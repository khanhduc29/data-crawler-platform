import express from "express";
import { autoRegisterWorker } from "../middleware/autoRegisterWorker.js";
import { createGoogleMapJobController, getGoogleMapJobs, getGoogleMapTaskDetail, getGoogleMapTasks, getPendingGoogleMapTask, updateGoogleMapTask, updatePartialGoogleMapTask, resetStuckTasks, getCrawlProgress, resetCrawlProgress } from "../controllers/googleMap.controller.js";

const router = express.Router();

router.post("/scan", createGoogleMapJobController);
router.get("/task/pending", autoRegisterWorker("google-map"), getPendingGoogleMapTask);
router.patch("/task/:id", updateGoogleMapTask);
router.patch("/task/:id/partial", updatePartialGoogleMapTask);
router.post("/task/reset-stuck", resetStuckTasks);
// frontend dashboard
router.get("/crawl-jobs", getGoogleMapJobs);
router.get("/crawl-tasks", getGoogleMapTasks);
router.get("/crawl-tasks/:id", getGoogleMapTaskDetail);
// resume crawling — progress tracking
router.get("/progress", getCrawlProgress);
router.delete("/progress", resetCrawlProgress);

export default router;