"""
Captcha Detector — Phát hiện captcha TikTok

Khi detected captcha → return False để main.py đổi proxy & retry.
KHÔNG cố giải captcha (puzzle/slider không thể giải tự động đáng tin cậy).
"""

import os
from core.logger import setup_logger

logger = setup_logger()

# Selectors cho TikTok captcha — CHỈ dùng selector cụ thể
CAPTCHA_SELECTORS = [
    "#captcha-verify-container",
    ".captcha_verify_container",
    "#tiktok-verify-ele",
    ".verify-wrap",
    ".captcha-verify-wrap",
]


async def _is_element_real_visible(el) -> bool:
    """
    Kiểm tra element thật sự visible trên page (có kích thước đủ lớn).
    TikTok thường embed captcha containers ẩn với size 0x0 hoặc rất nhỏ.
    """
    try:
        if not await el.is_visible():
            return False
        box = await el.bounding_box()
        if not box:
            return False
        if box["height"] < 50 or box["width"] < 50:
            return False
        return True
    except Exception:
        return False


async def detect_captcha(page) -> bool:
    """Kiểm tra page có captcha hay không — chỉ detect khi thật sự có captcha dialog visible"""
    for selector in CAPTCHA_SELECTORS:
        try:
            el = page.locator(selector)
            if await el.count() > 0:
                if await _is_element_real_visible(el.first):
                    logger.info(f"🔒 CAPTCHA DETECTED (selector: {selector})")
                    return True
        except Exception:
            continue

    return False


async def handle_captcha_if_present(page) -> bool:
    """
    Detect captcha trên page.
    - Trả về True nếu KHÔNG có captcha → OK, tiếp tục crawl.
    - Trả về False nếu CÓ captcha → main.py sẽ đổi proxy & retry.
    """
    if not await detect_captcha(page):
        return True  # Không có captcha → OK

    logger.warning("🔒 CAPTCHA DETECTED — sẽ đổi proxy và thử lại")
    logger.info("💡 Tip: Dùng cookies từ F12 Network tab để giảm captcha")
    return False
