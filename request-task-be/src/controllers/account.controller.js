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
