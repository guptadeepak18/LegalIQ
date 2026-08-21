import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { adminUsers } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, signAdminToken, type AuthRequest } from "../middleware/auth.js";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

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

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, message: "Invalid credentials" });
    return;
  }

  const token = signAdminToken(admin.id, admin.email);
  res.json({ success: true, token });
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
    .set({ passwordHash })
    .where(eq(adminUsers.id, admin.id));

  // Rotate the token so the session continues safely after the credential change.
  const token = signAdminToken(admin.id, admin.email);
  res.json({ success: true, token, message: "Password changed successfully" });
});

export default router;
