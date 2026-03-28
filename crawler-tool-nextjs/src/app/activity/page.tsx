"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/utils/authFetch";
import { useRouter } from "next/navigation";

const API = "/api/proxy";

const TOOL_OPTIONS = [
  { value: "", label: "Tất cả Tools" },
  { value: "google-map", label: "🗺️ Google Maps" },
  { value: "tiktok", label: "🎵 TikTok" },
  { value: "youtube", label: "▶️ YouTube" },
  { value: "instagram", label: "📸 Instagram" },
  { value: "pinterest", label: "📌 Pinterest" },
  { value: "twitter", label: "🐦 Twitter" },
  { value: "chplay", label: "🤖 CH Play" },
  { value: "appstore", label: "🍎 App Store" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả Status" },
  { value: "pending", label: "⏳ Pending" },
  { value: "processing", label: "⚙️ Processing" },
  { value: "running", label: "🔄 Running" },
  { value: "success", label: "✅ Success" },
  { value: "error", label: "❌ Error" },
];

const LIMIT_OPTIONS = [10, 20, 50];

const TOOL_ICONS: Record<string, string> = {
  "google-map": "🗺️",
  tiktok: "🎵",
  youtube: "▶️",
  instagram: "📸",
  pinterest: "📌",
  twitter: "🐦",
  chplay: "🤖",
  appstore: "🍎",
};

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: "rgba(234,179,8,0.15)", color: "#EAB308", label: "⏳ Pending" },
    processing: { bg: "rgba(59,130,246,0.15)", color: "#3B82F6", label: "⚙️ Processing" },
    running: { bg: "rgba(59,130,246,0.15)", color: "#3B82F6", label: "🔄 Running" },
    success: { bg: "rgba(34,197,94,0.15)", color: "#22C55E", label: "✅ Success" },
    error: { bg: "rgba(239,68,68,0.15)", color: "#EF4444", label: "❌ Error" },
  };
  const s = map[status] || { bg: "rgba(148,163,184,0.1)", color: "#94A3B8", label: status };
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

interface ActivityItem {
  _id: string;
  tool: string;
  label: string;
  status: string;
  error_message: string | null;
  scan_type: string | null;
  assigned_worker: string | null;
  retry_count: number;
  userId: string | null;
  user: { name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface DetailData {
  _id: string;
  tool: string;
  label: string;
  status: string;
  error_message?: string;
  error?: string;
  last_error?: string;
  scan_type?: string;
  assigned_worker?: string;
  retry_count?: number;
  max_retries?: number;
  input?: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  user?: { name: string; email: string } | null;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
  keyword?: string;
}

export default function ActivityPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Filters
  const [tool, setTool] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Data
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (tool) params.set("tool", tool);
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await authFetch(`${API}/activity?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setItems(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error("Failed to fetch activity:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, tool, status, search, from, to]);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchData();
  }, [user, fetchData, router]);

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 500);
  };

  const openDetail = async (item: ActivityItem) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await authFetch(`${API}/activity/${item.tool}/${item._id}`);
      const json = await res.json();
      if (json.success) {
        setDetailData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReset = async () => {
    if (!detailData) return;
    setResetting(true);
    try {
      const res = await authFetch(`${API}/activity/${detailData.tool}/${detailData._id}/reset`, {
        method: "PUT",
      });
      const json = await res.json();
      if (json.success) {
        // Update detail
        setDetailData((prev) => (prev ? { ...prev, status: "pending", error_message: undefined, last_error: undefined, error: undefined } : prev));
        // Refresh list
        fetchData();
      }
    } catch (err) {
      console.error("Failed to reset:", err);
    } finally {
      setResetting(false);
    }
  };

  const formatDate = (d: string | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Pagination range
  const getPageRange = () => {
    const range: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 16px" }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            margin: 0,
            background: "linear-gradient(135deg, #6366F1, #A78BFA)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          📋 Lịch sử hoạt động
        </h1>
        <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>
          Theo dõi tất cả các tác vụ cào dữ liệu trên hệ thống
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          padding: 16,
          borderRadius: 12,
          background: "rgba(30,41,59,0.8)",
          border: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 20,
          alignItems: "center",
        }}
      >
        {/* Tool select */}
        <select
          value={tool}
          onChange={(e) => {
            setTool(e.target.value);
            setPage(1);
          }}
          style={selectStyle}
        >
          {TOOL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Status select */}
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          style={selectStyle}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Date from */}
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          style={{ ...inputStyle, width: 150 }}
          placeholder="Từ ngày"
        />

        {/* Date to */}
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          style={{ ...inputStyle, width: 150 }}
          placeholder="Đến ngày"
        />

        {/* Search (debounce) */}
        <input
          type="text"
          placeholder="🔍 Tìm kiếm keyword..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
      </div>

      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          fontSize: 13,
          color: "#94A3B8",
        }}
      >
        <span>
          Hiển thị <b style={{ color: "#E2E8F0" }}>{items.length}</b> / {total} kết quả
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Hiển thị</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            style={{
              ...selectStyle,
              width: 65,
              padding: "4px 6px",
              fontSize: 12,
            }}
          >
            {LIMIT_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <span>/ trang</span>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(15,23,42,0.6)",
        }}
      >
        {loading ? (
          <div
            style={{
              padding: 60,
              textAlign: "center",
              color: "#64748B",
              fontSize: 14,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid rgba(99,102,241,0.2)",
                borderTop: "3px solid #6366F1",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            Đang tải dữ liệu...
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: 60,
              textAlign: "center",
              color: "#475569",
              fontSize: 14,
            }}
          >
            Không tìm thấy kết quả nào
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "rgba(30,41,59,0.9)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <th style={thStyle}>Tool</th>
                <th style={{ ...thStyle, textAlign: "left" }}>Nội dung</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Người dùng</th>
                <th style={thStyle}>Thời gian</th>
                <th style={thStyle}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={`${item.tool}-${item._id}`}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background:
                      idx % 2 === 0
                        ? "transparent"
                        : "rgba(255,255,255,0.015)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(99,102,241,0.06)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      idx % 2 === 0
                        ? "transparent"
                        : "rgba(255,255,255,0.015)")
                  }
                >
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 10px",
                        borderRadius: 8,
                        background: "rgba(99,102,241,0.08)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#A5B4FC",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {TOOL_ICONS[item.tool] || "🔧"} {item.tool}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 280 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#E2E8F0",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.label}
                    </div>
                    {item.scan_type && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748B",
                          marginTop: 2,
                        }}
                      >
                        {item.scan_type}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {statusBadge(item.status)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {item.user ? (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#CBD5E1",
                          fontWeight: 500,
                        }}
                      >
                        {item.user.name}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#475569" }}>—</span>
                    )}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "center",
                      fontSize: 12,
                      color: "#94A3B8",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(item.createdAt)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <button
                      onClick={() => openDetail(item)}
                      style={{
                        padding: "5px 14px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        border: "1px solid rgba(99,102,241,0.3)",
                        background: "rgba(99,102,241,0.08)",
                        color: "#A5B4FC",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(99,102,241,0.2)";
                        e.currentTarget.style.borderColor =
                          "rgba(99,102,241,0.5)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "rgba(99,102,241,0.08)";
                        e.currentTarget.style.borderColor =
                          "rgba(99,102,241,0.3)";
                      }}
                    >
                      👁 Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 4,
            marginTop: 20,
          }}
        >
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            style={pageBtnStyle(false)}
          >
            ◀
          </button>
          {getPageRange().map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={pageBtnStyle(p === page)}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={pageBtnStyle(false)}
          >
            ▶
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {detailOpen && (
        <div
          onClick={() => setDetailOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1E293B",
              borderRadius: 16,
              padding: 28,
              width: 600,
              maxWidth: "95vw",
              maxHeight: "85vh",
              overflowY: "auto",
              border: "1px solid rgba(148,163,184,0.15)",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  color: "#F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {detailData
                  ? `${TOOL_ICONS[detailData.tool] || "🔧"} Chi tiết Task`
                  : "Chi tiết Task"}
              </h2>
              <button
                onClick={() => setDetailOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94A3B8",
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>
                Đang tải...
              </div>
            ) : detailData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Info rows */}
                <DetailRow label="Tool" value={
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {TOOL_ICONS[detailData.tool] || "🔧"}{" "}
                    <span style={{ textTransform: "capitalize" }}>{detailData.tool}</span>
                  </span>
                } />
                <DetailRow label="Nội dung" value={detailData.label || detailData.keyword || "—"} />
                <DetailRow label="Status" value={statusBadge(detailData.status)} />
                {detailData.scan_type && <DetailRow label="Scan Type" value={detailData.scan_type} />}
                {detailData.user && (
                  <DetailRow label="Người dùng" value={`${detailData.user.name} (${detailData.user.email})`} />
                )}
                {detailData.assigned_worker && (
                  <DetailRow label="Worker" value={detailData.assigned_worker} />
                )}
                <DetailRow label="Retry" value={`${detailData.retry_count || 0} / ${detailData.max_retries || 3}`} />
                <DetailRow label="Tạo lúc" value={formatDate(detailData.created_at || detailData.createdAt)} />
                <DetailRow label="Cập nhật" value={formatDate(detailData.updated_at || detailData.updatedAt)} />

                {/* Error section */}
                {!!(detailData.error_message || detailData.error || detailData.last_error) && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 14,
                      borderRadius: 10,
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#F87171",
                        marginBottom: 8,
                      }}
                    >
                      ❌ Lỗi chi tiết
                    </div>
                    <pre
                      style={{
                        fontSize: 12,
                        color: "#FCA5A5",
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        lineHeight: 1.5,
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      {detailData.error_message || detailData.error || detailData.last_error}
                    </pre>
                  </div>
                )}

                {/* Input section */}
                {!!detailData.input && (
                  <div
                    style={{
                      marginTop: 4,
                      padding: 14,
                      borderRadius: 10,
                      background: "rgba(99,102,241,0.05)",
                      border: "1px solid rgba(99,102,241,0.15)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#A5B4FC",
                        marginBottom: 8,
                      }}
                    >
                      📥 Input
                    </div>
                    <pre
                      style={{
                        fontSize: 11,
                        color: "#CBD5E1",
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: 150,
                        overflowY: "auto",
                      }}
                    >
                      {JSON.stringify(detailData.input, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Result count */}
                {!!detailData.result && (
                  <div style={{ fontSize: 13, color: "#94A3B8" }}>
                    📊 Kết quả:{" "}
                    <b style={{ color: "#22C55E" }}>
                      {Array.isArray(detailData.result)
                        ? `${detailData.result.length} items`
                        : "Có dữ liệu"}
                    </b>
                  </div>
                )}

                {/* Retry button */}
                {(detailData.status === "error" || detailData.status === "processing" || detailData.status === "running") && (
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    style={{
                      marginTop: 8,
                      padding: "12px 24px",
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: resetting ? "not-allowed" : "pointer",
                      background: "linear-gradient(135deg, #F59E0B, #D97706)",
                      border: "none",
                      color: "#fff",
                      opacity: resetting ? 0.6 : 1,
                      transition: "all 0.2s",
                    }}
                  >
                    {resetting ? "⏳ Đang reset..." : "🔄 Retry — Đổi về Pending"}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>
                Không tìm thấy dữ liệu
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// === Sub-components ===
function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span
        style={{
          width: 100,
          flexShrink: 0,
          fontSize: 12,
          color: "#64748B",
          fontWeight: 600,
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: "#E2E8F0", flex: 1 }}>{value}</span>
    </div>
  );
}

// === Shared styles ===
const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 13,
  background: "#0F172A",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#E2E8F0",
  outline: "none",
  cursor: "pointer",
  minWidth: 140,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 13,
  background: "#0F172A",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#E2E8F0",
  outline: "none",
};

const searchBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
  border: "none",
  color: "#fff",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 700,
  color: "#94A3B8",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  textAlign: "center",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
};

function pageBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    border: active
      ? "1px solid rgba(99,102,241,0.5)"
      : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(99,102,241,0.2)" : "rgba(30,41,59,0.6)",
    color: active ? "#A5B4FC" : "#94A3B8",
    cursor: "pointer",
    transition: "all 0.15s",
  };
}
