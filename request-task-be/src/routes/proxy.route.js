import express from "express";
import {
  getAllProxies,
  createProxy,
  updateProxy,
  deleteProxy,
  bulkDeleteProxies,
  getRandomProxy,
  checkProxy,
} from "../controllers/proxy.controller.js";
import { adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

// Worker-accessible (no admin required)
router.get("/random", getRandomProxy);

// Admin-only management operations
router.get("/", adminOnly, getAllProxies);
router.post("/", adminOnly, createProxy);
router.post("/bulk-delete", adminOnly, bulkDeleteProxies);
router.post("/check/:id", adminOnly, checkProxy);
router.patch("/:id", adminOnly, updateProxy);
router.delete("/:id", adminOnly, deleteProxy);

export default router;
