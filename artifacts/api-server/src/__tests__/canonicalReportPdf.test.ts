import assert from "node:assert/strict";
import { renderReportPDFBytes, type ReportData } from "../../../legaliq-web/src/lib/pdfGenerator.js";
import { selectCaseStudies } from "../data/caseStudies.js";

const [realCase] = selectCaseStudies(
  "Technology software startup",
  "Technology",
  [{ title: "Trademark and brand infringement exposure" }],
);

const data: ReportData = {
  company: "Acme Legal Test",
  name: "Test Owner",
  businessType: "Technology",
  city: "Pune",
  totalScore: 71,
  riskLevel: "STABLE",
  summary: "A persisted legal health report used to verify canonical PDF rendering.",
  pillars: [
    { label: "Litigation Health", score: 18 },
    { label: "Contractual Health", score: 17 },
    { label: "Compliance Health", score: 19 },
    { label: "Legal Cost Efficiency", score: 17 },
  ],
  insights: [],
  actions: [],
  similarCases: realCase ? [realCase] : [],
};

const first = await renderReportPDFBytes(data);
assert.equal(Buffer.from(first.subarray(0, 5)).toString("ascii"), "%PDF-");
assert.ok(first.byteLength > 10_000, "canonical report should contain the full designed document");
if (realCase) {
  assert.ok(
    Buffer.from(first).includes(Buffer.from(realCase.readMoreUrl)),
    "canonical PDF must embed the exact public source URL as a clickable link",
  );
}
assert.ok(
  !Buffer.from(first).includes(Buffer.from("CASE STUDY: A SIMILAR BUSINESS")),
  "canonical PDF must not render the legacy unsourced similar-business case block",
);
console.log("canonical report PDF tests passed");