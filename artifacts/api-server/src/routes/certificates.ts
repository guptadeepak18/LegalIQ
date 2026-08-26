import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, assessments, certificateTemplates, generatedCertificates, leads } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, type AuthRequest } from "../middleware/auth.js";
import {
  createCertificatePdf, deleteCertificateObject, normalizeAssetContentType, readCertificateObject,
  requestCertificateAssetUpload, validateCertificateAsset, writeGeneratedCertificate,
} from "../services/certificates.js";

const router = Router();
const permission = [requireAuth, requirePermission("brochures")] as const;

function config(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ["title", "subtitle", "issuerName", "issuerTitle", "accentColor", "recipientLabel"]) {
    if (raw[key] !== undefined && (typeof raw[key] !== "string" || raw[key].length > 200)) return null;
    if (typeof raw[key] === "string") out[key] = raw[key].trim();
  }
  return out;
}

router.post("/admin/certificate-templates/upload-url", ...permission, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const contentType = normalizeAssetContentType(body.contentType);
  const size = typeof body.size === "number" ? body.size : NaN;
  if (!contentType) { res.status(400).json({ success: false, message: "contentType must be PDF, PNG, or JPEG" }); return; }
  try {
    res.json({ success: true, ...(await requestCertificateAssetUpload(contentType, size)) });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Invalid upload request" });
  }
});

router.post("/admin/certificate-templates/finalize", ...permission, async (req: AuthRequest, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const objectPath = typeof body.objectPath === "string" ? body.objectPath : "";
  const contentType = normalizeAssetContentType(body.contentType);
  const templateConfig = config(body.config);
  if (!name || name.length > 120 || !contentType || !templateConfig) {
    res.status(400).json({ success: false, message: "A name, valid upload metadata, and valid configuration are required" }); return;
  }
  try {
    const asset = await validateCertificateAsset(objectPath, contentType);
    const [template] = await db.insert(certificateTemplates).values({
      name, description: typeof body.description === "string" ? body.description.trim().slice(0, 1000) : null,
      assetObjectPath: asset.path, assetContentType: asset.contentType, assetSizeBytes: asset.size,
      assetOriginalFilename: typeof body.originalFilename === "string" ? body.originalFilename.slice(0, 255) : null,
      assetChecksum: asset.checksum,
      config: templateConfig, createdByAdminId: req.adminId,
    }).returning();
    res.status(201).json({ success: true, template });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Upload validation failed" });
  }
});

router.get("/admin/certificate-templates", ...permission, async (_req, res) => {
  res.json({ success: true, templates: await db.select().from(certificateTemplates).orderBy(desc(certificateTemplates.updatedAt)) });
});

router.get("/admin/certificate-templates/:id/preview", ...permission, async (req, res) => {
  const [template] = await db.select().from(certificateTemplates).where(eq(certificateTemplates.id, String(req.params.id)));
  if (!template) { res.status(404).json({ success: false, message: "Certificate template not found" }); return; }
  const object = await readCertificateObject(template.assetObjectPath);
  if (!object) { res.status(404).json({ success: false, message: "Certificate template asset not found" }); return; }
  res.setHeader("Content-Type", object.contentType);
  res.setHeader("Content-Length", String(object.bytes.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.send(object.bytes);
});

router.patch("/admin/certificate-templates/:id", ...permission, async (req, res) => {
  const [existing] = await db.select().from(certificateTemplates).where(eq(certificateTemplates.id, String(req.params.id)));
  if (!existing) { res.status(404).json({ success: false, message: "Certificate template not found" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const nextConfig = body.config === undefined ? existing.config : config(body.config);
  if (!nextConfig) { res.status(400).json({ success: false, message: "Invalid certificate configuration" }); return; }
  const name = body.name === undefined ? existing.name : typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) { res.status(400).json({ success: false, message: "A valid template name is required" }); return; }
  let asset: Awaited<ReturnType<typeof validateCertificateAsset>> = {
    path: existing.assetObjectPath,
    contentType: existing.assetContentType,
    size: existing.assetSizeBytes,
    checksum: existing.assetChecksum,
  };
  if (body.objectPath !== undefined || body.contentType !== undefined) {
    const path = typeof body.objectPath === "string" ? body.objectPath : "";
    const type = normalizeAssetContentType(body.contentType);
    if (!type) { res.status(400).json({ success: false, message: "Valid replacement upload metadata is required" }); return; }
    try { asset = await validateCertificateAsset(path, type); } catch (error) { res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Invalid replacement asset" }); return; }
  }
  const [template] = await db.update(certificateTemplates).set({
    name, description: body.description === undefined ? existing.description : typeof body.description === "string" ? body.description.trim().slice(0, 1000) : existing.description,
    config: nextConfig, assetObjectPath: asset.path, assetContentType: asset.contentType, assetSizeBytes: asset.size,
    assetOriginalFilename: asset.path !== existing.assetObjectPath && typeof body.originalFilename === "string"
      ? body.originalFilename.slice(0, 255) : existing.assetOriginalFilename,
    assetChecksum: asset.checksum,
    version: existing.version + 1, updatedAt: new Date(),
  }).where(eq(certificateTemplates.id, existing.id)).returning();
  if (asset.path !== existing.assetObjectPath) await deleteCertificateObject(existing.assetObjectPath);
  res.json({ success: true, template });
});

router.post("/admin/certificate-templates/:id/activate", ...permission, async (_req, res) => {
  const id = String(_req.params.id);
  const [template] = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(491027)`);
    const [target] = await tx.select({ id: certificateTemplates.id }).from(certificateTemplates).where(eq(certificateTemplates.id, id));
    if (!target) return [];
    await tx.update(certificateTemplates).set({ isActive: false, updatedAt: new Date() }).where(eq(certificateTemplates.isActive, true));
    return tx.update(certificateTemplates).set({ isActive: true, updatedAt: new Date() }).where(eq(certificateTemplates.id, id)).returning();
  });
  if (!template) { res.status(404).json({ success: false, message: "Certificate template not found" }); return; }
  res.json({ success: true, template });
});

router.delete("/admin/certificate-templates/:id", ...permission, async (req, res) => {
  const [template] = await db.select().from(certificateTemplates).where(eq(certificateTemplates.id, String(req.params.id)));
  if (!template) { res.status(404).json({ success: false, message: "Certificate template not found" }); return; }
  if (template.isActive) { res.status(409).json({ success: false, message: "Activate another certificate template before deleting this one" }); return; }
  await db.delete(certificateTemplates).where(eq(certificateTemplates.id, template.id));
  await deleteCertificateObject(template.assetObjectPath);
  res.json({ success: true });
});

router.post("/admin/certificates/generate", ...permission, async (req: AuthRequest, res) => {
  const assessmentId = typeof req.body?.assessmentId === "string" ? req.body.assessmentId : "";
  const templateId = typeof req.body?.templateId === "string" ? req.body.templateId : "";
  const [assessment] = await db.select().from(assessments).where(eq(assessments.id, assessmentId));
  if (!assessment) { res.status(404).json({ success: false, message: "Assessment not found" }); return; }
  const [lead] = assessment.leadId ? await db.select().from(leads).where(eq(leads.id, assessment.leadId)) : [];
  const conditions = templateId ? eq(certificateTemplates.id, templateId) : eq(certificateTemplates.isActive, true);
  const [template] = await db.select().from(certificateTemplates).where(and(conditions, eq(certificateTemplates.isActive, true)));
  if (!template) { res.status(400).json({ success: false, message: "An active certificate template is required" }); return; }
  const [existing] = await db.select().from(generatedCertificates).where(and(
    eq(generatedCertificates.assessmentId, assessment.id),
    eq(generatedCertificates.certificateTemplateId, template.id),
    eq(generatedCertificates.certificateTemplateVersion, template.version),
  ));
  if (existing) {
    const stored = await readCertificateObject(existing.objectPath);
    if (stored) {
      res.json({ success: true, certificate: existing, previewUrl: `/api/admin/certificates/${existing.id}/preview` });
      return;
    }
    await db.delete(generatedCertificates).where(eq(generatedCertificates.id, existing.id));
  }
  const bytes = await createCertificatePdf({
    recipientName: lead?.name ?? "Assessment Participant", company: lead?.company ?? "",
    assessmentDate: assessment.completedAt, score: assessment.totalScore, ...template.config,
    asset: { path: template.assetObjectPath, contentType: template.assetContentType, size: template.assetSizeBytes },
  });
  const objectPath = await writeGeneratedCertificate(bytes);
  let certificate: typeof generatedCertificates.$inferSelect;
  try {
    [certificate] = await db.insert(generatedCertificates).values({
      assessmentId: assessment.id, leadId: assessment.leadId, certificateTemplateId: template.id,
      certificateTemplateVersion: template.version,
      certificateTemplateSnapshot: { name: template.name, assetObjectPath: template.assetObjectPath, assetOriginalFilename: template.assetOriginalFilename, assetContentType: template.assetContentType, assetChecksum: template.assetChecksum, config: template.config },
      objectPath, generatedByAdminId: req.adminId,
    }).returning();
  } catch (error) {
    await deleteCertificateObject(objectPath);
    throw error;
  }
  res.status(201).json({ success: true, certificate, previewUrl: `/api/admin/certificates/${certificate.id}/preview` });
});

router.get("/admin/certificates/:id/preview", ...permission, async (req, res) => {
  const [certificate] = await db.select().from(generatedCertificates).where(eq(generatedCertificates.id, String(req.params.id)));
  if (!certificate) { res.status(404).json({ success: false, message: "Certificate not found" }); return; }
  const object = await readCertificateObject(certificate.objectPath);
  if (!object) { res.status(404).json({ success: false, message: "Certificate file not found" }); return; }
  res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, no-store"); res.send(object.bytes);
});

router.get("/assessments/:id/certificate", async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ success: false, message: "Please sign in to continue" }); return; }
  const assessmentId = String(req.params.id);
  const [row] = await db.select({ assessment: assessments, lead: leads })
    .from(assessments)
    .innerJoin(leads, eq(assessments.leadId, leads.id))
    .where(eq(assessments.id, assessmentId));
  if (!row || row.lead.clerkUserId !== auth.userId) {
    res.status(404).json({ success: false, message: "Assessment not found" });
    return;
  }
  const [template] = await db.select().from(certificateTemplates).where(eq(certificateTemplates.isActive, true));
  if (!template) {
    res.status(409).json({ success: false, message: "A certificate template has not been selected yet. Please contact support." });
    return;
  }
  const [existing] = await db.select().from(generatedCertificates).where(and(
    eq(generatedCertificates.assessmentId, row.assessment.id),
    eq(generatedCertificates.certificateTemplateId, template.id),
    eq(generatedCertificates.certificateTemplateVersion, template.version),
  )).orderBy(desc(generatedCertificates.createdAt));
  if (existing) {
    const stored = await readCertificateObject(existing.objectPath);
    if (stored) {
      const safeCompany = row.lead.company.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "Business";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="LegalIQ-Certificate-${safeCompany}.pdf"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.send(stored.bytes);
      return;
    }
    await db.delete(generatedCertificates).where(eq(generatedCertificates.id, existing.id));
  }
  const bytes = await createCertificatePdf({
    recipientName: row.lead.name,
    company: row.lead.company,
    assessmentDate: row.assessment.completedAt,
    score: row.assessment.totalScore,
    ...template.config,
    asset: { path: template.assetObjectPath, contentType: template.assetContentType, size: template.assetSizeBytes },
  });
  const objectPath = await writeGeneratedCertificate(bytes);
  try {
    await db.insert(generatedCertificates).values({
      assessmentId: row.assessment.id,
      leadId: row.assessment.leadId,
      certificateTemplateId: template.id,
      certificateTemplateVersion: template.version,
      certificateTemplateSnapshot: {
        name: template.name,
        assetObjectPath: template.assetObjectPath,
        assetOriginalFilename: template.assetOriginalFilename,
        assetContentType: template.assetContentType,
        assetChecksum: template.assetChecksum,
        config: template.config,
      },
      objectPath,
    });
  } catch (error) {
    await deleteCertificateObject(objectPath);
    throw error;
  }
  const safeCompany = row.lead.company.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "Business";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="LegalIQ-Certificate-${safeCompany}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(Buffer.from(bytes));
});

export default router;