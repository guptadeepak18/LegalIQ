import { Router } from "express";
import { getSeedQuestions } from "../services/questions-bank.js";
import { getNextQuestion, PILLAR_META, type Answer } from "../services/question-tree.js";

const router = Router();

export const CONTEXT_TAGS: Record<string, string[]> = {
  "Kirana Shop":          ["FSSAI", "Shop & Establishment Act", "GST", "MSME", "Trade Licence", "Weights & Measures Act"],
  "Restaurant":           ["FSSAI", "Fire NOC", "GST", "MSME", "Labour Law", "FSMS", "Eating House Licence"],
  "Cloud Kitchen":        ["FSSAI", "GST", "MSME", "Zoning/Municipal", "Health Certificate", "Aggregator Agreements"],
  "Bakery":               ["FSSAI", "GST", "Shop & Establishment Act", "MSME", "Weights & Measures Act"],
  "Catering Business":    ["FSSAI", "GST", "Labour Law", "MSME", "Health Certificate"],
  "Food Manufacturer":    ["FSSAI", "Factories Act", "BIS", "GST", "Environmental Clearance", "Labour Law"],
  "Pharmacy":             ["Drug Licence", "CDSCO", "GST", "MSME", "Pharmacist Licence", "Narcotics Act"],
  "Hospital":             ["Clinical Establishment Act", "Bio-Medical Waste", "PCPNDT", "NABH", "Fire NOC", "Labour Law"],
  "Clinic":               ["Clinical Establishment Act", "MCI/NMC", "GST", "Fire NOC", "Patient Data Privacy"],
  "Diagnostic Lab":       ["NABL", "Clinical Establishment Act", "Bio-Medical Waste", "PCPNDT", "GST"],
  "Physiotherapy Centre": ["Clinical Establishment Act", "GST", "Shop & Establishment Act", "Consumer Protection"],
  "Software Company":     ["IT Act 2000", "DPDP Act 2023", "IP/Copyright", "Employment Contracts", "Startup India"],
  "SaaS":                 ["DPDP Act 2023", "IT Act 2000", "SaaS Terms of Service", "IP/Copyright", "Data Processing Agreements"],
  "FinTech":              ["RBI Regulations", "SEBI", "DPDP Act 2023", "KYC/AML", "Payment & Settlement Act", "FEMA"],
  "EdTech":               ["IT Act 2000", "Consumer Protection Act", "DPDP Act 2023", "IP/Copyright", "GST"],
  "HealthTech":           ["IT Act 2000", "DPDP Act 2023", "Clinical Establishment Act", "Telemedicine Guidelines"],
  "Startup":              ["DPDP Act 2023", "IP/Copyright", "Employment Contracts", "Shareholders Agreement", "Startup India DPIIT"],
  "Real Estate Agent":    ["RERA", "Stamp Duty Act", "GST", "Brokerage Agreements", "Benami Property Act"],
  "Residential Builder":  ["RERA", "MahaRERA/State RERA", "Building Plan Approval", "Environmental Clearance", "FEMA"],
  "Commercial Developer": ["RERA", "Building Plan Approval", "Environmental Clearance", "GST", "Labour Law"],
  "Property Management":  ["RERA", "Rent Control Act", "GST", "Maintenance Agreements", "Consumer Protection"],
  "CA Firm":              ["ICAI Regulations", "Engagement Letters", "Professional Indemnity", "DPDP Act 2023", "Income Tax Act"],
  "Law Firm":             ["Bar Council Regulations", "Retainer Agreements", "Professional Indemnity", "DPDP Act 2023"],
  "Consulting Firm":      ["GST", "Employment Contracts", "IP/Copyright", "Professional Indemnity", "MSME"],
  "HR Agency":            ["Labour Law", "PF/ESIC", "Employment Contracts", "Placement Agency Licence", "GST"],
  "Marketing Agency":     ["Advertising Standards", "IP/Copyright", "GST", "Client Agreements", "DPDP Act 2023"],
  "Garment Factory":      ["Factories Act", "Labour Law", "ESI/PF", "Fire NOC", "Export Compliance", "BIS"],
  "Electronics Manufacturer": ["Factories Act", "BIS/ISI", "E-Waste Rules", "Labour Law", "Environmental Clearance"],
  "Auto Parts":           ["Factories Act", "BIS", "Labour Law", "GST", "Environmental Compliance"],
  "Furniture Maker":      ["Factories Act", "Labour Law", "GST", "Forest Conservation Act", "MSME"],
  "Export Company":       ["EXIM Policy", "Customs Act", "FEMA", "Shipping Contracts", "Marine Insurance", "DGFT"],
  "Import Business":      ["Customs Act", "FEMA", "GST", "BIS/Import Licence", "DGFT"],
  "Wholesale Distributor":["GST", "MSME", "Labour Law", "Distribution Agreements", "Consumer Protection"],
  "Trading Company":      ["GST", "FEMA", "Labour Law", "Trade Agreements", "Consumer Protection"],
  "D2C Brand":            ["DPDP Act 2023", "Consumer Protection Act", "GST", "Trademark", "E-Commerce Rules"],
  "E-Commerce":           ["IT Act 2000", "Consumer Protection Act", "GST", "DPDP Act 2023", "Payment & Settlement Act"],
  "Retail Store":         ["Shop & Establishment Act", "GST", "Consumer Protection Act", "FSSAI (if food)", "Trade Licence"],
  "Franchise":            ["Franchise Agreement", "Trademark", "IP/Copyright", "GST", "MSME"],
  "School":               ["Right to Education Act", "POCSO", "Fire NOC", "Labour Law", "Fee Regulation"],
  "Coaching Institute":   ["Consumer Protection Act", "Shop & Establishment Act", "GST", "IP/Copyright", "Labour Law"],
  "EdTech Startup":       ["IT Act 2000", "Consumer Protection Act", "DPDP Act 2023", "IP/Copyright", "GST"],
  "Training Centre":      ["GST", "Shop & Establishment Act", "Labour Law", "Consumer Protection Act"],
  "Hotel":                ["FSSAI", "Fire NOC", "Police Verification", "GST", "Labour Law", "Tourism Licence"],
  "Gym":                  ["Consumer Protection Act", "Labour Law", "Fire NOC", "GST", "MSME"],
  "Spa & Wellness":       ["Shop & Establishment Act", "Labour Law", "GST", "Consumer Protection Act", "MSME"],
  "Travel Agency":        ["Tourism Act", "GST", "Consumer Protection Act", "FEMA", "IATA Licence"],
  "NGO":                  ["FCRA", "Section 8 Company", "CSR Rules", "Income Tax Exemption (80G/12A)", "Audit Requirements"],
  "Section 8 Company":    ["Companies Act", "Income Tax Exemption", "FCRA", "CSR Rules", "Audit Requirements"],
  "Trust":                ["Indian Trust Act", "Income Tax Exemption", "FCRA", "Audit Requirements"],
  "Society":              ["Societies Registration Act", "FCRA", "Income Tax Exemption", "Audit Requirements"],
  "Other Business":       ["GST", "Labour Law", "MSME", "Contract Act", "Consumer Protection Act"],
};

function getContextTags(businessType: string): string[] {
  return CONTEXT_TAGS[businessType] ?? ["GST", "Labour Law", "MSME", "Indian Contract Act", "Consumer Protection Act"];
}

router.post("/questions", (req, res): void => {
  const { businessType } = req.body as { businessType: string };

  if (!businessType) {
    res.status(400).json({ success: false, message: "businessType is required" });
    return;
  }

  const questions = getSeedQuestions(businessType);
  res.json({ success: true, questions });
});

// ─── NEW: Pillar-by-pillar adaptive questioning ────────────────────────────────
router.post("/questions/pillar-next", (req, res): void => {
  const { businessType, pillarIndex, answered } = req.body as {
    businessType: string;
    pillarIndex: number;
    answered: Record<string, Answer>;
  };

  if (!businessType || pillarIndex === undefined) {
    res.status(400).json({ success: false, message: "businessType and pillarIndex are required" });
    return;
  }

  const question = getNextQuestion(pillarIndex, businessType, answered ?? {});
  const pillarMeta = PILLAR_META[pillarIndex];

  res.json({ success: true, question: question ?? null, pillarMeta });
});

export { PILLAR_META };

export default router;
