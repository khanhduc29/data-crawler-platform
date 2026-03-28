"use client";

import { authFetch } from "@/utils/authFetch";

import { useState, useEffect } from "react";

const API = "/api/proxy";

type Tab = "form" | "jobs" | "tasks" | "task-result";

// ===== EXPORT HELPERS =====
function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportToCSV(task: any) {
  const results = task.result || task.partial_result || [];
  const headers = ["Name","Rating","Total Reviews","Address","Phone","Website","Email","Facebook","Instagram","LinkedIn","Twitter","YouTube","TikTok","Maps URL"];
  const rows = results.map((item: any) => {
    const s = item.socials || {};
    return [
      `"${(item.name ?? "").replace(/"/g, '""')}"`, item.rating ?? "", item.totalReviews ?? "",
      `"${(item.address ?? "").replace(/"/g, '""')}"`, `"${item.phone ?? ""}"`, `"${item.website ?? ""}"`,
      `"${s.email ?? ""}"`, `"${s.facebook ?? ""}"`, `"${s.instagram ?? ""}"`,
      `"${s.linkedin ?? ""}"`, `"${s.twitter ?? ""}"`, `"${s.youtube ?? ""}"`,
      `"${s.tiktok ?? ""}"`, `"${item.url ?? ""}"`,
    ];
  });
  const csv = headers.join(",") + "\n" + rows.map((r: any) => r.join(",")).join("\n");
  downloadFile(csv, `crawl-${task.keyword}.csv`, "text/csv;charset=utf-8");
}

function exportToTXT(task: any) {
  const results = task.result || task.partial_result || [];
  const lines = results.map((item: any, index: number) => {
    const s = item.socials || {};
    return [
      `${index + 1}. ${item.name}`,
      `   Rating: ${item.rating ?? "-"} (${item.totalReviews ?? "-"})`,
      `   Address: ${item.address ?? "-"}`,
      `   Phone: ${item.phone ?? "-"}`,
      `   Website: ${item.website ?? "-"}`,
      `   Email: ${s.email ?? "-"} | FB: ${s.facebook ?? "-"} | IG: ${s.instagram ?? "-"}`,
      `   TikTok: ${s.tiktok ?? "-"} | YouTube: ${s.youtube ?? "-"} | Twitter: ${s.twitter ?? "-"}`,
      `   Maps: ${item.url ?? "-"}`,
      "-".repeat(50),
    ].join("\n");
  });
  downloadFile(lines.join("\n"), `crawl-${task.keyword}.txt`, "text/plain;charset=utf-8");
}

export default function GoogleMapsToolPage() {
  // ===== FORM STATE =====
  const [keyword, setKeyword] = useState("");
  const [address, setAddress] = useState("");
  const [limit, setLimit] = useState(100);
  const [delay, setDelay] = useState(3);
  const [region, setRegion] = useState("vn");
  const [deepScanWebsite, setDeepScanWebsite] = useState(true);
  const [deepScanReviews, setDeepScanReviews] = useState(false);
  const [reviewLimit, setReviewLimit] = useState(20);
  const [reviewFilterStars, setReviewFilterStars] = useState<number[]>([]);
  const [resumeFromLast, setResumeFromLast] = useState(false);
  const [progressInfo, setProgressInfo] = useState<Record<string, number>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // ===== UI STATE =====
  const [tab, setTab] = useState<Tab>("form");
  const [jobs, setJobs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  // ===== PAGINATION =====
  const [jobPage, setJobPage] = useState(1);
  const [taskPage, setTaskPage] = useState(1);
  const [resultPage, setResultPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ===== FILTERS =====
  const [jobSearch, setJobSearch] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("");

  // ===== API =====
  const fetchJobs = async () => {
    try {
      const res = await authFetch(`${API}/google-map/crawl-jobs`);
      const json = await res.json();
      setJobs(json.data || []);
    } catch { /* ignore */ }
  };

  const fetchTasks = async (jobId: string) => {
    try {
      const res = await authFetch(`${API}/google-map/crawl-tasks?jobId=${jobId}`);
      const json = await res.json();
      setTasks(json.data || []);
    } catch { /* ignore */ }
  };

  const fetchTaskDetail = async (taskId: string) => {
    try {
      const res = await authFetch(`${API}/google-map/crawl-tasks/${taskId}`);
      const json = await res.json();
      setSelectedTask(json.data);
      setResultPage(1);
      setTab("task-result");
    } catch { /* ignore */ }
  };

  const createJob = async () => {
    if (isCreating) return;
    if (!keyword.trim()) { setCreateError("Keyword là bắt buộc"); return; }
    if (!address.trim()) { setCreateError("Địa chỉ là bắt buộc"); return; }
    if (!limit || limit <= 0) { setCreateError("Số lượng phải > 0"); return; }

    try {
      setIsCreating(true);
      setCreateError("");

      const res = await authFetch(`${API}/google-map/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_keywords: keyword,
          address,
          region,
          result_limit: limit,
          delay_seconds: delay,
          deep_scan: false,
          deep_scan_website: deepScanWebsite,
          deep_scan_reviews: deepScanReviews,
          review_limit: deepScanReviews ? reviewLimit : 0,
          review_filter_stars: deepScanReviews ? reviewFilterStars : [],
          resume_from_last: resumeFromLast,
        }),
      });

      if (!res.ok) throw new Error(`Server lỗi (${res.status})`);
      setTab("jobs");
      setJobPage(1);
      fetchJobs();
    } catch (err: any) {
      setCreateError(err?.message || "Không thể tạo job");
    } finally {
      setIsCreating(false);
    }
  };

  // Auto-refresh jobs
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh tasks
  useEffect(() => {
    if (tab === "tasks" && selectedJobId) {
      const interval = setInterval(() => fetchTasks(selectedJobId), 5000);
      return () => clearInterval(interval);
    }
  }, [tab, selectedJobId]);

  const results = selectedTask?.result || selectedTask?.partial_result || [];

  // ===== PAGINATION HELPERS =====
  const paginate = (data: any[], page: number) => data.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = (data: any[]) => Math.max(1, Math.ceil(data.length / pageSize));

  const pagedJobs = paginate(jobs, jobPage);
  const pagedTasks = paginate(tasks, taskPage);
  const pagedResults = paginate(results, resultPage);

  const PaginationBar = ({ current, total, totalItems, onChange }: { current: number; total: number; totalItems: number; onChange: (p: number) => void }) => {
    if (totalItems <= 0) return null;
    const start = (current - 1) * pageSize + 1;
    const end = Math.min(current * pageSize, totalItems);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "#94A3B8" }}>
        <span>{start}–{end} / {totalItems}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); onChange(1); }} style={{
            background: "#1E293B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "3px 8px", color: "#CBD5E1", fontSize: 12,
          }}>
            {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}/trang</option>)}
          </select>
          <button disabled={current <= 1} onClick={() => onChange(current - 1)} style={{ background: current <= 1 ? "transparent" : "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, padding: "3px 10px", color: current <= 1 ? "#475569" : "#60a5fa", cursor: current <= 1 ? "default" : "pointer", fontSize: 12 }}>◀</button>
          {Array.from({ length: Math.min(total, 7) }).map((_, i) => {
            let p: number;
            if (total <= 7) p = i + 1;
            else if (current <= 4) p = i + 1;
            else if (current >= total - 3) p = total - 6 + i;
            else p = current - 3 + i;
            return (
              <button key={p} onClick={() => onChange(p)} style={{
                background: p === current ? "#3B82F6" : "transparent", color: p === current ? "white" : "#94A3B8",
                border: p === current ? "1px solid #3B82F6" : "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", minWidth: 32,
              }}>{p}</button>
            );
          })}
          <button disabled={current >= total} onClick={() => onChange(current + 1)} style={{ background: current >= total ? "transparent" : "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, padding: "3px 10px", color: current >= total ? "#475569" : "#60a5fa", cursor: current >= total ? "default" : "pointer", fontSize: 12 }}>▶</button>
        </div>
      </div>
    );
  };

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h1>🗺️ Google Maps Crawler</h1>
        <p>Cào địa điểm, số điện thoại, website theo khu vực từ Google Maps</p>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
        <button className={`tab-btn ${tab === "form" ? "active" : ""}`} onClick={() => setTab("form")}>📝 Tạo Job</button>
        <button className={`tab-btn ${tab === "jobs" ? "active" : ""}`} onClick={() => { setTab("jobs"); fetchJobs(); }}>📋 Jobs ({jobs.length})</button>
        {selectedJobId && <button className={`tab-btn ${tab === "tasks" ? "active" : ""}`} onClick={() => setTab("tasks")}>📦 Tasks</button>}
        {selectedTask && <button className={`tab-btn ${tab === "task-result" ? "active" : ""}`} onClick={() => setTab("task-result")}>📊 Kết quả</button>}
      </div>

      {/* ===== FORM TAB ===== */}
      {tab === "form" && (
        <div className="tool-form">
          <div className="form-group">
            <label>Keyword (mỗi dòng 1 keyword) <span style={{color:"#EF4444"}}>*</span></label>
            <textarea
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={"VD: mỹ phẩm\ntrang phục truyền thống"}
              rows={4}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div className="form-group">
            <label>Địa chỉ / Khu vực <span style={{color:"#EF4444"}}>*</span></label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="VD: Cầu Giấy, Hà Nội"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Số lượng kết quả <span style={{color:"#EF4444"}}>*</span></label>
              <input type="number" value={limit} min={1} onChange={(e) => setLimit(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Delay (giây)</label>
              <select value={delay} onChange={(e) => setDelay(Number(e.target.value))}>
                <option value={1}>1 giây</option>
                <option value={3}>3 giây</option>
                <option value={5}>5 giây</option>
                <option value={10}>10 giây</option>
              </select>
            </div>
            <div className="form-group">
              <label>Khu vực</label>
              <select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="vn">Việt Nam</option>
                <option value="global">Quốc tế</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Quét chi tiết website</label>
              <select value={String(deepScanWebsite)} onChange={(e) => setDeepScanWebsite(e.target.value === "true")}>
                <option value="true">Có</option>
                <option value="false">Không</option>
              </select>
            </div>
            <div className="form-group">
              <label>Quét đánh giá</label>
              <select value={String(deepScanReviews)} onChange={(e) => setDeepScanReviews(e.target.value === "true")}>
                <option value="true">Có</option>
                <option value="false">Không</option>
              </select>
            </div>
            {deepScanReviews && (
              <div className="form-group">
                <label>Số đánh giá / DN</label>
                <input type="number" value={reviewLimit} min={1} max={100} onChange={(e) => setReviewLimit(Number(e.target.value))} />
              </div>
            )}
          </div>

          {deepScanReviews && (
            <div className="form-group" style={{ marginTop: 4 }}>
              <label>Lọc theo số sao <span style={{ color: "#64748B", fontSize: 12, fontWeight: 400 }}>(bỏ trống = lấy tất cả)</span></label>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <label
                    key={star}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                      border: reviewFilterStars.includes(star)
                        ? "2px solid #FBBF24"
                        : "2px solid rgba(255,255,255,0.08)",
                      background: reviewFilterStars.includes(star)
                        ? "rgba(251,191,36,0.15)"
                        : "rgba(15,23,42,0.5)",
                      color: reviewFilterStars.includes(star)
                        ? "#FBBF24"
                        : "#94A3B8",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={reviewFilterStars.includes(star)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setReviewFilterStars([...reviewFilterStars, star].sort());
                        } else {
                          setReviewFilterStars(reviewFilterStars.filter((s) => s !== star));
                        }
                      }}
                      style={{ display: "none" }}
                    />
                    {"⭐".repeat(star)} {star}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Resume toggle */}
          <div style={{ marginTop: 8, padding: "12px 16px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: progressInfo && Object.keys(progressInfo).length > 0 && resumeFromLast ? 10 : 0 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, color: resumeFromLast ? "#818CF8" : "#94A3B8" }}>
                <input
                  type="checkbox"
                  checked={resumeFromLast}
                  onChange={async (e) => {
                    const checked = e.target.checked;
                    setResumeFromLast(checked);
                    if (checked && keyword.trim() && address.trim()) {
                      try {
                        const encoded = encodeURIComponent(keyword);
                        const encodedAddr = encodeURIComponent(address);
                        const res = await authFetch(`${API}/google-map/progress?keyword=${encoded}&address=${encodedAddr}`);
                        const json = await res.json();
                        if (json.success && json.data) {
                          const map: Record<string, number> = {};
                          json.data.forEach((p: any) => { map[p.keyword] = p.total_collected; });
                          setProgressInfo(map);
                        }
                      } catch { /* ignore */ }
                    } else {
                      setProgressInfo({});
                    }
                  }}
                  style={{ width: 16, height: 16, accentColor: "#818CF8" }}
                />
                ⏩ Quét tiếp từ lần cuối
              </label>
              <span style={{ fontSize: 12, color: "#64748B" }}>(bỏ qua kết quả đã quét trước)</span>
            </div>
            {resumeFromLast && Object.keys(progressInfo).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(progressInfo).map(([kw, count]) => (
                  <span key={kw} style={{
                    padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: "rgba(99,102,241,0.1)", color: "#A5B4FC", border: "1px solid rgba(99,102,241,0.2)",
                  }}>
                    &quot;{kw}&quot;: đã quét {count} → sẽ tiếp từ {count + 1}
                  </span>
                ))}
              </div>
            )}
            {resumeFromLast && Object.keys(progressInfo).length === 0 && keyword.trim() && (
              <div style={{ fontSize: 12, color: "#64748B" }}>Chưa có dữ liệu quét trước — sẽ quét từ đầu</div>
            )}
          </div>
          <button className="btn-submit" onClick={createJob} disabled={isCreating}>
            {isCreating ? "⏳ Đang tạo job..." : "🔍 Bắt đầu quét"}
          </button>

          {createError && (
            <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5", fontSize: 14 }}>
              <strong>❌ Lỗi:</strong> {createError}
              <button onClick={() => setCreateError("")} style={{ marginLeft: 12, background: "none", border: "none", color: "#fca5a5", cursor: "pointer", textDecoration: "underline" }}>Đóng</button>
            </div>
          )}
        </div>
      )}

      {/* ===== JOBS TAB ===== */}
      {tab === "jobs" && (
        <div className="results-section">
          <h2>Danh sách Job ({jobs.length})</h2>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input value={jobSearch} onChange={e => { setJobSearch(e.target.value); setJobPage(1); }}
              placeholder="🔍 Tìm theo keyword, địa chỉ..." style={{ flex: 1, minWidth: 180, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#F1F5F9", fontSize: 13, outline: "none" }} />
            <select value={jobStatusFilter} onChange={e => { setJobStatusFilter(e.target.value); setJobPage(1); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#CBD5E1", fontSize: 13 }}>
              <option value="">Tất cả trạng thái</option>
              <option value="success">✅ Success</option>
              <option value="error">❌ Error</option>
              <option value="processing">🔄 Processing</option>
              <option value="running">🔄 Running</option>
              <option value="pending">⏳ Pending</option>
            </select>
            {(jobSearch || jobStatusFilter) && (
              <button onClick={() => { setJobSearch(""); setJobStatusFilter(""); setJobPage(1); }}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#f87171", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                ✕ Xóa bộ lọc
              </button>
            )}
          </div>

          {(() => {
            const filteredJobs = jobs.filter(j => {
              if (jobStatusFilter && j.status !== jobStatusFilter) return false;
              if (jobSearch) {
                const s = jobSearch.toLowerCase();
                if (!(j.raw_keywords || "").toLowerCase().includes(s) && !(j.address || "").toLowerCase().includes(s)) return false;
              }
              return true;
            });
            const pJobs = paginate(filteredJobs, jobPage);
            return (
              <>
          <table className="result-table">
            <thead>
              <tr>
                <th>Keywords</th>
                <th>Limit</th>
                <th>Địa chỉ</th>
                <th>Deep Web</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pJobs.map((job: any) => (
                <tr key={job._id}>
                  <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={job.raw_keywords}>{job.raw_keywords}</td>
                  <td>{job.result_limit}</td>
                  <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.address}</td>
                  <td>{job.deep_scan_website ? "✔" : "✖"}</td>
                  <td>
                    <span style={{
                      padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: job.status === "success" ? "rgba(34,197,94,0.15)" : job.status === "error" ? "rgba(239,68,68,0.15)" : job.status === "processing" || job.status === "running" ? "rgba(59,130,246,0.15)" : "rgba(251,191,36,0.15)",
                      color: job.status === "success" ? "#4ade80" : job.status === "error" ? "#f87171" : job.status === "processing" || job.status === "running" ? "#60a5fa" : "#fbbf24",
                    }}>
                      {job.status === "success" ? "✅ Xong" : job.status === "error" ? "❌ Lỗi" : job.status === "processing" || job.status === "running" ? "🔄 Đang chạy" : "⏳ Chờ"}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => { setSelectedJobId(job._id); fetchTasks(job._id); setTaskPage(1); setTab("tasks"); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.1)", color: "#60a5fa", cursor: "pointer", fontSize: 12 }}>
                      Xem task
                    </button>
                  </td>
                </tr>
              ))}
              {filteredJobs.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#64748B" }}>Không tìm thấy kết quả</td></tr>
              )}
            </tbody>
          </table>
          <PaginationBar current={jobPage} total={totalPages(filteredJobs)} totalItems={filteredJobs.length} onChange={setJobPage} />
              </>
            );
          })()}
        </div>
      )}

      {/* ===== TASKS TAB ===== */}
      {tab === "tasks" && (
        <div className="results-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2>Tasks cho Job</h2>
            <button onClick={() => setTab("jobs")} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(148,163,184,0.3)", background: "transparent", color: "#94A3B8", cursor: "pointer", fontSize: 12 }}>
              ⬅ Quay lại Jobs
            </button>
          </div>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input value={taskSearch} onChange={e => { setTaskSearch(e.target.value); setTaskPage(1); }}
              placeholder="🔍 Tìm theo keyword..." style={{ flex: 1, minWidth: 180, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#F1F5F9", fontSize: 13, outline: "none" }} />
            <select value={taskStatusFilter} onChange={e => { setTaskStatusFilter(e.target.value); setTaskPage(1); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.6)", color: "#CBD5E1", fontSize: 13 }}>
              <option value="">Tất cả trạng thái</option>
              <option value="success">✅ Success</option>
              <option value="error">❌ Error</option>
              <option value="processing">🔄 Processing</option>
              <option value="pending">⏳ Pending</option>
            </select>
            {(taskSearch || taskStatusFilter) && (
              <button onClick={() => { setTaskSearch(""); setTaskStatusFilter(""); setTaskPage(1); }}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#f87171", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                ✕ Xóa bộ lọc
              </button>
            )}
          </div>

          {(() => {
            const filteredTasks = tasks.filter(t => {
              if (taskStatusFilter && t.status !== taskStatusFilter) return false;
              if (taskSearch) {
                const s = taskSearch.toLowerCase();
                if (!(t.keyword || "").toLowerCase().includes(s) && !(t._id || "").toLowerCase().includes(s)) return false;
              }
              return true;
            });
            const pTasks = paginate(filteredTasks, taskPage);
            return (
              <>
          <table className="result-table">
            <thead>
              <tr><th>ID</th><th>Keyword</th><th>Limit</th><th>Status</th><th>Kết quả</th><th></th></tr>
            </thead>
            <tbody>
              {pTasks.map((task: any) => (
                <tr key={task._id}>
                  <td>{task._id?.slice(0, 8)}</td>
                  <td>{task.keyword}</td>
                  <td>{task.result_limit}</td>
                  <td>
                    <span style={{
                      padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: task.status === "success" ? "rgba(34,197,94,0.15)" : task.status === "error" ? "rgba(239,68,68,0.15)" : task.status === "processing" ? "rgba(59,130,246,0.15)" : "rgba(251,191,36,0.15)",
                      color: task.status === "success" ? "#4ade80" : task.status === "error" ? "#f87171" : task.status === "processing" ? "#60a5fa" : "#fbbf24",
                    }}>
                      {task.status === "success" ? "✅ Xong" : task.status === "error" ? "❌ Lỗi" : task.status === "processing" ? "🔄 Đang chạy" : "⏳ Chờ"}
                    </span>
                  </td>
                  <td>{task.result?.length || task.partial_result?.length || "—"}</td>
                  <td>
                    {(task.status === "success" || task.partial_result?.length > 0) && (
                      <button onClick={() => fetchTaskDetail(task._id)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.1)", color: "#60a5fa", cursor: "pointer", fontSize: 12 }}>
                        👁 Xem
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#64748B" }}>Không tìm thấy kết quả</td></tr>
              )}
            </tbody>
          </table>
          <PaginationBar current={taskPage} total={totalPages(filteredTasks)} totalItems={filteredTasks.length} onChange={setTaskPage} />
              </>
            );
          })()}
        </div>
      )}

      {/* ===== TASK RESULT TAB ===== */}
      {tab === "task-result" && selectedTask && (
        <div className="results-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0 }}>Kết quả: {selectedTask.keyword} ({results.length})</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => exportToCSV(selectedTask)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                ⬇ Excel (CSV)
              </button>
              <button onClick={() => exportToTXT(selectedTask)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.1)", color: "#FBBF24", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                ⬇ TXT
              </button>
              <button onClick={() => setTab("tasks")} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(148,163,184,0.3)", background: "transparent", color: "#94A3B8", cursor: "pointer", fontSize: 12 }}>
                ⬅ Quay lại
              </button>
            </div>
          </div>
          <table className="result-table">
            <thead>
              <tr><th>#</th><th>Tên</th><th>SĐT</th><th>Website</th><th>Rating</th><th>Socials</th><th></th></tr>
            </thead>
            <tbody>
              {pagedResults.map((item: any, i: number) => (
                <tr key={i}>
                  <td>{(resultPage - 1) * pageSize + i + 1}</td>
                  <td style={{ fontWeight: 600, color: "#F1F5F9", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name || "—"}</td>
                  <td>{item.phone || "—"}</td>
                  <td style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.website ? <a href={item.website} target="_blank" style={{ color: "#3B82F6" }}>Link</a> : "—"}
                  </td>
                  <td>⭐ {item.rating ?? "—"}</td>
                  <td>
                    {item.socials && Object.keys(item.socials).filter(k => item.socials[k]).length > 0 ? (
                      <span style={{ color: "#4ade80", fontSize: 12 }}>
                        {Object.keys(item.socials).filter(k => item.socials[k]).join(", ")}
                      </span>
                    ) : "—"}
                  </td>
                  <td>
                    <button onClick={() => setSelectedRow(item)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer", fontSize: 12 }}>
                      👁 Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar current={resultPage} total={totalPages(results)} totalItems={results.length} onChange={setResultPage} />
        </div>
      )}

      {/* ===== DETAIL MODAL ===== */}
      {selectedRow && (
        <div onClick={() => setSelectedRow(null)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#1E293B", borderRadius: 16, padding: 28, maxWidth: 700, width: "90%",
            maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(148,163,184,0.15)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: "#F1F5F9" }}>{selectedRow.name}</h2>
              <button onClick={() => setSelectedRow(null)} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Info Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                ["⭐ Rating", `${selectedRow.rating ?? "—"} (${selectedRow.totalReviews ?? "—"} reviews)`],
                ["📍 Địa chỉ", selectedRow.address || "—"],
                ["📞 SĐT", selectedRow.phone || "—"],
                ["🌐 Website", selectedRow.website || "—"],
                ["🗺️ Google Maps", selectedRow.url ? "Link" : "—"],
              ].map(([label, value], idx) => (
                <div key={idx} style={{ padding: "8px 12px", background: "rgba(15,23,42,0.5)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: "#CBD5E1", wordBreak: "break-all" }}>
                    {label === "🌐 Website" && selectedRow.website ? (
                      <a href={selectedRow.website} target="_blank" style={{ color: "#3B82F6" }}>{selectedRow.website}</a>
                    ) : label === "🗺️ Google Maps" && selectedRow.url ? (
                      <a href={selectedRow.url} target="_blank" style={{ color: "#3B82F6" }}>Mở Google Maps</a>
                    ) : value}
                  </div>
                </div>
              ))}
            </div>

            {/* Socials */}
            {selectedRow.socials && Object.keys(selectedRow.socials).some(k => selectedRow.socials[k]) && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, color: "#A78BFA", marginBottom: 8 }}>🔗 Social Links</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(selectedRow.socials).filter(([, v]) => v).map(([key, url]: any) => (
                    <a key={key} href={url} target="_blank" style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: "rgba(139,92,246,0.15)", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.3)",
                      textDecoration: "none",
                    }}>
                      {key === "facebook" ? "📘" : key === "instagram" ? "📷" : key === "tiktok" ? "🎵" :
                       key === "youtube" ? "▶️" : key === "twitter" ? "🐦" : key === "linkedin" ? "💼" : "📧"} {key}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            {selectedRow.reviews && selectedRow.reviews.length > 0 && (
              <div>
                <h3 style={{ fontSize: 15, color: "#FBBF24", marginBottom: 8 }}>💬 Đánh giá ({selectedRow.reviews.length})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                  {selectedRow.reviews.map((rv: any, idx: number) => (
                    <div key={idx} style={{ padding: "10px 14px", background: "rgba(15,23,42,0.5)", borderRadius: 8, borderLeft: "3px solid #FBBF24" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "#E2E8F0" }}>{rv.reviewer}</span>
                        <span style={{ fontSize: 11, color: "#64748B" }}>{rv.date}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#FBBF24", marginBottom: 4 }}>{"⭐".repeat(rv.rating || 0)}</div>
                      {rv.text && <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.5 }}>{rv.text}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
