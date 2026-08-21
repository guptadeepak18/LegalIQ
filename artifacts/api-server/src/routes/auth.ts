import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { adminUsers } from "@workspace/db";
import { and, asc, eq, ne } from "drizzle-orm";
import {
  requireAuth,
  requirePermission,
  signAdminToken,
  type AuthRequest,
} from "../middleware/auth.js";
import {
  ADMIN_PERMISSIONS,
  FULL_ADMIN_PERMISSIONS,
  hasFullPermissions,
  normalizePermissions,
  type AdminPermission,
} from "../lib/adminPermissions.js";

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicAdmin(admin: typeof adminUsers.$inferSelect) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    isActive: admin.isActive,
    permissions: normalizePermissions(admin.permissions),
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

function parseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return emailPattern.test(email) ? email : null;
}

function parseName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 2 && name.length <= 100 ? name : null;
}

function parsePermissions(value: unknown): AdminPermission[] | null {
  if (!Array.isArray(value)) return null;
  const permissions = normalizePermissions(value);
  return permissions.length === value.length ? permissions : null;
}

function canGrantPermissions(
  actorPermissions: AdminPermission[] | undefined,
  requestedPermissions: AdminPermission[],
): boolean {
  if (!actorPermissions) return false;
  if (hasFullPermissions(actorPermissions)) return true;
  if (requestedPermissions.includes("admin-users")) return false;
  return requestedPermissions.every((permission) => actorPermissions.includes(permission));
}

class AdminPolicyError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

router.post("/auth/login", async (req, res) => {
  const { email: rawEmail, password } = req.body as { email: string; password: string };
  const email = parseEmail(rawEmail);

  if (!email || !password) {
    res.status(400).json({ success: false, message: "Email and password required" });
    return;
  }

  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email));

  if (!admin) {
    res.status(401).json({ success: false, message: "Invalid credentials" });
    return;
  }

  if (!admin.isActive) {
    res.status(401).json({ success: false, message: "This admin account is inactive" });
    return;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, message: "Invalid credentials" });
    return;
  }

  const token = signAdminToken(admin.id, admin.email);
  res.json({ success: true, token, admin: publicAdmin(admin) });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (!req.adminId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, req.adminId));
  if (!admin) {
    res.status(401).json({ success: false, message: "Admin account not found" });
    return;
  }
  res.json({ success: true, admin: publicAdmin(admin) });
});

router.patch("/auth/profile", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (!req.adminId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const body = (req.body ?? {}) as { name?: unknown; email?: unknown };
  const updates: { name?: string; email?: string; updatedAt: Date } = { updatedAt: new Date() };
  if (body.name !== undefined) {
    const name = parseName(body.name);
    if (!name) {
      res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters" });
      return;
    }
    updates.name = name;
  }
  if (body.email !== undefined) {
    const email = parseEmail(body.email);
    if (!email) {
      res.status(400).json({ success: false, message: "Enter a valid email address" });
      return;
    }
    const [existing] = await db.select().from(adminUsers)
      .where(and(eq(adminUsers.email, email), ne(adminUsers.id, req.adminId)));
    if (existing) {
      res.status(409).json({ success: false, message: "An admin already uses this email address" });
      return;
    }
    updates.email = email;
  }
  if (!updates.name && !updates.email) {
    res.status(400).json({ success: false, message: "Provide a name or email to update" });
    return;
  }

  const [updated] = await db.update(adminUsers).set(updates)
    .where(eq(adminUsers.id, req.adminId)).returning();
  if (!updated) {
    res.status(404).json({ success: false, message: "Admin account not found" });
    return;
  }

  const token = updates.email ? signAdminToken(updated.id, updated.email) : undefined;
  res.json({ success: true, admin: publicAdmin(updated), token, message: "Profile updated successfully" });
});

router.post("/auth/change-password", requireAuth, async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = (req.body ?? {}) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, message: "Current and new passwords are required" });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    return;
  }

  if (!req.adminId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, req.adminId));

  if (!admin) {
    res.status(401).json({ success: false, message: "Admin account not found" });
    return;
  }

  const currentPasswordValid = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!currentPasswordValid) {
    res.status(400).json({ success: false, message: "Current password is incorrect" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(adminUsers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(adminUsers.id, admin.id));

  // Rotate the token so the session continues safely after the credential change.
  const token = signAdminToken(admin.id, admin.email);
  res.json({ success: true, token, message: "Password changed successfully" });
});

router.get("/auth/admin-users", requireAuth, requirePermission("admin-users"), async (_req, res): Promise<void> => {
  const admins = await db.select().from(adminUsers).orderBy(adminUsers.createdAt);
  res.json({ success: true, admins: admins.map(publicAdmin), availablePermissions: ADMIN_PERMISSIONS });
});

router.post("/auth/admin-users", requireAuth, requirePermission("admin-users"), async (req: AuthRequest, res): Promise<void> => {
  const { name: rawName, email: rawEmail, password, permissions, isActive = true } = (req.body ?? {}) as {
    name?: unknown; email?: unknown; password?: unknown; permissions?: unknown; isActive?: unknown;
  };
  const name = parseName(rawName);
  const email = parseEmail(rawEmail);
  const selectedPermissions = parsePermissions(permissions);
  if (!name || !email || typeof password !== "string" || password.length < 8 || !selectedPermissions || typeof isActive !== "boolean") {
    res.status(400).json({ success: false, message: "Provide a valid name, email, password (8+ characters), active status, and permissions" });
    return;
  }
  if (!canGrantPermissions(req.adminPermissions, selectedPermissions)) {
    res.status(403).json({ success: false, message: "You cannot grant permissions you do not hold" });
    return;
  }
  const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
  if (existing) {
    res.status(409).json({ success: false, message: "An admin already uses this email address" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [admin] = await db.insert(adminUsers).values({
    name, email, passwordHash, isActive, permissions: selectedPermissions,
  }).returning();
  res.status(201).json({ success: true, admin: publicAdmin(admin) });
});

router.patch("/auth/admin-users/:id", requireAuth, requirePermission("admin-users"), async (req: AuthRequest, res): Promise<void> => {
  const id = String(req.params.id);
  const body = (req.body ?? {}) as { name?: unknown; email?: unknown; password?: unknown; permissions?: unknown; isActive?: unknown };
  if (body.password !== undefined && (typeof body.password !== "string" || body.password.length < 8)) {
    res.status(400).json({ success: false, message: "New passwords must be at least 8 characters" });
    return;
  }

  const passwordHash = typeof body.password === "string"
    ? await bcrypt.hash(body.password, 12)
    : undefined;

  let updated: typeof adminUsers.$inferSelect | undefined;
  try {
    updated = await db.transaction(async (tx) => {
      // Lock the complete admin set in a stable order so the final-full-admin
      // invariant cannot be bypassed by concurrent demotions/deactivations.
      const lockedAdmins = await tx.select().from(adminUsers).orderBy(asc(adminUsers.id)).for("update");
      const target = lockedAdmins.find((admin) => admin.id === id);
      if (!target) throw new AdminPolicyError(404, "Admin account not found");

      const nextName = body.name === undefined ? target.name : parseName(body.name);
      const nextEmail = body.email === undefined ? target.email : parseEmail(body.email);
      const nextPermissions = body.permissions === undefined
        ? normalizePermissions(target.permissions)
        : parsePermissions(body.permissions);
      const nextIsActive = body.isActive === undefined ? target.isActive : body.isActive;
      if (!nextName || !nextEmail || !nextPermissions || typeof nextIsActive !== "boolean") {
        throw new AdminPolicyError(400, "Provide valid account details and permissions");
      }
      if (!canGrantPermissions(req.adminPermissions, nextPermissions)) {
        throw new AdminPolicyError(403, "You cannot grant permissions you do not hold");
      }
      if (req.adminId === target.id && (!nextIsActive || !nextPermissions.includes("admin-users"))) {
        throw new AdminPolicyError(400, "You cannot remove your own admin management access or deactivate your account");
      }
      if (
        target.isActive &&
        hasFullPermissions(target.permissions) &&
        (!nextIsActive || !hasFullPermissions(nextPermissions)) &&
        !lockedAdmins.some((admin) =>
          admin.id !== target.id && admin.isActive && hasFullPermissions(admin.permissions),
        )
      ) {
        throw new AdminPolicyError(400, "Keep at least one active administrator with full permissions");
      }
      if (nextEmail !== target.email) {
        const existing = lockedAdmins.find((admin) => admin.email === nextEmail && admin.id !== target.id);
        if (existing) throw new AdminPolicyError(409, "An admin already uses this email address");
      }

      const updates: {
        name: string; email: string; permissions: AdminPermission[]; isActive: boolean;
        passwordHash?: string; updatedAt: Date;
      } = {
        name: nextName,
        email: nextEmail,
        permissions: nextPermissions,
        isActive: nextIsActive,
        updatedAt: new Date(),
      };
      if (passwordHash) updates.passwordHash = passwordHash;
      const [result] = await tx.update(adminUsers).set(updates).where(eq(adminUsers.id, target.id)).returning();
      return result;
    });
  } catch (error) {
    if (error instanceof AdminPolicyError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ success: false, message: "An admin already uses this email address" });
      return;
    }
    throw error;
  }

  res.json({ success: true, admin: publicAdmin(updated!), message: "Admin account updated successfully" });
});

export default router;
