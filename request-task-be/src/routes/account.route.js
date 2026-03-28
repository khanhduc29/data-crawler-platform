import express from "express";
import {
  getAllAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountById,
  getRandomAccountByPlatform,
  checkAccountCookies,
} from "../controllers/account.controller.js";
import { adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

// Worker-accessible (no admin needed — crawlers fetch accounts by platform)
router.get("/platform/:platform/random", getRandomAccountByPlatform);

// Admin CRUD
router.get("/", adminOnly, getAllAccounts);
router.post("/", adminOnly, createAccount);
router.post("/:id/check", adminOnly, checkAccountCookies);
router.get("/:id", adminOnly, getAccountById);
router.patch("/:id", adminOnly, updateAccount);
router.delete("/:id", adminOnly, deleteAccount);

export default router;
