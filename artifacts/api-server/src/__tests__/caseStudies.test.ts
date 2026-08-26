import assert from "node:assert/strict";
import { resolveCaseStudies, selectCaseStudies } from "../data/caseStudies.js";

const education = selectCaseStudies(
  "B-School and higher education institute",
  "Education",
  [{ title: "Student fee refund and grievance exposure", gap: "No written admissions refund policy" }],
  JSON.stringify({ answers: ["AICTE affiliation records need renewal", "Student admission complaints are handled informally"] }),
);
assert.ok(education.length >= 1 && education.length <= 3, "education signals should select a small relevant set");
assert.ok(education.every((item) => /student|admission|programme|education/i.test(`${item.title} ${item.summary}`)));
assert.equal(new Set(education.map((item) => item.caseStudyId)).size, education.length, "selected cases must be unique");
assert.ok(education.every((item) =>
  item.caseStudy.provenance.verificationStatus === "verified"
  && item.caseStudy.provenance.sourceUrl === item.readMoreUrl
  && /^https:\/\//.test(item.readMoreUrl),
), "every displayed case must preserve its exact verified source");

const logistics = selectCaseStudies(
  "Logistics and courier",
  "Supply chain",
  [{ title: "Cargo delivery disputes", consequence: "Claims for lost consignments" }],
);
assert.equal(logistics[0]?.caseStudyId, "patel-roadways-carrier-consumer-liability");

const noEvidence = selectCaseStudies("General services business", "Other", []);
assert.deepEqual(noEvidence, [], "weak or unrelated evidence must return no case instead of a fallback");

const hospitalityComplaint = selectCaseStudies(
  "Hotel and travel service",
  "Hospitality",
  [{ title: "Customer service complaint", gap: "No complaint handling process", consequence: "Consumer complaint" }],
);
assert.ok(
  hospitalityComplaint.every((item) => item.caseStudyId !== "ima-vp-shantha-consumer-protection"),
  "generic service complaints must never qualify a healthcare-only decision",
);

const contractRisk = selectCaseStudies(
  "General services business",
  "Professional services",
  [{ title: "Contract and agreement exposure", gap: "Client contract terms are incomplete" }],
);
assert.ok(contractRisk.length > 0, "common contract risks must still produce relevant sourced cases");

const hydratedLegacy = resolveCaseStudies(
  [{ caseStudyId: logistics[0]?.caseStudyId, title: logistics[0]?.title, summary: logistics[0]?.summary, relevance: logistics[0]?.relevance, readMoreUrl: logistics[0]?.readMoreUrl }],
  "Logistics",
  "Supply chain",
);
assert.equal(hydratedLegacy[0]?.caseStudy.provenance.verificationStatus, "verified", "legacy report cards must regain full Read More details");

console.log("caseStudies tests passed");