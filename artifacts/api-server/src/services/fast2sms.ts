import { logger } from "../lib/logger.js";

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;

export async function sendSmsOtp(
  phone: string,
  otp: string
): Promise<void> {
  if (!FAST2SMS_API_KEY) {
    logger.warn("FAST2SMS_API_KEY not set, skipping SMS");
    return;
  }

  const cleanPhone = phone.replace(/^\+91/, "").replace(/\D/g, "");

  try {
    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: FAST2SMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "otp",
        variables_values: otp,
        flash: "0",
        numbers: cleanPhone,
      }),
    });

    const data = await res.json() as { return?: boolean; message?: string[] };
    if (!data.return) {
      logger.warn({ data, phone }, "Fast2SMS OTP send failed");
    }
  } catch (err) {
    logger.error({ err, phone }, "Fast2SMS request error");
    throw err;
  }
}
