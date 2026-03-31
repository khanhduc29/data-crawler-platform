import SocialAccount from "../models/SocialAccount.model.js";
import { getUserFilter } from "../middleware/auth.middleware.js";

/**
 * GET all accounts (optionally filter by platform)
 * /api/accounts?platform=twitter
 */
export async function getAllAccounts(req, res) {
  try {
    const { platform } = req.query;
    const query = { ...getUserFilter(req) };
    if (platform) query.platform = platform;

    const accounts = await SocialAccount.find(query)
      .sort({ platform: 1, createdAt: -1 })
      .lean();

    // Mask password in response
    const masked = accounts.map((a) => ({
      ...a,
      password: a.password ? "••••••••" : "",
      cookies: a.cookies ? "••••set••••" : "",
    }));

    res.json({ success: true, data: masked });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST create account
 */
export async function createAccount(req, res) {
  try {
    const { platform, username, password, email, phone, label, notes, cookies } = req.body;

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: "platform is required",
      });
    }

    if (!username && !cookies) {
      return res.status(400).json({
        success: false,
        message: "username or cookies is required",
      });
    }

    // Auto-generate username from cookies if not provided
    let finalUsername = username || "";
    if (!finalUsername && cookies) {
      // Try to extract username from cookie string
      const uidMatch = cookies.match(/living_user_id=(\d+)/);
      if (uidMatch) {
        finalUsername = `tiktok_${uidMatch[1]}`;
      } else {
        finalUsername = `cookie_user_${Date.now()}`;
      }
      console.log(`[Account] Auto-generated username: ${finalUsername}`);
    }

    const account = await SocialAccount.create({
      platform,
      username: finalUsername,
      password: password || "",
      email: email || "",
      phone: phone || "",
      label: label || "",
      notes: notes || "",
      cookies: cookies || "",
      userId: req.user?.id,
    });

    res.json({ success: true, data: { ...account.toObject(), password: "••••••••", cookies: cookies ? "••••set••••" : "" } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: `Account @${req.body.username} on ${req.body.platform} already exists`,
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PATCH update account
 */
export async function updateAccount(req, res) {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData._id;

    const account = await SocialAccount.findByIdAndUpdate(id, updateData, { new: true }).lean();

    if (!account) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    res.json({ success: true, data: { ...account, password: "••••••••" } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE account
 */
export async function deleteAccount(req, res) {
  try {
    const { id } = req.params;
    const account = await SocialAccount.findByIdAndDelete(id);

    if (!account) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET account by ID (with real password — for worker only)
 */
export async function getAccountById(req, res) {
  try {
    const { id } = req.params;
    const account = await SocialAccount.findById(id).lean();

    if (!account) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    res.json({ success: true, data: account });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/accounts/platform/:platform/random
 * Lấy 1 account active ngẫu nhiên theo platform (cho worker/crawler gọi)
 * Trả về đầy đủ cookies + password (KHÔNG mask)
 */
export async function getRandomAccountByPlatform(req, res) {
  try {
    const { platform } = req.params;

    const count = await SocialAccount.countDocuments({ platform, status: "active" });

    if (count === 0) {
      return res.json({
        success: true,
        data: null,
        message: `No active ${platform} account`,
      });
    }

    const random = Math.floor(Math.random() * count);
    const account = await SocialAccount.findOne({ platform, status: "active" })
      .skip(random)
      .lean();

    console.log(`[Account] 🎯 Random ${platform} account: @${account?.username}`);

    res.json({ success: true, data: account });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/accounts/:id/check
 * Kiểm tra cookies còn hợp lệ không
 * Hiện hỗ trợ TikTok (gọi API TikTok để verify session)
 */
export async function checkAccountCookies(req, res) {
  try {
    const { id } = req.params;
    const account = await SocialAccount.findById(id);

    if (!account) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    if (!account.cookies) {
      return res.json({
        success: true,
        valid: false,
        message: "Không có cookies",
      });
    }

    const platform = account.platform;
    let valid = false;
    let detail = "";

    if (platform === "tiktok") {
      // Parse cookies + detect format
      let cookieHeader = "";
      let cookieFormat = "raw"; // "raw" | "json_array" | "storage_state"
      const rawCookies = account.cookies.trim();

      try {
        const parsed = JSON.parse(rawCookies);
        if (Array.isArray(parsed)) {
          cookieHeader = parsed.map(c => `${c.name}=${c.value}`).join("; ");
          cookieFormat = "json_array";
          console.log(`[Check] Parsed JSON array: ${parsed.length} cookies`);
        } else if (parsed.cookies && Array.isArray(parsed.cookies)) {
          cookieHeader = parsed.cookies.map(c => `${c.name}=${c.value}`).join("; ");
          cookieFormat = "storage_state";
          console.log(`[Check] Parsed storage_state: ${parsed.cookies.length} cookies`);
        } else {
          cookieHeader = rawCookies;
          console.log(`[Check] Unknown JSON format — using raw string`);
        }
      } catch {
        cookieHeader = rawCookies;
        console.log(`[Check] Using raw cookie string (${rawCookies.length} chars)`);
      }

      if (!cookieHeader) {
        return res.json({
          success: true,
          valid: false,
          message: "Cookie string rỗng sau khi parse",
          platform,
          username: account.username,
        });
      }

      // === RAW STRING (document.cookie) → chỉ validate format, KHÔNG gọi API ===
      // document.cookie không chứa httpOnly cookies (sessionid, sid_guard...)
      // nên gọi TikTok API từ server sẽ luôn bị 403/redirect
      if (cookieFormat === "raw") {
        const hasSession = /sessionid|sid_guard|sid_tt/i.test(cookieHeader);
        const hasMsToken = /msToken=/.test(cookieHeader);
        const hasTtCsrf = /tt_csrf_token|_tt_enable_cookie/.test(cookieHeader);

        if (hasSession) {
          // Có session cookies → có thể dùng được (hiếm khi có từ document.cookie)
          valid = true;
          detail = "✅ Cookies chứa session tokens — có thể dùng được";
        } else if (hasMsToken || hasTtCsrf) {
          // Có 1 số cookie hữu ích nhưng thiếu session
          valid = true;
          detail = "⚠️ Cookies đã lưu — nhưng thiếu httpOnly session cookies (document.cookie không lấy được). Crawler vẫn có thể dùng kết hợp với browser session";
        } else {
          valid = true;
          detail = "⚠️ Cookies đã lưu — không thể verify từ server (document.cookie thiếu httpOnly cookies). Dùng login_debug.py hoặc Cookie Editor extension để export đầy đủ hơn";
        }
        console.log(`[Check] Raw cookie format — skipping API check. hasSession=${hasSession}, hasMsToken=${hasMsToken}`);
      } else {
        // === JSON FORMAT (export đầy đủ, có httpOnly) → thử gọi API verify ===
        const { default: fetch } = await import("node-fetch");

        const msTokenMatch = cookieHeader.match(/msToken=([^;]+)/);
        const msToken = msTokenMatch ? msTokenMatch[1] : "";
        const apiUrl = `https://www.tiktok.com/api/user/detail/?uniqueId=tiktok&secUid=` +
          (msToken ? `&msToken=${msToken}` : "");

        try {
          const response = await fetch(apiUrl, {
            headers: {
              "Cookie": cookieHeader,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              "Referer": "https://www.tiktok.com/",
              "Origin": "https://www.tiktok.com",
              "Accept": "application/json, text/plain, */*",
              "Accept-Language": "en-US,en;q=0.9",
              "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": '"Windows"',
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-origin",
            },
            signal: AbortSignal.timeout(15000),
          });

          const responseText = await response.text();

          if (response.ok) {
            try {
              const data = JSON.parse(responseText);
              if (data.userInfo) {
                valid = true;
                detail = "✅ Session hợp lệ — TikTok API xác nhận";
              } else {
                valid = false;
                detail = "Cookies hết hạn — TikTok API không trả user data";
              }
            } catch {
              valid = false;
              detail = "Cookies có thể hết hạn — TikTok trả về HTML thay vì JSON";
              console.log(`[Check] TikTok response not JSON: ${responseText.substring(0, 200)}`);
            }
          } else if (response.status === 403) {
            valid = false;
            detail = "Cookies hết hạn hoặc bị block (HTTP 403)";
            console.log(`[Check] TikTok 403: ${responseText.substring(0, 200)}`);
          } else {
            valid = false;
            detail = `TikTok trả về status ${response.status}`;
            console.log(`[Check] TikTok HTTP ${response.status}: ${responseText.substring(0, 200)}`);
          }
        } catch (fetchErr) {
          // Network error / timeout
          valid = true;
          detail = `⚠️ Không thể kết nối TikTok API (${fetchErr.message}) — cookies đã lưu, sẽ verify khi crawl`;
          console.log(`[Check] TikTok fetch error: ${fetchErr.message}`);
        }
      }
    } else if (platform === "twitter") {
      // Twitter check
      let cookieHeader = account.cookies.trim();
      let cookieFormat = "raw";

      try {
        const parsed = JSON.parse(cookieHeader);
        if (Array.isArray(parsed)) {
          cookieHeader = parsed.map(c => `${c.name}=${c.value}`).join("; ");
          cookieFormat = "json_array";
        } else if (parsed.cookies && Array.isArray(parsed.cookies)) {
          cookieHeader = parsed.cookies.map(c => `${c.name}=${c.value}`).join("; ");
          cookieFormat = "storage_state";
        }
      } catch { /* simple string */ }

      // Check for key Twitter cookies
      const hasAuthToken = /auth_token=/.test(cookieHeader);
      const hasCt0 = /ct0=/.test(cookieHeader);

      if (cookieFormat === "raw" && !hasAuthToken) {
        // document.cookie format — auth_token là httpOnly nên thường không có
        valid = true;
        detail = "⚠️ Cookies đã lưu — auth_token (httpOnly) không có trong document.cookie. Dùng Cookie Editor extension để export đầy đủ";
      } else if (hasAuthToken && hasCt0) {
        // Có đủ cookies quan trọng → thử verify qua API
        const { default: fetch } = await import("node-fetch");
        try {
          const response = await fetch("https://api.x.com/1.1/account/verify_credentials.json", {
            headers: {
              "Cookie": cookieHeader,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
              "x-csrf-token": extractCsrfToken(cookieHeader),
            },
            signal: AbortSignal.timeout(10000),
          });

          if (response.ok) {
            valid = true;
            detail = "✅ Twitter session hợp lệ";
          } else if (response.status === 403) {
            valid = false;
            detail = "Cookies hết hạn hoặc bị block (HTTP 403)";
          } else {
            valid = false;
            detail = `Twitter trả về status ${response.status}`;
          }
        } catch (fetchErr) {
          valid = true;
          detail = `⚠️ Không thể kết nối Twitter API — cookies đã lưu`;
        }
      } else {
        valid = true;
        detail = "⚠️ Cookies đã lưu — thiếu auth_token hoặc ct0 để verify";
      }
    } else {
      // Nền tảng khác — chỉ check cookies có tồn tại
      valid = !!account.cookies;
      detail = valid ? "Cookies đã set (chưa hỗ trợ verify tự động)" : "Không có cookies";
    }

    // Update account status dựa trên kết quả check
    if (!valid && account.status === "active") {
      await SocialAccount.findByIdAndUpdate(id, { status: "expired" });
    }

    res.json({
      success: true,
      valid,
      message: detail,
      platform,
      username: account.username,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

function extractCsrfToken(cookieHeader) {
  const match = cookieHeader.match(/ct0=([^;]+)/);
  return match ? match[1] : "";
}
