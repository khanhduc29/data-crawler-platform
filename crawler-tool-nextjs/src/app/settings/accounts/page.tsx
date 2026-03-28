"use client";

import { authFetch } from "@/utils/authFetch";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const API = "/api/proxy";

const PLATFORMS = [
  { key: "twitter", label: "X (Twitter)", icon: "🐦", color: "#1D9BF0" },
  { key: "tiktok", label: "TikTok", icon: "🎵", color: "#FF0050" },
  { key: "instagram", label: "Instagram", icon: "📸", color: "#E1306C" },
  { key: "youtube", label: "YouTube", icon: "▶️", color: "#FF0000" },
  { key: "pinterest", label: "Pinterest", icon: "📌", color: "#E60023" },
  { key: "facebook", label: "Facebook", icon: "📘", color: "#1877F2" },
];

const STATUS_OPTS = [
  { key: "active", label: "✅ Active", color: "#4ade80" },
  { key: "inactive", label: "⏸ Inactive", color: "#94A3B8" },
  { key: "banned", label: "🚫 Banned", color: "#f87171" },
  { key: "expired", label: "⏰ Expired", color: "#fbbf24" },
];

type Account = {
  _id: string;
  platform: string;
  username: string;
  password: string;
  email: string;
  phone: string;
  cookies: string;
  label: string;
  notes: string;
  status: string;
  createdAt: string;
};

const emptyForm = {
  platform: "twitter",
  username: "",
  password: "",
  email: "",
  phone: "",
  cookies: "",
  label: "",
  notes: "",
  status: "active",
};

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCookies, setShowCookies] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<Record<string, { valid: boolean; message: string } | null>>({});

  const flash = (text: string, type: "ok" | "err" = "ok") => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 4000);
  };

  const fetchAccounts = useCallback(async () => {
    try {
      const url = filter ? `${API}/accounts?platform=${filter}` : `${API}/accounts`;
      const res = await authFetch(url);
      const json = await res.json();
      if (json.success) setAccounts(json.data);
    } catch { /* ignore */ }
  }, [filter]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleSubmit = async () => {
    if (!form.username.trim()) { flash("Username là bắt buộc", "err"); return; }
    setLoading(true);
    try {
      const url = editId ? `${API}/accounts/${editId}` : `${API}/accounts`;
      const method = editId ? "PATCH" : "POST";
      const body = { ...form };
      // Don't send masked values
      if (body.password === "••••••••") delete (body as any).password;
      if (body.cookies === "••••set••••") delete (body as any).cookies;

      const res = await authFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        flash(editId ? "✅ Cập nhật thành công!" : "✅ Thêm tài khoản thành công!");
        setForm({ ...emptyForm }); setEditId(null); setShowForm(false);
        fetchAccounts();
      } else {
        flash(`❌ ${json.message}`, "err");
      }
    } catch (err: any) {
      flash(`❌ ${err?.message}`, "err");
    } finally { setLoading(false); }
  };

  const handleEdit = (acc: Account) => {
    setForm({
      platform: acc.platform,
      username: acc.username,
      password: acc.password,
      email: acc.email || "",
      phone: acc.phone || "",
      cookies: acc.cookies || "",
      label: acc.label || "",
      notes: acc.notes || "",
      status: acc.status || "active",
    });
    setEditId(acc._id); setShowForm(true); setShowCookies(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa tài khoản này?")) return;
    try {
      const res = await authFetch(`${API}/accounts/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) { flash("🗑 Đã xóa!"); fetchAccounts(); }
    } catch { flash("❌ Lỗi xóa", "err"); }
  };

  const handleCheck = async (id: string) => {
    setCheckingId(id);
    setCheckResult((prev) => ({ ...prev, [id]: null }));
    try {
      const res = await authFetch(`${API}/accounts/${id}/check`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setCheckResult((prev) => ({ ...prev, [id]: { valid: json.valid, message: json.message } }));
        if (json.valid) {
          flash(`✅ @${json.username}: ${json.message}`);
        } else {
          flash(`⚠️ @${json.username}: ${json.message}`, "err");
          fetchAccounts(); // refresh to show updated status
        }
      } else {
        flash(`❌ ${json.message}`, "err");
      }
    } catch (err: any) {
      flash(`❌ Check failed: ${err?.message}`, "err");
    } finally {
      setCheckingId(null);
    }
  };

  const handleCancel = () => {
    setForm({ ...emptyForm }); setEditId(null); setShowForm(false); setShowCookies(false);
  };

  const plat = (key: string) => PLATFORMS.find(p => p.key === key) || PLATFORMS[0];

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h1>🔐 Quản lý tài khoản</h1>
        <p>Thêm, sửa, xóa tài khoản & cookie cho các nền tảng crawler</p>
      </div>

      {/* Settings tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(15,23,42,0.5)", padding: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
        {[
          { href: "/settings/accounts", label: "🔐 Tài khoản", active: true },
          { href: "/settings/proxies", label: "🌐 Proxy" },
          { href: "/settings/workers", label: "🤖 Workers" },
          ...(user?.role === "admin" ? [{ href: "/settings/users", label: "👥 Users" }] : []),
        ].map((tab) => (
          <Link key={tab.href} href={tab.href} style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
            color: tab.active ? "#fff" : "#94A3B8",
            background: tab.active ? "linear-gradient(135deg, #6366F1, #8B5CF6)" : "transparent",
            transition: "all 0.2s",
          }}>{tab.label}</Link>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div style={{
          padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600,
          background: msgType === "ok" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          color: msgType === "ok" ? "#4ade80" : "#f87171",
          border: `1px solid ${msgType === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
        }}>{msg}</div>
      )}

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#94A3B8" }}>Lọc:</span>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ background: "#1E293B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", color: "#CBD5E1", fontSize: 13 }}>
            <option value="">Tất cả</option>
            {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
          </select>
          <span style={{ fontSize: 13, color: "#64748B" }}>{accounts.length} tài khoản</span>
        </div>
        <button onClick={() => { handleCancel(); setShowForm(true); }} style={{
          padding: "8px 20px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
          background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "#fff",
        }}>+ Thêm tài khoản</button>
      </div>

      {/* ===== ADD/EDIT FORM ===== */}
      {showForm && (
        <div className="tool-form" style={{ marginBottom: 20, border: "1px solid rgba(139,92,246,0.3)", borderRadius: 12 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "#A78BFA" }}>{editId ? "✏️ Sửa tài khoản" : "➕ Thêm tài khoản mới"}</h3>

          {/* Platform + Status */}
          <div className="form-row">
            <div className="form-group">
              <label>Nền tảng <span style={{ color: "#EF4444" }}>*</span></label>
              <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
                {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Trạng thái</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Nhãn</label>
              <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="VD: Bot chính, Tài khoản phụ" />
            </div>
          </div>

          {/* Username + Email */}
          <div className="form-row">
            <div className="form-group">
              <label>Username <span style={{ color: "#EF4444" }}>*</span></label>
              <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="@username" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
            </div>
          </div>

          {/* Password + Phone */}
          <div className="form-row">
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label>Số điện thoại</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+84..." />
            </div>
          </div>

          {/* Cookies */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600 }}>🍪 Cookie / Session</label>
              <button onClick={() => setShowCookies(!showCookies)} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.1)", color: "#A78BFA", cursor: "pointer" }}>
                {showCookies ? "Ẩn" : "Hiện"}
              </button>
            </div>
            {showCookies && (
              <textarea
                value={form.cookies}
                onChange={e => setForm({ ...form, cookies: e.target.value })}
                placeholder={"Paste cookie string từ DevTools Console:\n  document.cookie\nHoặc auth_token riêng cho Twitter"}
                rows={4}
                style={{
                  width: "100%", padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(15,23,42,0.5)", color: "#CBD5E1", fontSize: 13, fontFamily: "monospace",
                  resize: "vertical",
                }}
              />
            )}
            {!showCookies && form.cookies && form.cookies !== "••••set••••" && (
              <span style={{ fontSize: 12, color: "#4ade80" }}>✅ Cookie đã được set ({form.cookies.length} ký tự)</span>
            )}
            {!showCookies && form.cookies === "••••set••••" && (
              <span style={{ fontSize: 12, color: "#94A3B8" }}>🔒 Cookie đã lưu (ẩn vì bảo mật)</span>
            )}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label>Ghi chú</label>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="VD: Dùng cho quét users" />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={handleSubmit} disabled={loading} className="btn-submit" style={{ flex: 1 }}>
              {loading ? "⏳ Đang lưu..." : editId ? "💾 Cập nhật" : "💾 Thêm"}
            </button>
            <button onClick={handleCancel} style={{
              padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent", color: "#94A3B8", cursor: "pointer", fontSize: 14,
            }}>Hủy</button>
          </div>
        </div>
      )}

      {/* ===== ACCOUNTS TABLE ===== */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
          <thead>
            <tr style={{ fontSize: 12, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Nền tảng</th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Username</th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Email</th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>Password</th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>Cookie</th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>Trạng thái</th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Nhãn</th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#64748B" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
                Chưa có tài khoản nào. Bấm &quot;Thêm tài khoản&quot; để bắt đầu.
              </td></tr>
            )}
            {accounts.map(acc => {
              const p = plat(acc.platform);
              const st = STATUS_OPTS.find(s => s.key === acc.status) || STATUS_OPTS[0];
              return (
                <tr key={acc._id} style={{
                  background: "rgba(15,23,42,0.5)", borderRadius: 8,
                  transition: "background 0.2s",
                }}>
                  {/* Platform */}
                  <td style={{ padding: "10px 12px", borderRadius: "8px 0 0 8px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "4px 10px", borderRadius: 16, fontSize: 13, fontWeight: 600,
                      background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}30`,
                    }}>
                      {p.icon} {p.label}
                    </span>
                  </td>
                  {/* Username */}
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#F1F5F9", fontSize: 14 }}>{acc.username}</td>
                  {/* Email */}
                  <td style={{ padding: "10px 12px", color: "#94A3B8", fontSize: 13 }}>{acc.email || "—"}</td>
                  {/* Password */}
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {acc.password ? (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}>✅ Set</span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#475569" }}>—</span>
                    )}
                  </td>
                  {/* Cookie */}
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {acc.cookies ? (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(139,92,246,0.15)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.2)" }}>🍪 Set</span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#475569" }}>—</span>
                    )}
                  </td>
                  {/* Status */}
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span style={{
                      fontSize: 11, padding: "3px 10px", borderRadius: 12, fontWeight: 600,
                      background: `${st.color}15`, color: st.color, border: `1px solid ${st.color}30`,
                    }}>{st.label}</span>
                  </td>
                  {/* Label */}
                  <td style={{ padding: "10px 12px", color: "#94A3B8", fontSize: 13 }}>{acc.label || "—"}</td>
                  {/* Actions */}
                  <td style={{ padding: "10px 12px", textAlign: "center", borderRadius: "0 8px 8px 0" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                      {acc.cookies && (
                        <button
                          onClick={() => handleCheck(acc._id)}
                          disabled={checkingId === acc._id}
                          style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                            border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", color: "#4ade80",
                            opacity: checkingId === acc._id ? 0.6 : 1,
                          }}
                        >
                          {checkingId === acc._id ? "⏳..." : "🔍 Check"}
                        </button>
                      )}
                      <button onClick={() => handleEdit(acc)} style={{
                        padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                        border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.1)", color: "#60A5FA",
                      }}>✏️ Sửa</button>
                      <button onClick={() => handleDelete(acc._id)} style={{
                        padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                        border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#f87171",
                      }}>🗑</button>
                    </div>
                    {checkResult[acc._id] && (
                      <div style={{
                        marginTop: 4, fontSize: 11, fontWeight: 600,
                        color: checkResult[acc._id]?.valid ? "#4ade80" : "#fbbf24",
                      }}>
                        {checkResult[acc._id]?.valid ? "✅" : "⚠️"} {checkResult[acc._id]?.message}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hướng dẫn cookie */}
      <div style={{
        marginTop: 24, borderRadius: 12,
        background: "rgba(15,23,42,0.5)", border: "1px solid rgba(139,92,246,0.15)",
        overflow: "hidden",
      }}>
        <button
          onClick={() => setShowGuide(!showGuide)}
          style={{
            width: "100%", textAlign: "left", padding: "14px 20px",
            background: "none", border: "none", cursor: "pointer",
            color: "#A78BFA", fontSize: 15, fontWeight: 700,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <span>📖 Hướng dẫn lấy Cookie / Session cho Crawler</span>
          <span style={{ fontSize: 12, color: "#64748B" }}>{showGuide ? "▲ Ẩn" : "▼ Xem"}</span>
        </button>

        {showGuide && (
          <div style={{ padding: "0 20px 20px", color: "#94A3B8", fontSize: 13, lineHeight: 1.9 }}>

            {/* Cách 1: TikTok — login_debug.py */}
            <div style={{ marginBottom: 20, padding: 16, borderRadius: 10, background: "rgba(255,0,80,0.06)", border: "1px solid rgba(255,0,80,0.15)" }}>
              <h4 style={{ margin: "0 0 10px", color: "#FF0050", fontSize: 14 }}>🎵 TikTok — Cách 1: Dùng login_debug.py (Khuyên dùng)</h4>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li>Mở terminal, vào thư mục <strong>tiktok-crawler</strong></li>
                <li>Chạy: <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 8px", borderRadius: 4, color: "#E2E8F0" }}>python login_debug.py</code></li>
                <li>Trình duyệt mở ra → <strong>Đăng nhập TikTok thủ công</strong></li>
                <li>Sau khi đăng nhập xong → quay lại terminal → <strong>bấm Enter</strong></li>
                <li>File <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 8px", borderRadius: 4, color: "#E2E8F0" }}>tiktok_session.json</code> được tạo ra</li>
                <li>Mở file đó → <strong>Copy toàn bộ nội dung</strong> → Paste vào trường Cookie ở đây</li>
              </ol>
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", fontSize: 12, fontWeight: 600 }}>
                💡 Đây là cách tốt nhất vì export đầy đủ cookies + localStorage, session sống lâu nhất
              </div>
            </div>

            {/* Cách 2: DevTools */}
            <div style={{ marginBottom: 20, padding: 16, borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <h4 style={{ margin: "0 0 10px", color: "#818CF8", fontSize: 14 }}>🔧 Cách 2: Export từ Chrome DevTools (mọi nền tảng)</h4>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li>Mở Chrome → đăng nhập vào nền tảng (tiktok.com, x.com, ...)</li>
                <li>Nhấn <strong>F12</strong> → DevTools → tab <strong>Console</strong></li>
                <li>Gõ: <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 8px", borderRadius: 4, color: "#E2E8F0" }}>document.cookie</code> → Enter</li>
                <li><strong>Copy kết quả</strong> → Paste vào trường Cookie ở đây</li>
              </ol>
              <div style={{ marginTop: 10, fontSize: 12, color: "#64748B" }}>
                ⚠️ Cách này chỉ lấy được cookies, không có localStorage → session có thể ngắn hơn
              </div>
            </div>

            {/* Cách 3: Extension */}
            <div style={{ padding: 16, borderRadius: 10, background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.15)" }}>
              <h4 style={{ margin: "0 0 10px", color: "#EAB308", fontSize: 14 }}>🧩 Cách 3: Dùng Extension &quot;EditThisCookie&quot; hoặc &quot;Cookie Editor&quot;</h4>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li>Cài extension <strong>Cookie Editor</strong> từ Chrome Web Store</li>
                <li>Đăng nhập nền tảng → click icon extension</li>
                <li>Bấm <strong>Export</strong> (JSON) → Copy</li>
                <li>Paste vào trường Cookie ở đây</li>
              </ol>
              <div style={{ marginTop: 10, fontSize: 12, color: "#64748B" }}>
                ✅ Hỗ trợ export JSON array — tương thích tốt với hệ thống
              </div>
            </div>

            {/* Check guide */}
            <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <strong style={{ color: "#4ade80" }}>🔍 Kiểm tra cookies:</strong>{" "}
              <span>Sau khi thêm tài khoản, bấm nút <strong>&quot;🔍 Check&quot;</strong> để kiểm tra cookies còn hợp lệ không. Nếu hết hạn, hệ thống sẽ tự chuyển trạng thái sang &quot;Expired&quot;.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
