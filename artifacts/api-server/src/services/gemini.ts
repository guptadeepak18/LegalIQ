import { GoogleGenAI } from "@google/genai";
import { resolveBusinessProfile, type ResolvedProfile, type Topic, type PillarId, type OptKey } from "./businessProfiles.js";
import { logger } from "../lib/logger.js";
import {
  selectCaseStudies,
  type SimilarCaseStudy,
} from "../data/caseStudies.js";

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-pro",
] as const;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? "";
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  if (baseUrl) {
    return new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: "", baseUrl },
    });
  }
  return new GoogleGenAI({ apiKey });
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
  subCategory?: string;
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
    priority: "Immediate" | "Short-Term" | "Long-Term";
    costMin: string;
    costMax: string;
    delayImpact: string;
    link: { url: string; label: string } | null;
  }>;
  costSummary: Array<{
    issue: string;
    costRange: string;
    delayImpact: string;
  }>;
  similarCases: SimilarCaseStudy[];
  example: {
    businessName: string;
    whatHappened: string;
    consequences: string;
    vcloWouldHave: string;
    lesson: string;
  };
  vcloPitch: string;
}

/** Preserve the complete assessment response as matching evidence. The case
 * catalog does its own deterministic taxonomy/threshold matching; no AI text
 * is used to invent or broaden a case-study match. */
function caseMatchingAnswers(answersJSON?: string): string {
  if (!answersJSON) return "";
  try {
    const parsed: unknown = JSON.parse(answersJSON);
    return JSON.stringify(parsed);
  } catch {
    // Older callers may send a non-JSON answer summary. It remains useful
    // evidence, but cannot change the deterministic catalog or add a fallback.
    return answersJSON;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core caller — tries each model in order, falls through on 429
// ─────────────────────────────────────────────────────────────────────────────

async function callGemini(
  prompt: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) {
    const groqModels = [
      process.env.GROQ_MODEL,
      "openai/gpt-oss-120b",
      "llama-3.3-70b-versatile",
      "qwen/qwen3.8-27b",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-20b",
    ].filter(Boolean) as string[];
    const groqRequest = (model: string) => fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    });
    for (const model of groqModels) {
      try {
        let res = await groqRequest(model);
        // Rate-limited with a short retry window: wait once rather than moving
        // to the next model, which usually shares the same org-level limit.
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after"));
          if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 8) {
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            res = await groqRequest(model);
          }
        }
        if (res.ok) {
          const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const raw = data.choices?.[0]?.message?.content ?? "";
          logger.info({ model }, "Groq AI call succeeded");
          return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        }
        logger.warn({ status: res.status, model }, "Groq model failed, trying next");
      } catch (groqErr) {
        logger.warn({ err: groqErr, model }, "Groq error, trying next");
      }
    }
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (openRouterApiKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openRouterApiKey}`,
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages: [{ role: "user", content: prompt }],
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const raw = data.choices?.[0]?.message?.content ?? "";
        logger.info("OpenRouter AI call succeeded");
        return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      }
      logger.warn({ status: res.status }, "OpenRouter call failed, falling through to Gemini");
    } catch (orErr) {
      logger.warn({ err: orErr }, "OpenRouter error, falling through to Gemini");
    }
  }

  const ai = getAiClient();
  let lastError: Error = new Error("No models available");

  for (const model of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature,
          // gemini-2.5-* "thinking" eats into maxOutputTokens and truncates
          // JSON, so it is capped there (2.5-pro needs a minimum budget).
          // Newer models reject thinkingBudget:0 with 400 INVALID_ARGUMENT, so
          // leave thinking on their defaults and give them output headroom.
          ...(model.startsWith("gemini-2.5")
            ? { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: model === "gemini-2.5-pro" ? 128 : 0 } }
            : { maxOutputTokens: maxTokens * 2 }),
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
      logger.warn({ model, err: msg }, "Gemini model attempt failed, trying next");
      continue;
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 1 — Seed Question Generator
// Generates 5 questions per pillar (20 total across 4 pillars) at session start
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

const PILLAR_FILL_GUIDANCE: Record<PillarName, string> = {
  "Litigation Health": "Think: pending cases, notices from specific regulators, customer or counterparty claims, cheque-bounce (Section 138) matters, employee disputes.",
  "Contractual Health": "Think: the specific counterparties listed above — lease, platform terms, staff or consultant contracts, supplier and customer terms.",
  "Compliance Health": "Think: other licences or registrations above, statutory registers and returns, labour compliance (PF/ESIC/minimum wages), state-specific rules.",
  "Legal Cost Efficiency": "Think: penalties or settlements already paid, insurance gaps, reactive vs preventive legal spend, money stuck in disputes or unclaimed statutory interest (MSMED Act), personal guarantees given by the owner.",
};

function formatTopicsForPrompt(topics: Topic[]): string {
  return topics
    .map((tp, i) => `  ${i + 1}. ${tp.topic} — legal basis: ${tp.law}. Reference question (rephrase it to fit, don't copy it word for word): "${tp.q}"`)
    .join("\n");
}

function buildSeedPrompt(
  companyName: string,
  profile: ResolvedProfile,
  state: string,
  onlyPillarId?: number
): string {
  const targetPillar = onlyPillarId ? PILLAR_META.find((p) => p.id === onlyPillarId) : undefined;
  const pillarIds = (targetPillar ? [targetPillar.id] : [1, 2, 3, 4]) as PillarId[];
  const scopeInstruction = targetPillar
    ? `YOUR TASK (THIS CALL): Generate exactly 5 questions for ONLY PILLAR ${targetPillar.id} — "${targetPillar.name}". The other pillars are generated separately. Return only that one pillar's JSON object.`
    : `YOUR TASK: Generate exactly 5 questions per pillar (20 total across 4 pillars).`;

  const mustCover = pillarIds.map((id) => {
    const meta = PILLAR_META.find((p) => p.id === id)!;
    const topics = profile.topicsByPillar[id];
    const remaining = 5 - topics.length;
    return `PILLAR ${id} — ${meta.name.toUpperCase()}: ${PILLAR_DEFINITIONS[meta.name]}
MUST-COVER TOPICS for a ${profile.subCategory} (write one question per topic, in this order):
${formatTopicsForPrompt(topics)}${remaining > 0 ? `
  + ${remaining} more question(s) on other ${meta.name} risks that are COMMON and SPECIFIC to a ${profile.subCategory} in ${state}. ${PILLAR_FILL_GUIDANCE[meta.name]}` : ""}`;
  }).join("\n\n");

  // Pillars are generated in separate calls, so tell each call what the others cover.
  const otherTopics = ([1, 2, 3, 4] as PillarId[])
    .filter((id) => !pillarIds.includes(id))
    .flatMap((id) => profile.topicsByPillar[id].map((tp) => tp.topic));
  const exclusion = otherTopics.length
    ? `\nALREADY COVERED IN OTHER PILLARS — do NOT ask about these again, even in different words: ${otherTopics.join("; ")}.\n`
    : "";

  return `
You are a senior Indian legal risk advisor with 20 years of experience advising
MSMEs, startups, and SMEs across India. You know the day-to-day legal realities
of a ${profile.subCategory} — its regulators, inspections, licences, typical
contracts, and the disputes that actually hit businesses like it.

You are writing the questions for a legal health assessment of ONE specific business.

BUSINESS PROFILE:
- Business name: ${companyName}
- Industry category: ${profile.category}
- Business type (sub-category): ${profile.subCategory}
- Location (city / state): ${state}
- Size, age, and legal structure: not collected — do not assume them. Where a rule depends on size or turnover, build the threshold into the answer options.

WHAT IS SPECIFIC TO A ${profile.subCategory.toUpperCase()}:
- Regulators and inspectors: ${profile.regulators.join("; ")}
- Licences and registrations: ${profile.licences.join("; ")}
- Key counterparties and contracts: ${profile.counterparties.join("; ")}
- Disputes this kind of business commonly faces: ${profile.disputes.join("; ")}

${scopeInstruction}

${mustCover}
${exclusion}
SPECIFICITY RULES (most important — a question that fails these is wrong):
1. Every question must name at least one concrete thing specific to a ${profile.subCategory}: a regulator, licence, register, form, platform, counterparty, document, or law from the lists above. A question that would make sense for ANY business is not allowed.
2. BANNED generic questions (and close variants): "Do you have a lawyer you can call?", "Has your business received any legal notice?", "Do you have written agreements with vendors?", "Are your licences up to date?", "Do you file GST on time?", "Do you have insurance?". Replace them with the specific version, e.g. "Is your FSSAI State licence valid for your current turnover?" instead of "Are your licences up to date?".
3. Use the words a ${profile.subCategory} owner actually uses (e.g. "Swiggy payout", "Drug Inspector", "H1 register", "RERA escrow", "jangad memo", "job card"). Write at a Class 10 reading level, with at most 22 words per question.
4. Where state rules differ, use the rule for ${state} if you know it confidently; otherwise phrase the question so it applies across states.
5. Use "${companyName}" in at most 1 or 2 questions per pillar, where it reads naturally.
6. The 5 questions within a pillar must each cover a different risk — no overlap.
7. Do not invent laws, section numbers, or penalty amounts. If you are not sure of a figure, describe the consequence without a number.

OPTIONS RULES (every question):
- Keep each option label under 12 words. Offer "Not applicable" only if the question is conditional (e.g. "if you sell supplements").
- 3 to 4 answer options written for THAT question, like real answers from an owner (never a generic Yes/No/Not sure set). Example for "Do your Swiggy/Zomato terms say when they can delist you?": "Yes, I've read and saved them", "I've seen them but not read closely", "No, I just accepted in the app", "Not sure where to find them".
- Each option has a "score" from 0 to 4 (4 = fully protected, 0 = high risk). Include one honest "not sure" style option, scored 1.
- Every question also has an "insight" object written for THIS question and a ${profile.subCategory}:
  - info: 1-2 plain sentences on why this matters for a ${profile.subCategory}
  - impact: the concrete financial or operational consequence
  - suggestion: one practical step the owner can take this week
  - recommendation: what to put in place, and who should do it (CA, lawyer, consultant)
  - example: 2-3 sentences describing a realistic situation at a similar ${profile.subCategory} in India (do not name real people or businesses)

${targetPillar ? `OUTPUT — return only this JSON, no explanations, no markdown (ONE pillar object, not wrapped in a "pillars" array):
{
  "id": ${targetPillar.id},
  "name": "${targetPillar.name}",
  "icon": "${targetPillar.icon}",
  "questions": [
    {
      "id": "p${targetPillar.id}_q1",
      "text": "question text, max 22 words",
      "context": "one-line hint shown under the question, specific to a ${profile.subCategory}",
      "risk_if_no": "exact financial or legal consequence if this is a gap",
      "law_reference": "specific Indian law, rule, or authority",
      "weight": 9,
      "exposure_low": 50000,
      "exposure_high": 500000,
      "options": [
        { "value": "A", "label": "tailored answer", "sublabel": "optional helper text", "score": 4 },
        { "value": "B", "label": "tailored answer", "score": 2 },
        { "value": "C", "label": "tailored answer", "score": 0 },
        { "value": "D", "label": "tailored 'not sure' answer", "score": 1 }
      ],
      "insight": { "info": "...", "impact": "...", "suggestion": "...", "recommendation": "...", "example": "..." }
    }
    /* … same shape for "p${targetPillar.id}_q2" through "p${targetPillar.id}_q5"; weight 5-10 reflects severity … */
  ]
}` : `OUTPUT — return only this JSON, no explanations, no markdown:
{
  "pillars": [
    { "id": 1, "name": "Litigation Health", "icon": "⚖️", "questions": [ /* 5 questions, shape: id "p1_q1".., text, context, risk_if_no, law_reference, weight, exposure_low, exposure_high, options[], insight{} */ ] },
    { "id": 2, "name": "Contractual Health", "icon": "📄", "questions": [ ... ] },
    { "id": 3, "name": "Compliance Health", "icon": "✅", "questions": [ ... ] },
    { "id": 4, "name": "Legal Cost Efficiency", "icon": "💼", "questions": [ ... ] }
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

// ─── Business-specific static fallback ───────────────────────────────────────
// Used when the AI is slow or unavailable. Built from the resolved business
// profile, so a pharmacy still gets Drug Licence / H1-register questions and a
// cloud kitchen still gets FSSAI / aggregator questions. Generic STATIC_SEED
// questions are only used to fill a pillar if the profile has fewer than 5 topics.
const OPTS_LICENCE: AnswerOption[] = [
  { value: "A", label: "Yes, valid and I have the certificate", score: 4 },
  { value: "B", label: "Applied for / renewal is in progress", score: 2 },
  { value: "C", label: "No, or it has expired", score: 0 },
  { value: "D", label: "Not sure whether we need it", score: 1 },
];
const OPTS_FILING: AnswerOption[] = [
  { value: "A", label: "Yes, always on time", score: 4 },
  { value: "B", label: "Usually, with occasional delays", score: 2 },
  { value: "C", label: "No, we are behind", score: 0 },
  { value: "D", label: "Not sure — my CA handles it", score: 1 },
];
const OPTS_PRACTICE: AnswerOption[] = [
  { value: "A", label: "Yes, consistently and documented", score: 4 },
  { value: "B", label: "Sometimes, but not every time", score: 2 },
  { value: "C", label: "No, we don't do this", score: 0 },
  { value: "D", label: "Not sure", score: 1 },
];
const OPTS_COVER: AnswerOption[] = [
  { value: "A", label: "Yes, with adequate cover", score: 4 },
  { value: "B", label: "We have a policy, but it may not cover this", score: 2 },
  { value: "C", label: "No cover for this", score: 0 },
  { value: "D", label: "Not sure what our policy covers", score: 1 },
];
const OPT_SETS: Record<OptKey, AnswerOption[]> = {
  HAVE: OPTS_HAVE, LICENCE: OPTS_LICENCE, FILING: OPTS_FILING, PRACTICE: OPTS_PRACTICE,
  COVER: OPTS_COVER, DISPUTE: OPTS_DISPUTE, SPEND: OPTS_SPEND,
};

function topicToQuestion(tp: Topic, idx: number, pillar: AssessmentPillar, profile: ResolvedProfile): AssessmentQuestion {
  const reverse = tp.opts === "DISPUTE" || tp.opts === "SPEND";
  return {
    id: `p${pillar.id}_q${idx + 1}`,
    text: tp.q,
    hint: tp.hint,
    riskIfNo: tp.risk,
    weight: Math.max(6, 10 - idx),
    isReverse: reverse,
    isFollowUp: false,
    pillar: pillar.name,
    options: OPT_SETS[tp.opts],
    insight: mkInsight(
      `${tp.hint} For a ${profile.noun}, this falls under ${tp.law}.`,
      tp.risk,
      `Check where your ${profile.noun} stands on "${tp.topic.toLowerCase()}" this week and write down any gaps.`,
      `Have a lawyer or CA who knows ${tp.law} review this and set up a simple tracker so it doesn't lapse.`,
      `Many ${profile.noun} owners in India find out about this gap only after an inspection, complaint, or claim forces the issue — fixing it beforehand is much cheaper.`,
    ),
  };
}

export function buildFallbackPillar(profile: ResolvedProfile, pillarId: PillarId): AssessmentPillar {
  const base = STATIC_SEED_PILLARS[pillarId - 1]!;
  const specific = profile.topicsByPillar[pillarId].map((tp, i) => topicToQuestion(tp, i, base, profile));
  const fillers = base.questions.slice(0, Math.max(0, 5 - specific.length)).map((q, i) => ({
    ...q,
    id: `p${base.id}_q${specific.length + i + 1}`,
  }));
  return { ...base, questions: [...specific, ...fillers] };
}

export function buildFallbackPillars(category: string, subCategory: string): AssessmentPillar[] {
  const profile = resolveBusinessProfile(category, subCategory);
  return ([1, 2, 3, 4] as PillarId[]).map((id) => buildFallbackPillar(profile, id));
}

// ─── In-memory cache keyed per-lead so every business gets its own
// dynamically generated questions. The TTL only exists so a page refresh /
// retry within the same session reuses the same AI-generated set.
const seedCache = new Map<string, { pillars: AssessmentPillar[]; ts: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
// Pre-warm (on lead creation) and session start can request the same lead at
// once — share one in-flight generation instead of paying for two.
const seedInflight = new Map<string, Promise<AssessmentPillar[]>>();

export function clearSeedCache(leadId?: string) {
  if (leadId) {
    seedCache.delete(leadId);
  } else {
    seedCache.clear();
  }
}

/** Exposed for tests / tooling: the exact prompt used for one pillar. */
export function buildSeedPromptFor(companyName: string, category: string, subCategory: string, state: string, pillarId: number): string {
  return buildSeedPrompt(companyName, resolveBusinessProfile(category, subCategory), state, pillarId);
}

export function generateSeedQuestionsForAssessment(
  leadId: string,
  companyName: string,
  category: string,
  subCategory: string,
  state: string
): Promise<AssessmentPillar[]> {
  const existing = seedInflight.get(leadId);
  if (existing) return existing;
  const p = generateSeedQuestionsUncached(leadId, companyName, category, subCategory, state)
    .finally(() => seedInflight.delete(leadId));
  seedInflight.set(leadId, p);
  return p;
}

async function generateSeedQuestionsUncached(
  leadId: string,
  companyName: string,
  category: string,
  subCategory: string,
  state: string
): Promise<AssessmentPillar[]> {
  const cacheKey = leadId;
  const cached = seedCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    logger.info({ cacheKey }, "Seed questions: cache hit");
    return cached.pillars;
  }

  const profile = resolveBusinessProfile(category, subCategory);

  function parsePillar(pIdx: number, p: SeedPillarRaw): AssessmentPillar {
    const meta = PILLAR_META[pIdx]!;
    const pillarName = meta.name;
    return {
      id: meta.id,
      name: pillarName,
      icon: p.icon ?? STATIC_SEED_PILLARS[pIdx]!.icon,
      definition: PILLAR_DEFINITIONS[pillarName] ?? "",
      questions: (p.questions ?? [])
        .filter((q) => typeof q?.text === "string" && q.text.trim().length > 0)
        .slice(0, 5)
        .map((q, qIdx) => {
          const expEstimate = q.exposure_estimate
            ?? (q.exposure_low != null && q.exposure_high != null
              ? `₹${q.exposure_low.toLocaleString("en-IN")} – ₹${q.exposure_high.toLocaleString("en-IN")}`
              : undefined);
          return {
            id: `p${meta.id}_q${qIdx + 1}`,
            text: q.text.trim(),
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

  // One focused call per pillar, run concurrently (a single 20-question call
  // routinely exceeded request timeouts).
  async function generateOnePillar(pillarMeta: { id: number; name: PillarName; icon: string }): Promise<AssessmentPillar> {
    const prompt = buildSeedPrompt(companyName || "your business", profile, state, pillarMeta.id);

    async function tryParse(): Promise<AssessmentPillar> {
      const raw = await callGemini(prompt, 5000, 0.3);
      const parsed = JSON.parse(raw) as SeedPillarRaw;
      const pillar = parsePillar(pillarMeta.id - 1, parsed);
      if (pillar.questions.length < 5) {
        throw new Error(`Pillar "${pillarMeta.name}" has only ${pillar.questions.length} questions, expected 5`);
      }
      return pillar;
    }

    try {
      return await tryParse();
    } catch (err) {
      logger.error({ err, pillar: pillarMeta.name }, "Pillar seed generation failed, retrying once");
      return await tryParse();
    }
  }

  // A failed pillar falls back to its business-specific static set, without
  // throwing away the pillars that the AI did generate.
  const results = await Promise.allSettled(PILLAR_META.map((meta) => generateOnePillar(meta)));
  let aiCount = 0;
  const pillars = results.map((r, i) => {
    if (r.status === "fulfilled") { aiCount++; return r.value; }
    logger.error({ err: r.reason, pillar: PILLAR_META[i]!.name }, "Using business-specific static fallback for pillar");
    return buildFallbackPillar(profile, (i + 1) as PillarId);
  });

  if (aiCount === PILLAR_META.length) {
    seedCache.set(cacheKey, { pillars, ts: Date.now() });
    logger.info({ cacheKey, subCategory: profile.subCategory }, "Seed questions: AI generated and cached");
  } else {
    logger.warn({ cacheKey, aiCount, subCategory: profile.subCategory }, "Seed questions: partial AI generation, not cached");
  }
  return pillars;
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

4. ACTION PLAN — Up to 6 prioritised actions distributed across 3 tiers: Immediate (This Week), Short-Term (This Month), Long-Term (This Quarter). For each action provide: priority tier, timeline, a specific action title, cost_min and cost_max in ₹ (realistic Indian market ranges), delay_impact (what happens financially or operationally if this is delayed 3–6 months), and a link object with a url (use official Indian government portals such as mca.gov.in, gst.gov.in, labour.gov.in, ipindia.gov.in, indiankanoon.org, or restthecase.com service pages) and a label for the link.

8. COST SUMMARY — 3–4 rows summarising the resolution cost of the most critical legal issues identified. For each, provide: issue (plain-language name of the legal gap), cost_range (e.g. "₹5,000 – ₹25,000"), and delay_impact (financial or operational consequence of delaying resolution).

9. SIMILAR CASES — Do not generate case names, case facts, outcomes, or source URLs. The application selects verified public cases from a curated catalog after this response, using the risk flags and business profile.

5. CONSULTATION NOTE — 1–2 sentences, specific to their risk profile.

6. BUSINESS EXAMPLE — A real-sounding Indian company story (plausible, not sensitive):
   businessName, whatHappened (2-3 sentences), consequences (₹ amount + time), vcloWouldHave (how Rest The Case VCLO prevented it), lesson (one punchy takeaway).

7. VCLO PITCH — One compelling, professional paragraph (4–5 sentences) addressed to ${payload.company}, a ${payload.businessType} in ${payload.city}. Reference: their score (${payload.total}/100) and risk level, their two lowest-scoring pillars, the single highest-priority risk flag from section 3, and how a dedicated Rest The Case VCLO (Virtual Chief Legal Officer) specifically addresses those gaps for a business of this type and stage. Tone: confident, consultative, and factual — no fear-based language, no fabricated statistics. End with a clear reason to act now.

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
    { "step": 1, "priority": "Immediate", "timeline": "This Week",    "action": "...", "cost_min": "₹0",      "cost_max": "₹X,000", "delay_impact": "...", "link": { "url": "https://...", "label": "..." } },
    { "step": 2, "priority": "Immediate", "timeline": "This Week",    "action": "...", "cost_min": "₹X,000",  "cost_max": "₹Y,000", "delay_impact": "...", "link": { "url": "https://...", "label": "..." } },
    { "step": 3, "priority": "Short-Term","timeline": "This Month",   "action": "...", "cost_min": "₹X,000",  "cost_max": "₹Y,000", "delay_impact": "...", "link": { "url": "https://...", "label": "..." } },
    { "step": 4, "priority": "Short-Term","timeline": "This Month",   "action": "...", "cost_min": "₹X,000",  "cost_max": "₹Y,000", "delay_impact": "...", "link": { "url": "https://...", "label": "..." } },
    { "step": 5, "priority": "Long-Term", "timeline": "This Quarter", "action": "...", "cost_min": "₹X,000",  "cost_max": "₹Y,000", "delay_impact": "...", "link": { "url": "https://...", "label": "..." } },
    { "step": 6, "priority": "Long-Term", "timeline": "This Quarter", "action": "...", "cost_min": "₹X,000",  "cost_max": "₹Y,000", "delay_impact": "...", "link": { "url": "https://...", "label": "..." } }
  ],
  "cost_summary": [
    { "issue": "...", "cost_range": "₹X,000 – ₹Y,000", "delay_impact": "..." },
    { "issue": "...", "cost_range": "₹X,000 – ₹Y,000", "delay_impact": "..." },
    { "issue": "...", "cost_range": "₹X,000 – ₹Y,000", "delay_impact": "..." }
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
  const fallbackRisks = [
    { title: "Critical Legal Gap", gap: "Missing written safeguards", consequence: "Commercial dispute exposure" },
    { title: "Compliance Risk", gap: "Incomplete licences or filings", consequence: "Regulatory notices and penalties" },
    { title: "Contractual Gaps", gap: "Informal business relationships", consequence: "Payment and enforcement disputes" },
  ];

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
      { action: "Audit all contracts and agreements", description: "List every vendor, employee, and client relationship and confirm each has a signed written agreement in place.", timeline: "THIS WEEK",  priority: "Immediate",  costMin: "₹0",      costMax: "₹5,000",  delayImpact: "Unwritten agreements remain unenforceable, increasing dispute liability.", link: { url: "https://www.restthecase.com", label: "Get Contract Review" } },
      { action: "File all pending statutory returns", description: "Check GST portal, MCA21, and Income Tax portal for any overdue returns or notices and file immediately.",                timeline: "THIS MONTH", priority: "Short-Term", costMin: "₹2,000",  costMax: "₹15,000", delayImpact: "Late filing penalties compound monthly and may trigger scrutiny.", link: { url: "https://www.gst.gov.in", label: "GST Portal" } },
      { action: "Engage a Virtual CLO on retainer",   description: "A Virtual CLO provides proactive legal coverage for your business at a fraction of in-house counsel costs.",            timeline: "90 DAYS",    priority: "Long-Term",  costMin: "₹4,999",  costMax: "₹9,999",  delayImpact: "Without ongoing legal oversight, risks accumulate across all four pillars.", link: { url: "https://www.restthecase.com/virtualCLOPackage", label: "View VCLO Plans" } },
    ],
    costSummary: [
      { issue: "Unwritten vendor/client agreements",   costRange: "₹0 – ₹5,000",    delayImpact: "Potential ₹2–12 Lakh dispute liability if contested without written proof." },
      { issue: "Statutory filing non-compliance",      costRange: "₹2,000 – ₹15,000", delayImpact: "Late fees and penalties compound monthly; may trigger regulatory notices." },
      { issue: "Intellectual property registration",  costRange: "₹5,000 – ₹20,000", delayImpact: "Unregistered IP is unprotected; loss of exclusive rights if a competitor files first." },
    ],
    similarCases: selectCaseStudies(payload.businessType, payload.category, fallbackRisks, caseMatchingAnswers(payload.answersJSON), payload.subCategory),
    example: {
      businessName: "Sunrise Enterprises",
      whatHappened: `A ${payload.businessType} in ${payload.city} faced a ₹12 Lakh demand from a vendor after a verbal agreement dispute. Without written contracts, they had no legal basis to defend their position and the case dragged on for 8 months.`,
      consequences: "Lost ₹12 Lakhs + 8 months of management attention disrupting operations.",
      vcloWouldHave: "A VCLO would have ensured all vendor agreements were documented and dispute resolution clauses were in place before work began.",
      lesson: "A written contract costs ₹5,000. A verbal agreement dispute costs ₹12 Lakhs.",
    },
    vcloPitch: `${payload.company} scored ${payload.total}/100 (${payload.risk} risk), with contracts and compliance flagged as the areas needing the most attention for a ${payload.businessType} at this stage. A Rest The Case VCLO gives you a dedicated attorney who reviews every contract before you sign, tracks your compliance calendar, and is available on demand — replacing ad hoc legal help with continuous, business-focused support. Plans start at ₹4,999/month, a predictable cost compared to per-matter legal fees. The sooner these gaps are addressed, the fewer of them compound into larger issues.`,
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
    action_plan?: Array<{
      action: string;
      timeline: string;
      priority?: string;
      cost_min?: string;
      cost_max?: string;
      delay_impact?: string;
      link?: { url: string; label: string } | null;
    }>;
    cost_summary?: Array<{ issue: string; cost_range: string; delay_impact: string }>;
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
      actions: (raw.action_plan ?? []).slice(0, 6).map((a) => {
        const tl = (
          a.timeline?.includes("Week")  || a.timeline?.includes("WEEK")  ? "THIS WEEK"  :
          a.timeline?.includes("Month") || a.timeline?.includes("MONTH") ? "THIS MONTH" :
          "90 DAYS"
        ) as "THIS WEEK" | "THIS MONTH" | "90 DAYS";
        const rawPriority = (a.priority ?? "").trim();
        const priority = (
          rawPriority.toLowerCase().includes("immediate") ? "Immediate" :
          rawPriority.toLowerCase().includes("short")     ? "Short-Term" :
          rawPriority.toLowerCase().includes("long")      ? "Long-Term" :
          tl === "THIS WEEK" ? "Immediate" : tl === "THIS MONTH" ? "Short-Term" : "Long-Term"
        ) as "Immediate" | "Short-Term" | "Long-Term";
        return {
          action: a.action,
          description: a.action,
          timeline: tl,
          priority,
          costMin:      a.cost_min      ?? "₹0",
          costMax:      a.cost_max      ?? "",
          delayImpact:  a.delay_impact  ?? "",
          link:         a.link?.url ? { url: a.link.url, label: a.link.label ?? "Learn More" } : null,
        };
      }),
      costSummary: (raw.cost_summary ?? []).slice(0, 4).map((c) => ({
        issue:       c.issue,
        costRange:   c.cost_range,
        delayImpact: c.delay_impact,
      })),
      similarCases: selectCaseStudies(payload.businessType, payload.category, raw.risk_flags ?? fallbackRisks, caseMatchingAnswers(payload.answersJSON), payload.subCategory),
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
    const pillars = await generateSeedQuestionsForAssessment(`legacy:${_category}|${businessType}|${city}`, "your business", _category, businessType, city);
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

