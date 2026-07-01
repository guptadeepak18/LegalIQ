export type Answer = "YES" | "NO" | "UNSURE";
export type ShowIfCond = Answer | "NOT_YES" | "NOT_NO";

export interface PillarQuestion {
  id: string;
  text: string;
  hint?: string;
  isReverse: boolean;
  pillar: string;
  showIf?: { qId: string; cond: ShowIfCond };
}

export interface PillarMeta {
  key: string;
  name: string;
  emoji: string;
  pillar: string;
}

export const PILLAR_META: PillarMeta[] = [
  { key: "p0", name: "Legal Notices",    emoji: "⚖️",  pillar: "Litigation Health" },
  { key: "p1", name: "Agreements",       emoji: "📋",  pillar: "Contractual Health" },
  { key: "p2", name: "Licences & Filings", emoji: "📄", pillar: "Compliance Health" },
  { key: "p3", name: "Costs & Insurance", emoji: "💰", pillar: "Legal Cost Efficiency" },
  { key: "p4", name: "Future Risks",     emoji: "🔮",  pillar: "Future Risk Exposure" },
];

// ─── Default follow-up questions (shared across all business types) ──────────
// These use showIf to only appear when relevant

const DEFAULT_FOLLOWUPS: Record<string, PillarQuestion[]> = {
  p0: [
    { id: "p0q2", pillar: "Litigation Health", isReverse: false, text: "Did you respond to that notice on time and get it closed properly?", hint: "An unanswered notice can automatically turn into a court case.", showIf: { qId: "p0q0", cond: "YES" } },
    { id: "p0q3", pillar: "Litigation Health", isReverse: true,  text: "Has your business ever had a serious dispute with a customer, supplier, or partner that was never officially settled?", showIf: { qId: "p0q1", cond: "NOT_YES" } },
    { id: "p0q4", pillar: "Litigation Health", isReverse: true,  text: "Is the issue that caused that notice still unresolved — or likely to happen again?", showIf: { qId: "p0q2", cond: "NOT_YES" } },
  ],
  p1: [
    { id: "p1q2", pillar: "Contractual Health", isReverse: true,  text: "Has anyone ever not paid, not delivered, or broken a deal — and you had nothing in writing to prove it?", showIf: { qId: "p1q0", cond: "NOT_YES" } },
    { id: "p1q3", pillar: "Contractual Health", isReverse: true,  text: "Has any employee, freelancer, or partner ever left and taken your customers, ideas, or business methods with them?", showIf: { qId: "p1q1", cond: "NOT_YES" } },
    { id: "p1q4", pillar: "Contractual Health", isReverse: false, text: "Have you since started getting agreements in writing, or is it still mostly verbal?", showIf: { qId: "p1q2", cond: "YES" } },
  ],
  p2: [
    { id: "p2q2", pillar: "Compliance Health", isReverse: false, text: "Have you checked with a CA or lawyer to find out exactly which licences your business is missing?", showIf: { qId: "p2q0", cond: "NOT_YES" } },
    { id: "p2q3", pillar: "Compliance Health", isReverse: true,  text: "Have you received any penalty or notice for late or missing filings in the last year?", showIf: { qId: "p2q1", cond: "NOT_YES" } },
    { id: "p2q4", pillar: "Compliance Health", isReverse: false, text: "Do you know the names of all licences and registrations your type of business is legally required to have?", showIf: { qId: "p2q2", cond: "NO" } },
  ],
  p3: [
    { id: "p3q2", pillar: "Legal Cost Efficiency", isReverse: false, text: "Was the root cause of that fine fixed properly — or does the same risk still exist in your business?", showIf: { qId: "p3q0", cond: "YES" } },
    { id: "p3q3", pillar: "Legal Cost Efficiency", isReverse: true,  text: "If a major legal dispute or accident happened tomorrow, could your business financially survive it without insurance?", showIf: { qId: "p3q1", cond: "NOT_YES" } },
    { id: "p3q4", pillar: "Legal Cost Efficiency", isReverse: true,  text: "Has the same type of fine or problem happened more than once at your business?", showIf: { qId: "p3q2", cond: "NOT_YES" } },
  ],
  p4: [
    { id: "p4q2", pillar: "Future Risk Exposure", isReverse: false, text: "Is this data stored safely, and do your customers or staff know how their information is used?", showIf: { qId: "p4q0", cond: "YES" } },
    { id: "p4q3", pillar: "Future Risk Exposure", isReverse: false, text: "If you have a business partner or co-founder — have you both signed a formal written agreement about what happens if one wants to exit?", showIf: { qId: "p4q1", cond: "NOT_YES" } },
    { id: "p4q4", pillar: "Future Risk Exposure", isReverse: false, text: "Have you even looked at India's new data protection law (DPDP Act 2023) to understand what it means for your business?", showIf: { qId: "p4q2", cond: "NOT_YES" } },
  ],
};

// ─── Default base questions (Q0 + Q1 per pillar) ─────────────────────────────
const DEFAULT_BASE: Record<string, [string, string | undefined, string, string | undefined]> = {
  // p0: [q0text, q0hint, q1text, q1hint]
  p0: [
    "Has any government department or court ever sent your business an official notice, warning, or summons?",
    "Includes tax notices, municipal warnings, or any court paperwork.",
    "Do you have a trusted lawyer or legal advisor you can call today if any problem comes up?",
    "Not someone you'd search for — someone already familiar with your business.",
  ],
  p1: [
    "Do you have written, signed agreements with your main clients, suppliers, and service providers?",
    "A written agreement is your only real protection if someone breaks a promise.",
    "When someone works for your business — employee or freelancer — do they sign an agreement saying their work belongs to you?",
    "Without this, your designs, code, or methods may legally belong to them.",
  ],
  p2: [
    "Is your business properly registered — GST, company/firm registration, and any licence your type of work requires?",
    "The right licences depend on your business type and location.",
    "Do you file all your government returns on time — like GST, income tax, TDS, and annual filings?",
    "Late filings attract compounding penalties and can even disqualify company directors.",
  ],
  p3: [
    "In the last 2 years, has your business paid any fine, penalty, or compensation to a government body, court, or in a private settlement?",
    "Includes even small penalties like late filing fees or small consumer refunds.",
    "Does your business have insurance covering legal claims, accidents, fire, theft, or damage?",
    "Without insurance, one serious incident can cost years of profit.",
  ],
  p4: [
    "Does your business collect personal details of customers or staff — like phone numbers, emails, IDs, or payment information?",
    "Collecting this data creates legal responsibilities under India's new data protection law.",
    "If a key person — owner, partner, or senior manager — suddenly left or became unavailable, is there a written plan for what happens to the business?",
    "This includes succession plans, buy-sell agreements, or documented handover procedures.",
  ],
};

// ─── Business-type overrides (q0text, q0hint?, q1text, q1hint?) per pillar ──
type BaseOverride = Partial<Record<string, [string, string | undefined, string, string | undefined]>>;
const OVERRIDES: Record<string, BaseOverride> = {

  "Cloud Kitchen": {
    p0: ["Has FSSAI, your city's municipal office, or a delivery app like Swiggy or Zomato ever sent your kitchen an official warning or notice?", undefined, "Do you have a food or restaurant lawyer you can reach quickly if FSSAI or the municipal office comes knocking?", undefined],
    p1: ["Do you have a written agreement with Swiggy, Zomato, or Blinkit that clearly says what they can deduct and when they can remove your listing?", undefined, "Do your kitchen staff and helpers sign a written agreement before starting work with you?", undefined],
    p2: ["Does your kitchen have a valid FSSAI food licence, health certificate from your city, and GST registration?", undefined, "Do you file your GST returns on time and maintain the hygiene records that FSSAI inspectors check during visits?", undefined],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have insurance that covers you if a customer falls ill from your food or your kitchen equipment breaks down?", undefined],
  },

  "Restaurant": {
    p0: ["Has FSSAI, your city's health inspector, fire department, or a consumer forum ever sent your restaurant a notice or warning?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do you have a written agreement with every delivery app you're listed on — covering commission rates, penalties, and what happens if they delist you?", undefined, "Do your chefs and key staff members sign written contracts before joining?", undefined],
    p2: ["Does your restaurant have all required licences — FSSAI, Fire NOC, Eating House Licence, GST, and Shop & Establishment registration?", undefined, "Do you file GST returns on time and maintain the food safety records that FSSAI asks for during inspections?", undefined],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have insurance covering food illness claims from customers, accidents to staff, and equipment damage?", undefined],
  },

  "Kirana Shop": {
    p0: ["Has FSSAI, your municipal body, or the Weights & Measures department ever visited and issued your shop a warning or notice?", undefined, "Do you have a lawyer or CA you can call if a government inspector creates a problem for your shop?", undefined],
    p1: ["Do you have written credit terms with your main FMCG distributors and suppliers — in writing, not just spoken agreements?", "Verbal credit arrangements are the #1 cause of supplier disputes for small shops.", "If you have any helpers or delivery boys working for you, do they sign any written agreement?", undefined],
    p2: ["Does your shop have a valid FSSAI licence (not just registration), GST registration, and a current Shop & Establishment certificate?", undefined, DEFAULT_BASE.p2[2]!, DEFAULT_BASE.p2[3]],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have any insurance covering your shop against fire, theft, or damage to your stock?", undefined],
  },

  "Pharmacy": {
    p0: ["Has a Drug Inspector, CDSCO officer, or any health authority ever issued your pharmacy a notice or found violations during an inspection?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do you have written agreements with your medicine distributors covering return policies, expiry handling, and payment terms?", undefined, "If you employ a pharmacist or assistant, do they sign a written employment agreement before starting work?", undefined],
    p2: ["Does your pharmacy have a current Drug Licence (Forms 20 & 21), valid Pharmacist registration, and GST registration?", undefined, "Do you maintain all records the Drug Inspector checks — Schedule H/H1 registers, purchase invoices, and cold storage temperature logs?", undefined],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have professional indemnity insurance covering your pharmacy if a patient is harmed by a dispensing error?", undefined],
  },

  "Clinic": {
    p0: ["Has the State Medical Council, NMC, or Clinical Establishment Authority ever sent your clinic a formal notice or show-cause?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do patients sign a written consent form before any procedure, test, or treatment at your clinic?", "Absence of consent is the most common ground for medical negligence suits in India.", "Do your nurses, technicians, and admin staff sign written employment contracts covering their duties and confidentiality?", undefined],
    p2: ["Is your clinic registered under the Clinical Establishments Act in your state, with a valid and current registration certificate?", undefined, "Do you maintain all required records — patient files, consent forms, biomedical waste disposal logs, and staff credentials?", undefined],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have professional indemnity (malpractice) insurance covering your clinic and all treating doctors?", undefined],
    p4: ["Does your clinic collect and store sensitive patient data — health records, diagnoses, prescriptions, or payment information?", "Patient data is among the most protected categories under India's new DPDP Act 2023.", DEFAULT_BASE.p4[2]!, DEFAULT_BASE.p4[3]],
  },

  "SaaS": {
    p0: ["Has any client, competitor, regulator, or open-source community ever sent your company a formal legal notice?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do all your clients sign a written agreement before using your product — covering SLA, data ownership, and what happens if either party terminates?", undefined, "Do all your developers and contractors sign an agreement saying all code they write belongs to your company — not them?", "Without this, developers can legally own the code they wrote for you."],
    p2: ["Does your platform have published Privacy Policy, Terms of Service, and Cookie Policy — and is your company MCA-registered and GST-compliant?", undefined, "Do you file ROC annual returns, GST (18% on SaaS), and TDS on contractor payments on time?", undefined],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have cyber insurance and Errors & Omissions (E&O) insurance covering your platform if it goes down or leaks client data?", undefined],
    p4: ["Does your SaaS platform collect, store, or process personal data of your users or business clients?", "This triggers compliance obligations under India's DPDP Act 2023 — non-compliance penalties start at ₹50 Crores.", DEFAULT_BASE.p4[2]!, DEFAULT_BASE.p4[3]],
  },

  "Software Company": {
    p0: ["Has any client, ex-employee, or competitor ever sent your company a legal notice — related to project delivery, IP, or contract breach?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do all your clients sign a written project agreement before work begins — covering deliverables, payment terms, and who owns the final code?", undefined, "Do all your developers, designers, and contractors sign an agreement saying everything they build for you belongs to your company?", "Without this, the developer can legally claim ownership of the code."],
    p2: ["Is your company registered with MCA, GST-compliant on all invoices, and filing ROC annual returns on time?", undefined, DEFAULT_BASE.p2[2]!, DEFAULT_BASE.p2[3]],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have Errors & Omissions (E&O) and Cyber Liability insurance covering your client projects?", undefined],
  },

  "FinTech": {
    p0: ["Has the RBI, SEBI, FIU-IND, or any financial regulator ever sent your company a notice, query, or inspection finding?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do all users agree to proper Terms and KYC conditions before accessing your platform — in a way that's legally enforceable?", undefined, "Do your payment and technology partners sign agreements covering data security, liability limits, and what happens if they go down?", undefined],
    p2: ["Does your FinTech have all required regulatory approvals — RBI licence, NBFC registration, SEBI approval, or Payment Aggregator licence?", "Operating a FinTech product without the correct licence is a criminal offence in India.", "Are your FEMA reports, KYC/AML records, and regulatory compliance filings all current and up to date?", undefined],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have Cyber Liability, D&O (Directors & Officers), and E&O insurance covering your platform and its founders?", undefined],
    p4: ["Does your platform process sensitive financial data — bank accounts, transaction history, credit scores, or personal identification?", "Financial data is the highest-risk category under India's DPDP Act 2023.", DEFAULT_BASE.p4[2]!, DEFAULT_BASE.p4[3]],
  },

  "Startup": {
    p0: ["Has your startup received any legal notice from a competitor, ex-employee, investor, or government authority?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do all co-founders have a written agreement covering equity split, who does what, and exactly what happens if one of you wants to leave?", "90% of co-founder disputes that reach court stem from undocumented or vague founders' agreements.", "Do your employees and advisors sign agreements saying all work and ideas they contribute belong to the company — not them personally?", undefined],
    p2: ["Is your startup registered as a Private Limited or LLP with MCA, and have you applied for Startup India (DPIIT) recognition?", "DPIIT recognition gives you 3-year income tax holiday and easier ESOP rules.", DEFAULT_BASE.p2[2]!, DEFAULT_BASE.p2[3]],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have any insurance — even a basic D&O or E&O policy — to protect yourself and co-founders from personal liability?", undefined],
  },

  "Real Estate Agent": {
    p0: ["Has RERA or any consumer forum ever sent you a formal notice or summons related to a property deal you were involved in?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do all your clients sign a written brokerage agreement before you start searching or listing properties for them?", "Agents without written agreements cannot legally recover commission — courts have dismissed hundreds of oral commission claims.", "Do all property deals you facilitate have written MOUs that clearly mention your commission and who handles disputes?", undefined],
    p2: ["Are you registered as a RERA agent in every state where you actively conduct property transactions?", "Unregistered agents face ₹10,000/day fines and are personally liable for buyer losses under RERA.", "Do you conduct KYC checks on buyers and sellers as required by the money laundering (PMLA) rules for property agents?", undefined],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have Professional Indemnity (PI) insurance covering errors in property advice and transaction facilitation?", undefined],
  },

  "Residential Builder": {
    p0: ["Has RERA, a consumer forum, or any buyer ever sent your company an official notice or complaint?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do all your buyer agreements comply with RERA requirements — clear specs, delivery timeline, penalties for delay, registered with the authority?", undefined, "Do your contractors, architects, and engineers sign written contracts covering timelines, quality, and what happens if they fail to deliver?", undefined],
    p2: ["Is every ongoing project registered with RERA, with quarterly progress reports filed and 70% of buyer payments held in escrow?", "RERA non-registration attracts ₹10 Lakh/day penalty and personal criminal liability of promoters.", "Does every project have all required approvals — Building Plan Sanction, Commencement Certificate, and Environmental Clearance?", undefined],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have Construction All-Risk (CAR) and Builder's Liability insurance covering each active project?", undefined],
  },

  "Export Company": {
    p0: ["Has DGFT, Customs, RBI/FEMA enforcement, or a foreign buyer ever sent your business a notice about a shipment or payment issue?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do all your export transactions have a written contract with the foreign buyer covering payment terms, who bears the loss if goods are rejected, and which country's law applies?", undefined, "Do you have written agreements with your freight forwarder and shipping line covering liability, cargo handling, and what happens in transit?", undefined],
    p2: ["Does your business have a valid IEC (Import Export Code) and all the sector-specific export licences required for your product category?", undefined, "Do you realise payment from foreign buyers within 9 months and file the required FEMA export declarations (XOS/EDPMS) on time?", undefined],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have ECGC Export Credit Insurance and Marine Cargo Insurance covering all active shipments?", "These cover you if a foreign buyer defaults on payment or cargo is lost in transit."],
  },

  "Garment Factory": {
    p0: ["Has the Labour Department, Factory Inspector, or Pollution Control Board ever issued your factory a notice or found violations during an inspection?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do all your buyers — domestic and export — give you written purchase orders with clear specs, delivery dates, payment terms, and rejection clauses?", undefined, "Do you have written job-work agreements with all your stitching, embroidery, and finishing contractors covering quality and payment?", undefined],
    p2: ["Does your factory have a current Factory Licence, ESI/PF registration, Fire NOC, and Pollution Control Consent to Operate?", undefined, "Are you paying all workers minimum wage as per your state's latest notification, and depositing PF/ESIC every month on time?", undefined],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have Workers' Compensation insurance covering all your factory workers for injuries and accidents?", undefined],
  },

  "D2C Brand": {
    p0: ["Has any brand, marketplace, consumer authority, or customer ever sent your business a formal legal notice or complaint?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do you have reviewed agreements with every marketplace you sell on — Amazon, Flipkart, Meesho — covering commission, account suspension terms, and inventory liability?", undefined, "Do your manufacturers and vendors sign agreements that protect your product designs, formulations, and brand from being copied?", undefined],
    p2: ["Does your website have a published Privacy Policy, Return & Refund Policy, Terms of Service — and are you GST-registered and product-certified where required?", undefined, DEFAULT_BASE.p2[2]!, DEFAULT_BASE.p2[3]],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have product liability insurance that covers you if a customer is harmed by your product?", undefined],
  },

  "E-Commerce": {
    p0: ["Has any brand, seller on your platform, consumer authority, or regulator sent you a formal legal notice or complaint?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do all sellers on your platform sign a merchant agreement covering listing standards, commission structure, and who is responsible if something goes wrong?", undefined, "Do you have written agreements with your payment gateway and logistics partners covering SLA, fraud liability, and data handling?", undefined],
    p2: ["Is your platform compliant with Consumer Protection (E-Commerce) Rules 2020 — Grievance Officer appointed, seller info displayed, functional return policy in place?", undefined, DEFAULT_BASE.p2[2]!, DEFAULT_BASE.p2[3]],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have Cyber Liability and Product Liability insurance covering data breaches and goods sold on your platform?", undefined],
  },

  "School": {
    p0: ["Has the Education Department, your Board (CBSE/ICSE/State), fire department, or any parent ever filed a formal complaint against your school?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do all your teachers and staff sign written employment contracts covering duties, conduct standards, and notice period before joining?", undefined, "Do you have a written parent-school agreement covering fee structure, refund policy, and code of conduct?", undefined],
    p2: ["Does your school have all required registrations — Education Dept recognition, Board affiliation, Fire NOC, and Building Usage Certificate?", undefined, "Are you compliant with the RTE Act (25% EWS seats) and do all staff have POCSO mandatory reporting awareness?", undefined],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have school insurance covering student accidents, staff liability, building damage, and third-party claims?", undefined],
  },

  "Hotel": {
    p0: ["Has FSSAI, the fire department, police, Tourism Department, or any guest ever filed a formal complaint or sent your hotel an official notice?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do you have written agreements with every OTA you're listed on — MakeMyTrip, Booking.com, OYO — covering commission, cancellation terms, and what happens if they suspend your listing?", undefined, "Do all your staff — housekeeping, kitchen, security — sign written employment contracts with proper PF/ESIC enrolment?", undefined],
    p2: ["Does your hotel have all required licences — FSSAI, Fire NOC, Police Registration, GST, Tourism Dept classification, and Excise Licence if alcohol is served?", undefined, "Do you maintain Form C foreigner registration records and submit them to local police within 24 hours for every international guest?", "This is legally mandatory under the Foreigners Act — missing records lead to hotel licence suspension."],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do you have hotel insurance covering guest injuries, food liability, staff accidents, fire, and business interruption?", undefined],
  },

  "NGO": {
    p0: ["Has the MHA (FCRA), Income Tax Department, or any donor ever formally questioned your NGO's activities or fund utilisation?", undefined, DEFAULT_BASE.p0[2]!, DEFAULT_BASE.p0[3]],
    p1: ["Do you have written grant agreements with every donor — government, corporate, or foreign — covering exactly how the money must be used and what happens if unused?", undefined, "Do all your paid staff, volunteers, and field workers sign written agreements covering their role and your data handling obligations?", undefined],
    p2: ["Does your NGO have all valid registrations — Society/Trust/Section 8, 80G, 12A, FCRA (if foreign funds), and DARPAN portal listing?", undefined, "Are your FCRA annual returns, 80G/12A renewals, and state Registrar filings all submitted on time with audited accounts?", undefined],
    p3: [DEFAULT_BASE.p3[0]!, DEFAULT_BASE.p3[1], "Do your governing board members have Directors' Liability insurance protecting their personal assets from NGO legal actions?", undefined],
    p4: ["Does your NGO collect sensitive personal data from beneficiaries — like their health records, financial status, or legal history?", "Beneficiary data is heavily protected under India's DPDP Act 2023 — NGOs are considered Data Fiduciaries.", DEFAULT_BASE.p4[2]!, DEFAULT_BASE.p4[3]],
  },
};

// ─── Build full pillar question array ─────────────────────────────────────────
function buildBaseQuestions(pillarIdx: number, businessType: string): PillarQuestion[] {
  const key = `p${pillarIdx}`;
  const pillar = PILLAR_META[pillarIdx]!.pillar;
  const override = OVERRIDES[businessType]?.[key];
  const base = override ?? DEFAULT_BASE[key]!;

  return [
    {
      id: `p${pillarIdx}q0`,
      text: base[0]!,
      hint: base[1],
      isReverse: pillarIdx === 0 || pillarIdx === 3,
      pillar,
    },
    {
      id: `p${pillarIdx}q1`,
      text: base[2]!,
      hint: base[3],
      isReverse: false,
      pillar,
    },
  ];
}

export function getPillarQuestions(businessType: string, pillarIdx: number): PillarQuestion[] {
  const key = `p${pillarIdx}`;
  const base = buildBaseQuestions(pillarIdx, businessType);
  const followUps = (DEFAULT_FOLLOWUPS[key] ?? []).map((q) => ({ ...q, pillar: PILLAR_META[pillarIdx]!.pillar }));
  return [...base, ...followUps];
}

// ─── Decision-tree walker ─────────────────────────────────────────────────────
function matchesCond(answer: Answer, cond: ShowIfCond): boolean {
  if (cond === "NOT_YES") return answer !== "YES";
  if (cond === "NOT_NO")  return answer !== "NO";
  return answer === cond;
}

export function getNextQuestion(
  pillarIdx: number,
  businessType: string,
  answered: Record<string, Answer>
): PillarQuestion | null {
  const questions = getPillarQuestions(businessType, pillarIdx);
  for (const q of questions) {
    if (answered[q.id] !== undefined) continue; // already answered
    if (!q.showIf) return q;                     // base question — always show
    const prevAnswer = answered[q.showIf.qId];
    if (prevAnswer === undefined) continue;       // prerequisite not yet answered
    if (matchesCond(prevAnswer, q.showIf.cond)) return q;
  }
  return null; // pillar complete
}
