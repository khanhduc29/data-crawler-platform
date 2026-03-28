
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

import { connectDB } from "./config/db.js";
import tiktokRoute from "./routes/tiktok.route.js";
import googleMapRoute from "./routes/googleMap.route.js";
import youtubeRoute from "./routes/youtube.route.js";
import pinterestRoute from "./routes/pinterest.route.js";
import instagramRoutes from "./routes/instagram.routes.js";
import twitterRoute from "./routes/twitter.route.js";
import accountRoute from "./routes/account.route.js";
import workerRoute from "./routes/worker.route.js";
import chplayRoute from "./routes/chplay.route.js";
import appstoreRoute from "./routes/appstore.route.js";
import dashboardRoute from "./routes/dashboard.route.js";
import settingRoute from "./routes/setting.route.js";
import apiKeyRoute from "./routes/apiKey.route.js";
import proxyRoute from "./routes/proxy.route.js";
import authRoute from "./routes/auth.route.js";
import activityRoute from "./routes/activity.route.js";
import { startStuckTaskRecovery } from "./utils/stuckTaskRecovery.js";
import { authMiddleware, optionalAuth, adminOnly } from "./middleware/auth.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, "../.env"),
});

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// ===== Public routes (no auth required) =====
app.use("/api/auth", authRoute);

// ===== Worker-accessible routes (optionalAuth — workers don't have tokens) =====
app.use("/api/workers", optionalAuth, workerRoute);
app.use("/api/proxies", optionalAuth, proxyRoute);
app.use("/api/settings", optionalAuth, settingRoute);
app.use("/api/api-keys", apiKeyRoute);

// ===== Tool routes (optionalAuth — FE sends token, workers don't) =====
app.use("/api/tiktok", optionalAuth, tiktokRoute);
app.use("/api/google-map", optionalAuth, googleMapRoute);
app.use("/api/youtube", optionalAuth, youtubeRoute);
app.use("/api/pinterest", optionalAuth, pinterestRoute);
app.use("/api/instagram", optionalAuth, instagramRoutes);
app.use("/api/twitter", optionalAuth, twitterRoute);
app.use("/api/chplay", optionalAuth, chplayRoute);
app.use("/api/appstore", optionalAuth, appstoreRoute);

// ===== Admin-only routes (auth + admin role required) =====
app.use("/api/dashboard", authMiddleware, adminOnly, dashboardRoute);
app.use("/api/accounts", authMiddleware, adminOnly, accountRoute);

// ===== Authenticated routes (any logged-in user) =====
app.use("/api/activity", authMiddleware, activityRoute);

const PORT = process.env.PORT || 3000;

// ============================================================
// Lấy đường dẫn portable executables từ env (do main.cjs truyền vào)
// ============================================================
function getNodeExe() {
  return process.env.PORTABLE_NODE_EXE || "node";
}

function getPythonExe() {
  return process.env.PORTABLE_PYTHON_EXE || "python";
}

function getWorkersRoot() {
  const isPackaged = process.env.ELECTRON_IS_PACKAGED === "true";
  const resourcesPath = process.env.ELECTRON_RESOURCES_PATH;

  if (isPackaged && resourcesPath) {
    return path.join(resourcesPath, "workers");
  }
  return path.join(__dirname, "../../../workers");
}

// ============================================================
// Spawn worker chung
// ============================================================
function spawnWorker(name, command, args, options = {}) {
  console.log(`Starting ${name} worker...`);
  console.log(`  Command: ${command} ${args.join(" ")}`);

  const env = {
    ...process.env,
    ...(options.env || {}),
    PYTHONIOENCODING: "utf-8",  // Prevent UnicodeEncodeError on Windows
  };

  // For Python workers: inject sys.path so portable Python (._pth) can find local modules
  let finalCommand = command;
  let finalArgs = args;
  const isPython = command.toLowerCase().includes("python");
  if (isPython && options.cwd && args.length > 0) {
    const scriptPath = args[0].replace(/\\/g, "\\\\");
    const cwdPath = options.cwd.replace(/\\/g, "\\\\");
    const pyCode = `import sys; sys.path.insert(0, r'${cwdPath}'); exec(open(r'${scriptPath}', encoding='utf-8').read())`;
    finalArgs = ["-c", pyCode];
  }

  const worker = spawn(finalCommand, finalArgs, {
    ...options,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  worker.stdout.on("data", (data) => {
    console.log(`${name} WORKER: ${data.toString()}`);
  });

  worker.stderr.on("data", (data) => {
    console.error(`${name} ERROR: ${data.toString()}`);
  });

  worker.on("error", (err) => {
    console.error(`${name} spawn error:`, err.message);
  });

  worker.on("close", (code) => {
    console.log(`${name} worker exited with code ${code}`);
  });

  return worker;
}

// ============================================================
// Khởi động từng worker
// ============================================================
function startYoutubeWorker() {
  const workersRoot = getWorkersRoot();
  const workerPath = path.join(workersRoot, "Tool-youtube", "main.py");
  spawnWorker("YouTube", getPythonExe(), [workerPath], {
    cwd: path.dirname(workerPath),
  });
}

function startPhoneWorker() {
  const workersRoot = getWorkersRoot();
  const workerPath = path.join(workersRoot, "Tool-crawl-phone", "dist", "index.js");
  console.log("PHONE WORKER PATH:", workerPath);
  spawnWorker("Phone", getNodeExe(), [workerPath], {
    cwd: path.dirname(workerPath),
  });
}

function startTikTokWorker() {
  const workersRoot = getWorkersRoot();
  const workerPath = path.join(workersRoot, "titok_crawler", "main.py");
  spawnWorker("TikTok", getPythonExe(), [workerPath], {
    cwd: path.dirname(workerPath),
  });
}

function startPinterestWorker() {
  const workersRoot = getWorkersRoot();
  const workerPath = path.join(workersRoot, "pinterest-crawler", "main.py");
  console.log("PINTEREST WORKER PATH:", workerPath);
  spawnWorker("Pinterest", getPythonExe(), [workerPath], {
    cwd: path.dirname(workerPath),
  });
}

function startInstagramWorker() {
  const workersRoot = getWorkersRoot();
  const workerPath = path.join(workersRoot, "Tool-Instagram", "main.py");
  console.log("INSTAGRAM WORKER PATH:", workerPath);
  spawnWorker("Instagram", getPythonExe(), [workerPath], {
    cwd: path.dirname(workerPath),
  });
}

function startTwitterWorker() {
  const workersRoot = getWorkersRoot();
  const workerPath = path.join(workersRoot, "twitter_crawler", "main.py");
  console.log("TWITTER WORKER PATH:", workerPath);
  spawnWorker("Twitter", getPythonExe(), [workerPath], {
    cwd: path.dirname(workerPath),
  });
}

connectDB().then(() => {

  // 🔄 Stuck task recovery — tự động reset task bị kẹt
  startStuckTaskRecovery();

  // Workers are managed locally by crawler-tool-gui
  // Only start workers if ENABLE_WORKERS env is set (local dev only)
  if (process.env.ENABLE_WORKERS === "true") {
    startYoutubeWorker();
    startPhoneWorker();
    startTikTokWorker();
    startPinterestWorker();
    startInstagramWorker();
    startTwitterWorker();
  } else {
    console.log("ℹ️  Workers disabled (set ENABLE_WORKERS=true to enable)");
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

});