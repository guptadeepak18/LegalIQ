type ReportPdfInput = {
  company: string;
  ownerName: string;
  score: number;
  grade: string;
  riskLevel: string;
  summary: string;
  pillars: Array<{ label: string; score: number }>;
  insights: Array<{ title?: string; description?: string }>;
  actions: Array<{ action?: string; timeline?: string }>;
  cases: Array<{ title?: string; caseStudy?: { sourceTitle?: string; sourceUrl?: string } }>;
};

function ascii(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: string, width = 84): string[] {
  const words = ascii(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > width && current) {
      lines.push(current);
      current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Produces a standards-compliant, dependency-free PDF attachment from the same
 * persisted report data shown in LegalIQ. It intentionally does not mutate or
 * replace the browser report/PDF design.
 */
export function generateLhsReportPdf(input: ReportPdfInput): Buffer {
  const lines: Array<{ text: string; size: number; gap?: number }> = [
    { text: "LEGALIQ BY REST THE CASE", size: 15, gap: 8 },
    { text: `Legal Health Report - ${ascii(input.company)}`, size: 20, gap: 12 },
    { text: `Prepared for ${ascii(input.ownerName)}`, size: 10, gap: 14 },
    { text: `LEGAL HEALTH SCORE: ${input.score}/100  |  GRADE: ${ascii(input.grade)}  |  RISK: ${ascii(input.riskLevel)}`, size: 12, gap: 14 },
    { text: "EXECUTIVE SUMMARY", size: 12, gap: 5 },
    ...wrap(input.summary).map((text) => ({ text, size: 9 })),
    { text: "PILLAR SCORES", size: 12, gap: 5 },
    ...input.pillars.map((pillar) => ({ text: `${ascii(pillar.label)}: ${pillar.score}/25`, size: 9 })),
  ];
  if (input.insights.length) {
    lines.push({ text: "KEY FINDINGS", size: 12, gap: 5 });
    for (const [index, insight] of input.insights.slice(0, 3).entries()) {
      lines.push({ text: `${index + 1}. ${ascii(insight.title)}`, size: 10 });
      lines.push(...wrap(insight.description ?? "", 88).map((text) => ({ text, size: 8 })));
    }
  }
  if (input.actions.length) {
    lines.push({ text: "PRIORITY ACTIONS", size: 12, gap: 5 });
    for (const [index, action] of input.actions.slice(0, 5).entries()) {
      lines.push({ text: `${index + 1}. ${ascii(action.action)} (${ascii(action.timeline)})`, size: 9 });
    }
  }
  if (input.cases.length) {
    lines.push({ text: "RELEVANT SOURCED CASES", size: 12, gap: 5 });
    for (const item of input.cases.slice(0, 3)) {
      lines.push(...wrap(item.caseStudy?.sourceTitle || item.title || "", 88).map((text) => ({ text, size: 8 })));
      if (item.caseStudy?.sourceUrl) lines.push(...wrap(item.caseStudy.sourceUrl, 92).map((text) => ({ text, size: 7 })));
    }
  }
  lines.push({ text: "This report is an informational legal-health assessment and not legal advice.", size: 7, gap: 12 });

  const pageHeight = 792;
  const chunks: string[] = ["BT", "/F1 10 Tf", "50 748 Td"];
  let y = 748;
  for (const line of lines) {
    const gap = line.gap ?? 4;
    const step = line.size + gap;
    if (y - step < 42) break;
    chunks.push(`/F1 ${line.size} Tf`, `0 -${step} Td`, `(${escapePdf(ascii(line.text))}) Tj`);
    y -= step;
  }
  chunks.push("ET");
  const stream = chunks.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 ${pageHeight}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}