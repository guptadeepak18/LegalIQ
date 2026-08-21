import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, adminUsers } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  normalizePermissions,
  type AdminPermission,
} from "../lib/adminPermissions.js";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET or SESSION_SECRET must be configured for admin authentication");
  }
  return secret;
}
const JWT_SECRET = getJwtSecret();

export interface AuthRequest extends Request {
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
  adminPermissions?: AdminPermission[];
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
    };
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, payload.id));
    if (!admin || !admin.isActive) {
      res.status(401).json({ success: false, message: "This admin account is inactive or unavailable" });
      return;
    }

    req.adminId = admin.id;
    req.adminEmail = admin.email;
    req.adminName = admin.name;
    req.adminPermissions = normalizePermissions(admin.permissions);
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

export function requirePermission(permission: AdminPermission) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.adminPermissions?.includes(permission)) {
      res.status(403).json({ success: false, message: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}

export function signAdminToken(id: string, email: string): string {
  return jwt.sign({ id, email }, JWT_SECRET, { expiresIn: "24h" });
}
