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
}

export interface Action {
  action: string;
  description: string;
  timeline: "THIS WEEK" | "THIS MONTH" | "90 DAYS";
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
  actions: Action[];
  vcloPitch?: string;
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
  doc.text("Confidential. Prepared by Rest The Case. Not legal advice.", 14, H - 7.5);
  doc.text("restthecase.com/virtualCLOPackage", W - 14, H - 7.5, { align: "right" });
}

// Draw a small filled square as a pillar colour indicator (replaces emoji)
function pillarDot(doc: jsPDF, x: number, y: number, color: [number,number,number]) {
  doc.setFillColor(...color);
  doc.roundedRect(x, y - 3, 4.5, 4.5, 1, 1, "F");
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function generateReportPDF(data: ReportData): void {
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
  y += 18;

  const barMaxW = CW - 70;
  const rowH = 30;
  const rowGap = 5;

  data.pillars.forEach((p, i) => {
    const col = PILLAR_COLORS[i]!;
    const pct = Math.min(1, p.score / 25);
    const barW = barMaxW * pct;
    const rY = y + i * (rowH + rowGap);
    const pg = grade((p.score / 25) * 100);

    // Row card
    doc.setFillColor(...PANEL);
    doc.roundedRect(ML, rY, CW, rowH, 3, 3, "F");
    doc.setDrawColor(...INK4);
    doc.setLineWidth(0.2);
    doc.roundedRect(ML, rY, CW, rowH, 3, 3, "S");

    // Left colour accent strip
    doc.setFillColor(...col);
    doc.roundedRect(ML, rY, 4, rowH, 2, 2, "F");

    // Pillar number badge
    doc.setFillColor(...col);
    doc.circle(ML + 16, rY + 11, 6.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text(`${i + 1}`, ML + 16, rY + 14.5, { align: "center" });

    // Pillar label tag
    const tagX = ML + 26;
    doc.setFillColor(...col.map((c) => Math.min(255, c + 185)) as [number,number,number]);
    const tagW = doc.getTextWidth(PILLAR_LABELS[i]!) + 8;
    doc.roundedRect(tagX, rY + 5, tagW, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...col);
    doc.text(PILLAR_LABELS[i]!, tagX + tagW / 2, rY + 11, { align: "center" });

    // Pillar full name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK1);
    doc.text(p.label, tagX + tagW + 5, rY + 11);

    // Score (right side)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...col);
    doc.text(`${p.score}/25`, ML + CW - 6, rY + 12, { align: "right" });

    // Grade chip
    const chipX = ML + CW - 6 - doc.getTextWidth(`${p.score}/25`) - 20;
    doc.setFillColor(...col);
    doc.roundedRect(chipX, rY + 4, 14, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(`Grd ${pg}`, chipX + 7, rY + 9.5, { align: "center" });

    // Progress bar track
    const barY2 = rY + 20;
    doc.setFillColor(...INK4);
    doc.roundedRect(ML + 26, barY2, barMaxW, 4.5, 2, 2, "F");

    // Progress bar fill
    doc.setFillColor(...col);
    if (barW > 0) doc.roundedRect(ML + 26, barY2, Math.max(2, barW), 4.5, 2, 2, "F");
  });

  y += data.pillars.length * (rowH + rowGap) + 8;

  // Legend
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...INK3);
  doc.text("Score guide:  0-8 = Grade D (At Risk)   8-12 = Grade C (Needs Attention)   12-16 = Grade B (Good)   16-20 = Grade A (Excellent)", ML, y);
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
    const titleLines = wrap(doc, ins.title, CW - 24);
    const descLines  = wrap(doc, ins.description, CW - 20);
    const frLines    = wrap(doc, `Risk: ${ins.financialRisk}`, CW - 20);

    const boxH = 10 + titleLines.length * 5.5 + 4 + descLines.length * 4.8 + 4 + frLines.length * 4.8 + 8;

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
    doc.roundedRect(ML + 10, y + 7, badgeW2, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(ins.severity, ML + 10 + badgeW2 / 2, y + 12.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK3);
    doc.text(`${i + 1} / ${data.insights.length}`, W - ML - 8, y + 12, { align: "right" });

    // Title
    let cy = y + 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK1);
    doc.text(titleLines, ML + 10, cy);
    cy += titleLines.length * 5.5 + 4;

    // Description
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK2);
    doc.text(descLines, ML + 10, cy);
    cy += descLines.length * 4.8 + 4;

    // Financial risk line
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(175, 85, 0);
    doc.text(frLines, ML + 10, cy);

    y += boxH + 7;
  });

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

  data.actions.forEach((act, i) => {
    const tc = tlRGB(act.timeline);
    // Wrap BOTH action title AND description
    const titleLines = wrap(doc, act.action, CW - 36);
    // Show description only if it differs meaningfully from title
    const cleanTitle = clean(act.action).toLowerCase().replace(/\s+/g, " ");
    const cleanDesc  = clean(act.description).toLowerCase().replace(/\s+/g, " ");
    const showDesc   = cleanDesc.trim() !== "" && !cleanDesc.startsWith(cleanTitle.slice(0, 40));
    const descLines2 = showDesc ? wrap(doc, act.description, CW - 36) : [];

    const boxH = Math.max(26,
      16                         // top padding + badge + gap
      + titleLines.length * 5.5
      + (descLines2.length > 0 ? 3 + descLines2.length * 4.8 : 0)
      + 10                       // bottom padding
    );

    if (y + boxH > H - 20) {
      doc.addPage();
      page++;
      pageHeader(doc, page);
      pageFooter(doc);
      y = 24;
    }

    // Card background
    doc.setFillColor(...PANEL);
    doc.roundedRect(ML, y, CW, boxH, 4, 4, "F");
    doc.setDrawColor(...INK4);
    doc.setLineWidth(0.2);
    doc.roundedRect(ML, y, CW, boxH, 4, 4, "S");

    // Left colour accent
    doc.setFillColor(...tc);
    doc.rect(ML, y, 4, boxH, "F");

    // Number circle
    const circY = y + boxH / 2;
    doc.setFillColor(...tc);
    doc.circle(ML + 14, circY, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text(`${i + 1}`, ML + 14, circY + 3.5, { align: "center" });

    // Timeline badge (top right inside card)
    const tlW = doc.getTextWidth(act.timeline) + 8;
    doc.setFillColor(...tc.map((c) => Math.min(255, c + 185)) as [number,number,number]);
    doc.roundedRect(W - ML - tlW - 6, y + 6, tlW, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...tc);
    doc.text(act.timeline, W - ML - tlW / 2 - 6, y + 11.5, { align: "center" });

    // Action title (wrapped, left-aligned after circle)
    const textX = ML + 26;
    const textW = CW - 26 - tlW - 10;
    const wrappedTitle = wrap(doc, act.action, textW);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK1);
    let innerY = y + 12;
    doc.text(wrappedTitle, textX, innerY);
    innerY += wrappedTitle.length * 5.5;

    // Description (only if distinct from title)
    if (descLines2.length > 0) {
      innerY += 3;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK2);
      doc.text(descLines2, textX, innerY);
    }

    y += boxH + 6;
  });

  // ── VCLO pitch box (if fits on page) ────────────────────────────────────────
  if (data.vcloPitch) {
    const pitchLines = wrap(doc, data.vcloPitch, CW - 18);
    const pitchH = pitchLines.length * 5.2 + 24;
    if (y + pitchH < H - 20) {
      y += 6;
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
      doc.text("YOUR NEXT STEP  |  Rest The Case VCLO Service", ML + 9, y + 11);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(185, 178, 158);
      doc.text(pitchLines, ML + 9, y + 19);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // PAGE 5 — CALL TO ACTION
  // ══════════════════════════════════════════════════════════════
  doc.addPage();
  page++;

  // Dark background
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, H, "F");

  // Accent bars
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 3.5, "F");
  doc.rect(0, 0, 3.5, H, "F");

  const cx = W / 2;

  // ── Big tagline ─────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...GOLD);
  doc.text("Ready to fix these gaps?", cx, 72, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(175, 168, 152);
  doc.text("Book a free 30-minute consultation with a Rest The Case attorney.", cx, 84, { align: "center" });

  // ── Score recap box ─────────────────────────────────────────
  const sbW = 120;
  const sbX = cx - sbW / 2;
  doc.setFillColor(22, 20, 15);
  doc.roundedRect(sbX, 96, sbW, 38, 6, 6, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.roundedRect(sbX, 96, sbW, 38, 6, 6, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK3);
  doc.text("YOUR LEGAL HEALTH SCORE", cx, 108, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...GOLD);
  doc.text(`${data.totalScore} / 100`, cx, 124, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...rc);
  doc.text(`Grade ${g}  |  ${clean(gl).toUpperCase()}`, cx, 133, { align: "center" });

  // ── CTA button ──────────────────────────────────────────────
  const ctaW = 130;
  const ctaX = cx - ctaW / 2;
  doc.setFillColor(...GOLD);
  doc.roundedRect(ctaX, 150, ctaW, 20, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...DARK);
  doc.text("Book Free Consultation Now", cx, 162.5, { align: "center" });

  // ── URL ─────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text("restthecase.com/virtualCLOPackage", cx, 183, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK3);
  doc.text("India's first AI-powered Legal Health Platform for Businesses", cx, 194, { align: "center" });

  // Pillars recap mini
  const miniY = 210;
  doc.setFillColor(22, 20, 15);
  doc.roundedRect(ML + 10, miniY, CW - 20, 44, 5, 5, "F");

  const miniCols = data.pillars.length;
  const colW2 = (CW - 20) / miniCols;
  data.pillars.forEach((p, i) => {
    const col = PILLAR_COLORS[i]!;
    const cx2 = ML + 10 + i * colW2 + colW2 / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...col);
    doc.text(PILLAR_LABELS[i]!, cx2, miniY + 10, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...WHITE);
    doc.text(`${p.score}`, cx2, miniY + 24, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...INK3);
    doc.text("/25", cx2, miniY + 31, { align: "center" });

    // Mini bar
    const mbarW = colW2 - 12;
    doc.setFillColor(40, 38, 32);
    doc.roundedRect(cx2 - mbarW / 2, miniY + 35, mbarW, 3.5, 1, 1, "F");
    doc.setFillColor(...col);
    const fill = Math.max(1, (p.score / 25) * mbarW);
    doc.roundedRect(cx2 - mbarW / 2, miniY + 35, fill, 3.5, 1, 1, "F");
  });

  // ── Footer ──────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(70, 65, 55);
  doc.text(clean(`Report prepared for ${data.company}  |  ${today}  |  LegalIQ by Rest The Case`), cx, H - 18, { align: "center" });
  doc.text("Confidential  |  Not legal advice", cx, H - 11, { align: "center" });

  // ── Save ────────────────────────────────────────────────────
  const fname = `LegalIQ-Report-${clean(data.company).replace(/[^a-zA-Z0-9]/g, "-")}-${data.totalScore}.pdf`;
  doc.save(fname);
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

export async function generateCertificatePDF(data: CertificateData): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();   // 297
  const H = doc.internal.pageSize.getHeight();  // 210
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
  doc.roundedRect(-40, -40, 140, 140, 60, 60, "F");
  doc.roundedRect(W - 100, H - 100, 140, 140, 60, 60, "F");

  // ── Large background watermark logo (very light, centered) ──
  if (logoDataUrl) {
    const wmSize = 150;
    const gState = new (doc as any).GState({ opacity: 0.06 });
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

  // ── Header: logo mark + wordmark ──────────────────────────
  let headY = 30;
  if (logoDataUrl) {
    const logoS = 14;
    doc.addImage(logoDataUrl, "PNG", cx - logoS / 2, headY - logoS + 4, logoS, logoS);
    headY += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...CERT_GOLD);
  doc.text("LegalIQ", cx, headY + 12, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CERT_INK3);
  doc.text("LEGAL HEALTH ASSESSMENT  |  BY REST THE CASE", cx, headY + 19, { align: "center" });

  doc.setDrawColor(...CERT_GOLD_LT);
  doc.setLineWidth(0.3);
  doc.line(cx - 30, headY + 24, cx + 30, headY + 24);

  // ── Title ──────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...CERT_INK1);
  doc.text("Certificate of Legal Health", cx, headY + 40, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...CERT_INK2);
  doc.text("This certifies that", cx, headY + 50, { align: "center" });

  // ── Business name (hero) ──────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...CERT_GOLD);
  const nameLines = wrap(doc, data.company, W - 100);
  doc.text(nameLines.slice(0, 1), cx, headY + 63, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CERT_INK3);
  doc.text(clean(`${data.businessType}  |  ${data.city}`), cx, headY + 71, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...CERT_INK2);
  doc.text(
    "has successfully completed the LegalIQ Legal Health Assessment,",
    cx, headY + 82, { align: "center" }
  );
  doc.text(
    "evaluating litigation exposure, contracts, compliance, and legal cost efficiency.",
    cx, headY + 88, { align: "center" }
  );

  // ── Score medallion + grade badge ─────────────────────────
  const medY = headY + 105;
  const medR = 20;

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
  doc.setFontSize(28);
  doc.setTextColor(...CERT_GOLD);
  doc.text(`${data.totalScore}`, cx, medY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...CERT_INK3);
  doc.text("OUT OF 100", cx, medY + 11, { align: "center" });

  // Grade badge to the right of medallion
  const badgeX = cx + medR + 14;
  doc.setFillColor(...rc);
  doc.roundedRect(badgeX, medY - 11, 46, 22, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(`Grade ${g}`, badgeX + 23, medY - 1, { align: "center" });
  doc.setFontSize(8.5);
  doc.text(clean(gl).toUpperCase(), badgeX + 23, medY + 7, { align: "center" });

  // Label to the left of medallion
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...CERT_INK3);
  doc.text("LEGAL HEALTH", cx - medR - 14, medY - 1, { align: "right" });
  doc.text("SCORE", cx - medR - 14, medY + 7, { align: "right" });

  // ── Footer: signature line, date, certificate id ──────────
  const footY = H - 30;
  doc.setDrawColor(...CERT_INK3);
  doc.setLineWidth(0.25);

  // Left: date issued
  doc.line(om + 6, footY, om + 66, footY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...CERT_INK3);
  doc.text("DATE ISSUED", om + 6, footY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...CERT_INK1);
  doc.text(issuedDate, om + 6, footY - 3);

  // Right: authorised signature (Rest The Case)
  doc.line(W - om - 66, footY, W - om - 6, footY);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(13);
  doc.setTextColor(...CERT_GOLD);
  doc.text("Rest The Case", W - om - 36, footY - 3, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...CERT_INK3);
  doc.text("AUTHORISED ISSUER", W - om - 36, footY + 6, { align: "center" });

  // Center: certificate id + prepared for
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...CERT_INK3);
  doc.text(clean(`Certificate ID: ${certId}  |  Prepared for ${data.name}`), cx, footY + 6, { align: "center" });
  doc.setFontSize(7);
  doc.text("Verify at restthecase.com/virtualCLOPackage  |  Not legal advice", cx, H - 15, { align: "center" });

  // ── Save ───────────────────────────────────────────────────
  const fname = `LegalIQ-Certificate-${clean(data.company).replace(/[^a-zA-Z0-9]/g, "-")}-${data.totalScore}.pdf`;
  doc.save(fname);
}
