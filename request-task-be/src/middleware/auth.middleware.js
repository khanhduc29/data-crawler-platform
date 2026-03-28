import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "crawler-tool-secret-key-2024";

/**
 * Middleware: REQUIRED auth — returns 401 if no valid token.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Không có token — vui lòng đăng nhập",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
}

/**
 * Middleware: OPTIONAL auth — if token present, extracts user. Otherwise continues.
 * Used for routes that both FE (with auth) and workers (without auth) call.
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // Invalid token — ignore, treat as unauthenticated
    }
  }

  next();
}

/**
 * Middleware: ADMIN ONLY — requires authMiddleware first, then checks role.
 */
export function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Chỉ Admin mới có quyền truy cập",
    });
  }
  next();
}

/**
 * Helper: build userId filter for queries.
 * Admin sees all, regular user sees only their data.
 */
export function getUserFilter(req) {
  if (!req.user) return {}; // No auth — no filter (worker calls)
  if (req.user.role === "admin") return {}; // Admin sees all
  return { userId: req.user.id }; // Regular user sees own data
}
