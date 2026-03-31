import asyncio
import re
import json
import csv
import os
import random
from core.logger import setup_logger
from core.captcha_solver import detect_captcha

logger = setup_logger()
DATA_DIR = "data"


class CaptchaBlockedError(Exception):
    """Raised when captcha is detected — triggers proxy rotation + retry"""
    pass


# =========================
# UTILS
# =========================
def parse_number(text: str | None):
    if not text:
        return None

    text = text.strip().upper()

    try:
        if text.endswith("M"):
            return int(float(text[:-1]) * 1_000_000)
        if text.endswith("K"):
            return int(float(text[:-1]) * 1_000)
        return int(re.sub(r"[^\d]", "", text))
    except Exception:
        return None


def extract_video_id(url: str):
    if not url:
        return None
    m = re.search(r"/video/(\d+)", url)
    return m.group(1) if m else None


def save_to_json(filename, data):
    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    logger.info(f"💾 Saved JSON: {path}")


def save_to_csv(filename, data):
    if not data:
        return
    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)
    logger.info(f"📊 Saved CSV: {path}")


# =========================
# SCROLL – TIKTOK SEARCH VIDEO (FINAL)
# =========================
async def auto_scroll_video(page):
    """
    Scroll thật bằng chuột để TikTok trigger lazy load
    """

    # focus vào feed trước
    feed = page.locator("div[data-e2e='search_video-item-list']")
    if await feed.count() == 0:
        logger.warning("⚠️ Không tìm thấy feed")
        return

    await feed.first.hover()

    # đếm trước
    before = await page.locator("a[href*='/video/']").count()

    # scroll chuột nhiều lần
    for _ in range(8):
        await page.mouse.wheel(0, 1500)
        await page.wait_for_timeout(400)

    await page.wait_for_timeout(1500)

    after = await page.locator("a[href*='/video/']").count()

    logger.info(f"📈 Video before: {before} | after: {after}")

def normalize_tiktok_url(href: str | None):
    """
    Chuẩn hoá link video TikTok:
    - Nếu đã là absolute → dùng nguyên
    - Nếu là relative → prepend domain
    """
    if not href:
        return None

    href = href.strip()

    if href.startswith("http"):
        return href

    if href.startswith("/"):
        return f"https://www.tiktok.com{href}"

    return None
# =========================
# SEARCH → VIDEO LIST
# =========================
async def extract_top_videos(page, keyword, limit):
    url = f"https://www.tiktok.com/search/video?q={keyword}"
    logger.info(f"🌐 Open search video URL: {url}")

    await page.goto(url, timeout=60000, wait_until="domcontentloaded")

    # Chờ video links xuất hiện — tăng timeout và hỗ trợ hidden elements
    video_found = False

    # Lần 1: chờ visible (bình thường)
    try:
        await page.wait_for_selector("a[href*='/video/']", timeout=20000)
        video_found = True
        logger.info("✅ Video links found on page")
    except Exception:
        pass

    # Lần 2: nếu không visible, thử kiểm tra có attached nhưng bị ẩn (captcha overlay)
    if not video_found:
        try:
            count = await page.locator("a[href*='/video/']").count()
            if count > 0:
                logger.warning(f"⚠️ Found {count} video links but HIDDEN (likely captcha overlay)")
            else:
                logger.warning("⚠️ No video links found at all")
        except Exception:
            pass

        # Kiểm tra captcha
        logger.warning("🔒 Checking for captcha...")
        captcha_detected = await detect_captcha(page)

        if captcha_detected:
            # Chụp screenshot để debug
            try:
                await page.screenshot(path="debug_tiktok_search.png")
                logger.info("📸 Screenshot saved: debug_tiktok_search.png")
            except Exception:
                pass

            # Raise error cụ thể → main.py sẽ đổi proxy & retry
            raise CaptchaBlockedError(f"Captcha detected on search page for '{keyword}'")

        # Không có captcha nhưng vẫn không thấy video → thử reload
        logger.info("🔄 No captcha detected — trying page reload...")
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        try:
            await page.wait_for_selector("a[href*='/video/']", timeout=15000)
            video_found = True
            logger.info("✅ Video links found after reload!")
        except Exception:
            page_title = await page.title()
            try:
                await page.screenshot(path="debug_tiktok_search.png")
            except Exception:
                pass
            raise Exception(f"No video links found on TikTok search. Page title: '{page_title}'.")

    results = []
    seen = set()

    for round_idx in range(12):
        logger.info(f"🔄 Scroll search round {round_idx + 1}")

        cards = page.locator("a[href*='/video/']")
        count = await cards.count()

        for i in range(count):
            card = cards.nth(i)
            href = await card.get_attribute("href")
            if not href:
                continue

            video_id = extract_video_id(href)
            if not video_id or video_id in seen:
                continue

            seen.add(video_id)
            video_url = normalize_tiktok_url(href)

            # ===== thumbnail =====
            thumb = None
            img = card.locator("img[src*='tiktokcdn.com']")
            if await img.count() > 0:
                thumb = await img.first.get_attribute("src")

            # ===== view count =====
            view_count = None
            view_el = card.locator("strong[data-e2e='video-views']")
            if await view_el.count() > 0:
                view_count = parse_number(await view_el.first.inner_text())

            results.append({
                "video_id": video_id,
                "video_url": video_url,
                "thumbnail": thumb,
                "view_count": view_count,
            })

            logger.info(f"🎬 Found video: {video_id}")

            if len(results) >= limit:
                return results

        await auto_scroll_video(page)

    return results


# =========================
# VIDEO DETAIL
# =========================
async def crawl_video_detail(page, keyword, video_url):
    logger.info(f"🎥 Open video: {video_url}")

    await page.goto(video_url, timeout=60000, wait_until="domcontentloaded")
    await page.wait_for_timeout(2000)

    # ===== caption =====
    caption = None
    h1 = page.locator("h1")
    if await h1.count() > 0:
        caption = await h1.first.inner_text()

    # ===== stats =====
    async def get_stat(label):
        el = page.locator(f"strong[data-e2e='{label}']")
        if await el.count() > 0:
            text = await el.first.inner_text()
            return parse_number(text)
        return None

    view_count = await get_stat("view-count")
    like_count = await get_stat("like-count")
    comment_count = await get_stat("comment-count")
    share_count = await get_stat("share-count")

    # ===== author =====
    author_username = None
    author = page.locator("a[href^='/@']")
    if await author.count() > 0:
        href = await author.first.get_attribute("href")
        author_username = href.replace("/@", "").split("/")[0]

    return {
        "keyword": keyword,

        "video_url": video_url,
        "caption": caption,

        "author_username": author_username,
        "author_profile": (
            f"https://www.tiktok.com/@{author_username}"
            if author_username else None
        ),

        "view_count": view_count,
        "like_count": like_count,
        "comment_count": comment_count,
        "share_count": share_count,
    }

# =========================
# MAIN
# =========================

MAX_CONCURRENT_TABS = 3


async def _crawl_video_in_tab(context, semaphore, keyword, video, delay_range):
    """Crawl 1 video detail trong tab riêng (concurrent-safe)"""
    async with semaphore:
        tab = await context.new_page()
        try:
            detail = await asyncio.wait_for(
                crawl_video_detail(tab, keyword, video["video_url"]),
                timeout=30
            )
            video.update(detail)
            logger.info(f"✅ Video {video['video_id']} done")
            return video
        except asyncio.TimeoutError:
            logger.warning(f"⏰ Timeout video {video['video_id']} — skip")
            return None
        except Exception as e:
            logger.warning(f"❌ Skip video {video.get('video_id')} | {e}")
            return None
        finally:
            try:
                await tab.close()
            except Exception:
                pass
            await asyncio.sleep(random.randint(*delay_range) / 1000)


async def crawl_top_posts(
    page,
    keyword,
    sort_by="view",
    limit=50,

    delay_range=(1000, 3000),
    batch_size=5,
    batch_delay=2000,
    deep_scan=False,
    context=None,
    **kwargs,
):
    results = []

    videos = await extract_top_videos(page, keyword, limit)
    logger.info(f"📋 Tổng video lấy được: {len(videos)}")

    # ===== CONCURRENT DEEP SCAN (multi-tab) =====
    if deep_scan and context:
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_TABS)

        for i in range(0, len(videos), batch_size):
            batch = videos[i:i + batch_size]
            logger.info(f"🚀 Concurrent batch {i // batch_size + 1} — {len(batch)} videos")

            tasks = [
                _crawl_video_in_tab(context, semaphore, keyword, v, delay_range)
                for v in batch
            ]
            batch_results = await asyncio.gather(*tasks)

            for data in batch_results:
                if data:
                    results.append(data)

            if len(results) >= limit:
                break

            if i + batch_size < len(videos):
                logger.info("🧘 Batch pause...")
                await asyncio.sleep(batch_delay / 1000)

    # ===== SEQUENTIAL (no deep scan) =====
    else:
        for idx, video in enumerate(videos, 1):
            try:
                logger.info(f"🔄 Processing video {idx}/{len(videos)}")
                video.update({"keyword": keyword})
                results.append(video)
            except Exception as e:
                logger.warning(f"❌ Skip video {idx} | {e}")

            if len(results) >= limit:
                break

    # ===== sort (chỉ có ý nghĩa khi deep_scan) =====
    if deep_scan:
        sort_key = {
            "view": "view_count",
            "like": "like_count",
            "comment": "comment_count",
        }.get(sort_by)

        if sort_key:
            results.sort(
                key=lambda x: x.get(sort_key) or 0,
                reverse=True
            )

    logger.info(f"🏁 Hoàn thành – tổng video: {len(results)}")
    return results[:limit]