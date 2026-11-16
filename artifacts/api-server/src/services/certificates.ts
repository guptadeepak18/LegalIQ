import { createHash, randomUUID } from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, getS3Bucket, getS3Prefix } from "./certificateStorage.js";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const CERTIFICATE_UPLOAD_PREFIX = "certificate-template-assets/";

type CertificateAsset = {
  path: string;
  contentType: string;
  size: number;
  checksum?: string | null;
};

function s3Location() {
  const bucket = getS3Bucket();
  const prefix = getS3Prefix();
  return { bucket, prefix };
}

function objectName(objectPath: string) {
  if (!objectPath.startsWith("/objects/")) {
    throw new Error("Invalid private object path");
  }
  const { prefix } = s3Location();
  const rel = objectPath.slice("/objects/".length);
  return [prefix, rel].filter(Boolean).join("/");
}

function allowedContentType(
  value: string
): value is "application/pdf" | "image/png" | "image/jpeg" {
  return ["application/pdf", "image/png", "image/jpeg"].includes(value);
}

function supportedSize(contentType: string) {
  return contentType === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
}

function hasExpectedMagic(bytes: Buffer, type: string) {
  if (type === "application/pdf") {
    return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (type === "image/png") {
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return false;
}

export function normalizeAssetContentType(value: unknown) {
  const contentType =
    typeof value === "string" ? value.toLowerCase().split(";")[0].trim() : "";
  return allowedContentType(contentType) ? contentType : null;
}

export async function requestCertificateAssetUpload(
  contentType: string,
  declaredSize: number
) {
  if (
    !allowedContentType(contentType) ||
    !Number.isInteger(declaredSize) ||
    declaredSize < 1 ||
    declaredSize > supportedSize(contentType)
  ) {
    throw new Error(
      "Only PDF, PNG, and JPEG files within the permitted size limit may be uploaded"
    );
  }

  const objectPath = `/objects/${CERTIFICATE_UPLOAD_PREFIX}${randomUUID()}`;
  const { bucket } = s3Location();
  const key = objectName(objectPath);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return { uploadUrl, objectPath, expiresInSeconds: 900 };
}

export async function validateCertificateAsset(
  objectPath: string,
  expectedContentType?: string
): Promise<CertificateAsset> {
  if (!objectPath.startsWith(`/objects/${CERTIFICATE_UPLOAD_PREFIX}`)) {
    throw new Error("Invalid certificate asset path");
  }

  const { bucket } = s3Location();
  const key = objectName(objectPath);

  let head;
  try {
    head = await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  } catch (error) {
    throw new Error("Uploaded file was not found in storage");
  }

  const contentType = normalizeAssetContentType(head.ContentType);
  const size = Number(head.ContentLength ?? 0);

  if (
    !contentType ||
    (expectedContentType && contentType !== expectedContentType) ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > supportedSize(contentType)
  ) {
    await deleteCertificateObject(objectPath).catch(() => undefined);
    throw new Error("Uploaded file type or size is invalid");
  }

  const getRes = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!getRes.Body) {
    throw new Error("Uploaded file body is empty");
  }

  const bytesArray = await getRes.Body.transformToByteArray();
  const allBytes = Buffer.from(bytesArray);

  if (!hasExpectedMagic(allBytes, contentType)) {
    await deleteCertificateObject(objectPath).catch(() => undefined);
    throw new Error("Uploaded file content does not match its declared type");
  }

  return {
    path: objectPath,
    contentType,
    size,
    checksum: createHash("sha256").update(allBytes).digest("hex"),
  };
}

export async function deleteCertificateObject(objectPath: string): Promise<void> {
  const { bucket } = s3Location();
  const key = objectName(objectPath);
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  } catch {
    // Ignore not found errors during deletion
  }
}

export async function readCertificateObject(
  objectPath: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const { bucket } = s3Location();
  const key = objectName(objectPath);

  try {
    const res = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (!res.Body) return null;
    const bytesArray = await res.Body.transformToByteArray();
    return {
      bytes: Buffer.from(bytesArray),
      contentType:
        normalizeAssetContentType(res.ContentType) ?? "application/octet-stream",
    };
  } catch (error) {
    return null;
  }
}

export async function writeGeneratedCertificate(bytes: Uint8Array): Promise<string> {
  const objectPath = `/objects/generated-certificates/${randomUUID()}.pdf`;
  const { bucket } = s3Location();
  const key = objectName(objectPath);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: "application/pdf",
      CacheControl: "private, max-age=0",
    })
  );

  return objectPath;
}

export async function writePrivatePdf(
  objectPath: string,
  bytes: Uint8Array
): Promise<string> {
  if (!objectPath.startsWith("/objects/")) {
    throw new Error("Invalid private PDF path");
  }

  const { bucket } = s3Location();
  const key = objectName(objectPath);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: "application/pdf",
      CacheControl: "private, max-age=0",
    })
  );

  return objectPath;
}

export async function createCertificatePdf(input: {
  recipientName: string;
  company: string;
  assessmentDate?: Date | null;
  score?: number | null;
  title?: string;
  subtitle?: string;
  issuerName?: string;
  asset?: CertificateAsset | null;
}) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([842, 595]);
  const { width, height } = page.getSize();

  if (
    input.asset &&
    ["application/pdf", "image/png", "image/jpeg"].includes(input.asset.contentType)
  ) {
    const source = await readCertificateObject(input.asset.path);
    if (source) {
      if (source.contentType === "application/pdf") {
        const bg = await PDFDocument.load(source.bytes);
        const [copied] = await pdf.copyPages(bg, [0]);
        pdf.removePage(0);
        pdf.insertPage(0, copied);
        page = pdf.getPage(0);
      } else {
        const image =
          source.contentType === "image/png"
            ? await pdf.embedPng(source.bytes)
            : await pdf.embedJpg(source.bytes);
        page.drawImage(image, { x: 0, y: 0, width, height });
      }
    }
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const center = (text: string, y: number, size: number, useBold = false) =>
    page.drawText(text, {
      x: (width - (useBold ? bold : font).widthOfTextAtSize(text, size)) / 2,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.08, 0.13, 0.25),
    });

  center(input.title || "Certificate of Legal Health Assessment", 410, 27, true);
  center(input.subtitle || "This certifies that", 365, 15);
  center(input.recipientName || input.company, 315, 30, true);
  center(input.company && input.recipientName ? input.company : "", 280, 16);
  center(
    `completed the LegalIQ Legal Health Assessment${
      input.score == null ? "" : ` with a score of ${input.score}/100`
    }.`,
    230,
    14
  );
  center(
    `Issued ${new Date(input.assessmentDate ?? new Date()).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
    160,
    12
  );
  center(input.issuerName || "Rest The Case", 95, 14, true);

  return pdf.save();
}
