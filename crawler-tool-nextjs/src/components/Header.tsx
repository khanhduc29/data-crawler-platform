"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import MegaMenu from "./MegaMenu";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/utils/authFetch";

const API = "/api/proxy";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const { user, logout } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="header-logo">
            🛠 CrawlerTool
          </Link>

          <nav className="header-nav">
            {user ? (
              <>
                <button
                  className="nav-tools-btn"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  ⬡ Tools
                </button>
                <Link href="/">Trang chủ</Link>
                {user.role === "admin" && <Link href="/dashboard">📊 Dashboard</Link>}
                <Link href="/activity">📋 Lịch sử</Link>
                {user.role === "admin" && <Link href="/settings/accounts">Cài đặt</Link>}

                {/* Profile avatar button */}
                <div ref={dropdownRef} style={{ position: "relative" }}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "4px 12px 4px 4px", borderRadius: 24,
                      background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
                      cursor: "pointer", transition: "all 0.2s",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", display: "flex",
                      alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700,
                      background: user.role === "admin"
                        ? "linear-gradient(135deg, #F59E0B, #D97706)"
                        : "linear-gradient(135deg, #6366F1, #8B5CF6)",
                      color: "#fff",
                    }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, color: "#A5B4FC", fontWeight: 600 }}>
                      {user.name}
                    </span>
                    <span style={{ fontSize: 10, color: "#64748B" }}>▼</span>
                  </button>

                  {/* Dropdown */}
                  {profileOpen && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 8px)", right: 0,
                      width: 240, borderRadius: 12, overflow: "hidden",
                      background: "#1E293B", border: "1px solid rgba(255,255,255,0.08)",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.5)", zIndex: 100,
                    }}>
                      {/* User info */}
                      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>{user.name}</div>
                        <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{user.email}</div>
                        <span style={{
                          display: "inline-block", marginTop: 6, padding: "2px 8px", borderRadius: 10,
                          fontSize: 10, fontWeight: 700,
                          background: user.role === "admin" ? "rgba(245,158,11,0.15)" : "rgba(99,102,241,0.1)",
                          color: user.role === "admin" ? "#F59E0B" : "#A5B4FC",
                        }}>
                          {user.role === "admin" ? "👑 Admin" : "👤 User"}
                        </span>
                      </div>

                      {/* Menu items */}
                      <div style={{ padding: "6px 0" }}>
                        <button onClick={() => { setProfileOpen(false); setShowEditModal(true); }} style={{
                          width: "100%", padding: "10px 16px", background: "none", border: "none",
                          color: "#CBD5E1", fontSize: 13, cursor: "pointer", textAlign: "left",
                          display: "flex", alignItems: "center", gap: 8,
                        }}>
                          ✏️ Chỉnh sửa thông tin
                        </button>

                        {user.role === "admin" && (
                          <Link href="/settings/users" onClick={() => setProfileOpen(false)} style={{
                            display: "flex", alignItems: "center", gap: 8,
                            width: "100%", padding: "10px 16px", color: "#CBD5E1", fontSize: 13,
                            textDecoration: "none",
                          }}>
                            👥 Quản lý Users
                          </Link>
                        )}

                        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />

                        <button onClick={() => { setProfileOpen(false); logout(); }} style={{
                          width: "100%", padding: "10px 16px", background: "none", border: "none",
                          color: "#f87171", fontSize: 13, cursor: "pointer", textAlign: "left",
                          display: "flex", alignItems: "center", gap: 8,
                        }}>
                          🚪 Đăng xuất
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/">Trang chủ</Link>
                <Link href="/login" style={{
                  padding: "6px 16px", borderRadius: 8, fontWeight: 600, fontSize: 13,
                  background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                  color: "#fff",
                }}>
                  Đăng nhập
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {menuOpen && <MegaMenu onClose={() => setMenuOpen(false)} />}

      {/* === EDIT PROFILE MODAL === */}
      {showEditModal && user && <ProfileEditModal user={user} onClose={() => setShowEditModal(false)} />}
    </>
  );
}

// === Profile Edit Modal Component ===
function ProfileEditModal({ user, onClose }: { user: { _id: string; name: string; email: string; role: string }; onClose: () => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const { logout } = useAuth();

  const handleSave = async () => {
    setMessage("");

    if (newPassword && newPassword !== confirmPassword) {
      setMessage("Mật khẩu mới không khớp");
      setMessageType("error");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (name !== user.name) body.name = name;
      if (email !== user.email) body.email = email;
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      if (Object.keys(body).length === 0) {
        setMessage("Không có thay đổi nào");
        setMessageType("error");
        setSaving(false);
        return;
      }

      const res = await authFetch(`${API}/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.success) {
        setMessage("✅ Cập nhật thành công! Đang tải lại...");
        setMessageType("success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        // Reload to refresh user data
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMessage(json.message || "Cập nhật thất bại");
        setMessageType("error");
      }
    } catch {
      setMessage("Lỗi kết nối server");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#1E293B", borderRadius: 16, padding: 28, width: 440,
        border: "1px solid rgba(148,163,184,0.15)", maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#F1F5F9" }}>✏️ Chỉnh sửa thông tin</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        {/* Avatar preview */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", display: "inline-flex",
            alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700,
            background: user.role === "admin"
              ? "linear-gradient(135deg, #F59E0B, #D97706)"
              : "linear-gradient(135deg, #6366F1, #8B5CF6)",
            color: "#fff", marginBottom: 8,
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: "#64748B" }}>
            {user.role === "admin" ? "👑 Admin" : "👤 User"}
          </div>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Họ tên</label>
            <input value={name} onChange={e => setName(e.target.value)} style={{
              width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
              background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", outline: "none",
              boxSizing: "border-box",
            }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} style={{
              width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
              background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", outline: "none",
              boxSizing: "border-box",
            }} />
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: 11, color: "#475569" }}>Đổi mật khẩu</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Mật khẩu hiện tại</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Bắt buộc khi đổi MK" style={{
              width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
              background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", outline: "none",
              boxSizing: "border-box",
            }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Mật khẩu mới</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" style={{
              width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
              background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", outline: "none",
              boxSizing: "border-box",
            }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Xác nhận mật khẩu mới</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu mới" style={{
              width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
              background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", outline: "none",
              boxSizing: "border-box",
            }} />
          </div>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            marginTop: 14, padding: "10px 14px", borderRadius: 8, fontSize: 13,
            background: messageType === "success" ? "rgba(74,222,128,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${messageType === "success" ? "rgba(74,222,128,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: messageType === "success" ? "#4ADE80" : "#fca5a5",
          }}>
            {message}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: "transparent", border: "1px solid rgba(148,163,184,0.3)", color: "#94A3B8",
          }}>
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", border: "none", color: "#fff",
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? "⏳ Đang lưu..." : "💾 Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}
