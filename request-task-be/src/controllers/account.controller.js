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

    if (!platform || !username) {
      return res.status(400).json({
        success: false,
        message: "platform and username are required",
      });
    }

    const account = await SocialAccount.create({
      platform,
      username,
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
      // Parse cookies thành header string
      let cookieHeader = "";
      try {
        const parsed = JSON.parse(account.cookies);
        if (Array.isArray(parsed)) {
          cookieHeader = parsed.map(c => `${c.name}=${c.value}`).join("; ");
        } else if (parsed.cookies && Array.isArray(parsed.cookies)) {
          cookieHeader = parsed.cookies.map(c => `${c.name}=${c.value}`).join("; ");
        }
      } catch {
        // Simple string format
        cookieHeader = account.cookies;
      }

      // Gọi TikTok API để check session
      const { default: fetch } = await import("node-fetch");
      const response = await fetch("https://www.tiktok.com/api/user/detail/?uniqueId=tiktok&secUid=", {
        headers: {
          "Cookie": cookieHeader,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.userInfo) {
          valid = true;
          detail = `Session hợp lệ — TikTok API trả về dữ liệu`;
        } else {
          // TikTok trả 200 nhưng redirect hoặc không có data → cookies hết hạn
          valid = false;
          detail = "Cookies có thể đã hết hạn (API không trả user data)";
        }
      } else {
        valid = false;
        detail = `TikTok trả về status ${response.status}`;
      }
    } else if (platform === "twitter") {
      // Twitter check
      let cookieHeader = account.cookies;
      try {
        const parsed = JSON.parse(account.cookies);
        if (Array.isArray(parsed)) {
          cookieHeader = parsed.map(c => `${c.name}=${c.value}`).join("; ");
        }
      } catch { /* simple string */ }

      const { default: fetch } = await import("node-fetch");
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
        detail = "Twitter session valid";
      } else {
        valid = false;
        detail = `Twitter trả về status ${response.status}`;
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
