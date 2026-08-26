import { db, brochureTemplates, reports, type BrochureTemplateConfig } from "@workspace/db";
import { desc, eq, isNull } from "drizzle-orm";

export const DEFAULT_BROCHURE_CONFIG: BrochureTemplateConfig = {
  colors: { navy: "#0B1026", gold: "#C9A84C", accent: "#E2C97E" },
  contactEmail: "info@restthecase.com",
  contactPhone: "+91 9876543210",
  website: "restthecase.com/virtualCLOPackage",
  tagline: "Always-On Legal Protection for Indian Businesses.",
  coverTitle: "Virtual Chief Legal Officer (VCLO) Service",
  coverSubtitle: "Proactive legal protection, predictable costs, and a dedicated legal partner for your business.",
  vcloPitch: "A dedicated legal professional who understands your business and manages risk before it becomes expensive.",
  scoreLabel: "Legal Health Score",
};

export function isBrochureTemplateConfig(value: unknown): value is BrochureTemplateConfig {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<BrochureTemplateConfig>;
  const colors = c.colors as Record<string, unknown> | undefined;
  const strings = ["contactEmail", "contactPhone", "website", "tagline", "coverTitle", "coverSubtitle", "vcloPitch", "scoreLabel"] as const;
  return Boolean(
    colors &&
    ["navy", "gold", "accent"].every((key) => typeof colors[key] === "string") &&
    strings.every((key) => typeof c[key] === "string")
  );
}

export async function ensureDefaultBrochureTemplate() {
  const [existing] = await db.select().from(brochureTemplates).where(eq(brochureTemplates.templateKey, "vclo-standard"));
  const template = existing ?? (await db.insert(brochureTemplates).values({
      name: "VCLO Standard",
      description: "The original LegalIQ VCLO brochure in the REST THE CASE navy and gold brand.",
      templateKey: "vclo-standard",
      version: 1,
      isActive: true,
      config: DEFAULT_BROCHURE_CONFIG,
    }).returning())[0];
  await db.update(reports).set({
    brochureTemplateId: template.id,
    brochureTemplateVersion: template.version,
    brochureTemplateSnapshot: template.config,
    brochureTemplateSelectedAt: new Date(),
  }).where(isNull(reports.brochureTemplateId));
  return template;
}

export async function assignDefaultBrochureTemplate(reportId: string) {
  await ensureDefaultBrochureTemplate();
  const activeTemplates = await db.select().from(brochureTemplates)
    .where(eq(brochureTemplates.isActive, true))
    .orderBy(desc(brochureTemplates.updatedAt));
  const template = activeTemplates.find((item) => item.templateKey === "vclo-standard") ?? activeTemplates[0];
  if (!template) throw new Error("No active brochure template is available");
  await db.update(reports).set({
    brochureTemplateId: template.id,
    brochureTemplateVersion: template.version,
    brochureTemplateSnapshot: template.config,
    brochureTemplateSelectedAt: new Date(),
  }).where(eq(reports.id, reportId));
}