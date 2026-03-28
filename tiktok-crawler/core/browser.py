import os
import json
from playwright.async_api import async_playwright
from core.anti_block import get_random_ua
from core.proxy_helper import fetch_random_proxy, get_playwright_proxy

API_BASE = os.environ.get("API_BASE_URL", "http://localhost:3000")


def fetch_tiktok_account():
    """
    Lấy 1 tài khoản TikTok active ngẫu nhiên từ backend.
    Returns dict { username, cookies, ... } hoặc None.
    """
    import requests
    try:
        url = f"{API_BASE}/api/accounts/platform/tiktok/random"
        res = requests.get(url, timeout=5)
        res.raise_for_status()
        data = res.json()

        if data.get("success") and data.get("data"):
            account = data["data"]
            has_cookies = bool(account.get("cookies"))
            print(f"[ACCOUNT] ✅ Got TikTok account: @{account.get('username', '?')} (cookies={'yes' if has_cookies else 'no'})", flush=True)
            return account
        else:
            print("[ACCOUNT] ⚠️ No active TikTok account — running without login", flush=True)
            return None

    except Exception as e:
        print(f"[ACCOUNT] ⚠️ Failed to fetch account: {e} — running without login", flush=True)
        return None


def parse_cookies_string(cookies_str):
    """
    Parse cookies từ nhiều format:
    1. JSON array: [{"name":"sid","value":"xxx","domain":".tiktok.com",...}]
    2. Playwright storage_state JSON: {"cookies":[...], "origins":[...]}
    3. Simple string: "name1=value1; name2=value2"
    Returns list of cookie dicts cho Playwright context.add_cookies()
    """
    if not cookies_str or not cookies_str.strip():
        return []

    cookies_str = cookies_str.strip()

    # Try JSON parse
    try:
        parsed = json.loads(cookies_str)

        # Format: Playwright storage_state {"cookies": [...]}
        if isinstance(parsed, dict) and "cookies" in parsed:
            cookies = parsed["cookies"]
            print(f"[COOKIES] Parsed storage_state format: {len(cookies)} cookies", flush=True)
            return cookies

        # Format: JSON array [{"name":"...", "value":"...", ...}]
        if isinstance(parsed, list):
            # Playwright format — ensure required fields
            result = []
            for c in parsed:
                cookie = {
                    "name": c.get("name", ""),
                    "value": c.get("value", ""),
                    "domain": c.get("domain", ".tiktok.com"),
                    "path": c.get("path", "/"),
                }
                if c.get("expires"):
                    cookie["expires"] = c["expires"]
                if c.get("httpOnly") is not None:
                    cookie["httpOnly"] = c["httpOnly"]
                if c.get("secure") is not None:
                    cookie["secure"] = c["secure"]
                if c.get("sameSite"):
                    cookie["sameSite"] = c["sameSite"]
                result.append(cookie)
            print(f"[COOKIES] Parsed JSON array: {len(result)} cookies", flush=True)
            return result

    except (json.JSONDecodeError, TypeError):
        pass

    # Format: simple string "name1=value1; name2=value2"
    cookies = []
    for pair in cookies_str.split(";"):
        pair = pair.strip()
        if "=" in pair:
            name, value = pair.split("=", 1)
            cookies.append({
                "name": name.strip(),
                "value": value.strip(),
                "domain": ".tiktok.com",
                "path": "/",
            })

    if cookies:
        print(f"[COOKIES] Parsed string format: {len(cookies)} cookies", flush=True)
    return cookies


async def create_browser(headless=True, session_file=None):
    playwright = await async_playwright().start()

    # 🌐 Fetch random proxy from backend
    proxy_data = fetch_random_proxy()
    proxy_config = get_playwright_proxy(proxy_data)

    launch_kwargs = {
        "headless": headless,
        "args": [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
        ],
    }
    if proxy_config:
        launch_kwargs["proxy"] = proxy_config

    browser = await playwright.chromium.launch(**launch_kwargs)

    # ===== TẠO CONTEXT =====
    random_ua = get_random_ua()
    print(f"[BROWSER] Using User-Agent: {random_ua[:60]}...", flush=True)
    context_kwargs = {
        "user_agent": random_ua,
        "viewport": {"width": 1280, "height": 800},
    }

    # 🔑 Lấy tài khoản TikTok từ backend
    account = fetch_tiktok_account()
    use_backend_cookies = False

    if account and account.get("cookies"):
        cookies = parse_cookies_string(account["cookies"])
        if cookies:
            # Nếu cookies là storage_state format → dùng storage_state trực tiếp
            try:
                parsed = json.loads(account["cookies"])
                if isinstance(parsed, dict) and "cookies" in parsed:
                    # Full Playwright storage_state → load trực tiếp
                    # Save to temp file for storage_state param
                    import tempfile
                    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8')
                    json.dump(parsed, tmp, ensure_ascii=False)
                    tmp.close()
                    context_kwargs["storage_state"] = tmp.name
                    use_backend_cookies = True
                    print(f"[ACCOUNT] 🔐 Using storage_state from backend account @{account.get('username')}", flush=True)
            except (json.JSONDecodeError, TypeError):
                pass

            if not use_backend_cookies:
                # Sẽ inject cookies SAU khi tạo context
                use_backend_cookies = True
                print(f"[ACCOUNT] 🍪 Will inject {len(cookies)} cookies from backend account @{account.get('username')}", flush=True)

    # Fallback: dùng local session file
    if not use_backend_cookies and session_file:
        import os as _os
        import time
        if _os.path.exists(session_file):
            try:
                file_age_days = (time.time() - _os.path.getmtime(session_file)) / 86400
                with open(session_file, "r", encoding="utf-8") as f:
                    session_data = json.load(f)

                cookie_count = len(session_data.get("cookies", []))
                print(f"[SESSION] Fallback to local file {session_file}: {cookie_count} cookies, age={file_age_days:.1f} days", flush=True)

                if file_age_days > 30:
                    print(f"[SESSION] WARNING: Session is {file_age_days:.0f} days old!", flush=True)

                if cookie_count > 0:
                    context_kwargs["storage_state"] = session_file

            except (json.JSONDecodeError, KeyError, OSError) as e:
                print(f"[SESSION] ERROR: Invalid session file: {e}", flush=True)
        else:
            print(f"[SESSION] No local session file — running without login", flush=True)

    context = await browser.new_context(**context_kwargs)

    # Inject cookies nếu dùng backend account (non-storage_state format)
    if use_backend_cookies and "storage_state" not in context_kwargs:
        cookies = parse_cookies_string(account["cookies"])
        if cookies:
            await context.add_cookies(cookies)
            print(f"[ACCOUNT] ✅ Injected {len(cookies)} cookies into browser context", flush=True)

    page = await context.new_page()

    return playwright, browser, context, page
