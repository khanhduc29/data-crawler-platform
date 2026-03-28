import { createGoogleMapJob } from "../services/googleMap.service.js";
import GoogleMapTask from "../models/GoogleMapTask.model.js";
import GoogleMapJobModel from "../models/GoogleMapJob.model.js";
import GoogleMapTaskModel from "../models/GoogleMapTask.model.js";
import CrawlProgress from "../models/CrawlProgress.model.js";
import { syncRequestStatus } from "../utils/syncRequestStatus.js";
import { incrementWorkerTaskCount } from "../utils/incrementWorkerTaskCount.js";
import { getUserFilter } from "../middleware/auth.middleware.js";

export async function createGoogleMapJobController(req, res) {
  try {
    console.log(`[GoogleMap] createJob body:`, {
      deep_scan_reviews: req.body.deep_scan_reviews,
      review_limit: req.body.review_limit,
      review_filter_stars: req.body.review_filter_stars,
    });
    const job = await createGoogleMapJob({ ...req.body, userId: req.user?.id });

    res.json({
      success: true,
      data: job,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}

export async function getPendingGoogleMapTask(req, res) {
  try {
    const { worker_id } = req.query;
    console.log(`[GoogleMap] getPendingTask called, worker_id=${worker_id || "none"}`);

    let task = null;

    // 1) Ưu tiên: task đã assign cho worker này
    if (worker_id) {
      task = await GoogleMapTask.findOneAndUpdate(
        { status: "pending", assigned_worker: worker_id },
        { status: "processing" },
        { sort: { created_at: 1 }, new: true }
      );
    }

    // 2) Fallback: task chưa assign (hoặc không có worker_id)
    if (!task) {
      task = await GoogleMapTask.findOneAndUpdate(
        { status: "pending", $or: [{ assigned_worker: { $exists: false } }, { assigned_worker: "" }, { assigned_worker: null }] },
        { status: "processing", ...(worker_id ? { assigned_worker: worker_id } : {}) },
        { sort: { created_at: 1 }, new: true }
      );
    }

    // 3) Last resort: task assign cho worker khác (offline/sai tool) → lấy luôn
    if (!task) {
      task = await GoogleMapTask.findOneAndUpdate(
        { status: "pending" },
        { status: "processing", ...(worker_id ? { assigned_worker: worker_id } : {}) },
        { sort: { created_at: 1 }, new: true }
      );
    }

    console.log(`[GoogleMap] Found task: ${task ? task._id : "none"}`);

    if (!task) {
      return res.json({
        success: true,
        data: null,
        message: "No pending Google Map task",
      });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function updateGoogleMapTask(req, res) {
  try {
    const { id } = req.params;
    const { status, result, error_message } = req.body;

    if (!["success", "error"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be success or error",
      });
    }

    // 🔄 Auto-retry: nếu error → kiểm tra retry_count trước
    if (status === "error") {
      const currentTask = await GoogleMapTask.findById(id);
      if (currentTask) {
        const retryCount = currentTask.retry_count || 0;
        const maxRetries = currentTask.max_retries || 3;

        if (retryCount < maxRetries) {
          const retryTask = await GoogleMapTask.findByIdAndUpdate(
            id,
            {
              status: "pending",
              assigned_worker: null,
              last_error: error_message || "Unknown error",
              retry_count: retryCount + 1,
              updated_at: new Date(),
            },
            { new: true }
          );
          console.log(`🔄 GoogleMap task ${id} auto-retry ${retryCount + 1}/${maxRetries} → pending`);

          if (currentTask.job_id) {
            await syncRequestStatus(GoogleMapTask, GoogleMapJobModel, "job_id", currentTask.job_id);
          }
          return res.json({ success: true, data: retryTask, retried: true });
        }
      }
    }

    const updateData = {
      status,
      updated_at: new Date(),
    };

    if (status === "success" && result) {
      // Loại trùng theo name + address
      const seen = new Set();
      const dedupResult = result.filter((place) => {
        const key = `${(place.name || "").toLowerCase()}_${(place.address || "").toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      updateData.result = dedupResult;
      updateData.partial_result = null; // Xóa partial sau khi có result cuối
    }

    if (status === "error") {
      updateData.error_message = error_message || "Unknown error";
      updateData.last_error = updateData.error_message;
    }

    const task = await GoogleMapTask.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Google Map task not found",
      });
    }

    // Increment worker tasks_completed or tasks_error
    if (task.assigned_worker) {
      if (status === "success") {
        await incrementWorkerTaskCount(task.assigned_worker);
      } else if (status === "error") {
        const { incrementWorkerErrorCount } = await import("../utils/incrementWorkerTaskCount.js");
        await incrementWorkerErrorCount(task.assigned_worker);
      }
    }

    // Sync parent job status
    if (task.job_id) {
      await syncRequestStatus(GoogleMapTask, GoogleMapJobModel, "job_id", task.job_id);
    }

    // 📊 Save crawl progress (for resume-from-last feature)
    if (status === "success" && task.result && Array.isArray(task.result)) {
      try {
        // Lấy userId từ parent job
        const job = await GoogleMapJobModel.findById(task.job_id).lean();
        if (job?.userId) {
          await CrawlProgress.findOneAndUpdate(
            {
              userId: job.userId,
              tool: "google-map",
              keyword: task.keyword,
              address: task.address || "",
            },
            {
              $inc: { total_collected: task.result.length },
              last_task_id: task._id,
            },
            { upsert: true, new: true }
          );
          console.log(`[Progress] google-map | "${task.keyword}" → +${task.result.length} collected`);
        }
      } catch (progressErr) {
        console.error(`[Progress] Error saving progress:`, progressErr.message);
      }
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Lưu kết quả tạm (partial) để không mất data khi crash
 */
export async function updatePartialGoogleMapTask(req, res) {
  try {
    const { id } = req.params;
    const { partial_result } = req.body;

    const task = await GoogleMapTask.findByIdAndUpdate(
      id,
      {
        partial_result,
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.json({
      success: true,
      data: { _id: task._id, partial_count: partial_result?.length || 0 },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function getGoogleMapJobs(req, res) {
  try {
    const jobs = await GoogleMapJobModel.find(getUserFilter(req))
      .sort({ created_at: -1 })
      .limit(100);

    res.json({
      success: true,
      data: jobs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function getGoogleMapTasks(req, res) {
  try {
    const { jobId } = req.query;

    const tasks = await GoogleMapTaskModel.find({ job_id: jobId })
      .sort({ created_at: 1 });

    res.json({
      success: true,
      data: tasks,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function getGoogleMapTaskDetail(req, res) {
  try {
    const { id } = req.params;

    const task = await GoogleMapTaskModel.findById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Reset các task bị stuck ở "processing" > 5 phút → pending
 */
export async function resetStuckTasks(req, res) {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const result = await GoogleMapTask.updateMany(
      {
        status: "processing",
        updated_at: { $lt: fiveMinAgo },
      },
      {
        status: "pending",
        updated_at: new Date(),
      }
    );

    // Cũng reset task processing mà không có updated_at
    const result2 = await GoogleMapTask.updateMany(
      {
        status: "processing",
        updated_at: { $exists: false },
      },
      {
        status: "pending",
        updated_at: new Date(),
      }
    );

    const totalReset = (result.modifiedCount || 0) + (result2.modifiedCount || 0);

    console.log(`🔄 Reset ${totalReset} stuck processing tasks → pending`);

    res.json({
      success: true,
      message: `Reset ${totalReset} stuck tasks`,
      data: { reset_count: totalReset },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * GET /api/google-map/progress?keyword=xxx&address=yyy
 * Lấy tiến trình quét cho keyword + address (dùng cho resume toggle)
 */
export async function getCrawlProgress(req, res) {
  try {
    const { keyword, address } = req.query;
    const userId = req.user?.id;

    if (!keyword) {
      return res.json({ success: true, data: [] });
    }

    // Tách keywords (giống service)
    const keywords = keyword.split("\n").map(k => k.trim()).filter(Boolean);

    const progressList = await CrawlProgress.find({
      userId,
      tool: "google-map",
      keyword: { $in: keywords },
      address: address || "",
    }).lean();

    res.json({
      success: true,
      data: progressList,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * DELETE /api/google-map/progress
 * Reset tiến trình quét cho keyword + address
 */
export async function resetCrawlProgress(req, res) {
  try {
    const { keyword, address } = req.body;
    const userId = req.user?.id;

    const result = await CrawlProgress.deleteMany({
      userId,
      tool: "google-map",
      ...(keyword ? { keyword } : {}),
      ...(address !== undefined ? { address } : {}),
    });

    res.json({
      success: true,
      message: `Đã reset ${result.deletedCount} progress records`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}