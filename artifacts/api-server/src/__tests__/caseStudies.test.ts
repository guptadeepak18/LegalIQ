import assert from "node:assert/strict";
import { resolveCaseStudies, selectCaseStudies } from "../data/caseStudies.js";

const education = selectCaseStudies(
  "B-School and higher education institute",
  "Education",
  [{ title: "Student fee refund and grievance exposure", gap: "No written admissions refund policy" }],
  JSON.stringify({ answers: ["AICTE affiliation records need renewal", "Student admission complaints are handled informally"] }),
);
assert.ok(education.length >= 3 && education.length <= 5, "education signals should select three to five relevant cases when catalog coverage exists");
assert.ok(education.every((item) => /student|admission|programme|education/i.test(`${item.title} ${item.summary}`)));
assert.equal(new Set(education.map((item) => item.caseStudyId)).size, education.length, "selected cases must be unique");
assert.ok(education.every((item) =>
  item.caseStudy.provenance.verificationStatus === "verified"
  && item.caseStudy.provenance.sourceUrl === item.readMoreUrl
  && /^https:\/\//.test(item.readMoreUrl)
  && item.whatHappened.length > 20
  && item.legalIssue.length > 20
  && item.outcome.length > 20
  && item.whyItMatters.length > 20
  && item.sourceWebsite.length > 3,
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
assert.ok(contractRisk.length <= 5, "case selection must never exceed five records");

const hydratedLegacy = resolveCaseStudies(
  [{ caseStudyId: logistics[0]?.caseStudyId, title: logistics[0]?.title, summary: logistics[0]?.summary, relevance: logistics[0]?.relevance, readMoreUrl: logistics[0]?.readMoreUrl }],
  "Logistics",
  "Supply chain",
);
assert.equal(hydratedLegacy[0]?.caseStudy.provenance.verificationStatus, "verified", "legacy report cards must regain full Read More details");
assert.ok(hydratedLegacy[0]?.whatHappened, "legacy records must regain explicit report facts");
assert.equal(hydratedLegacy[0]?.readMoreUrl, hydratedLegacy[0]?.caseStudy.provenance.sourceUrl);

const copyrightCase = selectCaseStudies(
  "Translation and localization services",
  "Professional Services",
  [{ title: "Content copyright and licensing exposure" }],
).find((item) => item.caseStudyId === "rg-anand-copyright-substantial-similarity");
assert.ok(copyrightCase, "copyright signals must select the R.G. Anand case");
assert.equal(
  copyrightCase.readMoreUrl,
  "https://indiankanoon.org/doc/1734007/",
  "R.G. Anand card must link to the exact R.G. Anand v Deluxe Films judgment",
);
assert.equal(copyrightCase.readMoreUrl, copyrightCase.caseStudy.provenance.sourceUrl);

console.log("caseStudies tests passed");