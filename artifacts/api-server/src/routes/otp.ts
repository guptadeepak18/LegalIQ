import { Router } from "express";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { otpVerifications } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { sendOtpEmail } from "../services/resend.js";
import { logger } from "../lib/logger.js";

const router = Router();

function generateOTP(): string {
  return String(randomInt(100000, 999999));
}

async function checkRateLimit(
  recipient: string
): Promise<{ allowed: boolean; message?: string }> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

  const recent = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.recipient, recipient),
        gt(otpVerifications.createdAt, oneDayAgo)
      )
    );

  if (recent.length >= 5) {
    return { allowed: false, message: "Too many OTP requests. Try again tomorrow." };
  }

  const veryRecent = recent.filter(
    (r) => r.createdAt && r.createdAt > oneMinuteAgo
  );
  if (veryRecent.length > 0) {
    return { allowed: false, message: "Please wait 60 seconds before requesting a new OTP." };
  }

  return { allowed: true };
}

// Dev-only bypass — skips OTP entirely, returns a real verification token
router.post("/otp/dev-skip", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ success: false, message: "Not found" });
    return;
  }
  const { email } = req.body as { email?: string };
  const recipient = email ?? "dev@test.com";
  const verificationToken = uuidv4();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const otpHash = await bcrypt.hash("000000", 10);
  await db.insert(otpVerifications).values({
    recipient,
    type: "EMAIL",
    otpHash,
    expiresAt,
    verifiedAt: new Date(),
    verificationToken,
  });
  res.json({ success: true, emailToken: verificationToken });
});

// Phone OTP removed — email OTP only (free via Resend)
router.post("/otp/send-phone", (_req, res) => {
  res.status(410).json({ success: false, message: "Phone OTP is no longer supported. Please use email OTP." });
});

router.post("/otp/send-email", async (req, res) => {
  const { email } = req.body as { email: string };
  if (!email) {
    res.status(400).json({ success: false, message: "Email is required" });
    return;
  }

  const limit = await checkRateLimit(email);
  if (!limit.allowed) {
    res.status(429).json({ success: false, message: limit.message });
    return;
  }

  const otp = generateOTP();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(otpVerifications).values({
    recipient: email,
    type: "EMAIL",
    otpHash,
    expiresAt,
  });

  let emailDelivered = true;
  try {
    await sendOtpEmail(email, otp);
  } catch (err) {
    emailDelivered = false;
    logger.warn({ err }, "Email delivery failed — OTP stored in DB");
  }

  const isDev = process.env.NODE_ENV !== "production";

  if (!emailDelivered && !isDev) {
    res.status(503).json({
      success: false,
      message: "Email delivery is temporarily unavailable. Please contact support.",
    });
    return;
  }

  res.json({
    success: true,
    expiresIn: 600,
    message: emailDelivered
      ? "OTP sent to your email"
      : "Email delivery unavailable — use the code shown below to continue testing",
    ...(isDev && !emailDelivered ? { devOtp: otp } : {}),
  });
});

async function verifyOtp(
  recipient: string,
  otpInput: string
): Promise<{ success: boolean; token?: string; message?: string }> {
  const now = new Date();

  const records = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.recipient, recipient),
        gt(otpVerifications.expiresAt, now)
      )
    )
    .orderBy(otpVerifications.createdAt);

  if (records.length === 0) {
    return { success: false, message: "OTP expired or not found. Request a new one." };
  }

  const record = records[records.length - 1];

  if ((record.attempts ?? 0) >= (record.maxAttempts ?? 5)) {
    return { success: false, message: "Too many attempts. Request a new OTP." };
  }

  const match = await bcrypt.compare(otpInput, record.otpHash);

  if (!match) {
    const remaining = (record.maxAttempts ?? 5) - (record.attempts ?? 0) - 1;
    await db
      .update(otpVerifications)
      .set({ attempts: (record.attempts ?? 0) + 1 })
      .where(eq(otpVerifications.id, record.id));

    return {
      success: false,
      message: `Wrong OTP. ${remaining} attempts remaining.`,
    };
  }

  const verificationToken = uuidv4();
  const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db
    .update(otpVerifications)
    .set({
      verifiedAt: now,
      verificationToken,
      expiresAt: tokenExpiresAt,
    })
    .where(eq(otpVerifications.id, record.id));

  return { success: true, token: verificationToken };
}

router.post("/otp/verify-phone", (_req, res) => {
  res.status(410).json({ success: false, message: "Phone OTP is no longer supported. Please use email OTP." });
});

router.post("/otp/verify-email", async (req, res) => {
  const { email, otp } = req.body as { email: string; otp: string };
  if (!email || !otp) {
    res.status(400).json({ success: false, message: "Email and OTP required" });
    return;
  }

  const result = await verifyOtp(email, otp);
  if (!result.success) {
    res.status(400).json({ success: false, message: result.message });
    return;
  }

  res.json({ success: true, emailToken: result.token });
});

export default router;
