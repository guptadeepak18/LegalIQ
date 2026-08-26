import bcrypt from "bcryptjs";
import { db, adminUsers } from "@workspace/db";
import { eq } from "drizzle-orm";
import { FULL_ADMIN_PERMISSIONS } from "../lib/adminPermissions.js";
import { logger } from "../lib/logger.js";

const DEFAULT_ADMIN_EMAIL = "info@restthecase.com";

/**
 * Creates the initial admin only for a fresh database. The password is supplied
 * through Replit Secrets and is never stored in source code or logged.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!password) return;
  if (password.length < 8) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 8 characters");
  }

  const [existing] = await db.select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, DEFAULT_ADMIN_EMAIL));
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await db.insert(adminUsers).values({
      name: "Rest The Case Admin",
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      isActive: true,
      permissions: FULL_ADMIN_PERMISSIONS,
    });
    logger.info({ email: DEFAULT_ADMIN_EMAIL }, "Bootstrap admin account created");
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return;
    throw error;
  }
}