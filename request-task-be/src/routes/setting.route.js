import express from "express";
import Setting from "../models/Setting.model.js";
import { adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

// GET /api/settings — list all settings (workers + admin)
router.get("/", async (req, res) => {
  try {
    const settings = await Setting.find().lean();
    const map = {};
    for (const s of settings) map[s.key] = s.value;
    res.json({ success: true, data: map });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/settings/:key — get single setting (workers + admin)
router.get("/:key", async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key }).lean();
    res.json({ success: true, data: setting ? setting.value : "" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/settings/:key — upsert setting (admin only)
router.put("/:key", adminOnly, async (req, res) => {
  try {
    const { value, description } = req.body;
    const setting = await Setting.findOneAndUpdate(
      { key: req.params.key },
      { value: value || "", description: description || "" },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: setting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
