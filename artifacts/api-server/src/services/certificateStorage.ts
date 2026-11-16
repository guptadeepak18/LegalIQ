import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined, // Defaults to AWS IAM role on App Runner, ECS, or EC2
});

export function getS3Bucket(): string {
  const raw =
    process.env.AWS_S3_BUCKET ||
    process.env.S3_BUCKET ||
    process.env.PRIVATE_OBJECT_DIR ||
    "legaliq-assets";
  const [bucket] = raw.replace(/^\/+/, "").split("/");
  return bucket || "legaliq-assets";
}

export function getS3Prefix(): string {
  const raw =
    process.env.AWS_S3_PREFIX ||
    (process.env.PRIVATE_OBJECT_DIR
      ? process.env.PRIVATE_OBJECT_DIR.replace(/^\/+/, "").split("/").slice(1).join("/")
      : "");
  return raw.replace(/\/+$/, "");
}
