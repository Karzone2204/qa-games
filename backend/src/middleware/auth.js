import jwt from "jsonwebtoken";
import { jwtConfig, allowedEmailDomain } from "../config/auth.js";

/**
 * Returns true if the email's domain matches the allowed domain
 * (exact match or subdomain of the allowed domain).
 */
function isAllowedDomainEmail(email) {
  const domain = (email?.split("@")[1] || "").toLowerCase();
  const allowed = (allowedEmailDomain || "").toLowerCase();
  if (!domain || !allowed) return false;
  return domain === allowed || domain.endsWith(`.${allowed}`);
}

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, jwtConfig.secret);
    if (!isAllowedDomainEmail(payload.email)) {
      return res.status(403).json({ error: "Email domain not allowed" });
    }
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// (Optional) export for reuse in controllers
export const _isAllowedDomainEmail = isAllowedDomainEmail;
