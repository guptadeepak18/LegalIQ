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

export interface AnswerOption {
  /** Stable key for this option, e.g. "A" | "B" | "C" | "D" */
  value: string;
  /** Main answer text shown to the user */
  label: string;
  /** Optional short helper text shown under the label */
  sublabel?: string;
  /** 0 (worst / highest legal risk) to 4 (best / fully compliant) */
  score: number;
}

export interface QuestionInsight {
  /** Plain-language context: what this risk area is and why it matters */
  info: string;
  /** Concrete financial/operational impact if the gap is left unaddressed */
  impact: string;
  /** A practical suggestion the business can act on */
  suggestion: string;
  /** A specific recommendation (e.g. what to get in place, from whom) */
  recommendation: string;
  /** A short real-world example / case illustrating the risk */
  example: string;
}

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
  options: AnswerOption[];
  insight: QuestionInsight;
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
    reason: string;
    businessImpact: string;
    futureProblem: string;
    recommendation: string;
  }>;
  futureRisks: Array<{
    title: string;
    level: "HIGH" | "MEDIUM" | "LOW";
    impact: string;
    reason: string;
    action: string;
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
        config: {
          temperature,
          maxOutputTokens: maxTokens,
          // gemini-2.5-* models default to "thinking" mode, which silently eats
          // into maxOutputTokens for internal reasoning and truncates the
          // visible JSON response. gemini-2.5-flash allows disabling it
          // entirely (budget 0); gemini-2.5-pro requires a minimum budget, so
          // give it the smallest allowed value instead.
          thinkingConfig: { thinkingBudget: model === "gemini-2.5-pro" ? 128 : 0 },
        },
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

interface OptionRaw {
  value: string;
  label: string;
  sublabel?: string;
  score: number;
}

interface InsightRaw {
  info: string;
  impact: string;
  suggestion: string;
  recommendation: string;
  example: string;
}

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
  options?: OptionRaw[];
  insight?: InsightRaw;
}

interface SeedPillarRaw {
  id: number;
  name: string;
  icon: string;
  questions: SeedRaw[];
}

function fallbackOptions(): AnswerOption[] {
  return [
    { value: "A", label: "Yes, fully in place", score: 4 },
    { value: "B", label: "Partially — some gaps", score: 2 },
    { value: "C", label: "No, not in place", score: 0 },
    { value: "D", label: "Not sure", score: 1 },
  ];
}

function normaliseOptions(raw?: OptionRaw[]): AnswerOption[] {
  if (!Array.isArray(raw) || raw.length < 2) return fallbackOptions();
  return raw
    .filter((o) => o && typeof o.label === "string" && o.label.trim().length > 0)
    .map((o, i) => ({
      value: o.value ?? String.fromCharCode(65 + i),
      label: o.label.trim(),
      sublabel: o.sublabel?.trim(),
      score: Math.max(0, Math.min(4, Math.round(o.score ?? 2))),
    }));
}

function normaliseInsight(raw: InsightRaw | undefined, riskIfNo: string | undefined): QuestionInsight {
  return {
    info: raw?.info?.trim() || "This affects your day-to-day legal exposure and how protected your business is in a dispute.",
    impact: raw?.impact?.trim() || riskIfNo || "Leaving this unaddressed increases the chance of a costly dispute or penalty.",
    suggestion: raw?.suggestion?.trim() || "Review this area with a legal advisor and close any obvious gaps first.",
    recommendation: raw?.recommendation?.trim() || "Get a written policy or agreement in place and keep it up to date.",
    example: raw?.example?.trim() || "Many small businesses face this exact gap and only fix it after a dispute forces the issue.",
  };
}

const PILLAR_META: Array<{ id: number; name: PillarName; icon: string }> = [
  { id: 1, name: "Litigation Health", icon: "⚖️" },
  { id: 2, name: "Contractual Health", icon: "📄" },
  { id: 3, name: "Compliance Health", icon: "✅" },
  { id: 4, name: "Legal Cost Efficiency", icon: "💼" },
];

function buildSeedPrompt(
  companyName: string,
  businessType: string,
  registration: string,
  employeeCount: string,
  businessAge: string,
  industry: string,
  state: string,
  onlyPillarId?: number
): string {
  const targetPillar = onlyPillarId ? PILLAR_META.find((p) => p.id === onlyPillarId) : undefined;
  const scopeInstruction = targetPillar
    ? `YOUR TASK (THIS CALL): Generate exactly 5 main questions for ONLY PILLAR ${targetPillar.id} — "${targetPillar.name}". Ignore the other 3 pillars entirely for this call; they are generated separately. Return only that one pillar's JSON object (see OUTPUT shape below, but with a single pillar, not an array of 4).`
    : `YOUR TASK: Generate exactly 5 main questions per pillar (20 questions total across 4 pillars). These are ALL of the main questions for each pillar — do not generate fewer or more.`;
  return `
You are a senior Indian legal risk advisor with 20 years of experience 
advising MSMEs, startups, and SMEs across India.

You are generating the opening questions for a legal health assessment.
Each question must feel like it was written specifically for THIS business — 
not a generic legal checklist.

BUSINESS PROFILE:
Business Name: ${companyName}
Business Type: ${businessType}
Sub-category: ${industry}
Registration: ${registration}
Employees: ${employeeCount}
Years Operating: ${businessAge}
State: ${state}
Has Physical Location: Yes
Sells Online: Unknown
Handles Customer Data: Unknown

${scopeInstruction}
A separate follow-up engine will add up to 2 extra questions after any single main
question, but only when that specific answer reveals a risk worth exploring further.
You do not need to plan for follow-ups here — just write 5 strong, distinct main
questions per pillar, each covering a different risk area within that pillar.

STRICT RULES FOR QUESTION QUALITY:
1. Every question must mention or imply THIS specific business type or category — where it reads naturally, use the business name "${companyName}" directly (e.g. "Does ${companyName} have...").
2. Maximum 20 words per question
3. Practical and moderately easy to answer — a busy owner should be able to answer in a few seconds without looking anything up
4. NEVER use a plain Yes/No/Not-Sure question. Every question must ship with 3-4 custom answer OPTIONS that match that specific question (see OPTIONS RULES below)
5. No legal jargon — write at a Class 10 reading level
6. Each question must probe a risk that is ACTUALLY COMMON for this business type
7. Questions within a pillar must cover different risks — no overlap
8. Tone: professional and direct — like a CA during a tax audit

OPTIONS RULES (apply to every question):
- Provide 3 to 4 answer options, each tailored to what this exact question is asking (never reuse a generic Yes/No/Not Sure set)
- Options should read like natural human answers, e.g. for "Do you have signed agreements with your vendors?": "Yes, all of them are signed", "Only some vendors have signed agreements", "No, most are verbal/informal", "Not sure — I'd need to check"
- Each option needs a "score" from 0 to 4: 4 = fully compliant / no risk, 3 = mostly compliant, 2 = partial gap, 1 = significant gap, 0 = high risk / non-compliant
- Order options from best (score 4) to worst (score 0) or worst to best — keep it logical and easy to scan
- Every question must also include an "insight" object with 5 short fields written for THIS exact question and business:
  - info: 1-2 plain sentences on what this risk area is and why it matters for ${companyName}
  - impact: the concrete financial/operational consequence of the risk (₹ amount or real business impact)
  - suggestion: one practical, doable suggestion
  - recommendation: one specific recommendation (what to put in place, and how)
  - example: a short (2-3 sentence) real-world-style example of a similar business in India facing this exact issue

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

${targetPillar ? `OUTPUT — return only this JSON, no explanations, no markdown (ONE pillar object only, not wrapped in a "pillars" array):
{
  "id": ${targetPillar.id},
  "name": "${targetPillar.name}",
  "icon": "${targetPillar.icon}",
  "questions": [
    {
      "id": "p${targetPillar.id}_q1",
      "text": "QUESTION TEXT — max 20 words, plain language, practical",
      "context": "why this question matters for THIS specific business type",
      "risk_if_no": "exact financial or legal consequence if this is a gap",
      "law_reference": "specific Indian law or authority e.g. Consumer Protection Act 2019",
      "risk_area": "${targetPillar.name.toLowerCase()}",
      "weight": 9,
      "exposure_low": 50000,
      "exposure_high": 500000,
      "options": [
        { "value": "A", "label": "answer option matching this question", "sublabel": "optional short helper text", "score": 4 },
        { "value": "B", "label": "answer option matching this question", "score": 3 },
        { "value": "C", "label": "answer option matching this question", "score": 1 },
        { "value": "D", "label": "answer option matching this question", "score": 0 }
      ],
      "insight": {
        "info": "what this risk area is and why it matters for this business",
        "impact": "concrete ₹ or operational consequence",
        "suggestion": "one practical suggestion",
        "recommendation": "one specific recommendation",
        "example": "short real-world-style example"
      }
    }
    /* … continue this exact shape for "p${targetPillar.id}_q2" through "p${targetPillar.id}_q5" — 5 questions total, each covering a distinct risk area … */
  ]
}` : `OUTPUT — return only this JSON, no explanations, no markdown:
{
  "pillars": [
    {
      "id": 1,
      "name": "Litigation Health",
      "icon": "⚖️",
      "questions": [
        {
          "id": "p1_q1",
          "text": "QUESTION TEXT — max 20 words, plain language, practical",
          "context": "why this question matters for THIS specific business type",
          "risk_if_no": "exact financial or legal consequence if this is a gap",
          "law_reference": "specific Indian law or authority e.g. Consumer Protection Act 2019",
          "risk_area": "litigation",
          "weight": 9,
          "exposure_low": 50000,
          "exposure_high": 500000,
          "options": [
            { "value": "A", "label": "answer option matching this question", "sublabel": "optional short helper text", "score": 4 },
            { "value": "B", "label": "answer option matching this question", "score": 3 },
            { "value": "C", "label": "answer option matching this question", "score": 1 },
            { "value": "D", "label": "answer option matching this question", "score": 0 }
          ],
          "insight": {
            "info": "what this risk area is and why it matters for this business",
            "impact": "concrete ₹ or operational consequence",
            "suggestion": "one practical suggestion",
            "recommendation": "one specific recommendation",
            "example": "short real-world-style example"
          }
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
          "options": [ "...same shape as above, 3-4 options tailored to this question..." ],
          "insight": { "info": "...", "impact": "...", "suggestion": "...", "recommendation": "...", "example": "..." }
        }
        /* … continue this exact shape for "p1_q3", "p1_q4", "p1_q5" — 5 questions total in this pillar, each covering a distinct risk area … */
      ]
    },
    { "id": 2, "name": "Contractual Health", "icon": "📄", "questions": [...] },
    { "id": 3, "name": "Compliance Health", "icon": "✅", "questions": [...] },
    { "id": 4, "name": "Legal Cost Efficiency", "icon": "💼", "questions": [...] }
  ]
}`}`;
}

// ─── Static fallback: 2 seed questions × 4 pillars ────────────────────────
// These are only the SEED questions. Adaptive questions (2–4 per pillar)
// are generated by AI in real time based on the business profile and answers.
// ─── Reusable answer-option sets + insight builder for static fallback data ──
const OPTS_DISPUTE: AnswerOption[] = [
  { value: "A", label: "No, nothing like that", score: 4 },
  { value: "B", label: "It happened once but is resolved now", score: 3 },
  { value: "C", label: "Yes, and it's still unresolved", score: 0 },
  { value: "D", label: "Not sure / need to check", score: 1 },
];
const OPTS_HAVE: AnswerOption[] = [
  { value: "A", label: "Yes, always", score: 4 },
  { value: "B", label: "Usually, but not every time", score: 3 },
  { value: "C", label: "Rarely or never", score: 0 },
  { value: "D", label: "Not sure", score: 1 },
];
const OPTS_CURRENT: AnswerOption[] = [
  { value: "A", label: "Yes, all up to date", score: 4 },
  { value: "B", label: "Mostly, one or two are pending", score: 2 },
  { value: "C", label: "No, several are overdue or expired", score: 0 },
  { value: "D", label: "Not sure — I'd need to check", score: 1 },
];
const OPTS_SPEND: AnswerOption[] = [
  { value: "A", label: "No, never", score: 4 },
  { value: "B", label: "Once, and it was minor", score: 3 },
  { value: "C", label: "Yes, more than once", score: 0 },
  { value: "D", label: "Not tracked / not sure", score: 1 },
];

function mkInsight(info: string, impact: string, suggestion: string, recommendation: string, example: string): QuestionInsight {
  return { info, impact, suggestion, recommendation, example };
}

export const STATIC_SEED_PILLARS: AssessmentPillar[] = [
  {
    id: 1, name: "Litigation Health", icon: "⚖️",
    definition: PILLAR_DEFINITIONS["Litigation Health"],
    questions: [
      { id: "p1_q1", text: "Has your business received any legal notice from a court or government authority?", hint: "Includes consumer forum, labour tribunal, or tax notices", riskIfNo: "Unresolved notices escalate into court cases with mandatory attendance and heavy costs.", weight: 10, isReverse: true, isFollowUp: false, pillar: "Litigation Health", exposureEstimate: "₹50,000 – ₹5,00,000", options: OPTS_DISPUTE, insight: mkInsight("Legal notices are the first formal signal of a dispute — ignoring them almost always makes things worse.", "Unresolved notices escalate into court cases with mandatory attendance, legal fees, and possible ex-parte orders against you.", "Log every notice you receive and respond within the stated deadline, even if it's just to acknowledge it.", "Route every notice to a lawyer for a same-week reply — most can be resolved cheaply if addressed early.", "A small retailer ignored a consumer forum notice for months; the case went ex-parte and the resulting order cost far more than settling early would have.") },
      { id: "p1_q2", text: "Do you have any unresolved dispute with a customer or vendor right now?", hint: "Even informal disagreements over payment or delivery count", riskIfNo: "Unresolved disputes escalate — the longer you wait, the more expensive resolution becomes.", weight: 9, isReverse: true, isFollowUp: false, pillar: "Litigation Health", exposureEstimate: "₹25,000 – ₹3,00,000", options: OPTS_DISPUTE, insight: mkInsight("Open disputes — even informal ones over payment or delivery — are the most common trigger for litigation among small businesses.", "An unresolved dispute can freeze a business relationship and end in legal costs many times the original amount in question.", "Put every ongoing disagreement in writing (email/WhatsApp) so there is a paper trail if it escalates.", "Set a 30-day internal deadline to resolve or formally escalate any dispute — don't let it sit indefinitely.", "A vendor dispute over a delayed payment dragged on for a year without documentation, and the business lost the case for lack of evidence.") },
      { id: "p1_q3", text: "Do you have a lawyer you can call immediately if a legal dispute arises?", hint: "Even a retained legal adviser on call counts", riskIfNo: "Without legal counsel access, a sudden dispute can paralyze your business for months.", weight: 7, isReverse: false, isFollowUp: false, pillar: "Litigation Health", options: OPTS_HAVE, insight: mkInsight("Having a lawyer on call means you can react to a legal problem within hours instead of weeks.", "Without quick access to counsel, a sudden dispute can stall decisions and paralyze the business while you scramble to find help.", "Identify one lawyer or legal service you could call today and save their number.", "Set up a low-cost retainer or on-call arrangement with a local business lawyer.", "A shop owner spent two weeks searching for a lawyer after a notice arrived, missing the response deadline entirely.") },
      { id: "p1_q4", text: "Have any of your customers or vendors ever threatened you with legal action, even informally?", hint: "WhatsApp threats or verbal warnings count", riskIfNo: "Informal threats frequently escalate — ignoring them is one of the costliest mistakes.", weight: 8, isReverse: true, isFollowUp: false, pillar: "Litigation Health", options: OPTS_DISPUTE, insight: mkInsight("Informal threats — even a WhatsApp message — are often the first warning sign before a formal complaint is filed.", "Ignoring an informal threat is one of the costliest mistakes; it frequently escalates into a formal legal notice.", "Save and document any message that contains a threat of legal action, however informal.", "Respond calmly in writing and consider looping in a lawyer if the threat repeats.", "A vendor's WhatsApp warning about non-payment was ignored for months and turned into a formal consumer complaint.") },
      { id: "p1_q5", text: "Do you keep written records of all customer complaints and how they were resolved?", hint: "A simple register, email thread, or CRM entry counts", riskIfNo: "No records means no defence — consumer courts favour documented businesses.", weight: 6, isReverse: false, isFollowUp: false, pillar: "Litigation Health", options: OPTS_HAVE, insight: mkInsight("A record of complaints and resolutions is your evidence trail if a customer later escalates to a consumer forum.", "Without records, you have no defence — consumer courts consistently favour businesses that can show documented resolution attempts.", "Start a simple spreadsheet logging every complaint, date, and how it was resolved.", "Use a shared inbox or lightweight CRM so every team member logs complaints the same way.", "A retailer with no complaint log lost a consumer forum case simply because they couldn't prove they had offered a refund.") },
    ],
  },
  {
    id: 2, name: "Contractual Health", icon: "📄",
    definition: PILLAR_DEFINITIONS["Contractual Health"],
    questions: [
      { id: "p2_q1", text: "Do you have a written, signed agreement with every vendor you regularly pay?", hint: "Includes suppliers, service providers, and freelancers", riskIfNo: "Verbal agreements are unenforceable in Indian courts — you cannot claim damages.", weight: 9, isReverse: false, isFollowUp: false, pillar: "Contractual Health", exposureEstimate: "₹50,000 – ₹10,00,000", options: OPTS_HAVE, insight: mkInsight("A signed vendor agreement is your only real protection if a supplier fails to deliver or breaches terms.", "Without a written contract, Indian courts generally cannot enforce damages, refunds, or penalties against a defaulting vendor.", "Start with your top 3 highest-value vendors and get simple one-page agreements signed this month.", "Use a standard vendor agreement template covering price, delivery, and penalties, and require a signature before any payment.", "A café owner paid a supplier upfront with no contract; when the goods never arrived, there was no legal recourse to recover the money.") },
      { id: "p2_q2", text: "Does every employee or contractor sign an agreement before starting work?", hint: "Even a simple offer letter with terms counts", riskIfNo: "Unsigned employment creates disputes over pay, notice period, and IP ownership.", weight: 8, isReverse: false, isFollowUp: false, pillar: "Contractual Health", exposureEstimate: "₹1,00,000 – ₹5,00,000", options: OPTS_HAVE, insight: mkInsight("An employment or contractor agreement is what defines pay, notice period, confidentiality, and who owns the work produced.", "Without a signed agreement, disputes over pay or ownership of work can drag on and damage your reputation with future hires.", "Create one simple offer-letter template with the essentials and use it for every new hire, even short-term ones.", "Require every employee and contractor to sign before their first day, not after.", "A startup let a contractor build its app without a signed IP clause — the contractor later claimed partial ownership of the code.") },
      { id: "p2_q3", text: "Do you have a signed lease or rental agreement for your business premises?", hint: "Month-to-month verbal arrangements are high risk", riskIfNo: "An unsigned tenancy can result in eviction without notice and loss of all improvements.", weight: 8, isReverse: false, isFollowUp: false, pillar: "Contractual Health", options: OPTS_HAVE, insight: mkInsight("A signed lease protects your right to occupy the premises and outlines notice periods, deposits, and renewal terms.", "Without one, a landlord can ask you to vacate with little notice, and you may lose any money spent on fit-outs or improvements.", "Get your current arrangement, even if verbal, converted into a written lease as soon as possible.", "Register the lease if the term exceeds 11 months, as required under Indian law for enforceability.", "A boutique spent ₹8 lakh on interiors under a verbal lease and was asked to vacate within a week when the landlord changed his mind.") },
      { id: "p2_q4", text: "Have you ever lost money because someone didn't honour a verbal commitment?", hint: "Payment defaults, delivery failures, or service cancellations", riskIfNo: "Repeated verbal agreement losses signal systematic contract absence.", weight: 7, isReverse: true, isFollowUp: false, pillar: "Contractual Health", options: OPTS_DISPUTE, insight: mkInsight("Losses from broken verbal commitments are a direct sign that your business relies too heavily on trust instead of paper.", "Recurring losses like this compound over time and are almost entirely preventable with basic written terms.", "Identify the last 2-3 instances this happened and start requiring written confirmation for those relationships going forward.", "Move all recurring vendor/customer relationships to simple written purchase orders or agreements.", "A caterer repeatedly lost advance payments to no-show clients until requiring a signed booking confirmation solved the problem overnight.") },
      { id: "p2_q5", text: "Do your customer invoices or order confirmations include your payment terms and late-payment penalties?", hint: "Even a line on the invoice counts", riskIfNo: "Without stated terms, debt recovery through legal channels becomes extremely difficult.", weight: 6, isReverse: false, isFollowUp: false, pillar: "Contractual Health", options: OPTS_HAVE, insight: mkInsight("Payment terms printed on an invoice create a paper trail that makes unpaid dues far easier to recover legally.", "Without stated terms, recovering overdue payments through legal notice or court becomes far harder to prove and win.", "Add one line to your invoice template stating the due date and late-payment interest.", "Make it standard practice across your team to never send an invoice without payment terms.", "A supplier without stated payment terms struggled for a year to recover ₹2 lakh in dues because there was no written proof of the deadline.") },
    ],
  },
  {
    id: 3, name: "Compliance Health", icon: "✅",
    definition: PILLAR_DEFINITIONS["Compliance Health"],
    questions: [
      { id: "p3_q1", text: "Are all your business registrations and industry licences current and valid?", hint: "FSSAI for food, Drug Licence for pharmacy, RERA for real estate", riskIfNo: "Operating with lapsed registrations attracts penalties and bars you from making legal claims.", weight: 10, isReverse: false, isFollowUp: false, pillar: "Compliance Health", exposureEstimate: "₹50,000 – ₹5,00,000", options: OPTS_CURRENT, insight: mkInsight("Industry licences (FSSAI, trade licence, drug licence, etc.) are what make your operations legal in the eyes of regulators.", "Operating on a lapsed licence can mean instant fines, forced shutdown, and disqualifies you from suing others in your own defence.", "Make a simple calendar of every licence and its renewal date so nothing lapses unnoticed.", "Assign one person (or your CA) to track and renew every licence at least 30 days before expiry.", "A cloud kitchen operated for 4 months on an expired FSSAI licence and was shut down by inspectors during a routine check.") },
      { id: "p3_q2", text: "Are your GST returns filed on time every quarter?", hint: "Late filing attracts 18% interest per annum plus late fees", riskIfNo: "GST arrears compound quickly and can trigger bank account attachment orders.", weight: 9, isReverse: false, isFollowUp: false, pillar: "Compliance Health", exposureEstimate: "₹10,000 – ₹2,00,000", options: OPTS_CURRENT, insight: mkInsight("GST filing is a recurring statutory obligation, and the penalties for missing deadlines compound quickly.", "Late GST filings attract 18% annual interest plus late fees, and repeated defaults can lead to bank account attachment.", "Set a recurring reminder a week before every GST due date so filings never slip.", "Have your accountant file GST returns on a fixed monthly schedule rather than reactively.", "A small trader missed two consecutive GST filings and found their bank account temporarily frozen by the tax department.") },
      { id: "p3_q3", text: "Do you file your annual income tax return on time every year?", hint: "Due date is typically 31st July for non-audit businesses", riskIfNo: "Late ITR attracts penalties, disallows loss carry-forward, and flags you for scrutiny.", weight: 8, isReverse: false, isFollowUp: false, pillar: "Compliance Health", options: OPTS_CURRENT, insight: mkInsight("Timely income tax filing keeps you eligible for loss carry-forward benefits and out of the scrutiny queue.", "A late ITR attracts penalties, blocks loss carry-forward, and increases the chance of a tax department notice.", "Mark the ITR due date on your calendar today and set a reminder 3 weeks before.", "File through a CA on a fixed annual schedule rather than waiting until the deadline week.", "A small firm missed its ITR deadline two years running and lost the ability to carry forward a large business loss.") },
      { id: "p3_q4", text: "Are your employee PF and ESI contributions deposited on time every month?", hint: "Due by the 15th and 21st of the following month respectively", riskIfNo: "Delayed PF/ESI deposits attract interest, damages, and personal liability for directors.", weight: 8, isReverse: false, isFollowUp: false, pillar: "Compliance Health", options: OPTS_CURRENT, insight: mkInsight("PF and ESI deposits are employee entitlements with strict monthly deadlines under labour law.", "Delayed deposits attract interest, damages, and in serious cases personal liability for the business owners or directors.", "Set a recurring reminder for the 15th (PF) and 21st (ESI) of every month.", "Automate the deposit through payroll software so it's never dependent on manual follow-up.", "A director was held personally liable for months of unpaid PF dues after the company's HR missed several deposit deadlines.") },
      { id: "p3_q5", text: "Do you have a valid Shop and Establishment Act registration for your business location?", hint: "Required for almost every commercial establishment in India", riskIfNo: "Without S&E registration, you cannot legally employ workers or open a business bank account.", weight: 7, isReverse: false, isFollowUp: false, pillar: "Compliance Health", options: OPTS_CURRENT, insight: mkInsight("Shop & Establishment registration is the baseline licence that legitimizes almost every commercial premises in India.", "Without it, you technically cannot legally employ workers, and banks may refuse to open or maintain a business account.", "Check your registration certificate today and confirm the renewal date.", "Apply for or renew your S&E registration through your state's labour department portal.", "A new outlet operated for 6 months without S&E registration and had its bank account flagged during a routine compliance check.") },
    ],
  },
  {
    id: 4, name: "Legal Cost Efficiency", icon: "💼",
    definition: PILLAR_DEFINITIONS["Legal Cost Efficiency"],
    questions: [
      { id: "p4_q1", text: "Did you pay any fine or penalty to a government body in the last year?", hint: "Tax, labour, pollution, or licence-related penalties", riskIfNo: "Past penalties are a leading indicator of structural gaps that will repeat.", weight: 9, isReverse: true, isFollowUp: false, pillar: "Legal Cost Efficiency", exposureEstimate: "₹25,000 – ₹5,00,000", options: OPTS_SPEND, insight: mkInsight("Fines and penalties are usually a symptom of an underlying compliance gap, not a one-off accident.", "Repeated penalties add up fast and signal to regulators that your business is a recurring risk worth watching closely.", "List every fine paid this year and trace each one back to its root cause before it happens again.", "Do a full compliance review with your CA or lawyer if you've paid more than one penalty in the last 12 months.", "A logistics firm kept paying small e-way bill penalties every month rather than fixing the process — over a year it added up to a lakh in fines.") },
      { id: "p4_q2", text: "In the last year, did you spend money resolving a dispute a written agreement could have prevented?", hint: "Legal fees, settlement amounts, or lost business", riskIfNo: "Pattern of reactive spending means contracts are consistently absent or weak.", weight: 9, isReverse: true, isFollowUp: false, pillar: "Legal Cost Efficiency", exposureEstimate: "₹50,000 – ₹10,00,000", options: OPTS_SPEND, insight: mkInsight("Reactive legal spend — fixing disputes after the fact — is almost always more expensive than preventing them with contracts up front.", "Businesses that spend reactively typically pay 5-10x more than they would have on preventive contracts and reviews.", "Track every legal expense this year and check how many could have been avoided with a signed agreement.", "Invest in a standard contract template and a short annual legal check-up instead of paying for damage control.", "A distributor spent ₹3 lakh settling a dispute that a simple written supply agreement, costing a fraction of that, would have prevented.") },
      { id: "p4_q3", text: "Do you have standard contract templates your team uses without drafting fresh every time?", hint: "Templates prevent costly omissions and reduce lawyer fees", riskIfNo: "Every ad-hoc contract costs more and has higher error rates than a reviewed template.", weight: 6, isReverse: false, isFollowUp: false, pillar: "Legal Cost Efficiency", options: OPTS_HAVE, insight: mkInsight("Standard templates mean every contract has already been legally reviewed once, instead of drafted from scratch under time pressure.", "Ad-hoc contracts cost more in lawyer fees each time and have a much higher error/omission rate than a reused, reviewed template.", "Get your most common contract (vendor, customer, or employee) turned into a reusable template this month.", "Have a lawyer review and approve 2-3 core templates once, then reuse them for every future agreement.", "A services firm paid for a fresh contract review every single deal until switching to one approved template cut their legal costs by half.") },
      { id: "p4_q4", text: "Have you ever consulted a lawyer before signing a major contract or taking a significant business decision?", hint: "Proactive legal advice costs 5–10× less than reactive legal rescue", riskIfNo: "Reactive legal spending is typically 5–10× higher than proactive advice costs.", weight: 7, isReverse: false, isFollowUp: false, pillar: "Legal Cost Efficiency", options: OPTS_HAVE, insight: mkInsight("A quick legal review before signing a major contract catches problems while they're still cheap to fix.", "Fixing a bad contract after signing (reactive legal rescue) typically costs 5-10 times more than a proactive review upfront.", "Before your next major contract, budget a small amount for a lawyer's review before you sign.", "Build a habit: no contract above a certain value gets signed without a legal sanity check.", "A business signed a major distribution deal without review and later paid a lawyer 8x more to try to unwind an unfavourable clause.") },
      { id: "p4_q5", text: "Do you have any legal insurance or professional indemnity cover for your business?", hint: "Covers legal defence costs and certain liability claims", riskIfNo: "A single uninsured legal dispute can consume an entire year's profit.", weight: 6, isReverse: false, isFollowUp: false, pillar: "Legal Cost Efficiency", options: OPTS_HAVE, insight: mkInsight("Legal or professional indemnity insurance covers defence costs and certain liability claims so a single dispute doesn't sink the business.", "Without cover, one uninsured legal dispute can consume an entire year's profit in legal fees and settlements alone.", "Get a quote for a basic professional indemnity or legal expense policy suited to your business size.", "Choose a policy that at minimum covers legal defence costs for the claim types most common in your industry.", "An uninsured consultancy spent its entire annual profit defending a single client lawsuit that a basic policy would have covered.") },
    ],
  },
];

// ─── Static adaptive fallback questions (4 per pillar, indexed 0-3) ─────────
// Used when AI is unavailable (quota/timeout). Mandatory for adaptiveCount < 2.
export const STATIC_ADAPTIVE_QUESTIONS: Record<number, AssessmentQuestion[]> = {
  1: [
    { id: "p1_aq1", text: "Do you have a lawyer you can call immediately if a legal dispute arises?", hint: "Even a retained legal adviser on call counts", riskIfNo: "Without legal counsel access, a sudden dispute can paralyze your business for months.", weight: 7, isReverse: false, isFollowUp: true, pillar: "Litigation Health", options: OPTS_HAVE, insight: mkInsight("Having a lawyer on call means you can react to a legal problem within hours instead of weeks.", "Without quick access to counsel, a sudden dispute can stall decisions and paralyze the business while you scramble to find help.", "Identify one lawyer or legal service you could call today and save their number.", "Set up a low-cost retainer or on-call arrangement with a local business lawyer.", "A shop owner spent two weeks searching for a lawyer after a notice arrived, missing the response deadline entirely.") },
    { id: "p1_aq2", text: "Have any of your customers or vendors ever threatened you with legal action, even informally?", hint: "WhatsApp threats or verbal warnings count", riskIfNo: "Informal threats frequently escalate — ignoring them is one of the costliest mistakes.", weight: 8, isReverse: true, isFollowUp: true, pillar: "Litigation Health", options: OPTS_DISPUTE, insight: mkInsight("Informal threats — even a WhatsApp message — are often the first warning sign before a formal complaint is filed.", "Ignoring an informal threat is one of the costliest mistakes; it frequently escalates into a formal legal notice.", "Save and document any message that contains a threat of legal action, however informal.", "Respond calmly in writing and consider looping in a lawyer if the threat repeats.", "A vendor's WhatsApp warning about non-payment was ignored for months and turned into a formal consumer complaint.") },
    { id: "p1_aq3", text: "Do you keep written records of all customer complaints and how they were resolved?", hint: "A simple register, email thread, or CRM entry counts", riskIfNo: "No records means no defence — consumer courts favour documented businesses.", weight: 6, isReverse: false, isFollowUp: true, pillar: "Litigation Health", options: OPTS_HAVE, insight: mkInsight("A record of complaints and resolutions is your evidence trail if a customer later escalates to a consumer forum.", "Without records, you have no defence — consumer courts consistently favour businesses that can show documented resolution attempts.", "Start a simple spreadsheet logging every complaint, date, and how it was resolved.", "Use a shared inbox or lightweight CRM so every team member logs complaints the same way.", "A retailer with no complaint log lost a consumer forum case simply because they couldn't prove they had offered a refund.") },
    { id: "p1_aq4", text: "Has any current or former employee ever made a complaint against your business?", hint: "Includes grievances filed internally or with a labour office", riskIfNo: "Labour disputes are India's fastest-growing litigation category for small businesses.", weight: 7, isReverse: true, isFollowUp: true, pillar: "Litigation Health", options: OPTS_DISPUTE, insight: mkInsight("Employee grievances, even internal ones, are the seed of India's fastest-growing category of small business litigation.", "An unresolved labour complaint can turn into a tribunal case with back-pay orders and reputational damage.", "Set up a simple internal process for employees to raise concerns before they escalate externally.", "Document every employee grievance and its resolution, just like customer complaints.", "A small firm ignored a repeated pay complaint from a former employee, who later filed with the labour office and won back-pay.") },
  ],
  2: [
    { id: "p2_aq1", text: "Do your written agreements include a dispute resolution clause (arbitration or jurisdiction)?", hint: "Specifies what happens if the parties disagree", riskIfNo: "Without a dispute clause, you default to costly and slow civil court proceedings.", weight: 7, isReverse: false, isFollowUp: true, pillar: "Contractual Health", options: OPTS_HAVE, insight: mkInsight("A dispute resolution clause decides in advance where and how a disagreement will be settled — arbitration, mediation, or which court.", "Without this clause, any dispute defaults to slow, expensive civil court proceedings that can take years.", "Add a one-line arbitration/jurisdiction clause to your standard contract template.", "Specify a local arbitration process and your home city's jurisdiction in every future agreement.", "Two companies without a jurisdiction clause spent 3 years arguing over which state's courts should even hear their contract dispute.") },
    { id: "p2_aq2", text: "Do you have a signed lease or rental agreement for your business premises?", hint: "Month-to-month verbal arrangements are high risk", riskIfNo: "An unsigned tenancy can result in eviction without notice and loss of all improvements.", weight: 8, isReverse: false, isFollowUp: true, pillar: "Contractual Health", options: OPTS_HAVE, insight: mkInsight("A signed lease protects your right to occupy the premises and outlines notice periods, deposits, and renewal terms.", "Without one, a landlord can ask you to vacate with little notice, and you may lose any money spent on fit-outs or improvements.", "Get your current arrangement, even if verbal, converted into a written lease as soon as possible.", "Register the lease if the term exceeds 11 months, as required under Indian law for enforceability.", "A boutique spent ₹8 lakh on interiors under a verbal lease and was asked to vacate within a week when the landlord changed his mind.") },
    { id: "p2_aq3", text: "Have you ever lost money because someone didn't honour a verbal commitment?", hint: "Payment defaults, delivery failures, or service cancellations", riskIfNo: "Repeated verbal agreement losses signal systematic contract absence.", weight: 7, isReverse: true, isFollowUp: true, pillar: "Contractual Health", options: OPTS_DISPUTE, insight: mkInsight("Losses from broken verbal commitments are a direct sign that your business relies too heavily on trust instead of paper.", "Recurring losses like this compound over time and are almost entirely preventable with basic written terms.", "Identify the last 2-3 instances this happened and start requiring written confirmation for those relationships going forward.", "Move all recurring vendor/customer relationships to simple written purchase orders or agreements.", "A caterer repeatedly lost advance payments to no-show clients until requiring a signed booking confirmation solved the problem overnight.") },
    { id: "p2_aq4", text: "Do your customer invoices or order confirmations include your payment terms and late-payment penalties?", hint: "Even a line on the invoice counts", riskIfNo: "Without stated terms, debt recovery through legal channels becomes extremely difficult.", weight: 6, isReverse: false, isFollowUp: true, pillar: "Contractual Health", options: OPTS_HAVE, insight: mkInsight("Payment terms printed on an invoice create a paper trail that makes unpaid dues far easier to recover legally.", "Without stated terms, recovering overdue payments through legal notice or court becomes far harder to prove and win.", "Add one line to your invoice template stating the due date and late-payment interest.", "Make it standard practice across your team to never send an invoice without payment terms.", "A supplier without stated payment terms struggled for a year to recover ₹2 lakh in dues because there was no written proof of the deadline.") },
  ],
  3: [
    { id: "p3_aq1", text: "Do you file your annual income tax return on time every year?", hint: "Due date is typically 31st July for non-audit businesses", riskIfNo: "Late ITR attracts penalties, disallows loss carry-forward, and flags you for scrutiny.", weight: 8, isReverse: false, isFollowUp: true, pillar: "Compliance Health", options: OPTS_CURRENT, insight: mkInsight("Timely income tax filing keeps you eligible for loss carry-forward benefits and out of the scrutiny queue.", "A late ITR attracts penalties, blocks loss carry-forward, and increases the chance of a tax department notice.", "Mark the ITR due date on your calendar today and set a reminder 3 weeks before.", "File through a CA on a fixed annual schedule rather than waiting until the deadline week.", "A small firm missed its ITR deadline two years running and lost the ability to carry forward a large business loss.") },
    { id: "p3_aq2", text: "Are your employee PF and ESI contributions deposited on time every month?", hint: "Due by the 15th and 21st of the following month respectively", riskIfNo: "Delayed PF/ESI deposits attract interest, damages, and personal liability for directors.", weight: 8, isReverse: false, isFollowUp: true, pillar: "Compliance Health", options: OPTS_CURRENT, insight: mkInsight("PF and ESI deposits are employee entitlements with strict monthly deadlines under labour law.", "Delayed deposits attract interest, damages, and in serious cases personal liability for the business owners or directors.", "Set a recurring reminder for the 15th (PF) and 21st (ESI) of every month.", "Automate the deposit through payroll software so it's never dependent on manual follow-up.", "A director was held personally liable for months of unpaid PF dues after the company's HR missed several deposit deadlines.") },
    { id: "p3_aq3", text: "Do you have a valid Shop and Establishment Act registration for your business location?", hint: "Required for almost every commercial establishment in India", riskIfNo: "Without S&E registration, you cannot legally employ workers or open a business bank account.", weight: 7, isReverse: false, isFollowUp: true, pillar: "Compliance Health", options: OPTS_CURRENT, insight: mkInsight("Shop & Establishment registration is the baseline licence that legitimizes almost every commercial premises in India.", "Without it, you technically cannot legally employ workers, and banks may refuse to open or maintain a business account.", "Check your registration certificate today and confirm the renewal date.", "Apply for or renew your S&E registration through your state's labour department portal.", "A new outlet operated for 6 months without S&E registration and had its bank account flagged during a routine compliance check.") },
    { id: "p3_aq4", text: "Have you received any penalty or demand notice from a government body in the last 2 years?", hint: "Tax, labour, fire safety, or pollution board notices", riskIfNo: "Past penalty notices are a strong predictor of repeat compliance failures.", weight: 8, isReverse: true, isFollowUp: true, pillar: "Compliance Health", options: OPTS_DISPUTE, insight: mkInsight("A past penalty notice usually points to a recurring gap in your compliance process, not a one-time mistake.", "Businesses with a prior penalty are statistically far more likely to face a repeat notice from the same authority.", "Pull up the last notice you received and confirm the underlying issue has actually been fixed, not just paid off.", "Do an annual compliance audit covering tax, labour, and any industry-specific licences.", "A workshop paid a pollution board fine but never fixed the underlying issue, and was fined again the following year for the same violation.") },
  ],
  4: [
    { id: "p4_aq1", text: "Do you have standard contract templates your team uses without drafting fresh every time?", hint: "Templates prevent costly omissions and reduce lawyer fees", riskIfNo: "Every ad-hoc contract costs more and has higher error rates than a reviewed template.", weight: 6, isReverse: false, isFollowUp: true, pillar: "Legal Cost Efficiency", options: OPTS_HAVE, insight: mkInsight("Standard templates mean every contract has already been legally reviewed once, instead of drafted from scratch under time pressure.", "Ad-hoc contracts cost more in lawyer fees each time and have a much higher error/omission rate than a reused, reviewed template.", "Get your most common contract (vendor, customer, or employee) turned into a reusable template this month.", "Have a lawyer review and approve 2-3 core templates once, then reuse them for every future agreement.", "A services firm paid for a fresh contract review every single deal until switching to one approved template cut their legal costs by half.") },
    { id: "p4_aq2", text: "Have you ever consulted a lawyer before signing a major contract or taking a significant business decision?", hint: "Proactive legal advice costs 5–10× less than reactive legal rescue", riskIfNo: "Reactive legal spending is typically 5–10× higher than proactive advice costs.", weight: 7, isReverse: false, isFollowUp: true, pillar: "Legal Cost Efficiency", options: OPTS_HAVE, insight: mkInsight("A quick legal review before signing a major contract catches problems while they're still cheap to fix.", "Fixing a bad contract after signing (reactive legal rescue) typically costs 5-10 times more than a proactive review upfront.", "Before your next major contract, budget a small amount for a lawyer's review before you sign.", "Build a habit: no contract above a certain value gets signed without a legal sanity check.", "A business signed a major distribution deal without review and later paid a lawyer 8x more to try to unwind an unfavourable clause.") },
    { id: "p4_aq3", text: "Do you have any legal insurance or professional indemnity cover for your business?", hint: "Covers legal defence costs and certain liability claims", riskIfNo: "A single uninsured legal dispute can consume an entire year's profit.", weight: 6, isReverse: false, isFollowUp: true, pillar: "Legal Cost Efficiency", options: OPTS_HAVE, insight: mkInsight("Legal or professional indemnity insurance covers defence costs and certain liability claims so a single dispute doesn't sink the business.", "Without cover, one uninsured legal dispute can consume an entire year's profit in legal fees and settlements alone.", "Get a quote for a basic professional indemnity or legal expense policy suited to your business size.", "Choose a policy that at minimum covers legal defence costs for the claim types most common in your industry.", "An uninsured consultancy spent its entire annual profit defending a single client lawsuit that a basic policy would have covered.") },
    { id: "p4_aq4", text: "Do you track how much your business spends on legal fees and penalties each year?", hint: "Includes lawyer bills, fines, settlement costs", riskIfNo: "Businesses that don't measure legal spend consistently overspend by 30–50%.", weight: 5, isReverse: false, isFollowUp: true, pillar: "Legal Cost Efficiency", options: OPTS_HAVE, insight: mkInsight("Tracking legal spend — fees, fines, and settlements — is the only way to see whether you're spending reactively or proactively.", "Businesses that don't track this figure consistently overspend by 30-50% because problems keep repeating unnoticed.", "Start a simple running total of every legal-related expense this year, however small.", "Review the total every quarter with your accountant and flag any recurring cost driver.", "A firm was stunned to discover it had spent ₹4 lakh on avoidable late fees and dispute costs it had never actually tallied up.") },
  ],
};

// ─── In-memory cache keyed per-lead so every business gets its own
// dynamically generated questions instead of sharing a businessType/city bucket.
// The TTL only exists so a page refresh / retry within the same session reuses
// the same AI-generated set rather than re-billing Gemini.
const seedCache = new Map<string, { pillars: AssessmentPillar[]; ts: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function generateSeedQuestionsForAssessment(
  leadId: string,
  companyName: string,
  businessType: string,
  registration: string,
  employeeCount: string,
  businessAge: string,
  industry: string,
  state: string
): Promise<AssessmentPillar[]> {
  const cacheKey = leadId;
  const cached = seedCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    logger.info({ cacheKey }, "Seed questions: cache hit");
    return cached.pillars;
  }

  function parsePillar(pIdx: number, p: SeedPillarRaw): AssessmentPillar {
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
          options: normaliseOptions(q.options),
          insight: normaliseInsight(q.insight, q.risk_if_no),
        };
      }),
    };
  }

  // Generate each pillar's 5 questions with its own smaller, focused Gemini
  // call, run concurrently. A single "generate all 20 questions" call
  // routinely took 30-40s (bigger than any reasonable request timeout); 4
  // parallel per-pillar calls each produce far less output and typically
  // resolve in well under half that time, so real AI-generated (not static
  // fallback) questions actually make it back to the user in practice.
  async function generateOnePillar(pillarMeta: { id: number; name: PillarName; icon: string }): Promise<AssessmentPillar> {
    const prompt = buildSeedPrompt(companyName || "your business", businessType, registration, employeeCount, businessAge, industry, state, pillarMeta.id);

    async function tryParse(): Promise<AssessmentPillar> {
      const raw = await callGemini(prompt, 4000, 0.25);
      const parsed = JSON.parse(raw) as SeedPillarRaw;
      if ((parsed.questions?.length ?? 0) < 5) {
        throw new Error(`Pillar "${pillarMeta.name}" has only ${parsed.questions?.length ?? 0} questions, expected 5`);
      }
      return parsePillar(pillarMeta.id - 1, parsed);
    }

    try {
      return await tryParse();
    } catch (err) {
      logger.error({ err, pillar: pillarMeta.name }, "Pillar seed generation failed, retrying once");
      return await tryParse();
    }
  }

  try {
    const pillars = await Promise.all(PILLAR_META.map((meta) => generateOnePillar(meta)));
    seedCache.set(cacheKey, { pillars, ts: Date.now() });
    logger.info({ cacheKey }, "Seed questions: Gemini generated and cached");
    return pillars;
  } catch (err) {
    logger.error({ err, cacheKey }, "Seed generation failed for one or more pillars, using static fallback");
    return STATIC_SEED_PILLARS;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 2 — Per-Question Follow-up Engine
// Fires after a main question (or a follow-up to it) is answered.
// Decides whether ONE more follow-up is warranted for THIS SPECIFIC main
// question thread. Hard cap: 2 follow-ups per main question.
// ─────────────────────────────────────────────────────────────────────────────

interface FollowUpRaw {
  ask_followup: boolean;
  reasoning?: string;
  measure_type?: string;
  question?: {
    id?: string;
    text: string;
    risk_if_no?: string;
    risk_area?: string;
    weight?: number;
    exposure_low?: number;
    exposure_high?: number;
    isReverse?: boolean;
    options?: OptionRaw[];
    insight?: InsightRaw;
  };
}

function buildFollowUpPrompt(
  companyName: string,
  businessType: string,
  registration: string,
  employeeCount: string,
  industry: string,
  pillarName: string,
  pillarNumber: number,
  pillarDefinition: string,
  mainQuestionText: string,
  parentQuestionId: string,
  latestAnswer: string,
  followUpCount: number,
  questionThreadHistory: string
): string {
  return `You are LegalIQ's follow-up engine — a professional legal risk assessor.

A business owner has just answered a question in their legal health assessment.
Your job is to determine whether ONE targeted follow-up question is warranted
for THIS specific main question, or whether we have enough information on this
topic to score it and move on to the next main question.

BUSINESS PROFILE:
Business Name: ${companyName}
Business Type: ${businessType}
Registration: ${registration}
Employees: ${employeeCount}
Industry: ${industry}

CURRENT PILLAR: ${pillarName} (Pillar ${pillarNumber} of 4)
PILLAR DEFINITION: ${pillarDefinition}

THE MAIN QUESTION THIS FOLLOW-UP WOULD ATTACH TO:
"${mainQuestionText}"

CONVERSATION SO FAR ON THIS SPECIFIC QUESTION (main question + any follow-ups already asked about it):
${questionThreadHistory || "(no prior follow-ups on this question yet)"}

MOST RECENT ANSWER GIVEN: ${latestAnswer}
FOLLOW-UPS ALREADY ASKED ON THIS QUESTION: ${followUpCount} (maximum allowed: 2)

---

DECISION LOGIC — follow this exactly:

STEP 1 — Should we follow up at all?
Ask a follow-up ONLY if ALL of these are true:
  a) The most recent answer reveals a real risk or gap (e.g. "No", "Not sure", or a partial/weak answer) — not a clean "Yes, fully in place"
  b) followUpCount is less than 2
  c) A follow-up would materially change the risk score or exposure estimate for this exact topic
  d) We do not already have this information from the conversation on this question so far

Do NOT follow up if:
  - The answer is healthy / fully compliant (risk is covered — move to the next main question)
  - We already know the depth of this specific risk from a prior follow-up
  - The follow-up would be redundant, obvious, or a generic restatement
  - followUpCount is already 2

STEP 2 — What should the follow-up measure?
The follow-up must do exactly ONE of these:
  A) Measure SCALE — how many vendors, employees, transactions are exposed?
  B) Measure DURATION — how long has this gap existed?
  C) Measure SEVERITY — has this gap already caused a problem?
  D) Measure AWARENESS — do they know the specific rule they're missing?

Choose the one that most changes the ₹ exposure estimate for this specific topic.

STEP 3 — Write the follow-up question
Rules:
  - Maximum 16 words
  - Professional tone — direct, not warm
  - Must logically follow from their answer to "${mainQuestionText}" — not feel like a random new question
  - Reference "${companyName}" by name where it reads naturally
  - No legal jargon — Class 10 reading level

GOOD FOLLOW-UP EXAMPLES BY PILLAR:

Litigation Health:
  Main Q: "Do you have any unresolved disputes with a customer or vendor?"
  A: No (meaning yes, they have disputes)
  Good follow-up: "Is this dispute already in a court or consumer forum?"
  Why good: Measures severity — court filing = much higher exposure

Contractual Health:
  Main Q: "Do you have a written agreement with every vendor you regularly pay?"
  A: No
  Good follow-up: "How many vendors do you pay without a written agreement?"
  Why good: Measures scale — 2 vendors vs 20 vendors = very different risk

Compliance Health:
  Main Q: "Are your GST returns filed on time every quarter?"
  A: Not Sure
  Good follow-up: "When did you last check your GST filing status?"
  Why good: Measures awareness/duration — may reveal months of unfiled returns

Legal Cost Efficiency:
  Main Q: "Did you spend money last year resolving a dispute a contract could have prevented?"
  A: Yes
  Good follow-up: "Roughly how much did that dispute cost you in total?"
  Why good: Measures severity — anchors their pain to a real ₹ number for the report

STEP 4 — Custom answer options + insight (mandatory for every follow-up)
Never write a plain Yes/No/Not Sure question. Every follow-up must ship with 3-4 tailored answer OPTIONS:
  - Each option needs "value" (A/B/C/D), "label" (natural-language answer), optional "sublabel", and "score" 0-4 (4 = fully compliant/no risk, 0 = high risk)
  - Options must match exactly what THIS follow-up is asking, not a generic set
Every follow-up must also include an "insight" object with 5 fields tailored to this exact question and ${companyName}:
  - info: what this risk area is and why it matters
  - impact: concrete ₹/operational consequence
  - suggestion: one practical suggestion
  - recommendation: one specific recommendation
  - example: short real-world-style example

---

OUTPUT FORMAT — return only this JSON, nothing else:
{
  "ask_followup": true,
  "reasoning": "one sentence explaining why this follow-up is warranted",
  "measure_type": "SCALE / DURATION / SEVERITY / AWARENESS",
  "question": {
    "id": "${parentQuestionId}_fq${followUpCount + 1}",
    "text": "follow-up question here",
    "risk_if_no": "specific consequence",
    "risk_area": "same pillar risk area",
    "weight": 5,
    "exposure_low": 25000,
    "exposure_high": 300000,
    "isReverse": false,
    "options": [
      { "value": "A", "label": "tailored answer option", "sublabel": "optional helper text", "score": 4 },
      { "value": "B", "label": "tailored answer option", "score": 2 },
      { "value": "C", "label": "tailored answer option", "score": 0 },
      { "value": "D", "label": "Not sure", "score": 1 }
    ],
    "insight": {
      "info": "what this risk area is and why it matters for ${companyName}",
      "impact": "concrete ₹ or operational consequence",
      "suggestion": "one practical suggestion",
      "recommendation": "one specific recommendation",
      "example": "short real-world-style example"
    }
  }
}

OR if no follow-up is needed:
{
  "ask_followup": false,
  "reasoning": "one sentence explaining why we have enough information"
}`;
}

// Follow-up AI calls are capped; on timeout we skip the follow-up entirely
// (acceptable, since follow-ups are optional and only asked "when needed").
// Observed gemini-2.5-flash latency for this prompt varies 4-12s, so a short
// cap caused nearly every follow-up to be skipped on timeout rather than
// actually evaluated. 15s keeps the UX responsive while giving the model
// realistic room to finish before we fall back to "no follow-up".
const FOLLOWUP_TIMEOUT_MS = 15000;

export async function generateFollowUp(
  companyName: string,
  businessType: string,
  registration: string,
  employeeCount: string,
  industry: string,
  pillarName: string,
  pillarNumber: number,
  pillarDefinition: string,
  mainQuestionText: string,
  parentQuestionId: string,
  latestAnswer: string,
  followUpCount: number,
  questionThreadHistory: string
): Promise<AssessmentQuestion | null> {
  // Hard cap enforced here (engine also checks, but belt + suspenders)
  if (followUpCount >= 2) return null;

  const prompt = buildFollowUpPrompt(
    companyName || "your business", businessType, registration, employeeCount, industry,
    pillarName, pillarNumber, pillarDefinition,
    mainQuestionText, parentQuestionId, latestAnswer, followUpCount, questionThreadHistory
  );

  async function tryParse(): Promise<AssessmentQuestion | null> {
    const raw = await callGemini(prompt, 2500, 0.5);
    const parsed = JSON.parse(raw) as FollowUpRaw;

    if (!parsed.ask_followup || !parsed.question?.text?.trim()) {
      logger.info({ pillarName, parentQuestionId, followUpCount, reasoning: parsed.reasoning }, "Follow-up engine: no follow-up needed");
      return null;
    }

    const q = parsed.question;
    const expEstimate = q.exposure_low != null && q.exposure_high != null
      ? `₹${q.exposure_low.toLocaleString("en-IN")} – ₹${q.exposure_high.toLocaleString("en-IN")}`
      : undefined;

    return {
      id: q.id ?? `${parentQuestionId}_fq${followUpCount + 1}`,
      text: q.text.trim(),
      hint: q.risk_if_no,
      riskIfNo: q.risk_if_no,
      weight: q.weight ?? 6,
      isReverse: q.isReverse ?? false,
      isFollowUp: true,
      parentId: parentQuestionId,
      pillar: pillarName,
      exposureEstimate: expEstimate,
      options: normaliseOptions(q.options),
      insight: normaliseInsight(q.insight, q.risk_if_no),
    };
  }

  const timeoutPromise = new Promise<AssessmentQuestion | null>((resolve) =>
    setTimeout(() => {
      logger.warn({ pillarName, parentQuestionId, followUpCount }, "Follow-up question timed out — skipping");
      resolve(null);
    }, FOLLOWUP_TIMEOUT_MS)
  );

  try {
    return await Promise.race([tryParse(), timeoutPromise]);
  } catch (err) {
    logger.warn({ err }, "Follow-up engine failed, skipping follow-up");
    return null;
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

3. TOP 3 RISK FLAGS — For each, provide ALL of the following, specific to this business (not generic boilerplate):
   - title (plain language, max 6 words)
   - gap (what safeguard is missing)
   - consequence with specific law/authority
   - reason (why this gap exists / why it was flagged, referencing their answer pattern)
   - business_impact (concrete operational/financial impact on THIS business if unresolved)
   - future_problem (what could escalate into if left unresolved for 6-12 months)
   - recommendation (one specific, doable fix)
   - estimated ₹ exposure
   - urgency (Immediate / 30 Days / 90 Days)

3B. FUTURE RISK EXPOSURE — 3 forward-looking risks this specific business could face in the next 12-24 months based on their answer pattern, business type, and sector (e.g. DPDP Act data-privacy obligations, trademark/IP exposure, personal guarantee liability, labour law changes, GST scrutiny, sector-specific regulatory shifts). For each, provide:
   - title (plain language, max 6 words)
   - level (HIGH / MEDIUM / LOW)
   - impact (possible future impact on the business if this risk materialises)
   - reason (why this business specifically is exposed, based on their profile/answers)
   - action (recommended action to take now to reduce this future risk)

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
    { "rank": 1, "title": "risk title", "gap": "...", "consequence": "...", "law_reference": "specific act or null", "reason": "why this was flagged for this business", "business_impact": "concrete impact on this business", "future_problem": "what this escalates to if unresolved", "recommendation": "specific fix", "exposure": "₹X – ₹Y", "urgency": "Immediate" },
    { "rank": 2, "title": "...", "gap": "...", "consequence": "...", "law_reference": "...", "reason": "...", "business_impact": "...", "future_problem": "...", "recommendation": "...", "exposure": "...", "urgency": "30 Days" },
    { "rank": 3, "title": "...", "gap": "...", "consequence": "...", "law_reference": "...", "reason": "...", "business_impact": "...", "future_problem": "...", "recommendation": "...", "exposure": "...", "urgency": "90 Days" }
  ],
  "future_risks": [
    { "title": "future risk title", "level": "HIGH", "impact": "possible future impact on this business", "reason": "why this business is exposed", "action": "recommended action now" },
    { "title": "...", "level": "MEDIUM", "impact": "...", "reason": "...", "action": "..." },
    { "title": "...", "level": "LOW", "impact": "...", "reason": "...", "action": "..." }
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
      {
        title: "Critical Legal Gap",
        description: `Your ${payload.businessType} has significant gaps that expose it to financial risk. Without proper contracts and compliance, a single dispute could cost ₹5–20 Lakhs. Immediate action is recommended.`,
        severity: "HIGH",
        financialRisk: "₹5–20 Lakhs potential exposure",
        reason: "Your answers show key safeguards — written contracts and compliance filings — are missing or incomplete across the business.",
        businessImpact: "A single vendor or customer dispute could result in an unenforceable claim, direct financial loss, and weeks of management time diverted to firefighting.",
        futureProblem: "If left unresolved, repeated informal dealings compound the exposure — each new relationship without a contract adds to the total risk carried by the business.",
        recommendation: "Prioritise signed agreements for your top 3 highest-value relationships this month.",
      },
      {
        title: "Compliance Risk",
        description: "Several regulatory areas need immediate attention to avoid penalties and business disruption.",
        severity: "MEDIUM",
        financialRisk: "₹2–10 Lakhs potential exposure",
        reason: "Statutory filings and licence renewals were flagged as inconsistent or overdue in your assessment.",
        businessImpact: "Regulators can levy penalties, freeze accounts, or suspend licences for lapsed filings, directly disrupting day-to-day operations.",
        futureProblem: "Unresolved compliance gaps tend to surface during audits, funding rounds, or expansion — at the worst possible time to fix them.",
        recommendation: "Run a compliance checklist against GST, MCA21, and sector-specific licences this quarter.",
      },
      {
        title: "Contractual Gaps",
        description: "Written agreements are missing or incomplete for key business relationships, creating unenforceable positions.",
        severity: "LOW",
        financialRisk: "₹1–5 Lakhs potential exposure",
        reason: "Some business relationships rely on verbal understanding rather than documented terms.",
        businessImpact: "Without written terms, recovering dues or enforcing obligations in a dispute becomes significantly harder and slower.",
        futureProblem: "As the business scales, more relationships without contracts multiply this risk across a larger base of vendors, employees, or customers.",
        recommendation: "Introduce a standard agreement template for all new relationships going forward.",
      },
    ],
    futureRisks: [
      {
        title: "Data Privacy (DPDP Act) Exposure",
        level: "MEDIUM",
        impact: "Non-compliance with the Digital Personal Data Protection Act can result in penalties of up to ₹250 crore for serious data breaches or mishandling of customer data.",
        reason: `As a ${payload.businessType}, you likely collect customer or employee personal data without a formal consent and data-handling policy in place.`,
        action: "Draft a basic data privacy policy and consent mechanism before the DPDP Act's enforcement provisions take full effect.",
      },
      {
        title: "Trademark & Brand Exposure",
        level: "MEDIUM",
        impact: "Operating without a registered trademark risks losing your brand name to a competitor or facing a costly rebrand if challenged.",
        reason: "Many businesses at your stage delay trademark registration, leaving the brand name and logo legally unprotected.",
        action: "File a trademark application for your business name and logo within the next quarter.",
      },
      {
        title: "Personal Guarantee Liability",
        level: "LOW",
        impact: "Personal guarantees on business loans or leases can expose the owner's personal assets if the business defaults.",
        reason: "Growing businesses frequently take on loans or lease agreements that include personal guarantee clauses without full awareness of the exposure.",
        action: "Review all existing loan and lease agreements for personal guarantee clauses and negotiate caps where possible.",
      },
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
    risk_flags?: Array<{
      title: string;
      gap: string;
      consequence: string;
      law_reference?: string;
      reason?: string;
      business_impact?: string;
      future_problem?: string;
      recommendation?: string;
      exposure: string;
      urgency: string;
    }>;
    future_risks?: Array<{
      title: string;
      level?: string;
      impact: string;
      reason: string;
      action: string;
    }>;
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
        reason: f.reason || fallback.insights[i]?.reason || f.gap,
        businessImpact: f.business_impact || fallback.insights[i]?.businessImpact || f.consequence,
        futureProblem: f.future_problem || fallback.insights[i]?.futureProblem || "If left unresolved, this gap compounds over time and increases overall legal exposure.",
        recommendation: f.recommendation || fallback.insights[i]?.recommendation || "Consult a lawyer to close this gap.",
      })),
      futureRisks: (raw.future_risks ?? []).slice(0, 3).map((r, i) => ({
        title: r.title,
        level: (["HIGH", "MEDIUM", "LOW"].includes((r.level ?? "").toUpperCase()) ? (r.level ?? "").toUpperCase() : fallback.futureRisks[i]?.level ?? "MEDIUM") as "HIGH" | "MEDIUM" | "LOW",
        impact: r.impact || fallback.futureRisks[i]?.impact || "",
        reason: r.reason || fallback.futureRisks[i]?.reason || "",
        action: r.action || fallback.futureRisks[i]?.action || "",
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
    const pillars = await generateSeedQuestionsForAssessment(`legacy:${businessType}|${city}`, "your business", businessType, "Private Limited / LLP", "11-50", "2-5 years", businessType, city);
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
