import assert from "node:assert/strict";
import { BUSINESS_CATEGORIES } from "../../../legaliq-web/src/lib/indiaData.js";
import { resolveBusinessProfile, PROFILE_CATEGORIES } from "../services/businessProfiles.js";
import { buildFallbackPillars, buildSeedPromptFor } from "../services/gemini.js";

// Every onboarding category has its own profile (no silent drop to "Other").
for (const category of Object.keys(BUSINESS_CATEGORIES)) {
  assert.ok(PROFILE_CATEGORIES.includes(category), `Missing profile for category "${category}"`);
}

// Every sub-category gets 5 questions per pillar, at least 2 of them business-specific.
let total = 0;
for (const [category, subs] of Object.entries(BUSINESS_CATEGORIES)) {
  for (const sub of subs) {
    const profile = resolveBusinessProfile(category, sub);
    assert.equal(profile.isGeneric, false, `${sub} resolved to a generic profile`);
    const pillars = buildFallbackPillars(category, sub);
    assert.equal(pillars.length, 4);
    for (const p of pillars) {
      assert.equal(p.questions.length, 5, `${sub} / ${p.name} has ${p.questions.length} questions`);
      const ids = new Set(p.questions.map((q) => q.id));
      assert.equal(ids.size, 5, `${sub} / ${p.name} has duplicate question ids`);
      const pid = p.id as 1 | 2 | 3 | 4;
      assert.ok(profile.topicsByPillar[pid].length >= 2, `${sub} / ${p.name} has < 2 specific topics`);
    }
    total++;
  }
}

// Sub-category rules must not misfire on look-alike names.
const topicsOf = (c: string, s: string) =>
  Object.values(resolveBusinessProfile(c, s).topicsByPillar).flat().map((t) => t.topic);
assert.ok(!topicsOf("Beauty & Personal Care", "Hair Salon / Barber Shop").includes("Excise licence"), "Barber matched bar rule");
assert.ok(!topicsOf("Real Estate & Construction", "Coworking Space Operator").includes("Spa licensing"), "Space matched spa rule");
assert.ok(!topicsOf("Real Estate & Construction", "Property Management Company").includes("Hallmarking with HUID"), "Management matched gem rule");
assert.ok(!topicsOf("Agriculture & AgriBusiness", "Cotton / Jute Processing").includes("IT Rules / MIB compliance"), "Cotton matched OTT rule");
assert.ok(!topicsOf("Manufacturing", "Garment / Textile Manufacturer").includes("Food label compliance"), "Garment got food label rule");
assert.ok(!topicsOf("Technology & IT", "Mobile App Development").includes("BIS CRS and e-waste EPR"), "App dev got BIS rule");
assert.ok(!topicsOf("Education & Training", "Driver Training School").includes("RTE and fee regulation"), "Driving school got RTE rule");

// Positive matches: the most specific topic leads the pillar.
assert.equal(resolveBusinessProfile("Healthcare & Wellness", "Pharmacy / Chemist").topicsByPillar[3][0]!.topic, "Drug licence and pharmacist");
assert.equal(resolveBusinessProfile("Food & Beverage", "Bar / Liquor Outlet").topicsByPillar[3][0]!.topic, "Excise licence");
assert.equal(resolveBusinessProfile("Gems & Jewellery", "Jewellery Retailer").topicsByPillar[3][0]!.topic, "Hallmarking with HUID");

// Exclusive rules: a chemist is not asked clinic questions.
const chemist = topicsOf("Healthcare & Wellness", "Pharmacy / Chemist");
assert.ok(!chemist.includes("Medical negligence complaints"), "Chemist got clinic topics");
assert.ok(!chemist.includes("Bio-medical waste compliance"), "Chemist got BMW topic");
assert.ok(chemist.includes("Cold chain records"));

// Prompt labels category and sub-category correctly (they used to be swapped).
const prompt = buildSeedPromptFor("Sharma Medicos", "Healthcare & Wellness", "Pharmacy / Chemist", "Pune", 3);
assert.match(prompt, /Industry category: Healthcare & Wellness/);
assert.match(prompt, /Business type \(sub-category\): Pharmacy \/ Chemist/);
assert.match(prompt, /Drug licence and pharmacist/);
assert.doesNotMatch(prompt, /Employees: 1-50/);

console.log(`business profile tests passed (${total} sub-categories checked)`);
