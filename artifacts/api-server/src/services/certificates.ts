import { createHash, randomUUID } from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { objectStorageClient } from "./certificateStorage.js";

const SIDECAR = "http://127.0.0.1:1106";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const CERTIFICATE_UPLOAD_PREFIX = "certificate-template-assets/";

type CertificateAsset = { path: string; contentType: string; size: number; checksum?: string | null };

function privateLocation() {
  const raw = process.env.PRIVATE_OBJECT_DIR;
  if (!raw) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  const [bucket, ...parts] = raw.replace(/^\/+/, "").split("/");
  if (!bucket) throw new Error("PRIVATE_OBJECT_DIR is invalid");
  return { bucket, prefix: parts.join("/").replace(/\/+$/, "") };
}

function objectName(objectPath: string) {
  if (!objectPath.startsWith("/objects/")) throw new Error("Invalid private object path");
  const { prefix } = privateLocation();
  return [prefix, objectPath.slice("/objects/".length)].filter(Boolean).join("/");
}

function fileFor(objectPath: string) {
  const { bucket } = privateLocation();
  return objectStorageClient.bucket(bucket).file(objectName(objectPath));
}

function allowedContentType(value: string): value is "application/pdf" | "image/png" | "image/jpeg" {
  return ["application/pdf", "image/png", "image/jpeg"].includes(value);
}

function supportedSize(contentType: string) {
  return contentType === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
}

function hasExpectedMagic(bytes: Buffer, type: string) {
  if (type === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
}

export function normalizeAssetContentType(value: unknown) {
  const contentType = typeof value === "string" ? value.toLowerCase().split(";")[0].trim() : "";
  return allowedContentType(contentType) ? contentType : null;
}

export async function requestCertificateAssetUpload(contentType: string, declaredSize: number) {
  if (!allowedContentType(contentType) || !Number.isInteger(declaredSize) || declaredSize < 1 || declaredSize > supportedSize(contentType)) {
    throw new Error("Only PDF, PNG, and JPEG files within the permitted size limit may be uploaded");
  }
  const objectPath = `/objects/${CERTIFICATE_UPLOAD_PREFIX}${randomUUID()}`;
  const { bucket } = privateLocation();
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: objectName(objectPath),
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Could not create upload URL");
  const body = await response.json() as { signed_url?: string };
  if (!body.signed_url) throw new Error("Upload URL was not returned");
  return { uploadUrl: body.signed_url, objectPath, expiresInSeconds: 900 };
}

export async function validateCertificateAsset(objectPath: string, expectedContentType?: string): Promise<CertificateAsset> {
  if (!objectPath.startsWith(`/objects/${CERTIFICATE_UPLOAD_PREFIX}`)) throw new Error("Invalid certificate asset path");
  const file = fileFor(objectPath);
  const [exists] = await file.exists();
  if (!exists) throw new Error("Uploaded file was not found");
  const [metadata] = await file.getMetadata();
  const contentType = normalizeAssetContentType(metadata.contentType);
  const size = Number(metadata.size);
  if (!contentType || (expectedContentType && contentType !== expectedContentType) || !Number.isSafeInteger(size) || size < 1 || size > supportedSize(contentType)) {
    await file.delete({ ignoreNotFound: true });
    throw new Error("Uploaded file type or size is invalid");
  }
  const [bytes] = await file.download({ start: 0, end: 15 });
  if (!hasExpectedMagic(bytes, contentType)) {
    await file.delete({ ignoreNotFound: true });
    throw new Error("Uploaded file content does not match its declared type");
  }
  const [allBytes] = await file.download();
  return { path: objectPath, contentType, size, checksum: createHash("sha256").update(allBytes).digest("hex") };
}

export async function deleteCertificateObject(objectPath: string) {
  await fileFor(objectPath).delete({ ignoreNotFound: true });
}

export async function readCertificateObject(objectPath: string) {
  const file = fileFor(objectPath);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [metadata] = await file.getMetadata();
  const [bytes] = await file.download();
  return { bytes, contentType: normalizeAssetContentType(metadata.contentType) ?? "application/octet-stream" };
}

export async function writeGeneratedCertificate(bytes: Uint8Array) {
  const objectPath = `/objects/generated-certificates/${randomUUID()}.pdf`;
  const file = fileFor(objectPath);
  await file.save(Buffer.from(bytes), { resumable: false, contentType: "application/pdf", metadata: { cacheControl: "private, max-age=0" } });
  return objectPath;
}

export async function writePrivatePdf(objectPath: string, bytes: Uint8Array) {
  if (!objectPath.startsWith("/objects/")) throw new Error("Invalid private PDF path");
  await fileFor(objectPath).save(Buffer.from(bytes), {
    resumable: false,
    contentType: "application/pdf",
    metadata: { cacheControl: "private, max-age=0" },
  });
  return objectPath;
}

export async function createCertificatePdf(input: {
  recipientName: string; company: string; assessmentDate?: Date | null; score?: number | null;
  title?: string; subtitle?: string; issuerName?: string; asset?: CertificateAsset | null;
}) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([842, 595]);
  const { width, height } = page.getSize();
  if (input.asset && ["application/pdf", "image/png", "image/jpeg"].includes(input.asset.contentType)) {
    const source = await readCertificateObject(input.asset.path);
    if (source) {
      if (source.contentType === "application/pdf") {
        const bg = await PDFDocument.load(source.bytes);
        const [copied] = await pdf.copyPages(bg, [0]);
        pdf.removePage(0); pdf.insertPage(0, copied); page = pdf.getPage(0);
      } else {
        const image = source.contentType === "image/png" ? await pdf.embedPng(source.bytes) : await pdf.embedJpg(source.bytes);
        page.drawImage(image, { x: 0, y: 0, width, height });
      }
    }
  }
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const center = (text: string, y: number, size: number, useBold = false) => page.drawText(text, { x: (width - (useBold ? bold : font).widthOfTextAtSize(text, size)) / 2, y, size, font: useBold ? bold : font, color: rgb(0.08, 0.13, 0.25) });
  center(input.title || "Certificate of Legal Health Assessment", 410, 27, true);
  center(input.subtitle || "This certifies that", 365, 15);
  center(input.recipientName || input.company, 315, 30, true);
  center(input.company && input.recipientName ? input.company : "", 280, 16);
  center(`completed the LegalIQ Legal Health Assessment${input.score == null ? "" : ` with a score of ${input.score}/100`}.`, 230, 14);
  center(`Issued ${new Date(input.assessmentDate ?? new Date()).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, 160, 12);
  center(input.issuerName || "Rest The Case", 95, 14, true);
  return pdf.save();
}