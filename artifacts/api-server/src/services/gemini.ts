import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger.js";

const GEMINI_API_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
const GEMINI_BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

// Models available via Replit AI Integrations
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
] as const;

function getAiClient(): GoogleGenAI {
  if (GEMINI_BASE_URL) {
    return new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: { apiVersion: "", baseUrl: GEMINI_BASE_URL },
    });
  }
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export type PillarName =
  | "Litigation Health"
  | "Contractual Health"
  | "Compliance Health"
  | "Legal Cost Efficiency";

export interface AssessmentQuestion {
  id: string;
  text: string;
  hint?: string;
  riskIfNo?: string;
  weight: number;
  isReverse: boolean;
  isFollowUp: boolean;
  parentId?: string;
  pillar: string;
  exposureEstimate?: string;
}

export interface AssessmentPillar {
  id: number;
  name: PillarName;
  icon: string;
  definition: string;
  questions: AssessmentQuestion[];
}

export interface FollowUpDecision {
  ask_followup: boolean;
  reasoning?: string;
  question?: AssessmentQuestion;
}

export interface ReportPayload {
  ownerName: string;
  company: string;
  businessType: string;
  category: string;
  city: string;
  employeeCount?: string;
  businessAge?: string;
  total: number;
  risk: string;
  litigation: number;
  contractual: number;
  compliance: number;
  cost: number;
  future: number;
  answersJSON?: string;
}

export interface GeneratedReport {
  summary: string;
  pillarAssessments: Record<string, string>;
  futureRiskOutlook?: string;
  insights: Array<{
    title: string;
    description: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    financialRisk: string;
  }>;
  actions: Array<{
    action: string;
    description: string;
    timeline: "THIS WEEK" | "THIS MONTH" | "90 DAYS";
  }>;
  example: {
    businessName: string;
    whatHappened: string;
    consequences: string;
    vcloWouldHave: string;
    lesson: string;
  };
  vcloPitch: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core caller — tries each model in order, falls through on 429
// ─────────────────────────────────────────────────────────────────────────────

async function callGemini(
  prompt: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  const ai = getAiClient();
  let lastError: Error = new Error("No models available");

  for (const model of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { temperature, maxOutputTokens: maxTokens },
      });
      const raw = response.text ?? "";
      logger.info({ model }, "Gemini call succeeded");
      return raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message ?? "";
      if (msg.includes("429") || msg.includes("quota") || msg.includes("404") || msg.includes("not found")) {
        logger.warn({ model, err: msg }, "Gemini model unavailable, trying next");
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 1 — Seed Question Generator
// Generates 5 questions per pillar (25 total) at session start
// ─────────────────────────────────────────────────────────────────────────────

const PILLAR_DEFINITIONS: Record<PillarName, string> = {
  "Litigation Health": "Whether the business has active disputes, unresolved claims, or exposure to lawsuits including consumer forum complaints, labour tribunal notices, and cheque bounce cases.",
  "Contractual Health": "Whether the business has written agreements that protect it in key relationships — suppliers, customers, employees, landlords, and service providers.",
  "Compliance Health": "Whether the business is current on all government registrations, licences, and statutory filings required for its type and location.",
  "Legal Cost Efficiency": "Whether the business spends on legal reactively (damage control) versus proactively (prevention) — retainers, standard templates, insurance.",
};

interface SeedRaw {
  id: string;
  text: string;
  context?: string;
  risk_if_no: string;
  law_reference?: string;
  risk_area: string;
  weight: number;
  exposure_low?: number;
  exposure_high?: number;
  exposure_estimate?: string;
  triggers_followup_if?: string;
  isReverse?: boolean;
}

interface SeedPillarRaw {
  id: number;
  name: string;
  icon: string;
  questions: SeedRaw[];
}

function buildSeedPrompt(
  businessType: string,
  registration: string,
  employeeCount: string,
  businessAge: string,
  industry: string,
  state: string
): string {
  return `
You are a senior Indian legal risk advisor with 20 years of experience 
advising MSMEs, startups, and SMEs across India.

You are generating the opening questions for a legal health assessment.
Each question must feel like it was written specifically for THIS business — 
not a generic legal checklist.

BUSINESS PROFILE:
Business Type: ${businessType}
Sub-category: ${industry}
Registration: ${registration}
Employees: ${employeeCount}
Years Operating: ${businessAge}
State: ${state}
Has Physical Location: Yes
Sells Online: Unknown
Handles Customer Data: Unknown

YOUR TASK:
Generate exactly 2 opening questions per pillar (8 questions total across 4 pillars).
These are the FIRST questions in each pillar — the follow-up engine will 
handle subsequent questions based on answers.

STRICT RULES FOR QUESTION QUALITY:
1. Every question must mention or imply THIS specific business type
2. Maximum 15 words per question
3. Yes / No / Not Sure answers only
4. No legal jargon — write at a Class 10 reading level
5. Each question must probe a risk that is ACTUALLY COMMON for this business type
6. Questions within a pillar must cover different risks — no overlap
7. Tone: professional and direct — like a CA during a tax audit

BUSINESS-TYPE SPECIFIC GUIDANCE (apply the rules that match this business):

If businessType contains "Restaurant" OR "Food" OR "Cloud Kitchen" OR "Café" OR "Catering":
  Pillar 3 MUST cover: FSSAI licence validity, fire NOC, liquor licence (if applicable), health trade licence
  Pillar 1 MUST cover: food safety consumer complaints, hygiene notices from FSSAI inspectors
  Pillar 2 MUST cover: vendor agreements for raw materials, employee/chef contracts with confidentiality clauses
  Pillar 4 MUST cover: reactive spend on food safety violations, Zomato/Swiggy dispute costs

If businessType contains "Retail" OR "Shop" OR "Trading" OR "Wholesale" OR "Distribution":
  Pillar 3 MUST cover: Shop & Establishment Act registration, weights & measures licence, GST compliance
  Pillar 2 MUST cover: supplier credit agreements, purchase orders with return/defect terms
  Pillar 1 MUST cover: consumer forum complaints, cheque bounce disputes with suppliers
  Pillar 4 MUST cover: penalties paid for non-compliance, cost of unwritten vendor disputes

If businessType contains "Tech" OR "SaaS" OR "Software" OR "IT" OR "App" OR "Digital" OR "Startup":
  Pillar 3 MUST cover: MCA ROC annual filings, DPIT startup recognition, ESOP documentation, DPDP Act 2023 compliance
  Pillar 2 MUST cover: client MSAs with IP ownership clauses, contractor vs employee classification risk
  Pillar 1 MUST cover: IP infringement claims, founder disputes, investor agreement breaches
  Pillar 4 MUST cover: legal spend on ad-hoc contracts, cost of unplanned IP disputes

If businessType contains "Manufacturing" OR "Factory" OR "Production":
  Pillar 3 MUST cover: factory licence under Factories Act, pollution NOC from State PCB, BIS certification, fire safety
  Pillar 1 MUST cover: worker injury claims, Workmen's Compensation Act liability, product liability cases
  Pillar 2 MUST cover: purchase orders with warranty/defect terms, dealer/distributor agreements
  Pillar 4 MUST cover: EPR compliance costs, penalties under pollution board, reactive vs proactive ratio

If businessType contains "Construction" OR "Real Estate" OR "Contractor" OR "Builder" OR "Developer":
  Pillar 3 MUST cover: RERA registration, building plan approvals, labour cess, environment clearance
  Pillar 1 MUST cover: contractor payment disputes, land title disputes, homebuyer RERA complaints
  Pillar 2 MUST cover: subcontractor agreements with performance milestones, client contracts with penalty clauses
  Pillar 4 MUST cover: cost of RERA penalties, spend on dispute resolution vs preventive legal counsel

If businessType contains "Professional" OR "Consulting" OR "CA" OR "Chartered" OR "Agency" OR "Advisory":
  Pillar 2 MUST cover: signed engagement letters, scope of work with deliverables, payment terms in writing
  Pillar 4 MUST cover: professional indemnity exposure, unbilled hours on disputes, time on legal vs billable work
  Pillar 1 MUST cover: client complaints to regulatory councils, fee recovery disputes
  Pillar 3 MUST cover: professional body registration currency, GST compliance for services

If businessType contains "Healthcare" OR "Clinic" OR "Hospital" OR "Diagnostic" OR "Pharmacy" OR "Medical":
  Pillar 3 MUST cover: Clinical Establishment Registration, medical waste disposal licence, NABH if applicable, DPDP Act for patient data
  Pillar 1 MUST cover: patient complaints, medical negligence notices, Consumer Protection Act cases
  Pillar 4 MUST cover: cost of regulatory penalties, medico-legal defence spend
  Pillar 2 MUST cover: doctor/staff employment agreements, medical equipment vendor contracts

If businessType contains "Education" OR "School" OR "College" OR "Coaching" OR "Training" OR "EdTech":
  Pillar 3 MUST cover: state education department recognition/affiliation, GST registration for coaching, DPDP Act for student data, online content copyright compliance, UGC/AICTE compliance
  Pillar 1 MUST cover: student/parent consumer complaints, faculty misconduct complaints
  Pillar 2 MUST cover: student enrollment agreements, faculty employment contracts with IP clauses

If businessType contains "E-commerce" OR "Online" OR "Marketplace" OR "D2C":
  Pillar 3 MUST cover: Legal Metrology Act compliance, Consumer Protection (E-commerce) Rules 2020, DPDP Act 2023
  Pillar 4 MUST cover: payment aggregator compliance costs, return/refund dispute resolution costs
  Pillar 2 MUST cover: logistics partner agreements, seller/vendor onboarding agreements
  Pillar 1 MUST cover: consumer forum online complaints, counterfeit product liability

If businessType contains "Logistics" OR "Transport" OR "Courier" OR "Warehouse" OR "Supply Chain":
  Pillar 3 MUST cover: Motor Vehicles Act permits, GST e-way bills, warehouse licence, DPDP Act for GPS/driver data
  Pillar 1 MUST cover: cargo damage claims, accident liability cases
  Pillar 2 MUST cover: freight agreements with liability caps, customer indemnity clauses
  Pillar 4 MUST cover: accident liability settlement costs, EV transition compliance spend

If businessType contains "Finance" OR "Fintech" OR "Lending" OR "Investment" OR "Insurance" OR "NBFC":
  Pillar 3 MUST cover: RBI NBFC registration, SEBI registration if applicable, KYC/AML compliance, DPDP Act for financial data
  Pillar 4 MUST cover: cyber security RBI guideline compliance costs, regulatory penalty spend
  Pillar 2 MUST cover: loan agreements with proper security documentation, agent contracts
  Pillar 1 MUST cover: borrower defaults, RBI or consumer ombudsman complaints

If businessType contains "Hotel" OR "Hospitality" OR "Resort" OR "Guest House" OR "Travel" OR "Tourism":
  Pillar 3 MUST cover: hotel/trade licence, fire NOC, FSSAI for in-house restaurant, tourism department registration, DPDP Act for guest data
  Pillar 1 MUST cover: guest injury claims, consumer forum complaints on OTA bookings
  Pillar 2 MUST cover: OTA partnership agreements (MakeMyTrip, Booking.com), staff contracts
  Pillar 4 MUST cover: OTA dispute costs, regulatory fine exposure per booking system gap

If businessType contains "Agriculture" OR "Farming" OR "Agri" OR "Food Processing":
  Pillar 3 MUST cover: FSSAI licence for processing, APEDA registration for exports, pesticide licence
  Pillar 2 MUST cover: contract farming agreements, cold chain vendor agreements
  Pillar 4 MUST cover: crop insurance claim costs, MSP dispute resolution costs, agri export compliance spend
  Pillar 1 MUST cover: land dispute claims, input supplier payment disputes

If businessType contains "Media" OR "Entertainment" OR "Film" OR "OTT" OR "Publishing" OR "Content":
  Pillar 2 MUST cover: content licensing agreements, talent/artist contracts, IP assignment agreements
  Pillar 4 MUST cover: copyright infringement defence costs, IT Rules 2021 compliance spend
  Pillar 3 MUST cover: censorship board certification, advertising standards compliance, DPDP Act for user data
  Pillar 1 MUST cover: defamation claims, copyright infringement notices

If businessType contains "NGO" OR "Trust" OR "Foundation" OR "Non-Profit" OR "Section 8":
  Pillar 3 MUST cover: FCRA registration if receiving foreign funds, 80G/12A tax exemption filings, FCRA compliance for international donors
  Pillar 2 MUST cover: grant agreements, volunteer agreements, vendor contracts
  Pillar 4 MUST cover: CSR fund utilisation audit risk, penalty exposure for FCRA non-compliance

For ALL business types — always ensure:
  - At least 1 question per pillar directly names the business type or industry
  - Questions about labour law compliance (PF/ESI/Gratuity) appear in Pillar 3
  - Questions about personal guarantees on business loans and data privacy risks appear in Pillar 4
  - State = "${state}" should inform which state-specific licences to ask about

THE 4 PILLARS:

PILLAR 1 — LITIGATION HEALTH (score out of 25)
Risk: Active or pending legal disputes that drain time and money.

PILLAR 2 — CONTRACTUAL HEALTH (score out of 25)
Risk: Missing or weak written agreements that leave the business unprotected.

PILLAR 3 — COMPLIANCE HEALTH (score out of 25)
Risk: Expired licences, missed filings, or missing registrations that invite penalties.

PILLAR 4 — LEGAL COST EFFICIENCY (score out of 25)
Risk: Business is spending money fixing legal problems that prevention would have avoided.

OUTPUT — return only this JSON, no explanations, no markdown:
{
  "pillars": [
    {
      "id": 1,
      "name": "Litigation Health",
      "icon": "⚖️",
      "questions": [
        {
          "id": "p1_q1",
          "text": "QUESTION TEXT — max 15 words, plain language, Yes/No/Not Sure",
          "context": "why this question matters for THIS specific business type",
          "risk_if_no": "exact financial or legal consequence if answer is No",
          "law_reference": "specific Indian law or authority e.g. Consumer Protection Act 2019",
          "risk_area": "litigation",
          "weight": 9,
          "exposure_low": 50000,
          "exposure_high": 500000,
          "triggers_followup_if": "no"
        },
        {
          "id": "p1_q2",
          "text": "SECOND QUESTION — different risk area within same pillar",
          "context": "...",
          "risk_if_no": "...",
          "law_reference": "...",
          "risk_area": "litigation",
          "weight": 7,
          "exposure_low": 25000,
          "exposure_high": 200000,
          "triggers_followup_if": "no"
        }
      ]
    },
    { "id": 2, "name": "Contractual Health", "icon": "📄", "questions": [...] },
    { "id": 3, "name": "Compliance Health", "icon": "✅", "questions": [...] },
    { "id": 4, "name": "Legal Cost Efficiency", "icon": "💼", "questions": [...] }
  ]
}`;
}

// ─── Static fallback: 2 seed questions × 4 pillars ────────────────────────
// These are only the SEED questions. Adaptive questions (2–4 per pillar)
// are generated by AI in real time based on the business profile and answers.
export const STATIC_SEED_PILLARS: AssessmentPillar[] = [
  {
    id: 1, name: "Litigation Health", icon: "⚖️",
    definition: PILLAR_DEFINITIONS["Litigation Health"],
    questions: [
      { id: "p1_q1", text: "Has your business received any legal notice from a court or government authority?", hint: "Includes consumer forum, labour tribunal, or tax notices", riskIfNo: "Unresolved notices escalate into court cases with mandatory attendance and heavy costs.", weight: 10, isReverse: true, isFollowUp: false, pillar: "Litigation Health", exposureEstimate: "₹50,000 – ₹5,00,000" },
      { id: "p1_q2", text: "Do you have any unresolved dispute with a customer or vendor right now?", hint: "Even informal disagreements over payment or delivery count", riskIfNo: "Unresolved disputes escalate — the longer you wait, the more expensive resolution becomes.", weight: 9, isReverse: true, isFollowUp: false, pillar: "Litigation Health", exposureEstimate: "₹25,000 – ₹3,00,000" },
    ],
  },
  {
    id: 2, name: "Contractual Health", icon: "📄",
    definition: PILLAR_DEFINITIONS["Contractual Health"],
    questions: [
      { id: "p2_q1", text: "Do you have a written, signed agreement with every vendor you regularly pay?", hint: "Includes suppliers, service providers, and freelancers", riskIfNo: "Verbal agreements are unenforceable in Indian courts — you cannot claim damages.", weight: 9, isReverse: false, isFollowUp: false, pillar: "Contractual Health", exposureEstimate: "₹50,000 – ₹10,00,000" },
      { id: "p2_q2", text: "Does every employee or contractor sign an agreement before starting work?", hint: "Even a simple offer letter with terms counts", riskIfNo: "Unsigned employment creates disputes over pay, notice period, and IP ownership.", weight: 8, isReverse: false, isFollowUp: false, pillar: "Contractual Health", exposureEstimate: "₹1,00,000 – ₹5,00,000" },
    ],
  },
  {
    id: 3, name: "Compliance Health", icon: "✅",
    definition: PILLAR_DEFINITIONS["Compliance Health"],
    questions: [
      { id: "p3_q1", text: "Are all your business registrations and industry licences current and valid?", hint: "FSSAI for food, Drug Licence for pharmacy, RERA for real estate", riskIfNo: "Operating with lapsed registrations attracts penalties and bars you from making legal claims.", weight: 10, isReverse: false, isFollowUp: false, pillar: "Compliance Health", exposureEstimate: "₹50,000 – ₹5,00,000" },
      { id: "p3_q2", text: "Are your GST returns filed on time every quarter?", hint: "Late filing attracts 18% interest per annum plus late fees", riskIfNo: "GST arrears compound quickly and can trigger bank account attachment orders.", weight: 9, isReverse: false, isFollowUp: false, pillar: "Compliance Health", exposureEstimate: "₹10,000 – ₹2,00,000" },
    ],
  },
  {
    id: 4, name: "Legal Cost Efficiency", icon: "💼",
    definition: PILLAR_DEFINITIONS["Legal Cost Efficiency"],
    questions: [
      { id: "p4_q1", text: "Did you pay any fine or penalty to a government body in the last year?", hint: "Tax, labour, pollution, or licence-related penalties", riskIfNo: "Past penalties are a leading indicator of structural gaps that will repeat.", weight: 9, isReverse: true, isFollowUp: false, pillar: "Legal Cost Efficiency", exposureEstimate: "₹25,000 – ₹5,00,000" },
      { id: "p4_q2", text: "In the last year, did you spend money resolving a dispute a written agreement could have prevented?", hint: "Legal fees, settlement amounts, or lost business", riskIfNo: "Pattern of reactive spending means contracts are consistently absent or weak.", weight: 9, isReverse: true, isFollowUp: false, pillar: "Legal Cost Efficiency", exposureEstimate: "₹50,000 – ₹10,00,000" },
    ],
  },
];

// ─── Static adaptive fallback questions (4 per pillar, indexed 0-3) ─────────
// Used when AI is unavailable (quota/timeout). Mandatory for adaptiveCount < 2.
export const STATIC_ADAPTIVE_QUESTIONS: Record<number, AssessmentQuestion[]> = {
  1: [
    { id: "p1_aq1", text: "Do you have a lawyer you can call immediately if a legal dispute arises?", hint: "Even a retained legal adviser on call counts", riskIfNo: "Without legal counsel access, a sudden dispute can paralyze your business for months.", weight: 7, isReverse: false, isFollowUp: true, pillar: "Litigation Health" },
    { id: "p1_aq2", text: "Have any of your customers or vendors ever threatened you with legal action, even informally?", hint: "WhatsApp threats or verbal warnings count", riskIfNo: "Informal threats frequently escalate — ignoring them is one of the costliest mistakes.", weight: 8, isReverse: true, isFollowUp: true, pillar: "Litigation Health" },
    { id: "p1_aq3", text: "Do you keep written records of all customer complaints and how they were resolved?", hint: "A simple register, email thread, or CRM entry counts", riskIfNo: "No records means no defence — consumer courts favour documented businesses.", weight: 6, isReverse: false, isFollowUp: true, pillar: "Litigation Health" },
    { id: "p1_aq4", text: "Has any current or former employee ever made a complaint against your business?", hint: "Includes grievances filed internally or with a labour office", riskIfNo: "Labour disputes are India's fastest-growing litigation category for small businesses.", weight: 7, isReverse: true, isFollowUp: true, pillar: "Litigation Health" },
  ],
  2: [
    { id: "p2_aq1", text: "Do your written agreements include a dispute resolution clause (arbitration or jurisdiction)?", hint: "Specifies what happens if the parties disagree", riskIfNo: "Without a dispute clause, you default to costly and slow civil court proceedings.", weight: 7, isReverse: false, isFollowUp: true, pillar: "Contractual Health" },
    { id: "p2_aq2", text: "Do you have a signed lease or rental agreement for your business premises?", hint: "Month-to-month verbal arrangements are high risk", riskIfNo: "An unsigned tenancy can result in eviction without notice and loss of all improvements.", weight: 8, isReverse: false, isFollowUp: true, pillar: "Contractual Health" },
    { id: "p2_aq3", text: "Have you ever lost money because someone didn't honour a verbal commitment?", hint: "Payment defaults, delivery failures, or service cancellations", riskIfNo: "Repeated verbal agreement losses signal systematic contract absence.", weight: 7, isReverse: true, isFollowUp: true, pillar: "Contractual Health" },
    { id: "p2_aq4", text: "Do your customer invoices or order confirmations include your payment terms and late-payment penalties?", hint: "Even a line on the invoice counts", riskIfNo: "Without stated terms, debt recovery through legal channels becomes extremely difficult.", weight: 6, isReverse: false, isFollowUp: true, pillar: "Contractual Health" },
  ],
  3: [
    { id: "p3_aq1", text: "Do you file your annual income tax return on time every year?", hint: "Due date is typically 31st July for non-audit businesses", riskIfNo: "Late ITR attracts penalties, disallows loss carry-forward, and flags you for scrutiny.", weight: 8, isReverse: false, isFollowUp: true, pillar: "Compliance Health" },
    { id: "p3_aq2", text: "Are your employee PF and ESI contributions deposited on time every month?", hint: "Due by the 15th and 21st of the following month respectively", riskIfNo: "Delayed PF/ESI deposits attract interest, damages, and personal liability for directors.", weight: 8, isReverse: false, isFollowUp: true, pillar: "Compliance Health" },
    { id: "p3_aq3", text: "Do you have a valid Shop and Establishment Act registration for your business location?", hint: "Required for almost every commercial establishment in India", riskIfNo: "Without S&E registration, you cannot legally employ workers or open a business bank account.", weight: 7, isReverse: false, isFollowUp: true, pillar: "Compliance Health" },
    { id: "p3_aq4", text: "Have you received any penalty or demand notice from a government body in the last 2 years?", hint: "Tax, labour, fire safety, or pollution board notices", riskIfNo: "Past penalty notices are a strong predictor of repeat compliance failures.", weight: 8, isReverse: true, isFollowUp: true, pillar: "Compliance Health" },
  ],
  4: [
    { id: "p4_aq1", text: "Do you have standard contract templates your team uses without drafting fresh every time?", hint: "Templates prevent costly omissions and reduce lawyer fees", riskIfNo: "Every ad-hoc contract costs more and has higher error rates than a reviewed template.", weight: 6, isReverse: false, isFollowUp: true, pillar: "Legal Cost Efficiency" },
    { id: "p4_aq2", text: "Have you ever consulted a lawyer before signing a major contract or taking a significant business decision?", hint: "Proactive legal advice costs 5–10× less than reactive legal rescue", riskIfNo: "Reactive legal spending is typically 5–10× higher than proactive advice costs.", weight: 7, isReverse: false, isFollowUp: true, pillar: "Legal Cost Efficiency" },
    { id: "p4_aq3", text: "Do you have any legal insurance or professional indemnity cover for your business?", hint: "Covers legal defence costs and certain liability claims", riskIfNo: "A single uninsured legal dispute can consume an entire year's profit.", weight: 6, isReverse: false, isFollowUp: true, pillar: "Legal Cost Efficiency" },
    { id: "p4_aq4", text: "Do you track how much your business spends on legal fees and penalties each year?", hint: "Includes lawyer bills, fines, settlement costs", riskIfNo: "Businesses that don't measure legal spend consistently overspend by 30–50%.", weight: 5, isReverse: false, isFollowUp: true, pillar: "Legal Cost Efficiency" },
  ],
};

// ─── In-memory cache keyed by "businessType|state" ───────────────────────────
const seedCache = new Map<string, { pillars: AssessmentPillar[]; ts: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function generateSeedQuestionsForAssessment(
  businessType: string,
  registration: string,
  employeeCount: string,
  businessAge: string,
  industry: string,
  state: string
): Promise<AssessmentPillar[]> {
  const cacheKey = `${businessType}|${state}`;
  const cached = seedCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    logger.info({ cacheKey }, "Seed questions: cache hit");
    return cached.pillars;
  }

  const prompt = buildSeedPrompt(businessType, registration, employeeCount, businessAge, industry, state);

  async function tryParse(): Promise<AssessmentPillar[]> {
    const raw = await callGemini(prompt, 12000, 0.25);
    const parsed = JSON.parse(raw) as { pillars: SeedPillarRaw[] };

    if (!parsed.pillars || parsed.pillars.length !== 4) {
      throw new Error(`Expected 4 pillars, got ${parsed.pillars?.length ?? 0}`);
    }

    return parsed.pillars.map((p, pIdx) => {
      const pillarName = p.name as PillarName;
      return {
        id: p.id ?? pIdx + 1,
        name: pillarName,
        icon: p.icon ?? STATIC_SEED_PILLARS[pIdx]!.icon,
        definition: PILLAR_DEFINITIONS[pillarName] ?? "",
        questions: (p.questions ?? []).slice(0, 5).map((q) => {
          const expEstimate = q.exposure_estimate
            ?? (q.exposure_low != null && q.exposure_high != null
              ? `₹${q.exposure_low.toLocaleString("en-IN")} – ₹${q.exposure_high.toLocaleString("en-IN")}`
              : undefined);
          return {
            id: q.id ?? `p${p.id}_q${Math.random()}`,
            text: q.text,
            hint: q.context ?? q.risk_if_no,
            riskIfNo: q.risk_if_no,
            weight: q.weight ?? 7,
            isReverse: q.isReverse ?? false,
            isFollowUp: false,
            pillar: pillarName,
            exposureEstimate: expEstimate,
          };
        }),
      };
    });
  }

  try {
    const pillars = await tryParse();
    seedCache.set(cacheKey, { pillars, ts: Date.now() });
    logger.info({ cacheKey }, "Seed questions: Gemini generated and cached");
    return pillars;
  } catch (err) {
    logger.error({ err }, "Seed generation failed, retrying once");
    try {
      const pillars = await tryParse();
      seedCache.set(cacheKey, { pillars, ts: Date.now() });
      return pillars;
    } catch (err2) {
      logger.error({ err: err2 }, "Seed generation retry failed, using static fallback");
      return STATIC_SEED_PILLARS;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 2 — Follow-up Engine
// Fires after every answer; decides if one targeted follow-up is warranted
// ─────────────────────────────────────────────────────────────────────────────

interface FollowUpRaw {
  ask_followup: boolean;
  reasoning?: string;
  measure_type?: string;
  question?: {
    id: string;
    text: string;
    risk_area?: string;
    weight?: number;
    isReverse?: boolean;
    is_followup?: boolean;
    parent_id?: string;
  };
}

function buildFollowUpPrompt(
  businessType: string,
  registration: string,
  employeeCount: string,
  industry: string,
  pillarName: string,
  pillarNumber: number,
  pillarDefinition: string,
  questionText: string,
  parentQuestionId: string,
  answer: string,
  followUpCount: number,
  pillarHistory: string,
  riskArea: string
): string {
  return `You are LegalIQ's follow-up engine — a professional legal risk assessor.

A business owner has just answered a question in their legal health assessment.
Your job is to determine whether one targeted follow-up question is warranted,
or whether we have enough information to score this area and move on.

BUSINESS PROFILE:
- Business Type: ${businessType}
- Registration: ${registration}
- Employees: ${employeeCount}
- Industry: ${industry}

CURRENT PILLAR: ${pillarName} (Pillar ${pillarNumber} of 4)
PILLAR DEFINITION: ${pillarDefinition}

QUESTION ASKED:
"${questionText}"

ANSWER GIVEN: ${answer}
FOLLOW-UPS ALREADY ASKED ON THIS QUESTION: ${followUpCount}

FULL PILLAR CONVERSATION SO FAR:
${pillarHistory || "(No prior answers in this pillar yet)"}

---

DECISION LOGIC — follow this exactly:

STEP 1 — Should we follow up at all?
Ask a follow-up ONLY if ALL of these are true:
  a) Answer is "No" or "Not Sure"
  b) followUpCount is less than 2
  c) A follow-up would materially change the risk score or exposure estimate
  d) We do not already have this information from earlier in the conversation

Do NOT follow up if:
  - Answer is "Yes" (risk is covered — move on)
  - We already know the depth of this risk from a prior answer
  - The follow-up would be redundant or obvious
  - followUpCount is already 2

STEP 2 — What should the follow-up measure?
The follow-up must do exactly ONE of these:
  A) Measure SCALE — how many vendors, employees, transactions are exposed?
  B) Measure DURATION — how long has this gap existed?
  C) Measure SEVERITY — has this gap already caused a problem?
  D) Measure AWARENESS — do they know the specific rule they're missing?

Choose the one that most changes the ₹ exposure estimate.

STEP 3 — Write the follow-up question
Rules:
  - Maximum 12 words
  - Professional tone — direct, not warm
  - Must be answerable with a short specific answer (a number, a timeframe, yes/no)
  - No jargon
  - Must logically follow from their answer — not feel like a random new question

GOOD FOLLOW-UP EXAMPLES BY PILLAR:

Litigation Health:
  Q: "Do you have any unresolved disputes with a customer or vendor?"
  A: No (meaning yes, they have disputes)
  Good follow-up: "Is this dispute already in a court or consumer forum?"
  Why good: Measures severity — court filing = much higher exposure

Contractual Health:
  Q: "Do you have a written agreement with every vendor you regularly pay?"
  A: No
  Good follow-up: "How many vendors do you pay without a written agreement?"
  Why good: Measures scale — 2 vendors vs 20 vendors = very different risk

Compliance Health:
  Q: "Are your GST returns filed on time every quarter?"
  A: Not Sure
  Good follow-up: "When did you last check your GST filing status?"
  Why good: Measures awareness/duration — may reveal months of unfiled returns

Legal Cost Efficiency:
  Q: "Did you spend money last year resolving a dispute a contract could have prevented?"
  A: Yes
  Good follow-up: "Roughly how much did that dispute cost you in total?"
  Why good: Measures severity — anchors their pain to a real ₹ number for the report

Future Risk Exposure:
  Q: "Do you collect customer names, emails, or phone numbers in any form?"
  A: Yes
  Good follow-up: "Do you have a written privacy policy your customers can read?"
  Why good: Measures gap — DPDP Act 2023 requires this; no policy = penalty risk

---

OUTPUT FORMAT — return only this JSON, nothing else:
{
  "ask_followup": true,
  "reasoning": "one sentence explaining why this follow-up is warranted",
  "measure_type": "SCALE / DURATION / SEVERITY / AWARENESS",
  "question": {
    "id": "p${pillarNumber}_fq${followUpCount + 1}",
    "text": "follow-up question here",
    "risk_area": "${riskArea}",
    "weight": 5,
    "isReverse": false,
    "is_followup": true,
    "parent_id": "${parentQuestionId}"
  }
}

OR if no follow-up is needed:
{
  "ask_followup": false,
  "reasoning": "one sentence explaining why we have enough information"
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 2 — Adaptive Question Engine
// Fires after the 2 seed questions are done for a pillar.
// Decides whether to ask a follow-up (concerning answer) or a probing question
// (clean answer, but more to explore). Always asks at least 2 adaptive per pillar.
// Hard cap: 4 adaptive questions per pillar.
// ─────────────────────────────────────────────────────────────────────────────

export interface AdaptiveQuestionResult {
  ask: boolean;
  question?: AssessmentQuestion;
}

interface AdaptiveRaw {
  next: "followup" | "next_question" | "next_pillar";
  measure_type?: string;
  reason?: string;
  question?: {
    id?: string;
    text: string;
    risk_if_no?: string;
    law_reference?: string | null;
    risk_area?: string;
    weight?: number;
    exposure_low?: number;
    exposure_high?: number;
    is_followup?: boolean;
    parent_id?: string;
    isReverse?: boolean;
    hint?: string;
  };
}

function buildAdaptivePrompt(
  businessType: string,
  registration: string,
  employeeCount: string,
  industry: string,
  pillarName: string,
  pillarNumber: number,
  _pillarDefinition: string,
  pillarAnswers: Array<{ question: string; answer: string; isReverseScored: boolean }>,
  adaptiveCount: number
): string {
  const questionsAskedCount = pillarAnswers.length;
  const lastAnswer = pillarAnswers[pillarAnswers.length - 1];

  const pillarConversation = pillarAnswers
    .map((a, i) => {
      const effectivelyBad = a.isReverseScored ? a.answer === "YES" : a.answer === "NO" || a.answer === "UNSURE";
      return `Q${i + 1}: "${a.question}" → ${a.answer}${effectivelyBad ? " ⚠️ (risk confirmed)" : " ✅ (covered)"}`;
    })
    .join("\n");

  const parentQuestionId = lastAnswer
    ? `p${pillarNumber}_q${questionsAskedCount}`
    : `p${pillarNumber}_q1`;

  return `
You are LegalIQ's follow-up question engine.

CONTEXT:
Each pillar must produce exactly 5 questions total:
- Questions 1 and 2 are the seed questions (already asked)
- Questions 3, 4, and 5 are generated by YOU based on answers so far
- If earlier answers show no risk in an area, skip that follow-up and move to the next risk area
- Never ask more than 5 questions total per pillar

BUSINESS PROFILE:
Business Type: ${businessType}
Sub-category: ${industry}
Registration: ${registration}
Employees: ${employeeCount}
State: Unknown

CURRENT PILLAR: ${pillarName} (Pillar ${pillarNumber} of 4)
QUESTIONS ASKED SO FAR IN THIS PILLAR: ${questionsAskedCount} of 5
FOLLOW-UPS GENERATED SO FAR: ${adaptiveCount}

FULL PILLAR CONVERSATION:
${pillarConversation || "(No prior answers in this pillar yet)"}

LAST QUESTION ASKED:
"${lastAnswer?.question ?? ""}"

ANSWER GIVEN: ${lastAnswer?.answer ?? ""}

---

DECISION FRAMEWORK — follow this exactly:

RULE 1 — Have we reached 5 questions in this pillar?
If questionsAskedCount >= 5 → always return { "next": "next_pillar" }

RULE 2 — Does the answer reveal a risk that needs depth?
Generate a follow-up ONLY IF:
  a) Answer is "No" or "Not Sure"
  b) AND this specific risk is worth quantifying further
  c) AND we don't already know this information from an earlier answer
  d) AND a follow-up would change the ₹ exposure estimate significantly

RULE 3 — What type of follow-up to ask?
Choose exactly one:
  SCALE: How many / How much is affected? (reveals exposure size)
  DURATION: How long has this gap existed? (reveals accumulated risk)
  SEVERITY: Has this gap already caused a problem? (reveals if theoretical or real)
  DEPTH: Do you have a partial version of this? (narrows whether gap is complete or partial)

RULE 4 — What if the answer is "Yes"?
Most "Yes" answers → move to next question in the pillar (no follow-up needed).
Exception: if a "Yes" answer opens a NEW risk area → ask one targeted question on that new risk.

Example: 
Q: "Do you collect customer phone numbers or emails for your business?"
A: Yes
→ This opens DPDP Act risk → follow-up: "Do customers have a way to see or delete the data you hold on them?"

RULE 5 — No generic follow-ups
Every follow-up must be specific to:
  - The exact gap revealed by the answer
  - The specific business type
  - A specific ₹ consequence

BAD: "Do you have any documentation for this?"
GOOD: "How many vendors do you work with who have no written agreement?"

BAD: "Are you aware of the relevant regulations?"
GOOD: "Has your FSSAI licence been renewed in the last 12 months?"

PILLAR-SPECIFIC FOLLOW-UP GUIDANCE:

PILLAR 1 — LITIGATION HEALTH:
If they have an active dispute → ask: Is this in court, consumer forum, or still informal?
If they have an ex-employee dispute → ask: Did they receive a written legal notice?
If no disputes → ask about the most likely dispute type for their business type

PILLAR 2 — CONTRACTUAL HEALTH:
If no vendor agreements → ask: How many vendors do you pay more than ₹50,000/year without a contract?
If no client agreements → ask: What is the value of your largest active client relationship?
If partial agreements → ask: Do your agreements specify what happens if either side defaults?

PILLAR 3 — COMPLIANCE HEALTH:
If GST not filed → ask: How many months of GST returns are currently pending?
If licence expired → ask: How long has it been since the licence was last renewed?
If not sure about filings → ask: When did a CA or accountant last review your compliance status?

PILLAR 4 — LEGAL COST EFFICIENCY:
If they spent money on disputes → ask: Did you have a written agreement with the other party before the dispute?
If they draft contracts fresh each time → ask: How many new agreements does your business sign in a typical year?
If they carry personal guarantees on business loans → ask: What is the total amount you have personally guaranteed?
If they don't track legal spend → ask: Do you have a way to see what your business spent on legal fees and penalties last year?

---

OUTPUT — return only this JSON:

If a follow-up is warranted:
{
  "next": "followup",
  "measure_type": "SCALE / DURATION / SEVERITY / DEPTH",
  "question": {
    "id": "p${pillarNumber}_q${questionsAskedCount + 1}",
    "text": "follow-up question — max 15 words, plain language",
    "risk_if_no": "specific consequence",
    "law_reference": "specific Indian law if applicable, else null",
    "risk_area": "same pillar risk area",
    "weight": 6,
    "exposure_low": 25000,
    "exposure_high": 300000,
    "is_followup": true,
    "parent_id": "${parentQuestionId}"
  }
}

If no follow-up needed — move to next question in pillar:
{
  "next": "next_question",
  "reason": "answer shows no risk in this area"
}

If pillar is complete (5 questions asked):
{
  "next": "next_pillar",
  "reason": "pillar complete"
}`;
}

// Adaptive question AI calls are capped at 5 seconds; on timeout we return null (skip).
// In practice the pre-generated cache (adaptiveCache.ts) serves most questions instantly.
const ADAPTIVE_TIMEOUT_MS = 5000;

export async function generateNextAdaptiveQuestion(
  businessType: string,
  registration: string,
  employeeCount: string,
  industry: string,
  pillarName: string,
  pillarNumber: number,
  pillarDefinition: string,
  pillarAnswers: Array<{ question: string; answer: string; isReverseScored: boolean }>,
  adaptiveCount: number
): Promise<AssessmentQuestion | null> {
  // Hard cap enforced here (engine also checks, but belt + suspenders)
  if (adaptiveCount >= 4) return null;

  const prompt = buildAdaptivePrompt(
    businessType, registration, employeeCount, industry,
    pillarName, pillarNumber, pillarDefinition,
    pillarAnswers, adaptiveCount
  );

  async function tryParse(): Promise<AssessmentQuestion | null> {
    const raw = await callGemini(prompt, 1200, 0.5);
    const parsed = JSON.parse(raw) as AdaptiveRaw;

    if (parsed.next !== "followup" || !parsed.question?.text?.trim()) {
      logger.info({ pillarName, adaptiveCount, next: parsed.next, reason: parsed.reason }, "Adaptive engine: no follow-up needed");
      return null;
    }

    const q = parsed.question;
    const expEstimate = q.exposure_low != null && q.exposure_high != null
      ? `₹${q.exposure_low.toLocaleString("en-IN")} – ₹${q.exposure_high.toLocaleString("en-IN")}`
      : undefined;

    return {
      id: q.id ?? `p${pillarNumber}_aq${adaptiveCount + 1}`,
      text: q.text.trim(),
      hint: q.hint ?? q.risk_if_no,
      riskIfNo: q.risk_if_no,
      weight: q.weight ?? 6,
      isReverse: q.isReverse ?? false,
      isFollowUp: true,
      parentId: q.parent_id,
      pillar: pillarName,
      exposureEstimate: expEstimate,
    };
  }

  const timeoutPromise = new Promise<AssessmentQuestion | null>((resolve) =>
    setTimeout(() => {
      logger.warn({ pillarName, adaptiveCount }, "Adaptive question timed out — skipping");
      resolve(null);
    }, ADAPTIVE_TIMEOUT_MS)
  );

  try {
    return await Promise.race([tryParse(), timeoutPromise]);
  } catch (err) {
    logger.warn({ err }, "Adaptive question engine failed, returning null");
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 2b — Adaptive Batch Pre-Generator
// Generates 2 business-specific adaptive questions per pillar (10 total) in a
// single Gemini call at session start so the quiz never waits for AI mid-quiz.
// ─────────────────────────────────────────────────────────────────────────────

function buildAdaptiveBatchPrompt(
  businessType: string,
  registration: string,
  employeeCount: string,
  industry: string,
  state: string
): string {
  return `You are LegalIQ — India's AI legal diagnostic platform.

Generate exactly 2 targeted adaptive follow-up questions for EACH of the 5 legal health pillars for the business described below.

BUSINESS PROFILE:
- Business Type: ${businessType}
- Sub-category / Registration: ${registration}
- Industry: ${industry}
- Employees: ${employeeCount}
- State / City: ${state}

CRITICAL RULES:
1. Every question MUST be specific to a "${businessType}" business — mention actual operations, roles, documents, or risks unique to this type of business.
2. NEVER write generic questions like "Do you have legal documentation?" or "Are you aware of regulations?".
3. Each question must be answerable with YES / NO / NOT SURE (max 20 words).
4. Reference real Indian laws where applicable (GST Act, FSSAI, Shops & Establishments Act, IT Act, etc.).
5. The hint must explain why it matters for this specific business type.
6. isReverse: true means answering YES is the RISKY answer (e.g., "Have you ever been sued?").

PILLAR DEFINITIONS:
1. Litigation Health — Active disputes, unresolved claims, or lawsuit exposure
2. Contractual Health — Written agreements protecting the business in all key relationships
3. Compliance Health — Government registrations, licences, and filings being current
4. Legal Cost Efficiency — Spending on legal proactively vs. reactively (also covers future risk, DPDP Act, trademark gaps, personal guarantees)

OUTPUT — Return ONLY this exact JSON (no markdown, no extra text):
{
  "pillars": {
    "Litigation Health": [
      {
        "id": "p1_aq1",
        "text": "specific question for ${businessType} — max 20 words",
        "hint": "why this matters for ${businessType} businesses specifically",
        "risk_if_no": "specific consequence with Indian law reference",
        "weight": 7,
        "isReverse": false,
        "exposure_low": 50000,
        "exposure_high": 500000
      },
      {
        "id": "p1_aq2",
        "text": "second specific question for ${businessType}",
        "hint": "context for ${businessType} operators",
        "risk_if_no": "consequence",
        "weight": 7,
        "isReverse": false,
        "exposure_low": 25000,
        "exposure_high": 300000
      }
    ],
    "Contractual Health": [
      { "id": "p2_aq1", "text": "...", "hint": "...", "risk_if_no": "...", "weight": 7, "isReverse": false, "exposure_low": 50000, "exposure_high": 500000 },
      { "id": "p2_aq2", "text": "...", "hint": "...", "risk_if_no": "...", "weight": 7, "isReverse": false, "exposure_low": 25000, "exposure_high": 200000 }
    ],
    "Compliance Health": [
      { "id": "p3_aq1", "text": "...", "hint": "...", "risk_if_no": "...", "weight": 7, "isReverse": false, "exposure_low": 10000, "exposure_high": 200000 },
      { "id": "p3_aq2", "text": "...", "hint": "...", "risk_if_no": "...", "weight": 7, "isReverse": false, "exposure_low": 5000, "exposure_high": 100000 }
    ],
    "Legal Cost Efficiency": [
      { "id": "p4_aq1", "text": "...", "hint": "...", "risk_if_no": "...", "weight": 6, "isReverse": false, "exposure_low": 25000, "exposure_high": 300000 },
      { "id": "p4_aq2", "text": "...", "hint": "...", "risk_if_no": "...", "weight": 6, "isReverse": false, "exposure_low": 10000, "exposure_high": 150000 }
    ]
  }
}`;
}

interface AdaptiveBatchRaw {
  pillars: Record<string, Array<{
    id?: string;
    text: string;
    hint?: string;
    risk_if_no?: string;
    weight?: number;
    isReverse?: boolean;
    exposure_low?: number;
    exposure_high?: number;
  }>>;
}

const PILLAR_NAMES = [
  "Litigation Health",
  "Contractual Health",
  "Compliance Health",
  "Legal Cost Efficiency",
] as const;

export async function generateAdaptiveBatch(
  businessType: string,
  registration: string,
  employeeCount: string,
  industry: string,
  state: string
): Promise<Record<string, AssessmentQuestion[]>> {
  const prompt = buildAdaptiveBatchPrompt(businessType, registration, employeeCount, industry, state);

  try {
    const raw = await callGemini(prompt, 2500, 0.3);
    const parsed = JSON.parse(raw) as AdaptiveBatchRaw;

    if (!parsed.pillars || typeof parsed.pillars !== "object") {
      throw new Error("Invalid batch response structure");
    }

    const result: Record<string, AssessmentQuestion[]> = {};

    for (const pillarName of PILLAR_NAMES) {
      const qs = parsed.pillars[pillarName];
      if (!Array.isArray(qs) || qs.length < 2) {
        logger.warn({ pillarName }, "Adaptive batch: missing questions for pillar, will use static fallback");
        continue;
      }

      result[pillarName] = qs.slice(0, 2).map((q, idx) => {
        const pillarNum = PILLAR_NAMES.indexOf(pillarName) + 1;
        const exp = q.exposure_low != null && q.exposure_high != null
          ? `Rs.${q.exposure_low.toLocaleString("en-IN")} - Rs.${q.exposure_high.toLocaleString("en-IN")}`
          : undefined;

        return {
          id: q.id ?? `p${pillarNum}_aq${idx + 1}`,
          text: q.text?.trim() ?? "",
          hint: q.hint ?? q.risk_if_no ?? "",
          riskIfNo: q.risk_if_no ?? "",
          weight: q.weight ?? 7,
          isReverse: q.isReverse ?? false,
          isFollowUp: true,
          pillar: pillarName,
          exposureEstimate: exp,
        };
      }).filter((q) => q.text.length > 0);
    }

    logger.info({ businessType, pillarsGenerated: Object.keys(result).length }, "Adaptive batch: generated successfully");
    return result;
  } catch (err) {
    logger.warn({ err, businessType }, "Adaptive batch generation failed — quiz will use static fallbacks");
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 3 — Final Report Generator
// ─────────────────────────────────────────────────────────────────────────────

function buildReportPrompt(payload: ReportPayload): string {
  const scoreLabel =
    payload.total >= 80 ? "Healthy" :
    payload.total >= 60 ? "Needs Attention" :
    payload.total >= 40 ? "At Risk" : "Critical";

  const grade =
    payload.total >= 80 ? "A" :
    payload.total >= 60 ? "B" :
    payload.total >= 40 ? "C" : "D";

  return `You are LegalIQ — India's professional legal diagnostic platform for businesses.
Generate a personalised Legal Health Report based on the completed assessment below.

BUSINESS PROFILE:
- Owner Name: ${payload.ownerName}
- Business Name: ${payload.company}
- Business Type: ${payload.businessType}
- Registration: ${payload.category}
- Employees: ${payload.employeeCount ?? "unknown"}
- Years Operating: ${payload.businessAge ?? "unknown"}
- State: ${payload.city}

ASSESSMENT ANSWERS:
${payload.answersJSON ?? "Not provided"}

CALCULATED SCORE: ${payload.total} / 100
SCORE BREAKDOWN BY PILLAR (4 pillars × 25 pts each):
- Litigation Health: ${payload.litigation} / 25
- Contractual Health: ${payload.contractual} / 25
- Compliance Health: ${payload.compliance} / 25
- Legal Cost Efficiency: ${payload.cost} / 25

---
REPORT WRITING RULES:
Tone: Professional, direct, and factual — like a senior CA or legal advisor.
Not warm, not alarming — measured and credible.

Forbidden phrases: "as per our assessment", "pursuant to", "statutory obligations", "non-compliant", "herein", "it is advisable that you", "regulatory framework"
Preferred phrases: "your business is exposed to", "this gap can result in", "the financial impact of this is", "a written agreement would have prevented", "the penalty for this is up to"

Score: ${payload.total} = Grade ${grade} — ${scoreLabel}

---
SECTIONS TO GENERATE:

1. EXECUTIVE SUMMARY — 3 sentences max. State the score, what it means, and the single most urgent issue.

2. PILLAR BREAKDOWN — For each of 4 pillars: score, status, one finding sentence, one implication. Also include a "Future Risk Outlook" sub-section (2–3 sentences) covering emerging risks: DPDP Act compliance, trademark gaps, personal guarantees, or sector-specific threats specific to this business.

3. TOP 3 RISK FLAGS — For each: title (plain language, max 6 words), gap, consequence with specific law/authority, estimated ₹ exposure, urgency (Immediate / 30 Days / 90 Days).

4. ACTION PLAN — 3 prioritised actions only. Specific and doable. Include ₹ cost estimate. Timeline: This Week / This Month / This Quarter.

5. CONSULTATION NOTE — 1–2 sentences, specific to their risk profile.

6. BUSINESS EXAMPLE — A real-sounding Indian company story (plausible, not sensitive):
   businessName, whatHappened (2-3 sentences), consequences (₹ amount + time), vcloWouldHave (how Rest The Case VCLO prevented it), lesson (one punchy takeaway).

7. VCLO PITCH — One compelling paragraph (4–5 sentences) addressed to ${payload.company}. Reference: their two lowest-scoring pillars, score (${payload.total}/100), city (${payload.city}), and monthly cost of VCLO vs. reactive legal fees.

---
OUTPUT FORMAT — return only this JSON:
{
  "score": ${payload.total},
  "grade": "${grade}",
  "score_label": "${scoreLabel}",
  "executive_summary": "3 sentences here",
  "pillar_breakdown": [
    { "id": 1, "name": "Litigation Health", "score": ${payload.litigation}, "max": 25, "status": "Healthy/Needs Attention/At Risk/Critical", "finding": "...", "implication": "..." },
    { "id": 2, "name": "Contractual Health", "score": ${payload.contractual}, "max": 25, "status": "...", "finding": "...", "implication": "..." },
    { "id": 3, "name": "Compliance Health", "score": ${payload.compliance}, "max": 25, "status": "...", "finding": "...", "implication": "..." },
    { "id": 4, "name": "Legal Cost Efficiency", "score": ${payload.cost}, "max": 25, "status": "...", "finding": "...", "implication": "..." }
  ],
  "future_risk_outlook": "2–3 sentence AI-generated outlook on emerging risks: DPDP Act, trademark, personal guarantees, or sector-specific threats.",
  "risk_flags": [
    { "rank": 1, "title": "risk title", "gap": "...", "consequence": "...", "law_reference": "specific act or null", "exposure": "₹X – ₹Y", "urgency": "Immediate" },
    { "rank": 2, "title": "...", "gap": "...", "consequence": "...", "law_reference": "...", "exposure": "...", "urgency": "30 Days" },
    { "rank": 3, "title": "...", "gap": "...", "consequence": "...", "law_reference": "...", "exposure": "...", "urgency": "90 Days" }
  ],
  "action_plan": [
    { "step": 1, "timeline": "This Week", "action": "...", "cost": "₹0 / ₹X,000" },
    { "step": 2, "timeline": "This Month", "action": "...", "cost": "..." },
    { "step": 3, "timeline": "This Quarter", "action": "...", "cost": "..." }
  ],
  "consultation_note": "specific 1-2 sentence recommendation",
  "example": {
    "businessName": "...",
    "whatHappened": "...",
    "consequences": "...",
    "vcloWouldHave": "...",
    "lesson": "..."
  },
  "vcloPitch": "..."
}`;
}

export async function generateReport(payload: ReportPayload): Promise<GeneratedReport> {
  const prompt = buildReportPrompt(payload);

  const fallback: GeneratedReport = {
    summary: `${payload.company} scored ${payload.total}/100 — ${payload.total <= 39 ? "critical legal exposure requiring immediate action" : payload.total <= 59 ? "significant legal gaps with measurable financial risk" : payload.total <= 79 ? "identifiable gaps that warrant attention" : "a solid legal foundation with limited immediate exposure"}.`,
    pillarAssessments: {
      "Litigation Health": `Score: ${payload.litigation}/25 — Review active disputes and ensure legal counsel is accessible.`,
      "Contractual Health": `Score: ${payload.contractual}/25 — Written agreements need strengthening across key relationships.`,
      "Compliance Health": `Score: ${payload.compliance}/25 — All licences and government filings need verification.`,
      "Legal Cost Efficiency": `Score: ${payload.cost}/25 — Proactive legal management can significantly reduce reactive costs.`,
    },
    insights: [
      { title: "Critical Legal Gap", description: `Your ${payload.businessType} has significant gaps that expose it to financial risk. Without proper contracts and compliance, a single dispute could cost ₹5–20 Lakhs. Immediate action is recommended.`, severity: "HIGH", financialRisk: "₹5–20 Lakhs potential exposure" },
      { title: "Compliance Risk", description: "Several regulatory areas need immediate attention to avoid penalties and business disruption.", severity: "MEDIUM", financialRisk: "₹2–10 Lakhs potential exposure" },
      { title: "Contractual Gaps", description: "Written agreements are missing or incomplete for key business relationships, creating unenforceable positions.", severity: "LOW", financialRisk: "₹1–5 Lakhs potential exposure" },
    ],
    actions: [
      { action: "Audit all contracts and agreements", description: "List every vendor, employee, and client relationship and confirm each has a signed written agreement in place.", timeline: "THIS WEEK" },
      { action: "File all pending statutory returns", description: "Check GST portal, MCA21, and Income Tax portal for any overdue returns or notices and file immediately.", timeline: "THIS MONTH" },
      { action: "Engage a Virtual CLO on retainer", description: "A Virtual CLO provides proactive legal coverage for your business at a fraction of in-house counsel costs.", timeline: "90 DAYS" },
    ],
    example: {
      businessName: "Sunrise Enterprises",
      whatHappened: `A ${payload.businessType} in ${payload.city} faced a ₹12 Lakh demand from a vendor after a verbal agreement dispute. Without written contracts, they had no legal basis to defend their position and the case dragged on for 8 months.`,
      consequences: "Lost ₹12 Lakhs + 8 months of management attention disrupting operations.",
      vcloWouldHave: "A VCLO would have ensured all vendor agreements were documented and dispute resolution clauses were in place before work began.",
      lesson: "A written contract costs ₹5,000. A verbal agreement dispute costs ₹12 Lakhs.",
    },
    vcloPitch: `With a score of ${payload.total}/100 and ${payload.risk} risk, ${payload.company} in ${payload.city} needs proactive legal protection. Rest The Case's VCLO service provides dedicated legal counsel for ${payload.businessType}s starting at ₹4,999/month — a fraction of what a single dispute costs. Don't wait for a legal crisis to act.`,
  };

  interface ReportRaw {
    executive_summary?: string;
    pillar_breakdown?: Array<{ name: string; finding: string; implication: string }>;
    future_risk_outlook?: string;
    risk_flags?: Array<{ title: string; gap: string; consequence: string; law_reference?: string; exposure: string; urgency: string }>;
    action_plan?: Array<{ action: string; timeline: string }>;
    consultation_note?: string;
    example?: { businessName: string; whatHappened: string; consequences: string; vcloWouldHave: string; lesson: string };
    vcloPitch?: string;
  }

  function mapRawToReport(raw: ReportRaw): GeneratedReport {
    const pillarMap: Record<string, string> = {};
    for (const pb of raw.pillar_breakdown ?? []) {
      pillarMap[pb.name] = `${pb.finding} ${pb.implication}`;
    }

    return {
      summary: raw.executive_summary ?? fallback.summary,
      pillarAssessments: {
        "Litigation Health": pillarMap["Litigation Health"] ?? fallback.pillarAssessments["Litigation Health"]!,
        "Contractual Health": pillarMap["Contractual Health"] ?? fallback.pillarAssessments["Contractual Health"]!,
        "Compliance Health": pillarMap["Compliance Health"] ?? fallback.pillarAssessments["Compliance Health"]!,
        "Legal Cost Efficiency": pillarMap["Legal Cost Efficiency"] ?? fallback.pillarAssessments["Legal Cost Efficiency"]!,
      },
      futureRiskOutlook: raw.future_risk_outlook,
      insights: (raw.risk_flags ?? []).slice(0, 3).map((f, i) => ({
        title: f.title,
        description: `${f.gap} ${f.consequence}${f.law_reference ? ` (${f.law_reference})` : ""}`,
        severity: (["HIGH", "MEDIUM", "LOW"] as const)[i] ?? "LOW",
        financialRisk: f.exposure,
      })),
      actions: (raw.action_plan ?? []).slice(0, 3).map((a) => ({
        action: a.action,
        description: a.action,
        timeline: (
          a.timeline?.includes("Week") || a.timeline?.includes("WEEK") ? "THIS WEEK" :
          a.timeline?.includes("Month") || a.timeline?.includes("MONTH") ? "THIS MONTH" :
          "90 DAYS"
        ) as "THIS WEEK" | "THIS MONTH" | "90 DAYS",
      })),
      example: raw.example ?? fallback.example,
      vcloPitch: raw.vcloPitch ?? raw.consultation_note ?? fallback.vcloPitch,
    };
  }

  try {
    const raw = await callGemini(prompt, 8000, 0.4);
    return mapRawToReport(JSON.parse(raw) as ReportRaw);
  } catch (err) {
    logger.error({ err }, "Report generation failed, retrying");
    try {
      const raw2 = await callGemini(prompt, 8000, 0.4);
      return mapRawToReport(JSON.parse(raw2) as ReportRaw);
    } catch (err2) {
      logger.error({ err: err2 }, "Report retry failed, using fallback");
      return fallback;
    }
  }
}

// Keep old exports for backward compatibility
export type { ReportPayload as OldReportPayload };
export const STATIC_FALLBACK_QUESTIONS = STATIC_SEED_PILLARS.flatMap((p) =>
  p.questions.map((q, i) => ({
    id: i + 1,
    question: q.text,
    pillar: q.pillar as PillarName,
    isReverseScored: q.isReverse,
    isSeed: true,
    contextNote: q.hint,
  }))
);

// Legacy wrapper kept for submit.ts compatibility
export async function generateSeedQuestions(
  businessType: string,
  _category: string,
  city: string,
  _contextTags: string[]
): Promise<Array<{ id: number; question: string; pillar: PillarName; isReverseScored: boolean; isSeed: boolean; contextNote?: string }>> {
  try {
    const pillars = await generateSeedQuestionsForAssessment(businessType, "Private Limited / LLP", "11-50", "2-5 years", businessType, city);
    return pillars.flatMap((p) =>
      p.questions.map((q, i) => ({
        id: i + 1,
        question: q.text,
        pillar: p.name,
        isReverseScored: q.isReverse,
        isSeed: true,
        contextNote: q.hint,
      }))
    );
  } catch {
    return STATIC_FALLBACK_QUESTIONS;
  }
}

export async function generateFollowUpQuestions(
  _businessType: string,
  _category: string,
  _city: string,
  _contextTags: string[],
  _seedAnswers: Array<{ pillar: string; answer: "YES" | "NO" | "UNSURE"; question?: string }>
): Promise<Array<{ id: number; question: string; pillar: PillarName; isReverseScored: boolean; isSeed: boolean; contextNote?: string }>> {
  return [];
}
