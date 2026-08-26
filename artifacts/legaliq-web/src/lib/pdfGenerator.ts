import { jsPDF } from "jspdf";

export interface PillarScore {
  label: string;
  score: number;
}

export interface Insight {
  title: string;
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  financialRisk: string;
  reason?: string;
  businessImpact?: string;
  futureProblem?: string;
  recommendation?: string;
}

export interface FutureRisk {
  title: string;
  level: "HIGH" | "MEDIUM" | "LOW";
  impact: string;
  reason: string;
  action: string;
}

export interface Action {
  action: string;
  description: string;
  timeline: "THIS WEEK" | "THIS MONTH" | "90 DAYS";
  priority?: "Immediate" | "Short-Term" | "Long-Term";
  costMin?: string;
  costMax?: string;
  delayImpact?: string;
}

export interface AnswerHistoryItem {
  question: string;
  pillar: string;
  answer: string;
  score: number;
  maxScore: number;
  weight: number;
  isSeed: boolean;
  info: string;
  impact: string;
  suggestion: string;
  recommendation: string;
}

export interface CaseStudyExample {
  businessName: string;
  whatHappened: string;
  consequences: string;
  vcloWouldHave: string;
  lesson: string;
}

export interface BenchmarkData {
  avgScore: number;
  minScore: number;
  maxScore: number;
  sampleSize: number;
}

export interface ReportData {
  company: string;
  name: string;
  businessType: string;
  city: string;
  totalScore: number;
  riskLevel: string;
  summary: string;
  pillars: PillarScore[];
  insights: Insight[];
  futureRisks?: FutureRisk[];
  actions: Action[];
  costSummary?: Array<{ issue: string; costRange: string; delayImpact: string }>;
  similarCases?: Array<{
    caseStudyId?: string;
    title: string;
    summary: string;
    relevance: string;
    readMoreUrl: string;
    caseStudy?: {
      id: string;
      slug: string;
      businessIndustry: string;
      legalSituation: string;
      disputeNature: string;
      keyLegalIssue: string;
      businessImpact: string;
      resolution: string;
      takeaway: string;
      lhsPillars: string[];
      recommendation: string;
      sourceTitle: string;
      sourceUrl: string;
    };
  }>;
  vcloPitch?: string;
  answerHistory?: AnswerHistoryItem[];
  example?: CaseStudyExample;
  benchmark?: BenchmarkData;
}

// ─── Color palette ────────────────────────────────────────────────────────────
const GOLD   : [number,number,number] = [201, 168,  76];
const DARK   : [number,number,number] = [ 10,  10,  10];
const WHITE  : [number,number,number] = [255, 255, 255];
const NEAR_W : [number,number,number] = [245, 243, 238];
const INK1   : [number,number,number] = [ 28,  26,  24];
const INK2   : [number,number,number] = [ 75,  70,  65];
const INK3   : [number,number,number] = [135, 128, 118];
const INK4   : [number,number,number] = [210, 206, 198];
const PANEL  : [number,number,number] = [248, 246, 242];
const DARK_P : [number,number,number] = [ 20,  18,  14];

const PILLAR_COLORS: [number,number,number][] = [
  [220,  60,  60],
  [210, 130,  20],
  [ 50, 120, 220],
  [120,  70, 210],
];

const PILLAR_LABELS = ["LITIGATION", "CONTRACTS", "COMPLIANCE", "COST"];

const PILLAR_DESCRIPTIONS = [
  "Exposure to disputes, legal notices, and court proceedings.",
  "Strength and enforceability of vendor, employee, and customer agreements.",
  "Adherence to statutory filings, licenses, and regulatory obligations.",
  "Efficiency of legal spend and preparedness to avoid avoidable costs.",
];

export interface ComparisonRow {
  label: string;
  traditional: string;
  vclo: string;
}

export const VCLO_COMPARISON: ComparisonRow[] = [
  { label: "Cost Efficiency", traditional: "Typically billed hourly or per matter, so costs vary with case complexity and volume", vclo: "Flat monthly subscription, making legal costs predictable and easier to budget" },
  { label: "Ongoing Support", traditional: "Usually engaged on a case-by-case basis when an issue comes up", vclo: "Continuous access to legal support as part of the subscription, not only when problems arise" },
  { label: "Response Time", traditional: "Response depends on the lawyer's availability and may need advance scheduling", vclo: "Direct access to a legal point of contact, without having to find a new lawyer each time" },
  { label: "Compliance Monitoring", traditional: "Tracking filings, licences, and renewal deadlines is usually left to the business", vclo: "Structured tracking of key compliance deadlines, filings, and renewals" },
  { label: "Contract Review", traditional: "Each contract review is typically a separate, billable engagement", vclo: "Contract review is included as part of the ongoing service" },
  { label: "Risk Prevention", traditional: "Legal issues are often addressed only after they arise", vclo: "Regular check-ins help identify and address risks before they escalate" },
  { label: "Business-Focused Guidance", traditional: "Advice is often general and not tailored to a specific industry or stage", vclo: "Guidance is shaped around your business model, sector, and stage of growth" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip characters jsPDF / Helvetica cannot render (emojis, ₹, etc.) */
function clean(text: string): string {
  return (text ?? "")
    .replace(/₹/g, "Rs.")
    .replace(/\u20B9/g, "Rs.")
    .replace(/[^\u0000-\u00FF]/g, "")  // keep Latin-1 only
    .replace(/\s+/g, " ")
    .trim();
}

function wrap(doc: jsPDF, text: string, maxW: number): string[] {
  return doc.splitTextToSize(clean(text), maxW);
}

function grade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function riskRGB(scoreOrLevel: number | string): [number,number,number] {
  const g = typeof scoreOrLevel === "number" ? grade(scoreOrLevel) : scoreOrLevel;
  if (g === "D" || scoreOrLevel === "CRITICAL") return [220, 50, 50];
  if (g === "C" || scoreOrLevel === "RISKY") return [220, 120, 30];
  if (g === "B" || scoreOrLevel === "STABLE" || scoreOrLevel === "MODERATE") return [210, 130, 20];
  return [34, 180, 80];
}

function gradeLabel(score: number): string {
  const g = grade(score);
  if (g === "A") return "Healthy";
  if (g === "B") return "Stable";
  if (g === "C") return "Risky";
  return "Critical";
}

function sevRGB(s: string): [number,number,number] {
  if (s === "HIGH")   return [220, 50, 50];
  if (s === "MEDIUM") return [210, 130, 20];
  return [34, 180, 80];
}

function tlRGB(t: string): [number,number,number] {
  if (t === "THIS WEEK")  return [220, 50, 50];
  if (t === "THIS MONTH") return [210, 130, 20];
  return [50, 120, 220];
}

// ─── Shared page chrome ────────────────────────────────────────────────────────

function pageHeader(doc: jsPDF, pageNum: number) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 2.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...GOLD);
  doc.text("LegalIQ  |  Legal Health Report", 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK3);
  doc.text(`by Rest The Case  |  restthecase.com/virtualCLOPackage  |  Page ${pageNum}`, W - 14, 11, { align: "right" });

  doc.setDrawColor(...INK4);
  doc.setLineWidth(0.25);
  doc.line(14, 15, W - 14, 15);
}

function pageFooter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...INK4);
  doc.setLineWidth(0.25);
  doc.line(14, H - 13, W - 14, H - 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK3);
  doc.text("Confidential. For informational purposes only. Not legal advice — consult a qualified Advocate.", 14, H - 7.5);
  doc.text("restthecase.com/virtualCLOPackage", W - 14, H - 7.5, { align: "right" });
}

// Draw a small filled square as a pillar colour indicator (replaces emoji)
function pillarDot(doc: jsPDF, x: number, y: number, color: [number,number,number]) {
  doc.setFillColor(...color);
  doc.roundedRect(x, y - 3, 4.5, 4.5, 1, 1, "F");
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function renderReportPDFBytes(data: ReportData): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W   = doc.internal.pageSize.getWidth();   // 210
  const H   = doc.internal.pageSize.getHeight();  // 297
  const ML  = 16;
  const MR  = 16;
  const CW  = W - ML - MR; // 178

  const g   = grade(data.totalScore);
  const gl  = gradeLabel(data.totalScore);
  const rc  = riskRGB(data.totalScore);
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  // ══════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ══════════════════════════════════════════════════════════════
  let page = 1;

  // Dark full background
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, H, "F");

  // Top gold bar
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 3.5, "F");

  // Left gold stripe
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, 3.5, H, "F");

  // ── Brand mark ──────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...GOLD);
  doc.text("LegalIQ", ML + 6, 44);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK3);
  doc.text("Legal Health Assessment  |  by Rest The Case", ML + 6, 54);

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(ML + 6, 60, W - ML, 60);

  // ── Company ─────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...WHITE);
  const coLines = wrap(doc, data.company, CW - 8);
  doc.text(coLines, ML + 6, 77);
  const coH = coLines.length * 11;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK3);
  doc.text(clean(`${data.businessType}  |  ${data.city}`), ML + 6, 77 + coH + 4);

  // ── Score panel ─────────────────────────────────────────────
  const spY = 118;
  const spH = 78;
  doc.setFillColor(22, 22, 22);
  doc.roundedRect(ML + 6, spY, CW - 6, spH, 7, 7, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.roundedRect(ML + 6, spY, CW - 6, spH, 7, 7, "S");

  // Label inside box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK3);
  doc.text("LEGAL HEALTH SCORE", ML + 18, spY + 14);

  // Big number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(64);
  doc.setTextColor(...GOLD);
  doc.text(`${data.totalScore}`, ML + 18, spY + 54);
  const numW = doc.getTextWidth(`${data.totalScore}`);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(...INK3);
  doc.text("/ 100", ML + 18 + numW + 3, spY + 54);

  // Grade + risk badge (right side)
  const bX = ML + 18 + numW + 36;
  doc.setFillColor(...rc);
  doc.roundedRect(bX, spY + 36, 44, 20, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(`Grade ${g}`, bX + 22, spY + 50, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(...rc);
  doc.text(clean(gl).toUpperCase(), bX + 22, spY + 66, { align: "center" });

  // ── Summary ─────────────────────────────────────────────────
  const sumY = spY + spH + 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(170, 165, 155);
  const sumLines = wrap(doc, data.summary, CW - 8);
  doc.text(sumLines.slice(0, 7), ML + 6, sumY);

  // ── Prepared for / date ──────────────────────────────────────
  const bY = H - 38;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(ML + 6, bY, W - ML, bY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK3);
  doc.text("PREPARED FOR", ML + 6, bY + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(clean(`${data.name}  |  ${data.company}`), ML + 6, bY + 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK3);
  doc.text("DATE", W - ML - 36, bY + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(today, W - ML - 36, bY + 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(80, 76, 70);
  doc.text("Confidential  |  Not legal advice  |  restthecase.com/virtualCLOPackage", ML + 6, H - 9);

  // ══════════════════════════════════════════════════════════════
  // PAGE 2 — 4-PILLAR BREAKDOWN
  // ══════════════════════════════════════════════════════════════
  doc.addPage();
  page++;
  pageHeader(doc, page);
  pageFooter(doc);

  let y = 24;

  // Section title
  doc.setFillColor(...DARK_P);
  doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...GOLD);
  doc.text("4-PILLAR LEGAL HEALTH BREAKDOWN", ML + 6, y + 8.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 142, 120);
  doc.text("Each pillar scored out of 25", ML + CW - 6, y + 8.5, { align: "right" });
  y += 18;

  const rowH = 40;
  const rowGap = 6;
  const barX = ML + 12;
  const barW2 = CW - 24;

  data.pillars.forEach((p, i) => {
    const col = PILLAR_COLORS[i]!;
    const lightCol = col.map((c) => Math.min(255, c + 190)) as [number, number, number];
    const pct = Math.min(1, p.score / 25);
    const rY = y + i * (rowH + rowGap);
    const pg = grade((p.score / 25) * 100);
    const pgRGB = riskRGB((p.score / 25) * 100);

    // Card background + border
    doc.setFillColor(...PANEL);
    doc.roundedRect(ML, rY, CW, rowH, 3, 3, "F");
    doc.setDrawColor(...INK4);
    doc.setLineWidth(0.2);
    doc.roundedRect(ML, rY, CW, rowH, 3, 3, "S");

    // Left colour accent strip (full height)
    doc.setFillColor(...col);
    doc.roundedRect(ML, rY, 4.5, rowH, 2, 2, "F");

    // ── Header row: number badge · pillar name · tag  ||  score · grade chip ──
    const headerY = rY + 13;

    doc.setFillColor(...col);
    doc.circle(ML + 17, headerY - 3, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text(`${i + 1}`, ML + 17, headerY, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK1);
    doc.text(clean(p.label), ML + 30, headerY);
    const nameW = doc.getTextWidth(clean(p.label));

    const tagX = ML + 30 + nameW + 6;
    doc.setFillColor(...lightCol);
    const tagW = doc.getTextWidth(PILLAR_LABELS[i]!) + 8;
    doc.roundedRect(tagX, headerY - 8, tagW, 7.5, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...col);
    doc.text(PILLAR_LABELS[i]!, tagX + tagW / 2, headerY - 3, { align: "center" });

    // Score + grade chip, right-aligned
    const scoreStr = `${p.score}/25`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...col);
    doc.text(scoreStr, ML + CW - 8, headerY, { align: "right" });
    const scoreW = doc.getTextWidth(scoreStr);

    const chipW = 20;
    const chipX = ML + CW - 8 - scoreW - 8 - chipW;
    doc.setFillColor(...pgRGB);
    doc.roundedRect(chipX, headerY - 10, chipW, 9, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...WHITE);
    doc.text(`${pg}`, chipX + chipW / 2, headerY - 3.5, { align: "center" });

    // ── Description line ──────────────────────────────────────────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK3);
    doc.text(clean(PILLAR_DESCRIPTIONS[i]!), ML + 30, headerY + 6.5);

    // ── Progress bar ──────────────────────────────────────────────────────
    const barY2 = rY + rowH - 8;
    doc.setFillColor(...INK4);
    doc.roundedRect(barX, barY2, barW2, 4.5, 2, 2, "F");
    doc.setFillColor(...col);
    const fillW = barW2 * pct;
    if (fillW > 0) doc.roundedRect(barX, barY2, Math.max(2, fillW), 4.5, 2, 2, "F");
  });

  y += data.pillars.length * (rowH + rowGap) + 4;

  // Legend
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK3);
  doc.text("Score guide (per pillar, out of 25):  0-9 D (At Risk)   10-14 C (Needs Attention)   15-19 B (Good)   20-25 A (Excellent)", ML, y);
  y += 10;

  // Overall summary bar
  doc.setFillColor(...DARK_P);
  doc.roundedRect(ML, y, CW, 26, 4, 4, "F");
  doc.setFillColor(...rc);
  doc.rect(ML, y, 3.5, 26, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text("Overall Legal Health Score", ML + 9, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(160, 155, 145);
  const ol = data.totalScore >= 80 ? "Excellent — Legal health is strong."
    : data.totalScore >= 60 ? "Good — Some areas need attention."
    : data.totalScore >= 40 ? "At Risk — Significant gaps require priority action."
    : "Critical — Immediate legal intervention required.";
  doc.text(ol, ML + 9, y + 19);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...rc);
  doc.text(`${data.totalScore}/100  Grade ${g}`, W - ML - 4, y + 17, { align: "right" });

  // ── Industry benchmark strip ──────────────────────────────────
  if (data.benchmark) {
    y += 26 + 10;
    if (y + 30 > H - 20) {
      doc.addPage();
      page++;
      pageHeader(doc, page);
      pageFooter(doc);
      y = 24;
    }
    const bm = data.benchmark;
    doc.setFillColor(...PANEL);
    doc.roundedRect(ML, y, CW, 30, 4, 4, "F");
    doc.setDrawColor(...INK4);
    doc.setLineWidth(0.2);
    doc.roundedRect(ML, y, CW, 30, 4, 4, "S");
    doc.setFillColor(...GOLD);
    doc.rect(ML, y, 3.5, 30, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK1);
    doc.text(`How ${clean(data.businessType)} businesses compare`, ML + 9, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK3);
    doc.text(clean(`Based on ${bm.sampleSize} LegalIQ assessments in this category`), ML + 9, y + 16.5);

    const stats: [string, number][] = [
      ["YOUR SCORE", data.totalScore],
      ["CATEGORY AVG", Math.round(bm.avgScore)],
      ["LOWEST", Math.round(bm.minScore)],
      ["HIGHEST", Math.round(bm.maxScore)],
    ];
    const statW = (CW - 18) / stats.length;
    stats.forEach(([label, val], i) => {
      const sx = ML + 9 + i * statW + statW / 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(i === 0 ? GOLD[0] : INK2[0], i === 0 ? GOLD[1] : INK2[1], i === 0 ? GOLD[2] : INK2[2]);
      doc.text(`${val}`, sx, y + 22, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...INK3);
      doc.text(label, sx, y + 27, { align: "center" });
    });
    y += 30;
  }

  // ══════════════════════════════════════════════════════════════
  // PAGE 3 — KEY RISK INSIGHTS
  // ══════════════════════════════════════════════════════════════
  doc.addPage();
  page++;
  pageHeader(doc, page);
  pageFooter(doc);

  y = 24;

  // Section header bar
  doc.setFillColor(...DARK_P);
  doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...GOLD);
  doc.text("KEY RISK INSIGHTS", ML + 6, y + 8.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130, 120, 100);
  doc.text(`${data.insights.length} risks identified`, W - ML - 6, y + 8.5, { align: "right" });
  y += 18;

  data.insights.forEach((ins, i) => {
    const sc = sevRGB(ins.severity);
    const titleLines  = wrap(doc, ins.title, CW - 46);
    const descLines   = wrap(doc, ins.description, CW - 20);
    const reasonLines = ins.reason ? wrap(doc, `Why this was flagged: ${ins.reason}`, CW - 20) : [];
    const impactLines = ins.businessImpact ? wrap(doc, `Business impact: ${ins.businessImpact}`, CW - 20) : [];
    const futureLines = ins.futureProblem ? wrap(doc, `If left unresolved: ${ins.futureProblem}`, CW - 20) : [];
    const recLines    = ins.recommendation ? wrap(doc, `Recommendation: ${ins.recommendation}`, CW - 20) : [];
    const frLines     = wrap(doc, `Estimated exposure: ${ins.financialRisk}`, CW - 20);

    const boxH =
      10 +
      titleLines.length * 5.5 + 4 +
      descLines.length * 4.6 + 3 +
      (reasonLines.length > 0 ? reasonLines.length * 4.4 + 3 : 0) +
      (impactLines.length > 0 ? impactLines.length * 4.4 + 3 : 0) +
      (futureLines.length > 0 ? futureLines.length * 4.4 + 3 : 0) +
      frLines.length * 4.4 + 3 +
      (recLines.length > 0 ? recLines.length * 4.4 + 3 : 0) +
      6;

    if (y + boxH > H - 20) {
      doc.addPage();
      page++;
      pageHeader(doc, page);
      pageFooter(doc);
      y = 24;
    }

    // Card
    doc.setFillColor(...PANEL);
    doc.roundedRect(ML, y, CW, boxH, 4, 4, "F");
    doc.setDrawColor(...INK4);
    doc.setLineWidth(0.25);
    doc.roundedRect(ML, y, CW, boxH, 4, 4, "S");

    // Left accent strip
    doc.setFillColor(...sc);
    doc.rect(ML, y, 4, boxH, "F");

    // Top row: severity badge + counter
    const badgeW2 = doc.getTextWidth(ins.severity) + 10;
    doc.setFillColor(...sc);
    doc.roundedRect(W - ML - 8 - badgeW2, y + 7, badgeW2, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(ins.severity, W - ML - 8 - badgeW2 / 2, y + 12.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK3);
    doc.text(`Risk ${i + 1} of ${data.insights.length}`, ML + 10, y + 8);

    // Title
    let cy = y + 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK1);
    doc.text(titleLines, ML + 10, cy);
    cy += titleLines.length * 5.5 + 4;

    // Description
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK2);
    doc.text(descLines, ML + 10, cy);
    cy += descLines.length * 4.6 + 3;

    if (reasonLines.length > 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...INK3);
      doc.text(reasonLines, ML + 10, cy);
      cy += reasonLines.length * 4.4 + 3;
    }

    if (impactLines.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(180, 40, 40);
      doc.text(impactLines, ML + 10, cy);
      cy += impactLines.length * 4.4 + 3;
    }

    if (futureLines.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...INK2);
      doc.text(futureLines, ML + 10, cy);
      cy += futureLines.length * 4.4 + 3;
    }

    // Financial risk line
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(175, 85, 0);
    doc.text(frLines, ML + 10, cy);
    cy += frLines.length * 4.4 + 3;

    if (recLines.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 130, 70);
      doc.text(recLines, ML + 10, cy);
    }

    y += boxH + 7;
  });

  // ══════════════════════════════════════════════════════════════
  // PAGE — FUTURE RISK EXPOSURE
  // ══════════════════════════════════════════════════════════════
  if (data.futureRisks && data.futureRisks.length > 0) {
    doc.addPage();
    page++;
    pageHeader(doc, page);
    pageFooter(doc);

    y = 24;

    doc.setFillColor(...DARK_P);
    doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...GOLD);
    doc.text("FUTURE RISK EXPOSURE", ML + 6, y + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 120, 100);
    doc.text(`${data.futureRisks.length} risks on the horizon`, W - ML - 6, y + 8.5, { align: "right" });
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK3);
    doc.text(
      wrap(doc, "Forward-looking legal risks this business may face in the next 12-24 months, based on your answer pattern and business profile.", CW),
      ML,
      y
    );
    y += 12;

    data.futureRisks.forEach((fr, i) => {
      const sc = sevRGB(fr.level);
      const titleLines  = wrap(doc, fr.title, CW - 46);
      const impactLines = wrap(doc, `Possible future impact: ${fr.impact}`, CW - 20);
      const reasonLines = wrap(doc, `Why you're exposed: ${fr.reason}`, CW - 20);
      const actionLines = wrap(doc, `Recommended action: ${fr.action}`, CW - 20);

      const boxH =
        10 +
        titleLines.length * 5.5 + 4 +
        impactLines.length * 4.6 + 3 +
        reasonLines.length * 4.4 + 3 +
        actionLines.length * 4.4 + 6;

      if (y + boxH > H - 20) {
        doc.addPage();
        page++;
        pageHeader(doc, page);
        pageFooter(doc);
        y = 24;
      }

      doc.setFillColor(...PANEL);
      doc.roundedRect(ML, y, CW, boxH, 4, 4, "F");
      doc.setDrawColor(...INK4);
      doc.setLineWidth(0.25);
      doc.roundedRect(ML, y, CW, boxH, 4, 4, "S");

      doc.setFillColor(...sc);
      doc.rect(ML, y, 4, boxH, "F");

      const badgeText = `${fr.level} RISK`;
      const badgeW2 = doc.getTextWidth(badgeText) + 10;
      doc.setFillColor(...sc);
      doc.roundedRect(W - ML - 8 - badgeW2, y + 7, badgeW2, 8, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...WHITE);
      doc.text(badgeText, W - ML - 8 - badgeW2 / 2, y + 12.5, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...INK3);
      doc.text(`Future Risk ${i + 1} of ${data.futureRisks!.length}`, ML + 10, y + 8);

      let cy = y + 20;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK1);
      doc.text(titleLines, ML + 10, cy);
      cy += titleLines.length * 5.5 + 4;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(180, 40, 40);
      doc.text(impactLines, ML + 10, cy);
      cy += impactLines.length * 4.6 + 3;

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...INK3);
      doc.text(reasonLines, ML + 10, cy);
      cy += reasonLines.length * 4.4 + 3;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 130, 70);
      doc.text(actionLines, ML + 10, cy);

      y += boxH + 7;
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PAGE — DETAILED ASSESSMENT HISTORY
  // ══════════════════════════════════════════════════════════════
  if (data.answerHistory && data.answerHistory.length > 0) {
    doc.addPage();
    page++;
    pageHeader(doc, page);
    pageFooter(doc);

    y = 24;

    doc.setFillColor(...DARK_P);
    doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...GOLD);
    doc.text("DETAILED ASSESSMENT HISTORY", ML + 6, y + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 120, 100);
    doc.text(`${data.answerHistory.length} questions answered`, W - ML - 6, y + 8.5, { align: "right" });
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK3);
    doc.text(
      wrap(doc, "Every question you answered, the choice you selected, the score it earned, and what that means for your business.", CW),
      ML,
      y
    );
    y += 12;

    data.answerHistory.forEach((qa, i) => {
      const pillarIdx = PILLAR_LABELS.findIndex((l) => qa.pillar.toUpperCase().startsWith(l)) >= 0
        ? PILLAR_LABELS.findIndex((l) => qa.pillar.toUpperCase().startsWith(l))
        : ["litigation", "contract", "compliance", "cost"].findIndex((k) => qa.pillar.toLowerCase().includes(k));
      const col = PILLAR_COLORS[Math.max(0, pillarIdx)]!;
      const isGood = qa.score >= 3;
      const isMid = qa.score === 2;
      const scoreColor: [number, number, number] = isGood ? [34, 180, 80] : isMid ? [210, 130, 20] : [220, 50, 50];
      const scoreWord = isGood ? "Full/near-full marks" : isMid ? "Partial marks" : "Marks lost";

      const outcome = qa.info || (isGood
        ? "This answer reflects a healthy legal practice for this question."
        : "This answer indicates a gap that increases legal exposure.");
      const whyText = isGood
        ? `Why: this response shows the safeguard is in place, so the question scored ${qa.score}/${qa.maxScore} with minimal risk carried forward.`
        : `Why marks were lost: this response signals the safeguard is missing or incomplete, so only ${qa.score}/${qa.maxScore} was awarded out of ${qa.maxScore}.`;
      const problemText = !isGood
        ? (qa.impact || "This gap could expose the business to disputes, penalties, or unenforceable claims if not addressed.")
        : "";
      const recommendation = qa.recommendation || qa.suggestion || "Review this area with a lawyer to close the gap.";

      const questionLines = wrap(doc, `Q${i + 1}. ${qa.question}`, CW - 20);
      const outcomeLines = wrap(doc, outcome, CW - 20);
      const whyLines = wrap(doc, whyText, CW - 20);
      const problemLines = problemText && !isGood ? wrap(doc, `Potential business problem: ${problemText}`, CW - 20) : [];
      const recLines = wrap(doc, `Recommendation: ${recommendation}`, CW - 20);

      const boxH =
        10 +
        questionLines.length * 5 +
        6 + // answer/score row
        outcomeLines.length * 4.4 + 3 +
        whyLines.length * 4.4 + 3 +
        (problemLines.length > 0 ? problemLines.length * 4.4 + 3 : 0) +
        recLines.length * 4.4 +
        10;

      if (y + boxH > H - 20) {
        doc.addPage();
        page++;
        pageHeader(doc, page);
        pageFooter(doc);
        y = 24;
      }

      // Card
      doc.setFillColor(...PANEL);
      doc.roundedRect(ML, y, CW, boxH, 4, 4, "F");
      doc.setDrawColor(...INK4);
      doc.setLineWidth(0.2);
      doc.roundedRect(ML, y, CW, boxH, 4, 4, "S");

      // Left accent
      doc.setFillColor(...col);
      doc.rect(ML, y, 4, boxH, "F");

      let cy = y + 10;

      // Pillar tag (top-left)
      const pillarTagW = doc.getTextWidth(qa.pillar) + 8;
      doc.setFillColor(...(col.map((c) => Math.min(255, c + 190)) as [number, number, number]));
      doc.roundedRect(ML + 9, y + 5, pillarTagW, 7, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...col);
      doc.text(clean(qa.pillar), ML + 9 + pillarTagW / 2, y + 9.8, { align: "center" });

      // Score badge (top-right)
      const scoreLbl = `${qa.score}/${qa.maxScore} — ${scoreWord}`;
      const scoreLblW = doc.getTextWidth(scoreLbl) + 10;
      doc.setFillColor(...scoreColor);
      doc.roundedRect(ML + CW - 9 - scoreLblW, y + 5, scoreLblW, 7, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...WHITE);
      doc.text(scoreLbl, ML + CW - 9 - scoreLblW / 2, y + 9.8, { align: "center" });

      cy = y + 18;

      // Question
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...INK1);
      doc.text(questionLines, ML + 9, cy);
      cy += questionLines.length * 5 + 2;

      // Selected answer
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.8);
      doc.setTextColor(...col);
      doc.text(`Your answer: ${clean(qa.answer)}`, ML + 9, cy);
      cy += 6;

      // Outcome / reason for score
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(...INK2);
      doc.text(outcomeLines, ML + 9, cy);
      cy += outcomeLines.length * 4.4 + 3;

      // Why marks lost/gained
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...INK3);
      doc.text(whyLines, ML + 9, cy);
      cy += whyLines.length * 4.4 + 3;

      // Business problem (only when marks were lost)
      if (problemLines.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(175, 60, 20);
        doc.text(problemLines, ML + 9, cy);
        cy += problemLines.length * 4.4 + 3;
      }

      // Recommendation
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.8);
      doc.setTextColor(20, 120, 90);
      doc.text(recLines, ML + 9, cy);

      y += boxH + 6;
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PAGE 4 — ACTION PLAN
  // ══════════════════════════════════════════════════════════════
  doc.addPage();
  page++;
  pageHeader(doc, page);
  pageFooter(doc);

  y = 24;

  // Section header bar
  doc.setFillColor(...DARK_P);
  doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...GOLD);
  doc.text("PRIORITISED ACTION PLAN", ML + 6, y + 8.5);
  y += 18;

  // Group by priority tier for PDF rendering
  const priorityOrder = ["Immediate", "Short-Term", "Long-Term"] as const;
  const priorityColors: Record<string, [number,number,number]> = {
    "Immediate":  [220, 60, 60],
    "Short-Term": [210, 130, 20],
    "Long-Term":  [50, 120, 220],
  };

  priorityOrder.forEach((tier) => {
    const tierActions = data.actions.filter(a => (a.priority ?? "Long-Term") === tier);
    if (tierActions.length === 0) return;

    const tierColor = priorityColors[tier] as [number,number,number];

    // Tier sub-header
    if (y + 10 > H - 20) { doc.addPage(); page++; pageHeader(doc, page); pageFooter(doc); y = 24; }
    doc.setFillColor(...tierColor.map(c => Math.min(255, c + 190)) as [number,number,number]);
    doc.roundedRect(ML, y, CW, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...tierColor);
    doc.text(tier.toUpperCase(), ML + 5, y + 5.5);
    y += 12;

    tierActions.forEach((act, i) => {
      const titleLines = wrap(doc, act.action, CW - 36);
      const costText = act.costMin ? `${act.costMin}${act.costMax ? ` - ${act.costMax}` : ""}` : "";
      const delayLines = act.delayImpact ? wrap(doc, act.delayImpact, CW - 36) : [];

      const boxH = Math.max(26,
        16
        + titleLines.length * 5.5
        + (costText ? 7 : 0)
        + (delayLines.length > 0 ? 4 + delayLines.length * 4.6 : 0)
        + 8
      );

      if (y + boxH > H - 20) {
        doc.addPage(); page++; pageHeader(doc, page); pageFooter(doc); y = 24;
      }

      // Card
      doc.setFillColor(...PANEL);
      doc.roundedRect(ML, y, CW, boxH, 4, 4, "F");
      doc.setDrawColor(...INK4);
      doc.setLineWidth(0.2);
      doc.roundedRect(ML, y, CW, boxH, 4, 4, "S");

      // Left accent bar in tier colour
      doc.setFillColor(...tierColor);
      doc.rect(ML, y, 4, boxH, "F");

      // Step circle
      const circY = y + boxH / 2;
      doc.setFillColor(...tierColor);
      doc.circle(ML + 14, circY, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      doc.text(`${i + 1}`, ML + 14, circY + 3, { align: "center" });

      // Timeline badge top-right
      const tlW = doc.getTextWidth(act.timeline) + 8;
      doc.setFillColor(...tierColor.map(c => Math.min(255, c + 185)) as [number,number,number]);
      doc.roundedRect(W - ML - tlW - 6, y + 5, tlW, 7.5, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...tierColor);
      doc.text(act.timeline, W - ML - tlW / 2 - 6, y + 10, { align: "center" });

      const textX = ML + 26;
      const textW = CW - 26 - tlW - 10;
      let innerY = y + 11;

      // Title
      const wTitle = wrap(doc, act.action, textW);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...INK1);
      doc.text(wTitle, textX, innerY);
      innerY += wTitle.length * 5.5;

      // Cost range
      if (costText) {
        innerY += 3;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...GOLD);
        doc.text(`Est. Cost: ${costText}`, textX, innerY);
        innerY += 5.5;
      }

      // Delay impact
      if (delayLines.length > 0) {
        innerY += 2;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...INK3);
        doc.text(delayLines, textX, innerY);
      }

      y += boxH + 5;
    });

    y += 4; // spacing between tiers
  });

  // Cost Summary block on action plan page
  if (data.costSummary && data.costSummary.length > 0) {
    if (y + 14 > H - 20) { doc.addPage(); page++; pageHeader(doc, page); pageFooter(doc); y = 24; }

    // Header
    doc.setFillColor(...DARK_P);
    doc.roundedRect(ML, y, CW, 10, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...GOLD);
    doc.text("COST SUMMARY", ML + 5, y + 7);
    y += 14;

    data.costSummary.forEach((row) => {
      const issueLines = wrap(doc, row.issue, CW * 0.4);
      const delayLines = wrap(doc, row.delayImpact, CW * 0.42);
      const rowH = Math.max(14, Math.max(issueLines.length, delayLines.length) * 4.6 + 6);

      if (y + rowH > H - 20) { doc.addPage(); page++; pageHeader(doc, page); pageFooter(doc); y = 24; }

      doc.setFillColor(...PANEL);
      doc.roundedRect(ML, y, CW, rowH, 2, 2, "F");
      doc.setDrawColor(...INK4);
      doc.setLineWidth(0.15);
      doc.roundedRect(ML, y, CW, rowH, 2, 2, "S");

      const col1X = ML + 4;
      const col2X = ML + CW * 0.42;
      const col3X = ML + CW * 0.62;
      const ry = y + 5;

      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...INK1);
      doc.text(issueLines, col1X, ry);

      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GOLD);
      doc.text(row.costRange, col2X, ry);

      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...INK2);
      doc.text(delayLines, col3X, ry);

      y += rowH + 3;
    });

    // Note about interactive report
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK3);
    doc.text("For Similar Cases and clickable action links, view the full interactive report at restthecase.com/legaliq", ML, y);
    y += 8;
  }

  // ══════════════════════════════════════════════════════════════
  // PAGE — YOUR NEXT PLAN (personalised roadmap)
  // ══════════════════════════════════════════════════════════════
  {
    doc.addPage();
    page++;
    pageHeader(doc, page);
    pageFooter(doc);
    y = 24;

    // Section title bar
    doc.setFillColor(...DARK_P);
    doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...GOLD);
    doc.text("YOUR NEXT PLAN", ML + 6, y + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 142, 120);
    doc.text("Derived from your assessment findings", ML + CW - 6, y + 8.5, { align: "right" });
    y += 18;

    // Score-contextual intro
    const pillarRankedPdf = [
      { label: "Litigation",  score: data.pillars.find(p => p.label.includes("Litigation"))?.score ?? 0 },
      { label: "Contracts",   score: data.pillars.find(p => p.label.includes("Contract"))?.score ?? 0 },
      { label: "Compliance",  score: data.pillars.find(p => p.label.includes("Compliance"))?.score ?? 0 },
      { label: "Legal Costs", score: data.pillars.find(p => p.label.includes("Cost"))?.score ?? 0 },
    ].sort((a, b) => a.score - b.score);
    const w0pdf = pillarRankedPdf[0]?.label ?? "Litigation";
    const w1pdf = pillarRankedPdf[1]?.label ?? "Contracts";
    const scoreDescPdf = data.totalScore >= 80 ? "strong" : data.totalScore >= 60 ? "stable but improvable" : data.totalScore >= 40 ? "at risk" : "critically exposed";
    const introTextPdf = `With a Legal Health Score of ${data.totalScore}/100 (${scoreDescPdf}), your business has identified gaps in ${w0pdf} and ${w1pdf} that need structured action. Here is your recommended action sequence.`;
    const introLinesPdf = wrap(doc, introTextPdf, CW);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK2);
    doc.text(introLinesPdf, ML, y);
    y += introLinesPdf.length * 5 + 8;

    // Phase blocks
    const phaseConfig: Array<{
      tier: string; timeLabel: string;
      outcomeBuilder: (w0: string, w1: string) => string;
      vcloNotes: Record<string, string>;
      defaultNote: string;
      filterFn: (a: Action) => boolean;
      rgb: [number,number,number]; headerRgb: [number,number,number];
    }> = [
      {
        tier: "Immediate", timeLabel: "Week 1",
        outcomeBuilder: (w0) => `Address highest-risk legal exposure in ${w0} before gaps compound into disputes or penalties.`,
        vcloNotes: {
          "Litigation":  "A VCLO helps you respond to notices correctly the first time and prevents escalation.",
          "Contracts":   "A VCLO reviews agreements before signing, ensuring enforceability.",
          "Compliance":  "A VCLO tracks your statutory filing calendar so you never miss a deadline.",
          "Legal Costs": "A VCLO's flat retainer replaces unpredictable per-matter billing.",
        },
        defaultNote: "A VCLO provides immediate guidance on your most urgent legal gaps.",
        filterFn: (a) => (a.priority ?? "Long-Term") === "Immediate" || a.timeline === "THIS WEEK",
        rgb: [220, 60, 60], headerRgb: [240, 200, 200],
      },
      {
        tier: "Short-Term", timeLabel: "Month 1",
        outcomeBuilder: (_w0, w1) => `Strengthen ${w1} foundations and build legal documentation that protects ongoing operations.`,
        vcloNotes: {
          "Litigation":  "A VCLO prepares dispute-response templates and advises on pending notices.",
          "Contracts":   "A VCLO prepares standard contract templates and reviews vendor agreements.",
          "Compliance":  "A VCLO sets up a compliance calendar and reviews outstanding regulatory obligations.",
          "Legal Costs": "A VCLO consolidates your legal needs into a single predictable monthly fee.",
        },
        defaultNote: "A VCLO prepares a compliance calendar and reviews key contracts.",
        filterFn: (a) => (a.priority ?? "Long-Term") === "Short-Term" || a.timeline === "THIS MONTH",
        rgb: [200, 130, 20], headerRgb: [240, 220, 180],
      },
      {
        tier: "Long-Term", timeLabel: "90 Days",
        outcomeBuilder: () => "Establish continuous legal monitoring and proactive risk prevention across all four pillars.",
        vcloNotes: {},
        defaultNote: "A VCLO provides ongoing monitoring, monthly check-ins, and on-demand legal guidance as your business grows.",
        filterFn: (a) => (a.priority ?? "Long-Term") === "Long-Term" || a.timeline === "90 DAYS",
        rgb: [50, 110, 210], headerRgb: [190, 210, 240],
      },
    ];

    phaseConfig.forEach((cfg) => {
      const phaseActions = data.actions.filter(cfg.filterFn).slice(0, 3);
      if (phaseActions.length === 0) return;

      const outcome = cfg.outcomeBuilder(w0pdf, w1pdf);
      const vcloNote = cfg.vcloNotes[w0pdf] ?? cfg.defaultNote;
      const actionLines = phaseActions.map(a => wrap(doc, `- ${a.action}`, CW - 20));
      const totalActionLines = actionLines.reduce((s, l) => s + l.length, 0);
      const boxH = 10 + 5 + wrap(doc, outcome, CW - 20).length * 4.5 + totalActionLines * 4.5 + wrap(doc, vcloNote, CW - 20).length * 4.5 + 18;

      if (y + boxH > H - 20) {
        doc.addPage(); page++;
        pageHeader(doc, page); pageFooter(doc);
        y = 24;
      }

      // Card background
      doc.setFillColor(...PANEL);
      doc.roundedRect(ML, y, CW, boxH, 4, 4, "F");
      doc.setDrawColor(...cfg.rgb);
      doc.setLineWidth(0.4);
      doc.roundedRect(ML, y, CW, boxH, 4, 4, "S");

      // Left accent strip
      doc.setFillColor(...cfg.rgb);
      doc.roundedRect(ML, y, 5, boxH, 3, 3, "F");

      // Phase header
      doc.setFillColor(...cfg.rgb);
      doc.roundedRect(ML + 9, y + 4, 32, 7.5, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...WHITE);
      doc.text(cfg.tier.toUpperCase(), ML + 25, y + 9, { align: "center" });

      doc.setFillColor(...cfg.headerRgb);
      doc.roundedRect(ML + 44, y + 4, 22, 7.5, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...cfg.rgb);
      doc.text(cfg.timeLabel, ML + 55, y + 9, { align: "center" });

      let iy = y + 16;

      // Outcome sentence
      const outcomeLines = wrap(doc, outcome, CW - 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK1);
      doc.text(outcomeLines, ML + 9, iy);
      iy += outcomeLines.length * 4.5 + 5;

      // Action list
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...INK3);
      doc.text("ACTIONS", ML + 9, iy);
      iy += 4.5;
      actionLines.forEach((lines) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...INK2);
        doc.text(lines, ML + 9, iy);
        iy += lines.length * 4.5 + 1.5;
      });
      iy += 2;

      // VCLO note
      doc.setFillColor(...cfg.rgb);
      doc.roundedRect(ML + 9, iy, CW - 14, 5, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...WHITE);
      doc.text("VCLO ACCELERATES THIS:", ML + 12, iy + 3.5);
      iy += 6.5;
      const vcloNoteLines = wrap(doc, vcloNote, CW - 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...cfg.rgb);
      doc.text(vcloNoteLines, ML + 9, iy);

      y += boxH + 5;
    });

    // ── "How VCLO supports this plan" pillar grid ──────────────────
    const gridTitle = "HOW REST THE CASE VCLO SUPPORTS THIS PLAN";
    const gridH = 12 + 4 * 14 + 6;
    if (y + gridH + 14 > H - 20) {
      doc.addPage(); page++;
      pageHeader(doc, page); pageFooter(doc);
      y = 24;
    }

    doc.setFillColor(...DARK_P);
    doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...GOLD);
    doc.text(gridTitle, ML + 6, y + 8.5);
    y += 14;

    const pillarGridItems: Array<{ label: string; capability: string; score: number; col: [number,number,number] }> = [
      { label: "Litigation Health",     capability: "Dispute prevention, notice response, and court-ready documentation", score: data.pillars.find(p => p.label.includes("Litigation"))?.score ?? 0, col: PILLAR_COLORS[0]! },
      { label: "Contractual Health",    capability: "Contract review, drafting, and vendor/client agreement management",  score: data.pillars.find(p => p.label.includes("Contract"))?.score ?? 0,   col: PILLAR_COLORS[1]! },
      { label: "Compliance Health",     capability: "Statutory filing calendar, licence renewal, and regulatory advisory", score: data.pillars.find(p => p.label.includes("Compliance"))?.score ?? 0, col: PILLAR_COLORS[2]! },
      { label: "Legal Cost Efficiency", capability: "Flat monthly retainer replaces unpredictable per-matter billing",     score: data.pillars.find(p => p.label.includes("Cost"))?.score ?? 0,        col: PILLAR_COLORS[3]! },
    ];

    pillarGridItems.forEach((item, gi) => {
      const isWeak = item.score < 15; // below 60% of 25
      const rowY = y + gi * 14;
      if (isWeak) {
        doc.setFillColor(item.col[0], Math.min(255, item.col[1] + 180), Math.min(255, item.col[2] + 180));
        doc.roundedRect(ML, rowY, CW, 13, 2, 2, "F");
      } else {
        doc.setFillColor(...PANEL);
        doc.roundedRect(ML, rowY, CW, 13, 2, 2, "F");
      }
      doc.setFillColor(...item.col);
      doc.roundedRect(ML, rowY, 4, 13, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...item.col);
      doc.text(item.label, ML + 8, rowY + 5.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...INK2);
      doc.text(clean(item.capability), ML + 8, rowY + 10.5);

      if (isWeak) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(...item.col);
        doc.text("PRIORITY", ML + CW - 6, rowY + 8, { align: "right" });
      }
    });
    y += 4 * 14 + 8;
  }

  // ══════════════════════════════════════════════════════════════
  // PAGE — CASE STUDY (real-world parallel)
  // ══════════════════════════════════════════════════════════════
  if (data.example) {
    const ex = data.example;
    doc.addPage();
    page++;
    pageHeader(doc, page);
    pageFooter(doc);

    y = 24;

    doc.setFillColor(...DARK_P);
    doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...GOLD);
    doc.text("CASE STUDY: A SIMILAR BUSINESS", ML + 6, y + 8.5);
    y += 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK1);
    doc.text(clean(ex.businessName), ML, y);
    y += 9;

    const blocks: [string, string, [number, number, number]][] = [
      ["WHAT HAPPENED", ex.whatHappened, INK2],
      ["CONSEQUENCES", ex.consequences, [180, 40, 40]],
      ["HOW A VCLO WOULD HAVE HELPED", ex.vcloWouldHave, [30, 130, 70]],
      ["THE LESSON", ex.lesson, [176, 137, 58]],
    ];

    blocks.forEach(([label, text, color]) => {
      if (!text) return;
      const lines = wrap(doc, text, CW - 18);
      const boxH = 12 + lines.length * 4.6 + 6;
      if (y + boxH > H - 20) {
        doc.addPage();
        page++;
        pageHeader(doc, page);
        pageFooter(doc);
        y = 24;
      }
      doc.setFillColor(...PANEL);
      doc.roundedRect(ML, y, CW, boxH, 4, 4, "F");
      doc.setDrawColor(...INK4);
      doc.setLineWidth(0.2);
      doc.roundedRect(ML, y, CW, boxH, 4, 4, "S");
      doc.setFillColor(...color);
      doc.rect(ML, y, 4, boxH, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...color);
      doc.text(label, ML + 9, y + 9);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK2);
      doc.text(lines, ML + 9, y + 16);

      y += boxH + 6;
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PAGE — CERTIFICATE DETAILS
  // ══════════════════════════════════════════════════════════════
  {
    doc.addPage();
    page++;
    pageHeader(doc, page);
    pageFooter(doc);

    y = 24;

    doc.setFillColor(...DARK_P);
    doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...GOLD);
    doc.text("CERTIFICATE OF LEGAL HEALTH ASSESSMENT", ML + 6, y + 8.5);
    y += 24;

    const certId = `LIQ-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Certificate panel
    const certH = 110;
    doc.setFillColor(16, 14, 10);
    doc.roundedRect(ML, y, CW, certH, 6, 6, "F");
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.roundedRect(ML, y, CW, certH, 6, 6, "S");
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.2);
    doc.roundedRect(ML + 4, y + 4, CW - 8, certH - 8, 4, 4, "S");

    const ccx = ML + CW / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...GOLD);
    doc.text("LegalIQ", ccx, y + 18, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK3);
    doc.text("LEGAL HEALTH ASSESSMENT  |  BY REST THE CASE", ccx, y + 24, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(210, 204, 190);
    doc.text("This certifies that", ccx, y + 35, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...WHITE);
    doc.text(wrap(doc, data.company, CW - 40).slice(0, 1), ccx, y + 45, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK3);
    doc.text(clean(`${data.businessType}  |  ${data.city}`), ccx, y + 52, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(180, 174, 160);
    doc.text("has successfully completed the LegalIQ Legal Health Assessment,", ccx, y + 61, { align: "center" });
    doc.text("evaluating litigation exposure, contracts, compliance, and legal cost efficiency.", ccx, y + 66.5, { align: "center" });

    // Score medallion
    const medY = y + 84;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.circle(ccx, medY, 15, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...GOLD);
    doc.text(`${data.totalScore}`, ccx, medY + 3, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...INK3);
    doc.text("OUT OF 100", ccx, medY + 8.5, { align: "center" });

    const cbadgeX = ccx + 26;
    doc.setFillColor(...rc);
    doc.roundedRect(cbadgeX, medY - 9, 40, 18, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(`Grade ${g}`, cbadgeX + 20, medY - 1, { align: "center" });
    doc.setFontSize(7);
    doc.text(clean(gl).toUpperCase(), cbadgeX + 20, medY + 6, { align: "center" });

    y += certH + 10;

    // Metadata row
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK3);
    doc.text("CERTIFICATE ID", ML, y);
    doc.text("DATE ISSUED", ML + CW / 2, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK1);
    doc.text(certId, ML, y + 6);
    doc.text(today, ML + CW / 2, y + 6);
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK3);
    doc.text(
      wrap(doc, "A full shareable certificate (landscape, print-ready) is also available for separate download from your Results page — ideal for displaying to investors, partners, or clients.", CW),
      ML,
      y
    );
  }

  // ══════════════════════════════════════════════════════════════
  // PAGE — VERIFIED CASE STUDIES
  // ══════════════════════════════════════════════════════════════
  if (data.similarCases?.length) {
    doc.addPage();
    page++;
    pageHeader(doc, page);
    pageFooter(doc);
    y = 24;

    doc.setFillColor(...DARK_P);
    doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...GOLD);
    doc.text("VERIFIED CASE STUDIES", ML + 6, y + 8.5);
    y += 19;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK3);
    doc.text(wrap(doc, "Public Indian legal decisions selected for their relevance to this assessment. Use the source link below each summary to read the full case.", CW), ML, y);
    y += 14;

    data.similarCases.slice(0, 3).forEach((caseItem, index) => {
      const titleLines = wrap(doc, `${index + 1}. ${caseItem.title}`, CW - 12);
      const summaryLines = wrap(doc, caseItem.summary, CW - 12);
      const relevanceLines = wrap(doc, caseItem.relevance, CW - 12);
      const cardH = titleLines.length * 5 + summaryLines.length * 4.4 + relevanceLines.length * 4.2 + 24;
      if (y + cardH > H - 20) {
        doc.addPage();
        page++;
        pageHeader(doc, page);
        pageFooter(doc);
        y = 24;
      }
      doc.setFillColor(...PANEL);
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.25);
      doc.roundedRect(ML, y, CW, cardH, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...INK1);
      doc.text(titleLines, ML + 6, y + 8);
      let cardY = y + 8 + titleLines.length * 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...INK2);
      doc.text(summaryLines, ML + 6, cardY);
      cardY += summaryLines.length * 4.4 + 4;
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...INK3);
      doc.text(relevanceLines, ML + 6, cardY);
      cardY += relevanceLines.length * 4.2 + 5;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...GOLD);
      doc.textWithLink("Read full public case study", ML + 6, cardY, { url: caseItem.readMoreUrl });
      y += cardH + 7;
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PAGE — YOUR NEXT STEP (VCLO pitch + comparison table)
  // ══════════════════════════════════════════════════════════════
  doc.addPage();
  page++;
  pageHeader(doc, page);
  pageFooter(doc);

  y = 24;

  doc.setFillColor(...DARK_P);
  doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...GOLD);
  doc.text("YOUR NEXT STEP", ML + 6, y + 8.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130, 120, 100);
  doc.text("Rest The Case VCLO Service", W - ML - 6, y + 8.5, { align: "right" });
  y += 18;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK3);
  doc.text(
    wrap(doc, "We recommend booking a free consultation with a Rest The Case attorney to walk through this report and the risks specific to your business in detail.", CW),
    ML,
    y
  );
  y += 14;

  // Personalised pitch box
  if (data.vcloPitch) {
    const pitchLines = wrap(doc, data.vcloPitch, CW - 18);
    const pitchH = pitchLines.length * 5.2 + 20;

    doc.setFillColor(16, 14, 10);
    doc.roundedRect(ML, y, CW, pitchH, 5, 5, "F");
    doc.setFillColor(...GOLD);
    doc.rect(ML, y, 4, pitchH, "F");
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.roundedRect(ML, y, CW, pitchH, 5, 5, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...GOLD);
    doc.text("HOW A VCLO HELPS YOUR BUSINESS", ML + 9, y + 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(210, 204, 190);
    doc.text(pitchLines, ML + 9, y + 19);

    y += pitchH + 10;
  }

  // Comparison table: Traditional Legal Support vs. Rest The Case VCLO
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK1);
  doc.text("Traditional Legal Support vs. Rest The Case VCLO", ML, y);
  y += 7;

  const col1W = CW * 0.30;
  const col2W = CW * 0.35;
  const col3W = CW - col1W - col2W;
  const headerH = 9;

  doc.setFillColor(...DARK_P);
  doc.roundedRect(ML, y, CW, headerH, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK3);
  doc.text("ASPECT", ML + 4, y + 6);
  doc.setTextColor(200, 130, 60);
  doc.text("TRADITIONAL LEGAL SUPPORT", ML + col1W + 4, y + 6);
  doc.setTextColor(...GOLD);
  doc.text("REST THE CASE VCLO", ML + col1W + col2W + 4, y + 6);
  y += headerH;

  VCLO_COMPARISON.forEach((row, i) => {
    const labelLines = wrap(doc, row.label, col1W - 8);
    const tradLines  = wrap(doc, row.traditional, col2W - 8);
    const vcloLines  = wrap(doc, row.vclo, col3W - 8);
    const rowLines = Math.max(labelLines.length, tradLines.length, vcloLines.length);
    const rowH = rowLines * 4.3 + 6;

    if (y + rowH > H - 20) {
      doc.addPage();
      page++;
      pageHeader(doc, page);
      pageFooter(doc);
      y = 24;

      doc.setFillColor(...DARK_P);
      doc.roundedRect(ML, y, CW, headerH, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...INK3);
      doc.text("ASPECT", ML + 4, y + 6);
      doc.setTextColor(200, 130, 60);
      doc.text("TRADITIONAL LEGAL SUPPORT", ML + col1W + 4, y + 6);
      doc.setTextColor(...GOLD);
      doc.text("REST THE CASE VCLO", ML + col1W + col2W + 4, y + 6);
      y += headerH;
    }

    if (i % 2 === 0) {
      doc.setFillColor(...PANEL);
      doc.rect(ML, y, CW, rowH, "F");
    }
    doc.setDrawColor(...INK4);
    doc.setLineWidth(0.15);
    doc.line(ML, y + rowH, ML + CW, y + rowH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK1);
    doc.text(labelLines, ML + 4, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK2);
    doc.text(tradLines, ML + col1W + 4, y + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 120, 70);
    doc.text(vcloLines, ML + col1W + col2W + 4, y + 5);

    y += rowH;
  });

  y += 12;

  // Strong CTA button
  if (y + 24 > H - 20) {
    doc.addPage();
    page++;
    pageHeader(doc, page);
    pageFooter(doc);
    y = 24;
  }
  const ctaBtnW = CW;
  doc.setFillColor(...GOLD);
  doc.roundedRect(ML, y, ctaBtnW, 20, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  doc.text("Book Your Free Consultation", ML + ctaBtnW / 2, y + 9, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(50, 45, 35);
  doc.text("restthecase.com/virtualCLOPackage  |  No commitment  |  30-minute call", ML + ctaBtnW / 2, y + 16, { align: "center" });

  // ══════════════════════════════════════════════════════════════
  // PAGE — DISCLAIMER
  // ══════════════════════════════════════════════════════════════
  doc.addPage();
  page++;
  pageHeader(doc, page);
  pageFooter(doc);

  y = 24;

  // Section header bar
  doc.setFillColor(...DARK_P);
  doc.roundedRect(ML, y, CW, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...GOLD);
  doc.text("IMPORTANT DISCLAIMER", ML + 6, y + 8.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130, 120, 100);
  doc.text("Please read carefully before relying on this report", W - ML - 6, y + 8.5, { align: "right" });
  y += 18;

  // Main disclaimer panel
  const disclaimerTextLines = [
    "The Legal Health Score generated by LegalIQ is an informational assessment tool designed",
    "to help businesses identify potential legal and compliance gaps. It is not legal advice, a legal",
    "opinion, or a substitute for consultation with a qualified legal professional.",
  ];

  const disclaimerBlocks: Array<{ heading: string; body: string; color: [number, number, number] }> = [
    {
      heading: "NOT LEGAL ADVICE",
      body: "This report and the Legal Health Score are produced solely for informational purposes. Nothing contained in this report constitutes legal advice, a legal opinion, or professional counsel of any kind. The results reflect responses entered during the assessment and are generated using artificial intelligence. They do not represent a legal review of your business, its contracts, regulatory status, or litigation exposure.",
      color: [220, 60, 60],
    },
    {
      heading: "LIMITATION OF LIABILITY",
      body: "Rest The Case, LegalIQ, and their associated attorneys, employees, and agents do not accept any liability whatsoever for any loss, damage, cost, or expense arising directly or indirectly from reliance on, or action taken in response to, the contents of this report. Users act on this information entirely at their own risk.",
      color: [210, 130, 20],
    },
    {
      heading: "AI-GENERATED CONTENT",
      body: "The insights, risk flags, action plans, and scoring in this report are generated by an artificial intelligence model based on the answers provided during the assessment. AI-generated content may be incomplete, inaccurate, or inapplicable to specific legal situations. It should be independently verified by a qualified legal professional before any reliance is placed upon it.",
      color: [50, 120, 220],
    },
    {
      heading: "CONSULT A QUALIFIED PROFESSIONAL",
      body: "For professional legal guidance tailored to your specific circumstances, business structure, industry, and jurisdiction, you should consult a qualified Advocate or engage Rest The Case's Virtual Chief Legal Officer (VCLO) service. A VCLO provides ongoing, personalised legal support from practising attorneys who understand your business. Visit restthecase.com/virtualCLOPackage to learn more.",
      color: [34, 150, 80],
    },
  ];

  disclaimerBlocks.forEach((block) => {
    const bodyLines = wrap(doc, block.body, CW - 20);
    const boxH = 10 + 5.5 + 4 + bodyLines.length * 4.6 + 8;

    if (y + boxH > H - 20) {
      doc.addPage();
      page++;
      pageHeader(doc, page);
      pageFooter(doc);
      y = 24;
    }

    doc.setFillColor(...PANEL);
    doc.roundedRect(ML, y, CW, boxH, 4, 4, "F");
    doc.setDrawColor(...INK4);
    doc.setLineWidth(0.2);
    doc.roundedRect(ML, y, CW, boxH, 4, 4, "S");
    doc.setFillColor(...block.color);
    doc.rect(ML, y, 4, boxH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...block.color);
    doc.text(block.heading, ML + 10, y + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK2);
    doc.text(bodyLines, ML + 10, y + 17.5);

    y += boxH + 6;
  });

  // Summary note at the bottom
  if (y + 22 <= H - 20) {
    doc.setFillColor(16, 14, 10);
    doc.roundedRect(ML, y, CW, 22, 4, 4, "F");
    doc.setFillColor(...GOLD);
    doc.rect(ML, y, 4, 22, "F");
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, 22, 4, 4, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...GOLD);
    doc.text("Use this report as a starting point, not a final answer.", ML + 10, y + 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(190, 183, 165);
    doc.text(
      "Book a free consultation at restthecase.com/virtualCLOPackage to review these findings with a qualified attorney.",
      ML + 10, y + 16
    );
  }

  // ══════════════════════════════════════════════════════════════
  // FINAL PAGE — the same premium light-theme certificate used for the
  // standalone certificate download, so the report never shows a separate
  // dark-theme "badge" summary.
  // ══════════════════════════════════════════════════════════════
  doc.addPage("a4", "landscape");
  page++;
  await drawCertificatePage(doc, {
    company: data.company,
    name: data.name,
    businessType: data.businessType,
    city: data.city,
    totalScore: data.totalScore,
  });

  return new Uint8Array(doc.output("arraybuffer"));
}

export async function generateReportPDF(data: ReportData): Promise<void> {
  const bytes = await renderReportPDFBytes(data);
  const fname = `LegalIQ-Report-${clean(data.company).replace(/[^a-zA-Z0-9]/g, "-")}-${data.totalScore}.pdf`;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fname;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ═════════════════════════════════════════════════════════════════════════
// CERTIFICATE — premium, cinematic light-theme certificate of assessment
// ═════════════════════════════════════════════════════════════════════════

export interface CertificateData {
  company: string;
  name: string;
  businessType: string;
  city: string;
  totalScore: number;
  logoUrl?: string;
}

// Light / cream certificate palette
const CERT_BG      : [number,number,number] = [252, 250, 245]; // warm ivory
const CERT_BG2     : [number,number,number] = [247, 243, 234]; // slightly deeper cream
const CERT_INK1    : [number,number,number] = [35,  30,  22];
const CERT_INK2    : [number,number,number] = [95,  86,  70];
const CERT_INK3    : [number,number,number] = [150, 140, 120];
const CERT_GOLD    : [number,number,number] = [176, 137, 58];
const CERT_GOLD_LT : [number,number,number] = [201, 168, 76];

/** Fetch an image URL and resolve it to a base64 data URL usable by jsPDF. */
async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Draw an ornamental corner flourish (simple nested-line corner mark). */
function cornerOrnament(doc: jsPDF, x: number, y: number, flipX: number, flipY: number) {
  doc.setDrawColor(...CERT_GOLD);
  doc.setLineWidth(0.6);
  doc.line(x, y, x + 14 * flipX, y);
  doc.line(x, y, x, y + 14 * flipY);
  doc.setLineWidth(0.3);
  doc.line(x + 4 * flipX, y + 4 * flipY, x + 9 * flipX, y + 4 * flipY);
  doc.line(x + 4 * flipX, y + 4 * flipY, x + 4 * flipX, y + 9 * flipY);
  doc.setFillColor(...CERT_GOLD);
  doc.circle(x + 2 * flipX, y + 2 * flipY, 0.9, "F");
}

/**
 * Draws the full premium light-theme certificate onto the current page of
 * `doc`. Shared by the standalone certificate PDF and the final page of the
 * main report PDF so both surfaces are pixel-identical in design.
 */
async function drawCertificatePage(doc: jsPDF, data: CertificateData): Promise<void> {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const cx = W / 2;

  const g  = grade(data.totalScore);
  const gl = gradeLabel(data.totalScore);
  const rc = riskRGB(data.totalScore);
  const issuedDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const certId = `LIQ-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const logoDataUrl = await loadImageAsDataUrl(data.logoUrl ?? "/rtc-logo-transparent.png");

  // ── Base background ────────────────────────────────────────
  doc.setFillColor(...CERT_BG);
  doc.rect(0, 0, W, H, "F");

  // Subtle radial-style corner washes (soft rectangles standing in for glow)
  doc.setFillColor(...CERT_BG2);
  doc.roundedRect(-40, -40, 130, 130, 60, 60, "F");
  doc.roundedRect(W - 90, H - 90, 130, 130, 60, 60, "F");

  // ── Large background watermark logo (very light, centered) ──
  if (logoDataUrl) {
    const wmSize = 130;
    const gState = new (doc as any).GState({ opacity: 0.05 });
    doc.setGState(gState);
    doc.addImage(logoDataUrl, "PNG", cx - wmSize / 2, H / 2 - wmSize / 2, wmSize, wmSize);
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
  }

  // ── Outer double border frame ─────────────────────────────
  const m1 = 8;
  doc.setDrawColor(...CERT_GOLD);
  doc.setLineWidth(1.1);
  doc.rect(m1, m1, W - m1 * 2, H - m1 * 2, "S");
  const m2 = 11.5;
  doc.setLineWidth(0.35);
  doc.setDrawColor(...CERT_GOLD_LT);
  doc.rect(m2, m2, W - m2 * 2, H - m2 * 2, "S");

  // Corner ornaments
  const om = 15;
  cornerOrnament(doc, om, om, 1, 1);
  cornerOrnament(doc, W - om, om, -1, 1);
  cornerOrnament(doc, om, H - om, 1, -1);
  cornerOrnament(doc, W - om, H - om, -1, -1);

  // ─────────────────────────────────────────────────────────────
  // Layout: a fixed vertical rhythm from the top margin so every
  // element gets guaranteed clearance from its neighbours — no
  // element position is derived from another element's font size.
  // ─────────────────────────────────────────────────────────────
  const top = 24;

  // ── Header: logo mark + wordmark ──────────────────────────
  if (logoDataUrl) {
    const logoS = 13;
    doc.addImage(logoDataUrl, "PNG", cx - logoS / 2, top - logoS + 3, logoS, logoS);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...CERT_GOLD);
  doc.text("LegalIQ", cx, top + 9, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...CERT_INK3);
  doc.text("LEGAL HEALTH ASSESSMENT  |  BY REST THE CASE", cx, top + 15, { align: "center" });

  doc.setDrawColor(...CERT_GOLD_LT);
  doc.setLineWidth(0.3);
  doc.line(cx - 26, top + 19.5, cx + 26, top + 19.5);

  // ── Title ──────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(27);
  doc.setTextColor(...CERT_INK1);
  doc.text("Certificate of Legal Health", cx, top + 33, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CERT_INK2);
  doc.text("This certifies that", cx, top + 41.5, { align: "center" });

  // ── Business name (hero) ──────────────────────────────────
  // Shrink the font a step at a time until the name fits on at most
  // two lines, so long legal names wrap instead of being truncated.
  doc.setFont("helvetica", "bold");
  let nameFontSize = 24;
  let nameLines = wrap(doc, data.company, W - 100);
  while (nameLines.length > 2 && nameFontSize > 15) {
    nameFontSize -= 2;
    doc.setFontSize(nameFontSize);
    nameLines = wrap(doc, data.company, W - 100);
  }
  doc.setFontSize(nameFontSize);
  doc.setTextColor(...CERT_GOLD);
  const nameLineH = nameFontSize * 1.15 * 0.3528;
  const nameBlockY = top + 53 - ((nameLines.length - 1) * nameLineH) / 2;
  doc.text(nameLines, cx, nameBlockY, { align: "center", lineHeightFactor: 1.15 });
  const nameBottom = nameBlockY + (nameLines.length - 1) * nameLineH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...CERT_INK3);
  const metaY = nameBottom + 7;
  doc.text(clean(`${data.businessType}  |  ${data.city}`), cx, metaY, { align: "center" });

  // Certifying paragraph — capped width so long lines never approach
  // the medallion's horizontal footprint, with guaranteed clearance below.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CERT_INK2);
  const paraLines = wrap(
    doc,
    "has successfully completed the LegalIQ Legal Health Assessment, evaluating litigation exposure, contracts, compliance, and legal cost efficiency.",
    150
  );
  const paraY = metaY + 10;
  doc.text(paraLines, cx, paraY, { align: "center", lineHeightFactor: 1.45 });
  const paraBottom = paraY + (paraLines.length - 1) * 10 * 1.45 * 0.3528;

  // ── Score medallion + grade badge ─────────────────────────
  const medR = 19;
  const medY = paraBottom + medR + 12; // guaranteed gap below the paragraph's last line

  // outer ring
  doc.setDrawColor(...CERT_GOLD);
  doc.setLineWidth(1.1);
  doc.circle(cx, medY, medR, "S");
  doc.setDrawColor(...CERT_GOLD_LT);
  doc.setLineWidth(0.4);
  doc.circle(cx, medY, medR - 2.2, "S");
  doc.setFillColor(...CERT_BG2);
  doc.circle(cx, medY, medR - 3.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...CERT_GOLD);
  doc.text(`${data.totalScore}`, cx, medY + 3.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...CERT_INK3);
  doc.text("OUT OF 100", cx, medY + 10, { align: "center" });

  // Grade badge and label are equal-width chips flanking the medallion so
  // the circle sits at the true visual center of the whole cluster instead
  // of looking pulled toward the heavier (filled) badge side.
  const chipW = 44;
  const chipGap = 16;
  const chipH = 21;

  // Grade badge (filled) to the right of medallion
  const badgeX = cx + medR + chipGap;
  doc.setFillColor(...rc);
  doc.roundedRect(badgeX, medY - chipH / 2, chipW, chipH, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...WHITE);
  doc.text(`Grade ${g}`, badgeX + chipW / 2, medY - 0.5, { align: "center" });
  doc.setFontSize(8);
  doc.text(clean(gl).toUpperCase(), badgeX + chipW / 2, medY + 7, { align: "center" });

  // Label chip (outlined, same footprint as badge) to the left of medallion
  const labelX = cx - medR - chipGap - chipW;
  doc.setDrawColor(...CERT_GOLD_LT);
  doc.setLineWidth(0.4);
  doc.roundedRect(labelX, medY - chipH / 2, chipW, chipH, 5, 5, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...CERT_INK3);
  doc.text("LEGAL HEALTH", labelX + chipW / 2, medY - 0.5, { align: "center" });
  doc.text("SCORE", labelX + chipW / 2, medY + 7, { align: "center" });

  // ── Footer: signature line, date, certificate id ──────────
  const footY = H - 30;
  doc.setDrawColor(...CERT_INK3);
  doc.setLineWidth(0.25);

  // Left: date issued
  doc.line(om + 6, footY, om + 66, footY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...CERT_INK1);
  doc.text(issuedDate, om + 6, footY - 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...CERT_INK3);
  doc.text("DATE ISSUED", om + 6, footY + 6);

  // Right: authorised signature (Rest The Case)
  doc.line(W - om - 66, footY, W - om - 6, footY);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(12.5);
  doc.setTextColor(...CERT_GOLD);
  doc.text("Rest The Case", W - om - 36, footY - 3, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...CERT_INK3);
  doc.text("AUTHORISED ISSUER", W - om - 36, footY + 6, { align: "center" });

  // Center: certificate id + prepared for
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...CERT_INK3);
  doc.text(clean(`Certificate ID: ${certId}  |  Prepared for ${data.name}`), cx, footY + 6, { align: "center" });
  doc.setFontSize(7);
  doc.text("Verify at restthecase.com/virtualCLOPackage  |  Not legal advice", cx, H - 15, { align: "center" });
}

// ══════════════════════════════════════════════════════════════════════
// VCLO BROCHURE PDF
// ══════════════════════════════════════════════════════════════════════

const NAVY   : [number,number,number] = [ 10,  15,  35];
const NAVY2  : [number,number,number] = [ 16,  22,  48];
const NAVY3  : [number,number,number] = [ 24,  32,  64];

function brochureHeader(doc: jsPDF, page: number) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text("LegalIQ  |  Virtual CLO Service", 14, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK3);
  doc.text(`by Rest The Case  |  restthecase.com/virtualCLOPackage  |  Page ${page}`, W - 14, 11, { align: "right" });
  doc.setDrawColor(...INK4);
  doc.setLineWidth(0.25);
  doc.line(14, 15, W - 14, 15);
}

function brochureFooter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...INK4);
  doc.setLineWidth(0.25);
  doc.line(14, H - 13, W - 14, H - 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK3);
  doc.text("Rest The Case  |  Trusted Legal Partner for Indian Businesses", 14, H - 7.5);
  doc.text("restthecase.com/virtualCLOPackage", W - 14, H - 7.5, { align: "right" });
}

function brochureCard(doc: jsPDF, x: number, y: number, w: number, h: number,
  color: [number,number,number], num: string, title: string, body: string) {
  // Card bg
  doc.setFillColor(...PANEL);
  doc.roundedRect(x, y, w, h, 3, 3, "F");
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 3, 3, "S");
  // Top colour bar
  doc.setFillColor(...color);
  doc.roundedRect(x, y, w, 3, 1, 1, "F");
  // Number badge
  doc.setFillColor(...color);
  doc.circle(x + 10, y + 16, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(num, x + 10, y + 19, { align: "center" });
  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK1);
  doc.text(title, x + 20, y + 18.5);
  // Body
  const bodyLines = doc.splitTextToSize(clean(body), w - 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK2);
  doc.text(bodyLines, x + 5, y + 27);
}

export interface BrochureTemplateConfig {
  colors: { navy: string; gold: string; accent: string };
  contactEmail: string;
  contactPhone: string;
  website: string;
  tagline: string;
  coverTitle: string;
  coverSubtitle: string;
  vcloPitch: string;
  scoreLabel: string;
}

export interface BrochureTemplateSelection {
  templateId?: string | null;
  version?: number | null;
  config?: BrochureTemplateConfig | null;
}

function brochureRgb(hex: string | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return fallback;
  return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
}

export async function generateVCLOBrochurePDF(selection: BrochureTemplateSelection = {}): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W   = doc.internal.pageSize.getWidth();
  const H   = doc.internal.pageSize.getHeight();
  const ML  = 16;
  const MR  = 16;
  const CW  = W - ML - MR;
  let page  = 1;
  const config = selection.config;
  const B_NAVY = brochureRgb(config?.colors.navy, NAVY);
  const B_GOLD = brochureRgb(config?.colors.gold, GOLD);
  const B_ACCENT = brochureRgb(config?.colors.accent, GOLD);
  const useLegacyCover = !config || config.coverTitle === "Virtual Chief Legal Officer (VCLO) Service";

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ═══════════════════════════════════════════════════════════════
  doc.setFillColor(...B_NAVY);
  doc.rect(0, 0, W, H, "F");

  // Gold top bar
  doc.setFillColor(...B_GOLD);
  doc.rect(0, 0, W, 3.5, "F");

  // Left gold stripe
  doc.setFillColor(...B_GOLD);
  doc.rect(0, 0, 3.5, H, "F");

  // Decorative background arc
  doc.setFillColor(20, 28, 60);
  doc.circle(W + 30, -30, 110, "F");

  // Brand: LegalIQ
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(...B_GOLD);
  doc.text("LegalIQ", ML + 8, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(160, 152, 130);
  doc.text(`${useLegacyCover ? "LEGAL HEALTH ASSESSMENT" : config?.scoreLabel?.toUpperCase()}  |  BY REST THE CASE`, ML + 8, 55);

  doc.setDrawColor(...B_GOLD);
  doc.setLineWidth(0.5);
  doc.line(ML + 8, 60, W - ML, 60);

  // Main headline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...WHITE);
  if (useLegacyCover) {
    doc.text("Virtual Chief", ML + 8, 82);
    doc.text("Legal Officer", ML + 8, 96);
    doc.setTextColor(...B_GOLD);
    doc.text("(VCLO) Service", ML + 8, 110);
  } else {
    const coverTitleLines = doc.splitTextToSize(clean(config!.coverTitle), CW - 20).slice(0, 3);
    doc.text(coverTitleLines, ML + 8, 82);
  }

  // Tagline
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(180, 172, 148);
  if (useLegacyCover) {
    doc.text("Always-On Legal Protection", ML + 8, 126);
    doc.text("for Indian Businesses.", ML + 8, 134);
  } else {
    const coverSubtitle = doc.splitTextToSize(clean(config!.coverSubtitle), CW - 18).slice(0, 3);
    doc.setTextColor(...B_ACCENT);
    doc.text(coverSubtitle, ML + 8, 122);
  }

  // Feature pills
  const pills = ["Contract Review", "Compliance Calendar", "On-Demand Legal Support", "Risk Prevention"];
  let pillX = ML + 8;
  let pillY = 154;
  pills.forEach((p) => {
    const tw = doc.getTextWidth(p) + 12;
    if (pillX + tw > W - ML) { pillX = ML + 8; pillY += 12; }
    doc.setFillColor(30, 38, 70);
    doc.setDrawColor(...B_GOLD);
    doc.setLineWidth(0.3);
    doc.roundedRect(pillX, pillY - 6, tw, 9, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...B_GOLD);
    doc.text(p, pillX + 6, pillY - 0.5);
    pillX += tw + 5;
  });

  // Score panel on cover
  const spY = 184;
  doc.setFillColor(18, 24, 52);
  doc.roundedRect(ML + 8, spY, CW - 10, 62, 5, 5, "F");
  doc.setDrawColor(...B_GOLD);
  doc.setLineWidth(0.5);
  doc.roundedRect(ML + 8, spY, CW - 10, 62, 5, 5, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(140, 132, 108);
  doc.text("WHY VCLO?", ML + 18, spY + 13);

  const reasons = [
    "Fixed monthly cost — no surprise legal bills",
    "Dedicated attorney who knows your business",
    "Proactive compliance — not reactive firefighting",
  ];
  reasons.forEach((r, i) => {
    const ry = spY + 24 + i * 13;
    doc.setFillColor(...B_GOLD);
    doc.circle(ML + 14, ry - 1.5, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text(clean(r), ML + 20, ry);
  });

  // Plans badge
  doc.setFillColor(...B_GOLD);
  doc.roundedRect(ML + 8, spY + 44, 72, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);
  doc.text("From Rs. 4,999/month", ML + 44, spY + 53, { align: "center" });

  // Bottom contact strip
  const bY = H - 32;
  doc.setDrawColor(40, 50, 80);
  doc.setLineWidth(0.3);
  doc.line(ML + 8, bY, W - ML, bY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(160, 152, 130);
  doc.text(clean(config?.website || "restthecase.com/virtualCLOPackage"), ML + 8, bY + 10);
  doc.text(clean(config?.contactEmail || "info@restthecase.com"), W - ML, bY + 10, { align: "right" });
  doc.setFontSize(7);
  doc.setTextColor(100, 92, 78);
  doc.text("This brochure is for informational purposes only and does not constitute legal advice.", ML + 8, bY + 20);

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — WHAT IS A VCLO?
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  page++;
  brochureHeader(doc, page);
  brochureFooter(doc);

  let y = 24;

  // Section heading
  doc.setFillColor(...NAVY2);
  doc.roundedRect(ML, y, CW, 14, 3, 3, "F");
  doc.setFillColor(...GOLD);
  doc.rect(ML, y, 4, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GOLD);
  doc.text("What is a Virtual Chief Legal Officer (VCLO)?", ML + 9, y + 9.5);
  y += 20;

  // Intro paragraph
  const introText = clean(config?.vcloPitch || "A Virtual CLO (VCLO) is a senior legal professional assigned to your business on a fixed monthly retainer. Unlike traditional lawyers who are engaged per matter, a VCLO becomes an extension of your team - proactively managing legal risks, reviewing contracts, tracking compliance deadlines, and advising on business decisions before problems arise.");
  const introLines = wrap(doc, introText, CW);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK2);
  doc.text(introLines, ML, y);
  y += introLines.length * 5 + 6;

  // 3 core benefit cards
  const benefits = [
    { num: "1", color: [201, 168, 76] as [number,number,number], title: "Cost Predictability", body: "One flat monthly fee replaces unpredictable per-matter billing. Budget your legal costs like a subscription, not a surprise." },
    { num: "2", color: [50, 120, 220] as [number,number,number], title: "Continuous Legal Support", body: "Your VCLO is always available. No need to search for a lawyer each time — they already know your business and its risks." },
    { num: "3", color: [34, 180, 80] as [number,number,number], title: "Proactive Compliance", body: "Stay ahead of filings, renewals, and regulatory deadlines. Your VCLO tracks your compliance calendar and alerts you in advance." },
  ];

  const cardH = 48;
  const cardW = (CW - 8) / 3;
  benefits.forEach((b, i) => {
    brochureCard(doc, ML + i * (cardW + 4), y, cardW, cardH, b.color, b.num, b.title, b.body);
  });
  y += cardH + 10;

  // VCLO vs Traditional heading
  doc.setFillColor(...DARK_P);
  doc.roundedRect(ML, y, CW, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("VCLO vs. Traditional Legal Support", ML + 6, y + 7);
  y += 14;

  // Comparison rows (use first 5 from VCLO_COMPARISON)
  const cmpRows = VCLO_COMPARISON.slice(0, 5);
  const col1W = CW * 0.26;
  const col2W = CW * 0.37;
  const col3W = CW * 0.37;

  // Table header
  doc.setFillColor(240, 238, 232);
  doc.rect(ML, y, CW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...INK1);
  doc.text("ASPECT", ML + 3, y + 5.5);
  doc.text("TRADITIONAL", ML + col1W + 3, y + 5.5);
  doc.setTextColor(34, 140, 60);
  doc.text("REST THE CASE VCLO", ML + col1W + col2W + 3, y + 5.5);
  y += 8;

  cmpRows.forEach((row, i) => {
    const c1Lines = wrap(doc, row.label,       col1W - 4);
    const c2Lines = wrap(doc, row.traditional, col2W - 4);
    const c3Lines = wrap(doc, row.vclo,        col3W - 4);
    const rowH2 = Math.max(c1Lines.length, c2Lines.length, c3Lines.length) * 4.5 + 6;

    if (y + rowH2 > H - 20) {
      doc.addPage(); page++;
      brochureHeader(doc, page);
      brochureFooter(doc);
      y = 24;
    }

    if (i % 2 === 0) {
      doc.setFillColor(252, 250, 246);
      doc.rect(ML, y, CW, rowH2, "F");
    }
    doc.setDrawColor(...INK4);
    doc.setLineWidth(0.15);
    doc.line(ML, y + rowH2, ML + CW, y + rowH2);

    const ry = y + 5;
    doc.setFont("helvetica", "bold");   doc.setFontSize(7.5); doc.setTextColor(...INK1);
    doc.text(c1Lines, ML + 3, ry);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...INK2);
    doc.text(c2Lines, ML + col1W + 3, ry);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(34, 140, 60);
    doc.text(c3Lines, ML + col1W + col2W + 3, ry);

    y += rowH2;
  });

  // ═══════════════════════════════════════════════════════════════
  // PAGE 3 — SERVICES
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  page++;
  brochureHeader(doc, page);
  brochureFooter(doc);

  y = 24;

  doc.setFillColor(...NAVY2);
  doc.roundedRect(ML, y, CW, 14, 3, 3, "F");
  doc.setFillColor(...GOLD);
  doc.rect(ML, y, 4, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GOLD);
  doc.text("What Your VCLO Plan Includes", ML + 9, y + 9.5);
  y += 20;

  const services = [
    { color: [201, 168, 76] as [number,number,number], icon: "01", title: "Contract Review & Drafting",        body: "All vendor, client, employee, and partner agreements reviewed and strengthened before you sign. Standard contracts drafted and templated for reuse." },
    { color: [50, 120, 220] as [number,number,number], icon: "02", title: "Compliance Calendar Management",    body: "Track GST filings, MCA returns, labour law compliances, and licence renewals. Advance reminders ensure you never miss a statutory deadline." },
    { color: [34, 180, 80]  as [number,number,number], icon: "03", title: "On-Demand Legal Queries",           body: "Ask any legal question and receive a clear, business-focused response — no billable hours, no surprises. Available via call, email, or WhatsApp." },
    { color: [220, 60, 60]  as [number,number,number], icon: "04", title: "Dispute Prevention & Management",   body: "Identify potential disputes before they escalate. If a notice or dispute arises, your VCLO guides your response and prepares the necessary documentation." },
    { color: [120, 70, 210] as [number,number,number], icon: "05", title: "IP Registration Guidance",          body: "Trademark, copyright, and patent filing support. Protect your brand, product, and content assets before competitors act first." },
    { color: [210, 130, 20] as [number,number,number], icon: "06", title: "Regulatory & Business Advisory",    body: "Guidance on sector-specific regulations — FSSAI, RERA, RBI, SEBI, and more. Stay compliant as your business grows and enters new verticals." },
  ];

  const svcCardH = 36;
  services.forEach((s, i) => {
    if (y + svcCardH > H - 20) {
      doc.addPage(); page++;
      brochureHeader(doc, page);
      brochureFooter(doc);
      y = 24;
    }

    const col = s.color;
    const lightCol = col.map(c => Math.min(255, c + 185)) as [number,number,number];

    doc.setFillColor(...PANEL);
    doc.roundedRect(ML, y, CW, svcCardH, 3, 3, "F");
    doc.setDrawColor(...INK4);
    doc.setLineWidth(0.15);
    doc.roundedRect(ML, y, CW, svcCardH, 3, 3, "S");

    // Left accent + icon badge
    doc.setFillColor(...col);
    doc.rect(ML, y, 4, svcCardH, "F");
    doc.setFillColor(...lightCol);
    doc.roundedRect(ML + 8, y + svcCardH / 2 - 8, 16, 16, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...col);
    doc.text(s.icon, ML + 16, y + svcCardH / 2 + 1.5, { align: "center" });

    // Title + body
    const bodyLines = wrap(doc, s.body, CW - 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK1);
    doc.text(s.title, ML + 28, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK2);
    doc.text(bodyLines.slice(0, 2), ML + 28, y + 18);

    y += svcCardH + 4;
  });

  // ═══════════════════════════════════════════════════════════════
  // PAGE 4 — HOW IT WORKS
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  page++;
  brochureHeader(doc, page);
  brochureFooter(doc);

  y = 24;

  doc.setFillColor(...NAVY2);
  doc.roundedRect(ML, y, CW, 14, 3, 3, "F");
  doc.setFillColor(...GOLD);
  doc.rect(ML, y, 4, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GOLD);
  doc.text("How It Works — 3 Simple Steps", ML + 9, y + 9.5);
  y += 22;

  // Connector line
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(ML + 14, y + 16, ML + 14, y + 16 + 2 * 64 + 12);
  doc.setLineDashPattern([], 0);

  const steps = [
    { num: "1", color: [201, 168, 76] as [number,number,number], title: "Legal Health Assessment",
      subtitle: "Start with LegalIQ — Free",
      body: "Complete the 15-minute LegalIQ assessment to receive your Legal Health Score. The score identifies your four legal health pillars — Litigation, Contracts, Compliance, and Legal Costs — and surfaces the gaps that need attention most urgently.",
      badge: "FREE · 15 minutes" },
    { num: "2", color: [50, 120, 220] as [number,number,number], title: "VCLO Onboarding",
      subtitle: "Week 1 — Personalised Setup",
      body: "Your dedicated VCLO reviews your Legal Health Report, existing agreements, and compliance calendar. An initial action plan is prepared specifically for your business type, stage, and identified risks.",
      badge: "Dedicated attorney assigned" },
    { num: "3", color: [34, 180, 80] as [number,number,number], title: "Ongoing Legal Support",
      subtitle: "Monthly — Always-On Coverage",
      body: "Your VCLO is available for contract reviews, compliance queries, dispute guidance, and legal questions throughout the month. Monthly check-ins ensure new risks are caught early — before they become costly problems.",
      badge: "Flat monthly retainer" },
  ];

  steps.forEach((s) => {
    const stepH = 64;
    if (y + stepH > H - 20) {
      doc.addPage(); page++;
      brochureHeader(doc, page);
      brochureFooter(doc);
      y = 24;
    }

    // Step circle
    doc.setFillColor(...s.color);
    doc.circle(ML + 14, y + 16, 11, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...WHITE);
    doc.text(s.num, ML + 14, y + 19.5, { align: "center" });

    // Card
    doc.setFillColor(...PANEL);
    doc.roundedRect(ML + 28, y, CW - 28, stepH, 4, 4, "F");
    doc.setDrawColor(...s.color);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML + 28, y, CW - 28, stepH, 4, 4, "S");

    // Badge
    const bw = doc.getTextWidth(s.badge) + 10;
    doc.setFillColor(...s.color.map(c => Math.min(255, c + 185)) as [number,number,number]);
    doc.roundedRect(W - ML - bw - 4, y + 6, bw, 7, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...s.color);
    doc.text(s.badge, W - ML - bw / 2 - 4, y + 11, { align: "center" });

    // Title
    const titleW = CW - 28 - bw - 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK1);
    doc.text(s.title, ML + 34, y + 12);

    // Subtitle
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...s.color);
    doc.text(s.subtitle, ML + 34, y + 19);

    // Body
    const bodyL = wrap(doc, s.body, titleW + bw + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK2);
    doc.text(bodyL.slice(0, 4), ML + 34, y + 26);

    y += stepH + 8;
  });

  // ═══════════════════════════════════════════════════════════════
  // PAGE 5 — PRICING & CTA
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  page++;

  // Full dark background for CTA page
  doc.setFillColor(...B_NAVY);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...B_GOLD);
  doc.rect(0, 0, W, 3.5, "F");
  doc.setFillColor(...B_GOLD);
  doc.rect(0, 0, 3.5, H, "F");

  y = 28;

  // Section tag
  doc.setFillColor(24, 32, 64);
  doc.setDrawColor(...B_GOLD);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML + 8, y, 56, 9, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...B_GOLD);
  doc.text("VCLO PLANS & PRICING", ML + 36, y + 6, { align: "center" });
  y += 16;

  // Headline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  doc.text("Protect Your Business.", ML + 8, y);
  y += 10;
  doc.setFontSize(22);
  doc.setTextColor(...B_GOLD);
  doc.text("For Less Than You Think.", ML + 8, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(170, 162, 140);
  const taglineLines = wrap(doc, clean(config?.tagline || "REST THE CASE VCLO plans give your business a dedicated attorney at a flat monthly rate - no hourly billing, no hidden fees, no surprises."), CW - 10);
  doc.text(taglineLines, ML + 8, y);
  y += taglineLines.length * 5.5 + 12;

  // Plan cards
  const plans = [
    { name: "Starter",    price: "Rs. 4,999",  period: "/month", highlight: false, features: ["Up to 3 contract reviews/month", "Compliance calendar", "On-demand queries (5/month)", "Basic advisory"] },
    { name: "Business",   price: "Rs. 9,999",  period: "/month", highlight: true,  features: ["Up to 10 contract reviews/month", "Full compliance monitoring", "Unlimited queries", "Dispute guidance", "IP advisory"] },
    { name: "Enterprise", price: "Custom",      period: "pricing", highlight: false, features: ["Unlimited contract reviews", "Multi-entity compliance", "Priority response SLA", "Board advisory support"] },
  ];

  const planW = (CW - 8) / 3;
  plans.forEach((plan, i) => {
    const px = ML + i * (planW + 4);
    const planH = 86;
    const planColor: [number,number,number] = plan.highlight ? GOLD : [40, 50, 85];
    const textC: [number,number,number] = plan.highlight ? DARK : WHITE;

    doc.setFillColor(...planColor);
    doc.roundedRect(px, y, planW, planH, 4, 4, "F");
    if (plan.highlight) {
      doc.setFillColor(...GOLD);
      doc.roundedRect(px, y, planW, 5, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...DARK);
      doc.text("MOST POPULAR", px + planW / 2, y + 3.5, { align: "center" });
    }

    const innerY = plan.highlight ? y + 10 : y + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textC);
    doc.text(plan.name, px + planW / 2, innerY, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...(plan.highlight ? DARK : GOLD));
    doc.text(plan.price, px + planW / 2, innerY + 10, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...(plan.highlight ? [80, 60, 10] as [number,number,number] : INK3));
    doc.text(plan.period, px + planW / 2, innerY + 16, { align: "center" });

    plan.features.forEach((f, fi) => {
      const fy = innerY + 24 + fi * 9.5;
      doc.setFillColor(plan.highlight ? 200 : 50, plan.highlight ? 180 : 65, plan.highlight ? 40 : 100);
      doc.circle(px + 6, fy - 1.5, 1.5, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...(plan.highlight ? [40, 30, 5] as [number,number,number] : [200, 195, 188] as [number,number,number]));
      const fl = wrap(doc, f, planW - 14);
      doc.text(fl[0]!, px + 10, fy);
    });
  });

  y += 92;

  // Gold CTA bar
  doc.setFillColor(...B_GOLD);
  doc.roundedRect(ML + 8, y, CW - 10, 22, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text("Book Your Free 30-Minute Consultation Today", ML + (CW - 10) / 2 + 8, y + 14.5, { align: "center" });
  y += 30;

  // Contact details
  const contacts = [
    `Website:  ${config?.website || "restthecase.com/virtualCLOPackage"}`,
    `Email:    ${config?.contactEmail || "info@restthecase.com"}`,
    `Phone:    ${config?.contactPhone || "+91 9876543210"}`,
  ];
  contacts.forEach((c, i) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(180, 172, 148);
    doc.text(clean(c), ML + 8, y + i * 10);
  });

  y += contacts.length * 10 + 8;

  // Footer disclaimer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 82, 65);
  doc.text("This brochure is for informational purposes only. Plans and pricing subject to change. Contact us for a custom quote.", ML + 8, H - 18);
  doc.text("(C) REST THE CASE  |  restthecase.com", ML + 8, H - 11);

  const suffix = selection.version ? `-v${selection.version}` : "";
  doc.save(`RestTheCase-VCLO-Service-Brochure${suffix}.pdf`);
}

export async function generateCertificatePDF(data: CertificateData): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await drawCertificatePage(doc, data);

  const fname = `LegalIQ-Certificate-${clean(data.company).replace(/[^a-zA-Z0-9]/g, "-")}-${data.totalScore}.pdf`;
  doc.save(fname);
}
