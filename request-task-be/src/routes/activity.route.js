import { Router } from "express";
import {
  getActivityHistory,
  getActivityDetail,
  resetTaskStatus,
} from "../controllers/activity.controller.js";

const router = Router();

// GET /api/activity?page=1&limit=20&tool=tiktok&status=error&search=keyword&from=2026-01-01&to=2026-12-31
router.get("/", getActivityHistory);

// GET /api/activity/:tool/:id
router.get("/:tool/:id", getActivityDetail);

// PUT /api/activity/:tool/:id/reset
router.put("/:tool/:id/reset", resetTaskStatus);

export default router;
