import assert from "node:assert/strict";
import { generateLhsReportPdf } from "../services/reportPdf.js";

const pdf = generateLhsReportPdf({
  company: "Example Education Pvt. Ltd.",
  ownerName: "Test User",
  score: 61,
  grade: "B",
  riskLevel: "STABLE",
  summary: "The organisation has a usable baseline with material admissions and affiliation gaps.",
  pillars: [
    { label: "Litigation Health", score: 15 },
    { label: "Contractual Health", score: 16 },
    { label: "Compliance Health", score: 12 },
    { label: "Legal Cost Efficiency", score: 18 },
  ],
  insights: [{ title: "Admission terms", description: "Create a written fee and refund policy." }],
  actions: [{ action: "Review affiliation records", timeline: "Within 30 days" }],
  cases: [{ title: "Programme approval", caseStudy: { sourceTitle: "AICTE v Surinder Kumar Dhawan", sourceUrl: "https://indiankanoon.org/doc/804444/" } }],
});

assert.ok(pdf.length > 900, "PDF attachment must be non-empty");
assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.4");
assert.match(pdf.toString("ascii"), /Legal Health Report/);
assert.match(pdf.toString("ascii"), /startxref/);

console.log("reportPdf tests passed");