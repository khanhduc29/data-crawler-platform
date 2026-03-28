import TikTokTask from "../models/TikTokTask.model.js";
import PinterestTask from "../models/PinterestTask.model.js";
import InstagramTask from "../models/InstagramTask.model.js";
import YouTubeTask from "../models/YouTubeTask.model.js";
import TwitterTask from "../models/TwitterTask.model.js";
import GoogleMapTask from "../models/GoogleMapTask.model.js";
import ChplayTask from "../models/ChplayTask.model.js";
import AppstoreTask from "../models/AppstoreTask.model.js";

import TikTokRequest from "../models/TikTokRequest.model.js";
import PinterestRequest from "../models/PinterestRequest.model.js";
import InstagramRequest from "../models/InstagramRequest.model.js";
import YouTubeRequest from "../models/YouTubeRequest.model.js";
import TwitterRequest from "../models/TwitterRequest.model.js";
import GoogleMapJob from "../models/GoogleMapJob.model.js";

import User from "../models/User.model.js";

// tool name → { TaskModel, RequestModel, parentKey, searchFields }
const TOOL_CONFIG = {
  "google-map": {
    TaskModel: GoogleMapTask,
    RequestModel: GoogleMapJob,
    parentKey: "job_id",
    getLabel: (t) => t.keyword || "Google Map Task",
  },
  tiktok: {
    TaskModel: TikTokTask,
    RequestModel: TikTokRequest,
    parentKey: "request_id",
    getLabel: (t) => t.input?.keyword || t.input?.username || t.scan_type || "TikTok Task",
  },
  youtube: {
    TaskModel: YouTubeTask,
    RequestModel: YouTubeRequest,
    parentKey: "request_id",
    getLabel: (t) => t.input?.keyword || t.input?.channel_url || t.scan_type || "YouTube Task",
  },
  instagram: {
    TaskModel: InstagramTask,
    RequestModel: InstagramRequest,
    parentKey: "request_id",
    getLabel: (t) => t.input?.url || "Instagram Task",
  },
  pinterest: {
    TaskModel: PinterestTask,
    RequestModel: PinterestRequest,
    parentKey: "request_id",
    getLabel: (t) => t.input?.keyword || t.input?.board_url || "Pinterest Task",
  },
  twitter: {
    TaskModel: TwitterTask,
    RequestModel: TwitterRequest,
    parentKey: "request_id",
    getLabel: (t) => t.input?.keyword || t.input?.username || t.scan_type || "Twitter Task",
  },
  chplay: {
    TaskModel: ChplayTask,
    RequestModel: null, // userId is directly on task
    parentKey: null,
    getLabel: (t) => t.input?.keyword || t.input?.appId || t.scan_type || "CH Play Task",
  },
  appstore: {
    TaskModel: AppstoreTask,
    RequestModel: null, // userId is directly on task
    parentKey: null,
    getLabel: (t) => t.input?.keyword || t.input?.appId || t.scan_type || "App Store Task",
  },
};

/**
 * GET /api/activity
 * Query params: page, limit, tool, status, search, from, to
 */
export async function getActivityHistory(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      tool,
      status,
      search,
      from,
      to,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    // Determine which tools to query
    const toolsToQuery = tool && TOOL_CONFIG[tool]
      ? { [tool]: TOOL_CONFIG[tool] }
      : TOOL_CONFIG;

    // Build per-tool results with userId resolution
    const allResults = [];

    for (const [toolName, config] of Object.entries(toolsToQuery)) {
      const { TaskModel, RequestModel, parentKey, getLabel } = config;

      // Build query filter for tasks
      const filter = {};

      // Status filter — handle both "running" and "processing" variants
      if (status) {
        filter.status = status;
      }

      // Date range filter
      if (from || to) {
        const dateField = TaskModel.schema.path("created_at") ? "created_at" : "createdAt";
        filter[dateField] = {};
        if (from) filter[dateField].$gte = new Date(from);
        if (to) filter[dateField].$lte = new Date(to + "T23:59:59.999Z");
      }

      try {
        // Fetch tasks (exclude heavy result field for listing)
        const tasks = await TaskModel.find(filter)
          .select("-result -partial_result")
          .sort({ createdAt: -1, created_at: -1 })
          .lean();

        // Resolve userId from parent request/job
        let userMap = {};
        if (RequestModel && parentKey) {
          const parentIds = [...new Set(tasks.map(t => t[parentKey]?.toString()).filter(Boolean))];
          if (parentIds.length > 0) {
            const parents = await RequestModel.find({ _id: { $in: parentIds } })
              .select("userId")
              .lean();
            for (const p of parents) {
              if (p.userId) userMap[p._id.toString()] = p.userId.toString();
            }
          }
        }

        // Auth filter: non-admin users see only their tasks
        const isAdmin = req.user?.role === "admin";
        const currentUserId = req.user?.id;

        for (const task of tasks) {
          // Resolve userId
          let taskUserId = null;
          if (task.userId) {
            taskUserId = task.userId.toString();
          } else if (parentKey && task[parentKey]) {
            taskUserId = userMap[task[parentKey].toString()] || null;
          }

          // Auth check: non-admin can only see own tasks
          if (!isAdmin && currentUserId && taskUserId && taskUserId !== currentUserId) {
            continue;
          }

          const label = getLabel(task);

          // Search filter (keyword in label)
          if (search && !label.toLowerCase().includes(search.toLowerCase())) {
            continue;
          }

          allResults.push({
            _id: task._id,
            tool: toolName,
            label,
            status: task.status,
            error_message: task.error_message || task.error || task.last_error || null,
            scan_type: task.scan_type || null,
            assigned_worker: task.assigned_worker || null,
            retry_count: task.retry_count || 0,
            userId: taskUserId,
            createdAt: task.created_at || task.createdAt,
            updatedAt: task.updated_at || task.updatedAt,
          });
        }
      } catch (err) {
        console.error(`[Activity] Error querying ${toolName}:`, err.message);
      }
    }

    // Sort all results by createdAt desc
    allResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const total = allResults.length;
    const totalPages = Math.ceil(total / limitNum);
    const paginated = allResults.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Resolve user names for paginated results
    const userIds = [...new Set(paginated.map(r => r.userId).filter(Boolean))];
    const userNameMap = {};
    if (userIds.length > 0) {
      const users = await User.find({ _id: { $in: userIds } }).select("name email").lean();
      for (const u of users) {
        userNameMap[u._id.toString()] = { name: u.name, email: u.email };
      }
    }

    const data = paginated.map(r => ({
      ...r,
      user: r.userId ? userNameMap[r.userId] || null : null,
    }));

    res.json({
      success: true,
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    });
  } catch (err) {
    console.error("[Activity] getActivityHistory error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/activity/:tool/:id
 */
export async function getActivityDetail(req, res) {
  try {
    const { tool, id } = req.params;
    const config = TOOL_CONFIG[tool];

    if (!config) {
      return res.status(400).json({ success: false, message: `Unknown tool: ${tool}` });
    }

    const task = await config.TaskModel.findById(id).lean();

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    // Resolve user
    let user = null;
    let taskUserId = task.userId?.toString();
    if (!taskUserId && config.parentKey && task[config.parentKey]) {
      const parent = await config.RequestModel.findById(task[config.parentKey]).select("userId").lean();
      taskUserId = parent?.userId?.toString();
    }
    if (taskUserId) {
      user = await User.findById(taskUserId).select("name email").lean();
    }

    res.json({
      success: true,
      data: {
        ...task,
        tool,
        label: config.getLabel(task),
        user,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/activity/:tool/:id/reset
 * Reset task status to pending for retry
 */
export async function resetTaskStatus(req, res) {
  try {
    const { tool, id } = req.params;
    const config = TOOL_CONFIG[tool];

    if (!config) {
      return res.status(400).json({ success: false, message: `Unknown tool: ${tool}` });
    }

    const task = await config.TaskModel.findByIdAndUpdate(
      id,
      {
        status: "pending",
        assigned_worker: null,
        retry_count: 0,
        error_message: null,
        last_error: null,
      },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    console.log(`🔄 [Activity] Reset task ${tool}/${id} → pending`);

    res.json({
      success: true,
      data: task,
      message: "Task đã được reset về pending",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
