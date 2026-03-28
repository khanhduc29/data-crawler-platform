"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function MegaMenu({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(1);
  const { user } = useAuth();

  return (
    <>
      <div className="mega-menu-overlay" onClick={onClose} />
      <div
        className="mega-menu"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("a")) onClose();
        }}
      >
        {page === 1 && (
          <>
            <div className="mega-menu-inner">
              {/* Google */}
              <div className="menu-col">
                <div className="menu-title">Google</div>
                <Link className="menu-item google" href="/tools/google-maps">
                  <span className="icon">G</span>
                  <span className="label">Google Maps</span>
                </Link>
              </div>

              {/* Instagram */}
              <div className="menu-col">
                <div className="menu-title">Instagram</div>
                <Link className="menu-item instagram" href="/tools/instagram">
                  <span className="icon">IG</span>
                  <span className="label">Quét chi tiết trang</span>
                </Link>
              </div>

              {/* TikTok */}
              <div className="menu-col">
                <div className="menu-title">TikTok</div>
                <Link className="menu-item tiktok" href="/tools/tiktok/top_posts">
                  <span className="icon">TT</span>
                  <span className="label">Quét video TOP</span>
                </Link>
                <Link className="menu-item tiktok" href="/tools/tiktok/accounts">
                  <span className="icon">TT</span>
                  <span className="label">Quét người dùng</span>
                </Link>
                <Link className="menu-item tiktok" href="/tools/tiktok/video_comments">
                  <span className="icon">TT</span>
                  <span className="label">Quét comment video</span>
                </Link>
                <Link className="menu-item tiktok" href="/tools/tiktok/friends">
                  <span className="icon">TT</span>
                  <span className="label">Quét bạn bè / follower</span>
                </Link>
              </div>

              {/* YouTube */}
              <div className="menu-col">
                <div className="menu-title">YouTube</div>
                <Link className="menu-item youtube" href="/tools/youtube/videos">
                  <span className="icon">YT</span>
                  <span className="label">Quét video</span>
                </Link>
                <Link className="menu-item youtube" href="/tools/youtube/channels">
                  <span className="icon">YT</span>
                  <span className="label">Quét channel</span>
                </Link>
                <Link className="menu-item youtube" href="/tools/youtube/video_comments">
                  <span className="icon">YT</span>
                  <span className="label">Quét comment video</span>
                </Link>
              </div>

              {/* Pinterest */}
              <div className="menu-col">
                <div className="menu-title">Pinterest</div>
                <Link className="menu-item pinterest" href="/tools/pinterest">
                  <span className="icon">P</span>
                  <span className="label">Quét theo keyword</span>
                </Link>
              </div>

              {/* Twitter */}
              <div className="menu-col">
                <div className="menu-title">X (Twitter)</div>
                <Link className="menu-item twitter" href="/tools/twitter/posts">
                  <span className="icon">X</span>
                  <span className="label">Quét bài viết</span>
                </Link>
                <Link className="menu-item twitter" href="/tools/twitter/users">
                  <span className="icon">X</span>
                  <span className="label">Quét người dùng</span>
                </Link>
                <Link className="menu-item twitter" href="/tools/twitter/replies">
                  <span className="icon">X</span>
                  <span className="label">Quét reply / comment</span>
                </Link>
              </div>
              {/* CH Play */}
              <div className="menu-col">
                <div className="menu-title">CH Play (Google Play)</div>
                <Link className="menu-item chplay" href="/tools/chplay">
                  <span className="icon">GP</span>
                  <span className="label">Tìm kiếm app</span>
                </Link>
                <Link className="menu-item chplay" href="/tools/chplay?tab=reviews">
                  <span className="icon">GP</span>
                  <span className="label">Cào reviews app</span>
                </Link>
              </div>

              {/* App Store */}
              <div className="menu-col">
                <div className="menu-title">App Store</div>
                <Link className="menu-item appstore" href="/tools/appstore">
                  <span className="icon">AS</span>
                  <span className="label">Tìm kiếm app</span>
                </Link>
                <Link className="menu-item appstore" href="/tools/appstore?tab=reviews">
                  <span className="icon">AS</span>
                  <span className="label">Cào reviews app</span>
                </Link>
              </div>
              
              {/* Settings (admin only) */}
              {user?.role === "admin" && (
              <div className="menu-col">
                <div className="menu-title">Cài đặt</div>
                <Link className="menu-item" href="/settings/accounts">
                  <span className="icon">🔐</span>
                  <span className="label">Quản lý tài khoản</span>
                </Link>
                <Link className="menu-item" href="/settings/workers">
                  <span className="icon">⚙</span>
                  <span className="label">Quản lý Workers</span>
                </Link>
                <Link className="menu-item" href="/settings/proxies">
                  <span className="icon">🌐</span>
                  <span className="label">Quản lý Proxy</span>
                </Link>
              </div>
              )}
            </div>
            
            <div className="mega-footer">
              <button onClick={() => setPage(2)}>→ Thêm tools</button>
            </div>
          </>
        )}

        {page === 2 && (
          <>
            <div className="mega-menu-inner">
              

            </div>
            <div className="mega-footer">
              <button onClick={() => setPage(1)}>← Quay lại</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
