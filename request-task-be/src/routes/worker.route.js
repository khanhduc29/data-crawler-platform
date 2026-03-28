import express from "express";
import { startWorker, stopWorker, getWorkers } from "../workers/workerManager.js";
import {
  registerWorker,
  unregisterWorker,
  listWorkers,
  workerHeartbeat,
} from "../controllers/worker.controller.js";
import { adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

// ─── Worker-accessible (crawlers call these without auth) ───
router.post("/register", registerWorker);
router.delete("/:worker_id", unregisterWorker);
router.get("/list", listWorkers);
router.post("/heartbeat", workerHeartbeat);

// ─── Admin-only: GUI worker management ───
router.get("/", adminOnly, (req, res) => {
  res.json(getWorkers());
});

router.post("/start", adminOnly, (req, res) => {
  const { name } = req.body;

  // mapping worker
  if (name === "youtube") {
    startWorker("youtube", "python", "../Tool-youtube/main.py");
  }

  res.json({ success: true });
});

router.post("/stop", adminOnly, (req, res) => {
  const { name } = req.body;
  stopWorker(name);
  res.json({ success: true });
});

export default router;