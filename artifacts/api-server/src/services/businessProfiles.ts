// ─────────────────────────────────────────────────────────────────────────────
// Business profiles — the domain knowledge that makes assessment questions
// specific to the category + sub-category a lead picked during onboarding.
//
// Resolution order (most specific first):
//   1. Sub-category rules (regex on the sub-category name, e.g. "Pharmacy")
//   2. Category profile   (keyed by the onboarding category, e.g. "Healthcare & Wellness")
//
// The resolved profile feeds two things:
//   - The AI prompt: regulators, licences, counterparties and the exact
//     must-cover topics per pillar, so the model cannot drift into generic
//     "do you have a lawyer?" questions.
//   - The static fallback: when the AI is slow/unavailable, the topic texts
//     below ARE the questions, so even the fallback is business-specific.
//
// Keep category keys in sync with BUSINESS_CATEGORIES in
// artifacts/legaliq-web/src/lib/indiaData.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** Pillar ids match PILLAR_META in gemini.ts: 1 Litigation, 2 Contractual, 3 Compliance, 4 Legal Cost Efficiency */
export type PillarId = 1 | 2 | 3 | 4;

/** Answer-option set used when a topic is served from the static fallback. */
export type OptKey = "HAVE" | "LICENCE" | "FILING" | "PRACTICE" | "COVER" | "DISPUTE" | "SPEND";

export interface Topic {
  p: PillarId;
  /** Short label of the risk area — used in the AI prompt and for de-duplication */
  topic: string;
  /** Ready-to-serve question text (≤ ~22 words, plain language) */
  q: string;
  /** One-line helper shown under the question */
  hint: string;
  /** Indian law / authority this topic rests on */
  law: string;
  /** Concrete consequence if this is a gap */
  risk: string;
  opts: OptKey;
}

interface ProfileFacts {
  regulators: string[];
  licences: string[];
  counterparties: string[];
  disputes: string[];
}

interface CategoryProfile extends ProfileFacts {
  topics: Topic[];
}

interface SubRule extends Partial<ProfileFacts> {
  match: RegExp;
  /** Restrict the rule to these onboarding categories (default: any) */
  cats?: string[];
  /** Replace the category's topics and facts instead of adding to them —
   *  for sub-categories that sit in a category but work very differently
   *  (e.g. a chemist inside "Healthcare & Wellness" is not a clinic). */
  exclusive?: boolean;
  topics: Topic[];
}

export interface ResolvedProfile extends ProfileFacts {
  category: string;
  subCategory: string;
  /** Short noun for the business, e.g. "pharmacy", "cloud kitchen" */
  noun: string;
  /** Up to 5 topics per pillar, most specific first */
  topicsByPillar: Record<PillarId, Topic[]>;
  /** True when no category profile or sub-category rule matched */
  isGeneric: boolean;
}

const t = (p: PillarId, topic: string, q: string, hint: string, law: string, risk: string, opts: OptKey): Topic =>
  ({ p, topic, q, hint, law, risk, opts });

// ─── Category profiles ────────────────────────────────────────────────────────

const CATEGORY_PROFILES: Record<string, CategoryProfile> = {
  "Food & Beverage": {
    regulators: ["FSSAI food safety officers", "Municipal health department", "Fire department", "Legal Metrology department", "State Excise (if alcohol)"],
    licences: ["FSSAI registration / State or Central licence", "Health trade licence", "Fire NOC", "Shop & Establishment registration", "GST", "Eating house licence (where the state requires it)"],
    counterparties: ["Swiggy / Zomato / ONDC aggregators", "raw-material and dairy suppliers", "kitchen staff and delivery riders", "landlord"],
    disputes: ["food-poisoning or foreign-object complaints", "aggregator commission deductions and delisting", "FSSAI improvement notices", "supplier credit disputes"],
    topics: [
      t(1, "FSSAI / health inspection notices", "Has an FSSAI officer or municipal health inspector ever issued you an improvement notice, sample failure, or penalty?", "Includes unsafe/sub-standard sample reports and hygiene notices.", "Food Safety and Standards Act 2006", "Sub-standard sample findings carry fines up to ₹5 lakh; unsafe food can mean prosecution.", "DISPUTE"),
      t(1, "Customer food-quality complaints", "Has a customer ever complained publicly or to a consumer forum about food poisoning, a foreign object, or stale food?", "Social media posts and aggregator escalations count too.", "Consumer Protection Act 2019", "Consumer forums regularly award ₹50,000–₹5 lakh in food contamination cases.", "DISPUTE"),
      t(2, "Aggregator agreements", "Have you read and kept a copy of your Swiggy/Zomato agreement, including commission, penalties, and delisting terms?", "These terms decide what the app can deduct or block without asking you.", "Indian Contract Act 1872", "Unread aggregator terms let the platform deduct penalties or delist you with no recourse.", "HAVE"),
      t(2, "Raw-material supplier terms", "Do your main suppliers of vegetables, meat, dairy, or ingredients give written terms on quality, credit period, and returns?", "Purchase orders or invoices with terms count.", "Indian Contract Act 1872 / Sale of Goods Act 1930", "Without written quality terms you bear the full cost of bad batches and credit disputes.", "HAVE"),
      t(3, "FSSAI licence tier and validity", "Is your FSSAI licence the right tier for your turnover (registration, State or Central) and currently valid?", "Basic registration only covers turnover up to ₹12 lakh a year.", "FSS (Licensing & Registration) Regulations 2011", "Operating without the correct FSSAI licence: up to ₹5 lakh fine and possible closure.", "LICENCE"),
      t(3, "Hygiene and FoSTaC records", "Do you have a FoSTaC-trained food safety supervisor and keep pest control, water testing, and staff medical records?", "Inspectors ask for these records during every visit.", "FSS Regulations, Schedule 4", "Missing hygiene records are the most common basis for improvement notices and licence suspension.", "PRACTICE"),
      t(4, "Product / food liability insurance", "Does your insurance cover a customer claim for food illness, not just fire and theft of equipment?", "Standard shop policies usually exclude food-liability claims.", "Consumer Protection Act 2019 (product liability)", "One uninsured food-illness claim can wipe out several months of profit.", "COVER"),
      t(4, "Repeat food-safety penalties", "In the last 2 years, have you paid FSSAI, municipal, or aggregator penalties for hygiene or packaging issues?", "Include fines and aggregator deductions for quality complaints.", "FSS Act 2006", "Repeat penalties point to a fixable process gap that keeps costing money.", "SPEND"),
    ],
  },

  "Healthcare & Wellness": {
    regulators: ["State Medical Council / NMC", "State Clinical Establishments authority", "State Pollution Control Board (bio-medical waste)", "CDSCO / State Drug Controller", "AERB (X-ray equipment)"],
    licences: ["Clinical Establishment / Nursing Home registration", "Bio-medical waste authorisation", "Doctor registrations with the State Medical Council", "Fire NOC", "AERB licence for X-ray", "PCPNDT registration (if ultrasound)"],
    counterparties: ["patients", "visiting consultants and doctors", "TPAs and insurers", "equipment and consumables vendors", "bio-medical waste operator"],
    disputes: ["medical negligence complaints", "billing disputes with patients and TPAs", "consent-related claims", "data leaks of patient records"],
    topics: [
      t(1, "Medical negligence complaints", "Has any patient or family ever sent a legal notice or filed a consumer or medical council complaint about treatment?", "Includes complaints still pending or settled informally.", "Consumer Protection Act 2019 / NMC regulations", "Medical negligence awards in consumer forums often run from ₹5 lakh to over ₹1 crore.", "DISPUTE"),
      t(1, "Billing / TPA disputes", "Have you had unresolved disputes with patients, TPAs, or insurers over bills, cashless claims, or deductions?", "Unpaid TPA claims and patient billing complaints both count.", "Consumer Protection Act 2019 / IRDAI regulations", "Unpaid claims and billing complaints build up quickly into receivables losses and consumer cases.", "DISPUTE"),
      t(2, "Informed consent forms", "Does every patient sign a written consent form, in a language they understand, before procedures or tests?", "Consent is the first thing examined in any negligence case.", "Indian Medical Council (Professional Conduct) Regulations / Supreme Court consent rulings", "Missing or invalid consent can make you liable even when treatment was correct.", "PRACTICE"),
      t(2, "Doctor and consultant agreements", "Do visiting doctors and consultants have written agreements covering fees, liability, and who is responsible if something goes wrong?", "Covers retainer, revenue-share, and visiting consultants.", "Indian Contract Act 1872", "Without them, the establishment usually ends up carrying the consultant's liability as well.", "HAVE"),
      t(3, "Clinical establishment registration", "Is your facility registered under the Clinical Establishments Act or your state's nursing home law, with a current certificate?", "Some states use their own law, e.g. KPME (Karnataka) or the BNHR Act (Maharashtra).", "Clinical Establishments Act 2010 / state nursing home laws", "Running an unregistered establishment can lead to fines, sealing, and denial of insurer empanelment.", "LICENCE"),
      t(3, "Bio-medical waste compliance", "Do you have bio-medical waste authorisation, a tie-up with an authorised operator, and colour-coded segregation records?", "The State PCB checks your annual report and segregation logs.", "Bio-Medical Waste Management Rules 2016", "BMW violations can mean prosecution under the Environment Protection Act and closure orders.", "LICENCE"),
      t(4, "Professional indemnity cover", "Do you and every treating doctor have professional indemnity insurance with cover that matches your procedures?", "Check that visiting consultants are covered too, not just the owner.", "Consumer Protection Act 2019", "A single negligence award can exceed a year's profit for a small clinic.", "COVER"),
      t(4, "Patient data protection", "Are patient records, prescriptions, and reports stored securely, with access limited and patient consent for sharing?", "WhatsApp-sharing reports with staff is a common gap.", "Digital Personal Data Protection Act 2023", "Health data breaches can attract DPDP penalties of up to ₹250 crore.", "PRACTICE"),
    ],
  },

  "Technology & IT": {
    regulators: ["MCA / Registrar of Companies", "CERT-In", "Data Protection Board (DPDP Act)", "GST department", "RBI (for foreign investment reporting under FEMA)"],
    licences: ["Company / LLP incorporation with ROC filings", "GST (with LUT for export of services)", "DPIIT Startup recognition", "Shop & Establishment / STPI registration (where applicable)"],
    counterparties: ["enterprise clients (MSAs and SOWs)", "developers, freelancers and contractors", "co-founders and investors", "cloud and API vendors", "end users (Terms & Privacy Policy)"],
    disputes: ["non-payment by clients", "IP ownership claims by ex-employees or contractors", "SLA penalty claims", "founder exits and ESOP disputes", "data breach liability"],
    topics: [
      t(1, "Client payment / SLA disputes", "Is any client currently withholding payment, disputing deliverables, or claiming SLA penalties against you?", "Includes overdue invoices the client has formally disputed.", "Indian Contract Act 1872 / Arbitration and Conciliation Act 1996", "Disputed invoices without clear acceptance criteria often end up written off.", "DISPUTE"),
      t(1, "IP / code ownership claims", "Has an ex-employee, freelancer, or partner ever claimed ownership of code, designs, or a product you sell?", "Includes claims made informally or in an exit dispute.", "Copyright Act 1957", "An IP ownership claim can block funding rounds, acquisitions, and enterprise sales.", "DISPUTE"),
      t(2, "IP assignment from developers", "Have all employees and freelancers who wrote code signed an agreement assigning the IP to the company?", "Freelancers own their code by default unless they assign it in writing.", "Copyright Act 1957, Section 18-19", "Without written assignment, contractors may legally own parts of your product.", "HAVE"),
      t(2, "Client MSA and SOW terms", "Do client contracts cap your liability and define acceptance criteria, payment milestones, and IP ownership?", "Check the MSA and every SOW, not just the first one.", "Indian Contract Act 1872", "Uncapped liability clauses expose you to claims far larger than the contract value.", "HAVE"),
      t(3, "ROC annual filings", "Are your company's ROC annual filings (AOC-4, MGT-7/7A) and director KYC submitted on time every year?", "Late fees are ₹100 per day per form, with no upper limit.", "Companies Act 2013", "Continuous defaults can disqualify directors for 5 years.", "FILING"),
      t(3, "DPDP privacy readiness", "Does your product have a current privacy notice, consent capture, and a process to delete user data on request?", "Applies to any personal data of Indian users, including B2B contacts.", "Digital Personal Data Protection Act 2023", "DPDP penalties go up to ₹250 crore per breach of obligations.", "PRACTICE"),
      t(4, "Cyber / E&O insurance", "Do you carry cyber liability or errors-and-omissions insurance covering data breaches and client claims?", "Many enterprise clients now require it in the MSA.", "Contractual requirement / IT Act 2000 Section 43A", "Breach response and client claims are uninsured costs that come straight from cash.", "COVER"),
      t(4, "CERT-In incident readiness", "Do you have a plan to report a cyber incident to CERT-In within 6 hours, and keep logs for 180 days?", "Mandatory for service providers and companies under the 2022 directions.", "CERT-In Directions, April 2022", "Non-compliance can lead to imprisonment of up to 1 year or a fine under IT Act Section 70B.", "PRACTICE"),
    ],
  },

  "Real Estate & Construction": {
    regulators: ["State RERA authority", "Municipal / town-planning authority", "Labour department (BOCW welfare board)", "State Pollution Control Board", "Stamp & registration department"],
    licences: ["RERA project / agent registration", "Building plan sanction, commencement and occupancy certificates", "BOCW establishment registration and labour cess", "Contract Labour Act licence", "GST"],
    counterparties: ["homebuyers and clients", "sub-contractors and labour contractors", "land owners (JDA)", "architects and consultants", "material suppliers"],
    disputes: ["possession delay complaints", "sub-contractor payment and quality disputes", "land title and JDA disputes", "worker accident claims"],
    topics: [
      t(1, "RERA / buyer complaints", "Has any buyer or client filed a RERA, consumer forum, or court complaint about delay, quality, or refund?", "Include complaints settled or still pending.", "RERA 2016 / Consumer Protection Act 2019", "RERA orders interest on delayed possession and can freeze project accounts.", "DISPUTE"),
      t(1, "Sub-contractor payment disputes", "Do you have unresolved payment or quality disputes with sub-contractors, labour contractors, or material suppliers?", "Running-bill disagreements count.", "Indian Contract Act 1872 / MSMED Act 2006", "MSME suppliers can claim compound interest at 3× the RBI rate on delayed dues.", "DISPUTE"),
      t(2, "Sub-contractor agreements", "Do your sub-contractor agreements set milestones, retention money, defect liability, and penalties that match your client contract?", "Back-to-back terms stop you from absorbing penalties alone.", "Indian Contract Act 1872", "Without back-to-back terms, client penalties land on you while the sub-contractor walks away.", "HAVE"),
      t(2, "Title and land documents", "For every project site, do you hold verified title documents and a registered sale deed or joint development agreement?", "Unregistered JDAs and incomplete title chains are common risks.", "Registration Act 1908 / Transfer of Property Act 1882", "Title defects can halt construction and lead to buyer refund claims.", "HAVE"),
      t(3, "RERA / municipal approvals", "Is every ongoing project registered with RERA (where required), with sanctioned plans and quarterly updates filed?", "Projects above 500 sq m or 8 units must be registered.", "RERA 2016, Sections 3, 4 and 11", "Penalty for not registering can be up to 10% of the project cost.", "LICENCE"),
      t(3, "BOCW and labour cess", "Are your sites registered under the BOCW Act, with 1% labour cess paid and workers registered with the welfare board?", "Applies to construction with 10 or more workers.", "BOCW Act 1996 / BOCW Cess Act 1996", "Unpaid cess carries interest and penalties, and blocks the occupancy certificate in many states.", "FILING"),
      t(4, "Contractor all-risk insurance", "Do your active projects carry Contractor's All Risk and workmen compensation insurance for site workers?", "Covers site accidents, collapse, and damage to works.", "Employees' Compensation Act 1923", "An uninsured worker death can cost ₹10 lakh or more in compensation plus penalties.", "COVER"),
      t(4, "Delay penalty exposure", "In the last 2 years, have you paid delay interest, liquidated damages, or settlements to buyers or clients?", "Include RERA interest and client LD deductions.", "RERA 2016, Section 18", "Repeated delay payouts show that contract timelines are not being managed.", "SPEND"),
    ],
  },

  "Professional Services": {
    regulators: ["Professional body (ICAI, ICSI, Bar Council, IBBI, Council of Architecture)", "GST department", "Income Tax (TDS)", "ASCI / CCPA (for marketing work)"],
    licences: ["Professional body membership / firm registration", "GST registration", "Shop & Establishment registration", "Partnership / LLP registration"],
    counterparties: ["clients (engagement letters)", "sub-consultants and freelancers", "employees with access to client data"],
    disputes: ["fee recovery from clients", "client claims of negligent advice", "complaints to professional bodies", "employees poaching clients"],
    topics: [
      t(1, "Fee recovery disputes", "Do you have client fees overdue by more than 90 days that the client is disputing or ignoring?", "Count retainer and milestone fees.", "Indian Contract Act 1872", "Old fees without a signed scope of work are rarely recovered in full.", "DISPUTE"),
      t(1, "Professional negligence claims", "Has a client ever blamed your advice or work for a loss and threatened a claim or a professional-body complaint?", "Disciplinary complaints to your professional body count.", "Professional body regulations / Consumer Protection Act 2019", "Negligence claims and disciplinary action can threaten both cash and your licence to practise.", "DISPUTE"),
      t(2, "Engagement letters", "Does every client engagement start with a signed letter defining scope, fees, deliverables, and a liability cap?", "Email acceptance of a proposal counts if the terms are complete.", "Indian Contract Act 1872", "Without a defined scope and cap, clients can demand unlimited extra work or damages.", "HAVE"),
      t(2, "Non-solicit and confidentiality", "Do employees and associates sign confidentiality and non-solicitation clauses covering client data and relationships?", "Post-exit non-competes are not enforceable in India, but non-solicit and confidentiality clauses are.", "Indian Contract Act 1872, Section 27", "Departing staff can take clients and confidential files with little recourse.", "HAVE"),
      t(3, "Professional registration currency", "Are your firm and every practising professional's registrations with your professional body current?", "Includes certificate of practice and firm registration.", "Chartered Accountants Act 1949 / Advocates Act 1961 / Company Secretaries Act 1980", "Practising on a lapsed certificate can void the work and lead to disciplinary action.", "LICENCE"),
      t(3, "GST and TDS on services", "Do you charge GST correctly on your fees and reconcile client TDS deductions in Form 26AS every quarter?", "Mismatched TDS credits are a common source of tax notices.", "CGST Act 2017 / Income Tax Act Section 194J", "Mismatches lead to lost TDS credit and GST demand notices with interest.", "FILING"),
      t(4, "Professional indemnity insurance", "Do you carry professional indemnity insurance with cover that matches your largest client engagements?", "Check the per-claim limit, not just the total.", "Professional body guidelines", "One uninsured claim from a large client can exceed the firm's yearly profit.", "COVER"),
      t(4, "Unbilled time on disputes", "In the last year, did you lose significant billable time or write off fees because of scope or payment disputes?", "Count write-offs and time spent chasing payments.", "Indian Contract Act 1872", "Scope creep with no written scope quietly reduces your margins on every engagement.", "SPEND"),
    ],
  },

  "Manufacturing": {
    regulators: ["Factory Inspector (Directorate of Industrial Safety)", "State Pollution Control Board", "BIS", "Labour department / EPFO / ESIC", "Legal Metrology department"],
    licences: ["Factory licence and approved plans", "PCB Consent to Establish and Consent to Operate", "BIS licence for products under mandatory Quality Control Orders", "Fire NOC", "EPR registration (plastic / e-waste / battery, if applicable)"],
    counterparties: ["OEM and B2B buyers (purchase orders)", "dealers and distributors", "job-workers and contract labour contractors", "raw-material suppliers"],
    disputes: ["worker injury claims", "quality rejections and payment withholding", "dealer termination disputes", "pollution board show-cause notices"],
    topics: [
      t(1, "Factory / PCB inspection notices", "Has the Factory Inspector or Pollution Control Board issued your unit a show-cause notice, prosecution, or closure direction?", "Includes notices still being contested.", "Factories Act 1948 / Water Act 1974 / Air Act 1981", "PCB closure directions can stop production overnight, with power and water disconnected.", "DISPUTE"),
      t(1, "Worker accident claims", "Has any worker accident in the last 3 years led to a compensation claim, police case, or labour court dispute?", "Include accidents involving contract workers.", "Employees' Compensation Act 1923 / Factories Act 1948", "Occupiers can face personal prosecution after serious factory accidents.", "DISPUTE"),
      t(2, "Buyer purchase-order terms", "Do your buyer POs clearly define specs, inspection, rejection limits, payment due dates, and warranty period?", "Many rejection disputes happen because the inspection criteria are vague.", "Sale of Goods Act 1930", "Vague rejection terms let buyers withhold payment for entire lots.", "HAVE"),
      t(2, "Job-work and contract labour agreements", "Do your job-workers and labour contractors have written agreements covering quality, wages compliance, and material accountability?", "As principal employer, you are liable for unpaid contract-worker wages and PF.", "Contract Labour Act 1970 / CGST Act Section 143", "Principal employers pay the contract worker dues the contractor leaves unpaid.", "HAVE"),
      t(3, "Factory licence and PCB consent", "Are your factory licence and Pollution Control Board Consent to Operate both valid for your current capacity?", "Expanding capacity without amended consent is a common violation.", "Factories Act 1948 / Water and Air Acts", "Operating without valid consent can lead to closure and environmental compensation orders.", "LICENCE"),
      t(3, "BIS mandatory certification", "Do the products you make fall under a BIS Quality Control Order, and if so, do you hold a valid BIS licence?", "Many QCOs now cover chemicals, toys, footwear, electricals, and steel.", "BIS Act 2016 / Quality Control Orders", "Selling QCO products without BIS certification: fines of at least ₹2 lakh and seizure of goods.", "LICENCE"),
      t(4, "MSME payment-delay exposure", "Do your large buyers regularly pay later than 45 days, and have you used MSME Samadhaan or interest claims?", "Being registered on Udyam gives you statutory interest rights.", "MSMED Act 2006, Sections 15-16", "Late payments tie up working capital while you give up statutory interest you could claim.", "PRACTICE"),
      t(4, "Product liability insurance", "Does your insurance cover product liability claims and recall costs, not just fire and machinery breakdown?", "Buyers increasingly pass product liability back to manufacturers.", "Consumer Protection Act 2019, Chapter VI", "A defect claim or recall without cover can cost more than the order was worth.", "COVER"),
    ],
  },

  "Retail & E-Commerce": {
    regulators: ["Legal Metrology department", "Central Consumer Protection Authority (CCPA)", "GST department", "Municipal / Shop & Establishment inspector", "BIS (for regulated products)"],
    licences: ["Shop & Establishment registration", "Trade licence", "GST", "Legal Metrology packer / importer registration", "Product-specific licences (FSSAI, drug licence, BIS)"],
    counterparties: ["marketplaces (Amazon, Flipkart, Meesho)", "brands and distributors", "landlord / mall operator", "logistics partners", "customers"],
    disputes: ["consumer complaints on defects and refunds", "marketplace account suspension and claims", "counterfeit or trademark notices", "distributor credit disputes"],
    topics: [
      t(1, "Consumer complaints", "Has any customer filed a consumer forum or National Consumer Helpline complaint about defects, refunds, or overcharging?", "NCH complaints often escalate to the district commission.", "Consumer Protection Act 2019", "Consumer commissions award refunds plus compensation and litigation costs.", "DISPUTE"),
      t(1, "Trademark / counterfeit notices", "Has a brand or marketplace ever accused you of selling counterfeit products or using its trademark without permission?", "Includes marketplace takedown notices.", "Trade Marks Act 1999", "Counterfeit allegations can lead to account suspension, seizure, and criminal complaints.", "DISPUTE"),
      t(2, "Marketplace / mall terms", "Have you reviewed your marketplace seller agreement or mall lease, including commissions, penalties, and suspension or exit terms?", "Platform and mall terms usually favour the platform or landlord.", "Indian Contract Act 1872", "Unread terms allow sudden suspensions, fee changes, and lock-in penalties.", "HAVE"),
      t(2, "Supplier / brand distribution terms", "Do you have written terms with your suppliers or brands on returns of damaged or expired stock, credit, and price protection?", "Purchase orders with these clauses count.", "Sale of Goods Act 1930", "Without return terms you absorb the cost of every damaged or slow-moving batch.", "HAVE"),
      t(3, "Legal Metrology labelling", "Does every packaged product you sell show MRP, net quantity, manufacturer/importer details, and customer care contact?", "Applies to online listings too.", "Legal Metrology (Packaged Commodities) Rules 2011", "Each non-compliant package can attract fines, and repeat offences lead to prosecution.", "PRACTICE"),
      t(3, "E-commerce / refund rules", "Do your store and website display a clear refund policy, grievance officer details, and avoid dark patterns like forced add-ons?", "CCPA has issued fines to online sellers for dark patterns.", "Consumer Protection (E-Commerce) Rules 2020 / Dark Patterns Guidelines 2023", "CCPA can order refunds, fines, and discontinuation of unfair practices.", "PRACTICE"),
      t(4, "Stock and liability insurance", "Is your inventory insured against fire, theft, and transit loss, with product liability cover for what you sell?", "Check that stock at third-party warehouses is covered.", "Insurance contract terms", "Uninsured stock loss is a direct hit to working capital.", "COVER"),
      t(4, "Refund and chargeback losses", "In the last year, did refunds, chargebacks, or marketplace claims cost you more than you expected?", "Count fraudulent returns and claims you lost.", "Consumer Protection (E-Commerce) Rules 2020", "Weak return and evidence processes turn into recurring losses.", "SPEND"),
    ],
  },

  "Trade & Export / Import": {
    regulators: ["DGFT", "Customs (CBIC)", "RBI / Authorised Dealer bank (FEMA)", "Export Promotion Council", "GST department"],
    licences: ["Import Export Code (IEC)", "RCMC from the relevant Export Promotion Council", "AD code registration at ports", "GST LUT for zero-rated exports", "Product-specific licences (FSSAI import, BIS, APEDA, drug licence)"],
    counterparties: ["foreign buyers and suppliers", "freight forwarders and customs brokers", "banks (LCs, export finance)", "domestic suppliers"],
    disputes: ["foreign buyer non-payment or rejection", "customs classification and valuation disputes", "unrealised export proceeds", "freight / demurrage claims"],
    topics: [
      t(1, "Customs / DGFT notices", "Have Customs or DGFT ever issued you a show-cause notice on classification, valuation, or export incentive claims?", "Includes notices for duty drawback or RoDTEP recovery.", "Customs Act 1962 / Foreign Trade (D&R) Act 1992", "Customs demands come with interest and penalties of up to 100% of the duty.", "DISPUTE"),
      t(1, "Foreign buyer payment disputes", "Is any foreign buyer currently refusing to pay, claiming quality rejection, or delaying payment beyond agreed terms?", "Partial payments and unresolved debit notes count.", "Contract terms / UN sale-of-goods principles", "Recovering money from overseas buyers without a contract and LC is slow and expensive.", "DISPUTE"),
      t(2, "Export sales contracts", "Do your export deals have a signed contract stating Incoterms, payment method (LC/advance), inspection, and which country's law applies?", "Proforma invoices alone rarely protect you.", "Indian Contract Act 1872 / ICC Incoterms 2020", "Without agreed Incoterms and jurisdiction, cross-border disputes become nearly unwinnable.", "HAVE"),
      t(2, "Forwarder and CHA agreements", "Do you have written terms with your freight forwarder and customs broker covering liability for errors, delays, and cargo damage?", "Many forwarders limit liability on the back of the bill of lading.", "Multimodal Transportation of Goods Act 1993 / CBLR 2018", "Broker filing errors can lead to penalties that fall on you as the importer or exporter.", "HAVE"),
      t(3, "Export realisation (EDPMS)", "Are all your export proceeds realised within RBI timelines, and are open EDPMS entries cleared with your bank?", "Open entries trigger caution-listing by your bank.", "FEMA 1999 / RBI Master Direction on Export of Goods", "Unrealised exports can lead to caution-listing, compounding, and loss of export incentives.", "FILING"),
      t(3, "IEC, RCMC and LUT validity", "Are your IEC details updated this year, your RCMC current, and a GST LUT filed for this financial year?", "The IEC must be updated annually between April and June.", "Foreign Trade Policy 2023 / CGST Rule 96A", "A deactivated IEC or missing LUT can block shipments or refunds.", "LICENCE"),
      t(4, "Export credit and cargo insurance", "Do you hold ECGC (or similar) buyer-default cover and marine cargo insurance for your shipments?", "Check that cover matches your Incoterms responsibility.", "ECGC policy terms / Marine Insurance Act 1963", "One buyer default without cover can wipe out a year's export margin.", "COVER"),
      t(4, "Demurrage and penalty costs", "In the last year, did you pay significant demurrage, detention, customs penalties, or incentive recoveries?", "Include amounts charged through your forwarder.", "Customs Act 1962", "Recurring port penalties usually come from documentation gaps.", "SPEND"),
    ],
  },

  "Education & Training": {
    regulators: ["State education department / Board (CBSE, ICSE, State)", "District administration (coaching centre registration)", "Child rights commissions (NCPCR / SCPCR)", "CCPA (misleading ads)", "Fire department"],
    licences: ["Recognition / affiliation or coaching centre registration", "Fire NOC and building safety certificate", "GST (18% on most coaching and training)", "Shop & Establishment registration", "Transport permits for school buses"],
    counterparties: ["students and parents", "faculty and trainers", "content creators and licensors", "landlord", "transport vendors"],
    disputes: ["fee refund demands", "misleading result or placement claims", "child safety incidents", "faculty exits taking students or content"],
    topics: [
      t(1, "Fee refund complaints", "Has any student or parent filed a consumer complaint or legal notice demanding a fee refund?", "Refund disputes are the most common case against education businesses.", "Consumer Protection Act 2019", "Consumer commissions routinely order refunds of unused fees with interest.", "DISPUTE"),
      t(1, "Child safety incidents", "Has any child safety, harassment, or injury incident at your institute led to a police complaint or a complaint to authorities?", "Includes incidents during transport or outside trips.", "POCSO Act 2012 / Juvenile Justice Act 2015", "Failing to report child abuse is itself an offence under POCSO for management.", "DISPUTE"),
      t(2, "Enrolment and refund terms", "Do students or parents sign enrolment terms that set out fees, a pro-rata refund policy, and a code of conduct?", "Current guidelines require pro-rata refunds when a student leaves a course.", "Guidelines for Regulation of Coaching Centres 2024 / Consumer Protection Act", "\"No refund\" clauses are routinely struck down, and the institute pays the refund plus costs.", "HAVE"),
      t(2, "Faculty contracts and content IP", "Do faculty contracts state that notes, videos, and question banks they create belong to the institute?", "Without this, departing faculty can legally reuse your content.", "Copyright Act 1957, Section 17", "Faculty leaving with content and students is a major revenue risk.", "HAVE"),
      t(3, "Recognition / registration", "Is your institute recognised, affiliated, or registered with the required authority, with the certificate currently valid?", "Coaching centres need district registration under the 2024 guidelines, adopted state by state.", "State education acts / Coaching Centre Guidelines 2024", "Operating without recognition or registration can lead to closure and fines.", "LICENCE"),
      t(3, "Staff police verification", "Have all teachers, drivers, and support staff completed police verification and child-protection training?", "Required by CBSE and most state child-safety guidelines.", "POCSO Act 2012 / Board affiliation bye-laws", "A single unverified staff member involved in an incident creates severe liability.", "PRACTICE"),
      t(4, "Student accident insurance", "Do you have insurance covering student accidents, public liability, and incidents during transport or trips?", "Check whether bus transport is covered under your policy.", "Motor Vehicles Act 1988 / insurance terms", "Uninsured accident claims involving children are both costly and damaging to reputation.", "COVER"),
      t(4, "Advertising claims exposure", "Do your ads use claims like \"100% selection\", toppers' photos, or guaranteed jobs without written proof and consent?", "CCPA has penalised several coaching brands for misleading result claims.", "CCPA Misleading Advertisement Guidelines 2022", "Misleading ad findings can bring penalties of up to ₹10 lakh, rising to ₹50 lakh for repeat offences.", "PRACTICE"),
    ],
  },

  "Hospitality & Tourism": {
    regulators: ["Local police (hotel / Sarai registration, Form C)", "FSSAI", "State Excise", "Fire department", "State Tourism department"],
    licences: ["Hotel / lodging trade licence", "Police registration", "FSSAI licence", "Fire NOC and lift licence", "Excise bar licence (if alcohol)", "Tourism department registration / classification"],
    counterparties: ["OTAs (MakeMyTrip, Booking.com, Airbnb)", "guests and corporate clients", "event and wedding clients", "tour and transport vendors", "staff"],
    disputes: ["guest injury or theft claims", "booking cancellation and refund disputes", "OTA parity and commission disputes", "noise and neighbourhood complaints"],
    topics: [
      t(1, "Guest complaints and claims", "Has any guest filed a consumer complaint or police complaint about injury, theft, overcharging, or a denied refund?", "Includes complaints raised through OTAs.", "Consumer Protection Act 2019", "Guest claims plus negative OTA reviews hit revenue twice.", "DISPUTE"),
      t(1, "Licence / police notices", "Has the police, fire department, excise, or municipal authority issued you a notice, fine, or sealing order?", "Includes noise and late-night operation notices.", "State police acts / Fire Services Acts / Excise Acts", "Sealing orders can shut operations during peak season.", "DISPUTE"),
      t(2, "OTA and channel agreements", "Have you reviewed your OTA agreements for commission, rate-parity, cancellation, and delisting terms?", "Parity clauses can restrict your direct pricing.", "Indian Contract Act 1872 / Competition Act 2002", "Unreviewed OTA terms let platforms change commissions and delist you.", "HAVE"),
      t(2, "Event / group booking contracts", "Do weddings, events, and group bookings sign a contract with advance, cancellation charges, and damage liability?", "WhatsApp confirmations rarely protect you if a large event is cancelled.", "Indian Contract Act 1872", "Large cancellations without signed terms can mean losing both the date and the advance dispute.", "HAVE"),
      t(3, "Foreign guest reporting (Form C)", "Do you submit Form C for every foreign guest within 24 hours and keep ID records for all guests?", "Applies to hotels, guesthouses, and homestays.", "Foreigners Act 1946 / Registration of Foreigners Rules", "Missed Form C submissions can lead to prosecution and licence trouble with the police.", "PRACTICE"),
      t(3, "Fire NOC and lift safety", "Are your fire NOC, fire-drill records, and lift licence all current for your building's size and occupancy?", "Hotel fires have led to strict renewal enforcement.", "State Fire Services Acts / National Building Code", "Operating without a fire NOC can lead to sealing and criminal liability after an incident.", "LICENCE"),
      t(4, "Public liability insurance", "Does your insurance cover guest injuries, food liability, and business interruption, not just the building?", "Check that pools, gyms, and events are included.", "Insurance terms", "One serious guest injury can trigger a claim larger than months of revenue.", "COVER"),
      t(4, "Guest data protection", "Are guest ID copies and payment details stored securely, with limited staff access and a deletion schedule?", "Photocopied IDs kept in open files are a common gap.", "Digital Personal Data Protection Act 2023", "A guest data leak exposes you to DPDP penalties and reputation damage.", "PRACTICE"),
    ],
  },

  "Finance & Insurance": {
    regulators: ["RBI", "SEBI", "IRDAI", "PFRDA / AMFI", "FIU-IND (PMLA reporting)", "State Registrar of Co-operative Societies / Chit Registrar"],
    licences: ["RBI Certificate of Registration / authorisation", "SEBI / AMFI / IRDAI registration (as applicable)", "FIU-IND registration", "GST", "State registrations for chit funds / co-operatives"],
    counterparties: ["borrowers / investors / policyholders", "lending partners, banks and NBFCs", "DSAs and recovery agents", "technology / LSP partners"],
    disputes: ["customer complaints to RBI Ombudsman / SEBI SCORES", "borrower defaults and recovery disputes", "mis-selling allegations", "recovery-agent harassment complaints"],
    topics: [
      t(1, "Regulator / Ombudsman complaints", "Have customers filed complaints against you with the RBI Ombudsman, SEBI SCORES, IRDAI Bima Bharosa, or a consumer forum?", "Open complaints count even if you believe they lack merit.", "RBI Integrated Ombudsman Scheme 2021 / SEBI SCORES", "Rising complaint volumes trigger regulatory inspections and can affect renewals.", "DISPUTE"),
      t(1, "Recovery and default disputes", "Are you dealing with borrower defaults or recovery disputes, including complaints about your recovery agents' conduct?", "Harassment complaints against agents fall on you as the regulated entity.", "RBI Fair Practices Code / SARFAESI Act 2002", "Recovery-agent misconduct can lead to RBI penalties and restrictions on outsourcing.", "DISPUTE"),
      t(2, "Customer agreement disclosures", "Do customers sign agreements, with a Key Fact Statement, that clearly disclose all charges, interest, and penalties before onboarding?", "KFS is mandatory for retail and MSME loans.", "RBI KFS circular 2024 / Fair Practices Code", "Undisclosed charges must be refunded and can attract RBI penalties.", "HAVE"),
      t(2, "DSA / partner agreements", "Do your DSAs, agents, and fintech partners have agreements covering code of conduct, data use, and audit rights?", "You remain liable for what your outsourced partners do.", "RBI Outsourcing Directions / Digital Lending Directions", "Partner misconduct is attributed to you by the regulator.", "HAVE"),
      t(3, "Core registration status", "Do you hold every regulatory registration your activity needs (RBI, SEBI, IRDAI, AMFI, or state), currently valid?", "Operating outside your licence scope is a serious offence.", "RBI Act 1934 Section 45-IA / SEBI Act 1992 / Insurance Act 1938", "Unauthorised financial activity can lead to criminal prosecution and asset freezes.", "LICENCE"),
      t(3, "KYC and PMLA reporting", "Do you complete KYC for every customer and file CTR/STR reports with FIU-IND on time?", "Includes periodic KYC updates for existing customers.", "PMLA 2002 / RBI KYC Master Direction", "FIU-IND imposes penalties per failure, and regulators treat KYC lapses very seriously.", "FILING"),
      t(4, "Regulatory penalty history", "In the last 3 years, have you paid any penalty or compounding fee to RBI, SEBI, IRDAI, or FIU-IND?", "Include penalties on partners that you reimbursed.", "Respective regulatory statutes", "Regulators publish penalties, which damages trust with lenders and investors.", "SPEND"),
      t(4, "Financial data security", "Is customer financial data stored in India with access controls, and do you have a breach response plan?", "Payment data must be stored only in India.", "RBI data localisation directive 2018 / DPDP Act 2023", "Financial data breaches carry the highest DPDP and regulatory exposure.", "PRACTICE"),
    ],
  },

  "Logistics & Supply Chain": {
    regulators: ["RTO / State Transport Authority", "GST department (e-way bills)", "Customs (for CHA / freight forwarding)", "Labour department", "Fire department / municipal (warehouses)"],
    licences: ["Goods carriage permits and fitness certificates", "Registration as a common carrier (Carriage by Road Act)", "GST", "Warehouse trade licence and Fire NOC", "Customs broker licence / MTO registration (if applicable)"],
    counterparties: ["shippers and e-commerce clients", "fleet owners and attached vehicle operators", "drivers and gig delivery partners", "warehouse landlords"],
    disputes: ["cargo damage and shortage claims", "road accident claims (MACT)", "e-way bill detentions", "client payment withholding"],
    topics: [
      t(1, "Cargo damage / shortage claims", "Are any clients currently claiming compensation from you for damaged, lost, or short-delivered goods?", "Include deductions made from your invoices.", "Carriage by Road Act 2007", "Without liability limits in your contract, claims can be for the full value of the goods.", "DISPUTE"),
      t(1, "Accident claims (MACT)", "Is any vehicle you own or operate involved in a pending road accident claim or criminal case?", "MACT claims can run for years.", "Motor Vehicles Act 1988", "Uninsured or policy-breach accidents make the owner personally liable for compensation.", "DISPUTE"),
      t(2, "Liability limits in client contracts", "Do your contracts with shippers cap your liability per consignment and require them to insure high-value goods?", "Use a goods forwarding note with declared value.", "Carriage by Road Act 2007, Section 10-12", "Uncapped liability lets one damaged load cost more than a month's revenue.", "HAVE"),
      t(2, "Attached vehicle / sub-vendor terms", "Do attached truck owners and delivery sub-vendors sign agreements covering insurance, driver checks, and loss liability?", "You face the client even when their vehicle causes the loss.", "Indian Contract Act 1872", "Sub-vendor losses end up on your books without back-to-back terms.", "HAVE"),
      t(3, "Permits and vehicle documents", "Do all your vehicles have valid permits, fitness certificates, PUC, and insurance, with drivers holding valid licences?", "One lapsed document can void the insurance claim.", "Motor Vehicles Act 1988", "Driving without valid documents means penalties, seizure, and denied insurance claims.", "LICENCE"),
      t(3, "E-way bill compliance", "Does every consignment move with a correct e-way bill, and are vehicle details updated when goods are transferred?", "Detentions at checkposts cost time and penalties.", "CGST Act Section 129 / Rule 138", "Goods can be detained, with penalties of up to 200% of the tax.", "PRACTICE"),
      t(4, "Goods-in-transit insurance", "Do you carry goods-in-transit or carrier's liability insurance covering your client consignments?", "Vehicle insurance does not cover the cargo.", "Insurance terms", "Uninsured cargo loss is paid from your own margin.", "COVER"),
      t(4, "Gig / driver labour obligations", "Do you register delivery partners and drivers for social security benefits and pay drivers in line with labour rules?", "The Social Security Code covers gig and platform workers.", "Code on Social Security 2020 / Motor Transport Workers Act 1961", "Labour claims and regulatory contributions can arrive with arrears.", "PRACTICE"),
    ],
  },

  "Agriculture & AgriBusiness": {
    regulators: ["State Agriculture department (seed / fertiliser / pesticide licensing)", "FSSAI", "APMC / mandi board", "State Pollution Control Board", "APEDA (exports)"],
    licences: ["Seed / fertiliser / insecticide dealer licence", "FSSAI licence for processing or storage", "APMC trader licence", "PCB consent (dairy, poultry, sugar, processing)", "Cold storage licence (state)"],
    counterparties: ["farmers and FPOs", "buyers and processors", "input suppliers", "landowners (lease)", "cold storage clients"],
    disputes: ["land and lease disputes", "spurious-input complaints from farmers", "buyer payment delays", "crop insurance claim rejections"],
    topics: [
      t(1, "Land / lease disputes", "Is any land you farm, lease, or operate on involved in a title, boundary, or tenancy dispute?", "Include family partition disputes.", "State land revenue and tenancy laws", "Land disputes can stop operations and block loans for years.", "DISPUTE"),
      t(1, "Input quality complaints", "Have farmers or buyers complained or filed cases about spurious seeds, fertiliser, feed, or produce quality?", "Includes complaints to the agriculture department.", "Seeds Act 1966 / Fertiliser Control Order 1985 / Insecticides Act 1968", "Spurious-input cases can lead to licence cancellation and criminal prosecution.", "DISPUTE"),
      t(2, "Farmer / buyer contracts", "Do you have written contracts with farmers or bulk buyers covering price, quality grades, quantity, and payment timelines?", "Verbal mandi-style deals are the most common source of disputes.", "Indian Contract Act 1872 / state contract-farming laws", "Price swings lead to defaults when there is no written agreement.", "HAVE"),
      t(2, "Land lease documentation", "Is every land lease you depend on written, signed, and registered where the lease runs longer than 11 months?", "Unregistered long leases are hard to enforce.", "Registration Act 1908 / Transfer of Property Act 1882", "An unenforceable lease can leave you without the land mid-season.", "HAVE"),
      t(3, "Dealer / processing licences", "Are your seed, fertiliser, pesticide, FSSAI, or APMC licences valid for every product and location you operate?", "Each product category usually needs its own authorisation.", "Seeds Act 1966 / FCO 1985 / FSS Act 2006", "Selling outside your licence can lead to stock seizure and suspension.", "LICENCE"),
      t(3, "Pollution / effluent consent", "If you run dairy, poultry, sugar, or processing operations, do you hold valid PCB consent and manage effluent as required?", "Poultry and dairy units above size thresholds need consent.", "Water Act 1974 / Air Act 1981", "PCB closure orders and environmental compensation can be severe.", "LICENCE"),
      t(4, "Crop / livestock insurance", "Are your crops, livestock, or stored produce insured, and do you know the claim documentation required?", "Many claims are rejected for missed intimation deadlines.", "PMFBY guidelines / insurance terms", "A failed season without cover can wipe out working capital.", "COVER"),
      t(4, "Payment delays from buyers", "In the last year, did buyers or processors delay or short-pay you, forcing you to accept a loss?", "Include sugar-cane and dairy payment delays.", "State APMC / sugarcane control laws", "Repeated short payments signal weak contracts and documentation.", "SPEND"),
    ],
  },

  "Automobiles & EVs": {
    regulators: ["RTO / State Transport department", "MoRTH (CMVR)", "State Pollution Control Board (workshops)", "BIS / ARAI (homologation)", "CPCB (Battery EPR)"],
    licences: ["Trade certificate for dealers", "Shop & Establishment and trade licence", "PCB consent and hazardous-waste authorisation (workshops)", "GST", "Authorised-dealer registration for used vehicles (Form 29C)"],
    counterparties: ["OEMs / principals (dealer agreements)", "customers", "financiers and insurers", "spare-parts suppliers"],
    disputes: ["warranty and defect complaints", "dealer termination by the OEM", "registration / transfer delays", "workshop damage claims"],
    topics: [
      t(1, "Warranty / defect complaints", "Has any customer filed a consumer complaint over a vehicle defect, warranty refusal, or a botched repair?", "Dealers are often joined as parties along with the OEM.", "Consumer Protection Act 2019", "Dealers can be ordered to replace the vehicle or refund it with compensation.", "DISPUTE"),
      t(1, "Registration / transfer issues", "Have you faced complaints or challans because a vehicle you sold was not registered or transferred in time?", "Used-vehicle sales without transfer are a major risk.", "Motor Vehicles Act 1988 / CMVR Rule 55A-55H", "Until transfer, liability for accidents and challans can stay with you.", "DISPUTE"),
      t(2, "Dealer / OEM agreement", "Have you reviewed your OEM dealer agreement for termination notice, territory, targets, and stock buy-back on exit?", "Sudden terminations leave dealers holding unsold stock.", "Indian Contract Act 1872", "Without buy-back terms, termination can leave you with crores in stranded inventory.", "HAVE"),
      t(2, "Job cards and repair authorisations", "Do customers sign job cards authorising repairs and cost estimates before work begins?", "This protects you in overcharging and damage disputes.", "Indian Contract Act 1872", "Without signed job cards, billing disputes usually go against the workshop.", "PRACTICE"),
      t(3, "Trade certificate / dealer registration", "Do you hold a valid trade certificate and, for used vehicles, an authorised-dealer registration certificate?", "Required for moving and selling unregistered or used vehicles.", "CMVR 1989 (Rules 33-35, 55A)", "Operating without them invites seizure and penalties.", "LICENCE"),
      t(3, "Waste oil and battery disposal", "Do you dispose of waste oil, batteries, and tyres through authorised recyclers, with records kept?", "Workshops generate hazardous waste under the rules.", "Hazardous Waste Rules 2016 / Battery Waste Management Rules 2022", "Improper disposal can lead to PCB penalties and environmental compensation.", "PRACTICE"),
      t(4, "Garage keeper's liability cover", "Does your insurance cover customer vehicles in your custody against fire, theft, and damage?", "Standard shop policies usually exclude customer vehicles.", "Insurance terms", "A single fire can lead to claims for several customer vehicles at once.", "COVER"),
      t(4, "Finance / insurance mis-selling exposure", "Are vehicle loans and insurance sold through you with clear disclosures and customer consent on record?", "Bundled add-ons are a frequent consumer complaint.", "IRDAI regulations / Consumer Protection Act 2019", "Mis-selling complaints lead to refunds, penalties, and loss of insurer tie-ups.", "PRACTICE"),
    ],
  },

  "Media & Entertainment": {
    regulators: ["Ministry of Information & Broadcasting", "CBFC", "ASCI / CCPA", "Copyright societies (IPRS, PPL)", "Police (event permissions)"],
    licences: ["Music licences (IPRS / PPL / Novex) for public performance", "CBFC certification (theatrical films)", "IT Rules 2021 compliance (digital publishers / OTT)", "Event permissions (police, fire, excise)", "GST"],
    counterparties: ["clients and brands", "talent, influencers and artists", "freelance crew and creators", "platforms (YouTube, OTT, Meta)", "venues and event vendors"],
    disputes: ["copyright infringement notices", "defamation claims", "unpaid invoices from brands", "talent contract disputes"],
    topics: [
      t(1, "Copyright / takedown notices", "Have you received copyright strikes, takedown notices, or legal claims over music, footage, images, or fonts you used?", "Platform strikes and courier notices both count.", "Copyright Act 1957", "Infringement can bring damages, injunctions, and loss of channels or clients.", "DISPUTE"),
      t(1, "Defamation / content complaints", "Has any person or brand threatened defamation action or complained to a platform or regulator about your content?", "Includes IT Rules grievance complaints.", "Bharatiya Nyaya Sanhita 2023 (criminal defamation) / IT Rules 2021", "Defamation can be both civil and criminal, with injunctions against publishing.", "DISPUTE"),
      t(2, "Talent and crew contracts", "Do talent, influencers, and freelance crew sign contracts assigning rights in their work and granting usage rights?", "Model and location releases are part of this.", "Copyright Act 1957, Sections 17-19", "Without assignments, talent can block distribution or demand extra fees later.", "HAVE"),
      t(2, "Client / brand agreements", "Do client agreements set deliverables, approval rounds, usage rights, kill fees, and payment timelines?", "Usage rights decide whether a client can reuse your work forever.", "Indian Contract Act 1872", "Endless revisions and unpaid kill fees are the most common revenue leaks.", "HAVE"),
      t(3, "Music and content licences", "Do you hold proper licences for every song, stock clip, and font used in your productions or events?", "\"Royalty-free\" downloads often still have usage limits.", "Copyright Act 1957", "Unlicensed use can mean claims from IPRS, PPL, or rights holders.", "LICENCE"),
      t(3, "Ad disclosure compliance", "Are paid promotions and influencer posts clearly labelled as ads, as the endorsement guidelines require?", "Applies to agencies and creators alike.", "CCPA Endorsement Guidelines 2022 / ASCI Code", "Undisclosed endorsements can bring penalties of up to ₹10 lakh.", "PRACTICE"),
      t(4, "Media liability insurance", "Do you carry media liability or E&O insurance covering IP infringement and defamation claims?", "Often required by OTT platforms and broadcasters.", "Insurance terms", "Defending one infringement suit can cost more than the project fee.", "COVER"),
      t(4, "Payment recovery costs", "In the last year, did you write off or spend heavily chasing unpaid client or brand invoices?", "Count invoices outstanding over 90 days.", "MSMED Act 2006 / Indian Contract Act", "Poor contract terms make recovery expensive and slow.", "SPEND"),
    ],
  },

  "Energy & Environment": {
    regulators: ["State Pollution Control Board / CPCB", "State DISCOM and Electrical Inspectorate (CEIG)", "MNRE", "PESO (petroleum / explosives)", "Ministry of Mines / State Mining department"],
    licences: ["PCB Consent to Operate", "CPCB EPR / recycler registration (e-waste, plastic, battery)", "Hazardous waste authorisation", "CEIG electrical safety approval", "PESO licences (fuel storage)"],
    counterparties: ["EPC clients and project developers", "DISCOMs (PPA, net-metering)", "waste generators and producers (EPR)", "equipment suppliers", "sub-contractors"],
    disputes: ["EPC performance and delay claims", "DISCOM payment delays", "environmental compensation notices", "EPR certificate disputes"],
    topics: [
      t(1, "Pollution board / NGT actions", "Has the Pollution Control Board, CPCB, or NGT issued you a notice, environmental compensation demand, or closure direction?", "Include notices to clients that name you.", "Environment Protection Act 1986 / NGT Act 2010", "Environmental compensation orders can run into crores.", "DISPUTE"),
      t(1, "EPC / performance disputes", "Is any client disputing system performance, project delay, or warranty obligations on work you delivered?", "Include withheld retention money.", "Indian Contract Act 1872", "Performance guarantee claims can be invoked without a court order.", "DISPUTE"),
      t(2, "EPC / supply contracts", "Do EPC and supply contracts define performance guarantees, LD caps, warranty back-to-back with OEMs, and payment milestones?", "Uncapped LDs and generation guarantees are high risk.", "Indian Contract Act 1872, Sections 73-74", "Without back-to-back warranties, you bear failures caused by the equipment.", "HAVE"),
      t(2, "PPA / offtake agreements", "Do your power purchase or waste-offtake agreements include payment security, tariff revision, and termination compensation?", "DISCOM payment delays are a long-standing risk.", "Electricity Act 2003", "Without payment security, receivables can stay stuck for years.", "HAVE"),
      t(3, "PCB consent and waste authorisation", "Are your Consent to Operate and hazardous-waste authorisation valid for your current capacity and waste types?", "Capacity increases need amended consent.", "Water Act 1974 / Air Act 1981 / Hazardous Waste Rules 2016", "Operating without valid consent can lead to closure and prosecution.", "LICENCE"),
      t(3, "EPR / CPCB portal filings", "If you are a recycler or producer, are your EPR registrations and returns on the CPCB portal filed on time?", "Applies to e-waste, plastic, battery, and tyre EPR.", "E-Waste Rules 2022 / Plastic Waste Management Rules 2016", "EPR non-compliance can lead to environmental compensation and loss of registration.", "FILING"),
      t(4, "Project / pollution insurance", "Do you carry project all-risk, pollution liability, or public liability insurance on active sites and plants?", "Standard policies often exclude pollution incidents.", "Public Liability Insurance Act 1991", "Spill or accident liability without cover can bankrupt a small operator.", "COVER"),
      t(4, "LD and penalty payouts", "In the last 2 years, did you pay liquidated damages, guarantee invocations, or regulatory penalties?", "Include amounts deducted from your bills.", "Indian Contract Act 1872", "Recurring LDs indicate contract terms you cannot realistically meet.", "SPEND"),
    ],
  },

  "Beauty & Personal Care": {
    regulators: ["Municipal health / trade licence department", "CDSCO / State Licensing Authority (cosmetics)", "ASCI / CCPA", "Shop & Establishment inspector", "Police (spa licensing in some cities)"],
    licences: ["Trade / health licence", "Shop & Establishment registration", "Cosmetics manufacturing / import licence (if you make or import products)", "GST", "Spa / massage licence where the city requires it"],
    counterparties: ["clients", "stylists and therapists (often on commission)", "product suppliers and brands", "landlord / franchisor"],
    disputes: ["skin or hair damage claims", "client injury or allergic reaction", "stylists leaving with clients", "misleading product claims"],
    topics: [
      t(1, "Treatment damage claims", "Has any client complained, posted publicly, or sent a notice about burns, allergic reactions, or hair or skin damage?", "Include refunds given to avoid escalation.", "Consumer Protection Act 2019", "Treatment injury claims bring compensation and damage your reputation online.", "DISPUTE"),
      t(1, "Inspection / licence notices", "Has the municipal body, police, or drug authority ever issued your business a notice, fine, or sealing order?", "Spa and massage centres face frequent police inspections.", "State municipal and police acts / Drugs & Cosmetics Act 1940", "Sealing orders stop revenue immediately.", "DISPUTE"),
      t(2, "Client consent and patch-test records", "Do clients sign consent forms and have patch tests recorded before chemical, laser, or skin treatments?", "This is your main defence in a damage claim.", "Consumer Protection Act 2019", "Without consent records, most damage claims are decided against the salon.", "PRACTICE"),
      t(2, "Stylist / therapist agreements", "Do stylists and therapists sign agreements covering commission, notice period, client confidentiality, and non-solicitation?", "Commission-based staff are often still employees in law.", "Indian Contract Act 1872 / Code on Wages 2019", "Staff leaving with your client list is a major revenue loss.", "HAVE"),
      t(3, "Trade and health licence", "Are your trade licence, health licence, and Shop & Establishment registration valid for your current premises?", "Renovation or relocation usually needs fresh approval.", "State municipal acts / Shops & Establishments Acts", "Operating without licences can lead to fines and sealing.", "LICENCE"),
      t(3, "Product labelling and claims", "Do products you sell or make have proper labels, and avoid claims like \"permanent\", \"chemical-free\", or \"whitening\" without proof?", "CCPA and ASCI frequently act on beauty claims.", "Cosmetics Rules 2020 / CCPA Advertising Guidelines 2022", "Misleading claims can bring penalties and product recalls.", "PRACTICE"),
      t(4, "Treatment liability insurance", "Does your insurance cover client injury from treatments, not just fire and theft?", "Professional liability for beauty services is a separate policy.", "Insurance terms", "One serious burn claim can cost more than months of profit.", "COVER"),
      t(4, "Refunds to settle complaints", "In the last year, did you pay refunds or compensation to settle treatment complaints?", "Count free re-dos given to avoid disputes.", "Consumer Protection Act 2019", "Recurring payouts point to gaps in consent or staff training.", "SPEND"),
    ],
  },

  "Gym / Fitness & Sports": {
    regulators: ["Municipal trade licence department", "Fire department", "Shop & Establishment inspector", "FSSAI (if supplements are sold)", "Copyright societies (PPL / IPRS for music)"],
    licences: ["Trade licence", "Shop & Establishment registration", "Fire NOC", "Music licence (PPL / IPRS)", "Swimming pool licence (where applicable)", "FSSAI (if selling supplements)"],
    counterparties: ["members (membership agreements)", "trainers and coaches", "equipment vendors and lessors", "landlord / franchisor"],
    disputes: ["membership refund disputes", "member injury claims", "trainer exits taking clients", "equipment lease defaults"],
    topics: [
      t(1, "Membership refund disputes", "Has any member filed a consumer complaint or notice over refunds, freezes, or a closed branch?", "\"Non-refundable\" memberships are frequently challenged.", "Consumer Protection Act 2019", "Consumer commissions often order refunds of the unused period plus compensation.", "DISPUTE"),
      t(1, "Member injury claims", "Has any member been injured during training or on equipment and blamed you or your trainer?", "Include incidents settled informally.", "Consumer Protection Act 2019 / law of negligence", "Injury claims can be large, and waivers do not fully protect you.", "DISPUTE"),
      t(2, "Membership agreement terms", "Do members sign an agreement covering fees, freeze and refund rules, rules of conduct, and a health declaration?", "One-sided \"no refund\" clauses are often unenforceable.", "Indian Contract Act 1872 / Consumer Protection Act 2019", "Unclear terms mean disputes are decided in the member's favour.", "HAVE"),
      t(2, "Trainer contracts", "Do trainers sign contracts covering certification, personal-training revenue share, and not soliciting members after leaving?", "Trainers moving gyms with clients is a common loss.", "Indian Contract Act 1872, Section 27", "Without non-solicit clauses, member churn follows trainer exits.", "HAVE"),
      t(3, "Trade licence and fire NOC", "Are your trade licence and fire NOC valid for your floor area and number of people using the space?", "Basement and upper-floor gyms face stricter fire rules.", "State Fire Services Acts / municipal acts", "Operating without a fire NOC can lead to sealing and liability after an incident.", "LICENCE"),
      t(3, "Music licence", "Do you hold a PPL or IPRS licence for music played on your premises and in group classes?", "Playing music in a gym counts as public performance.", "Copyright Act 1957", "Rights societies can claim licence fees with penalties and seek injunctions.", "LICENCE"),
      t(4, "Public liability insurance", "Do you carry public liability insurance covering member and visitor injuries on your premises?", "Check that trainer negligence is covered.", "Insurance terms", "An uninsured serious injury claim can close a small gym.", "COVER"),
      t(4, "Health screening practice", "Do you screen new members with a PAR-Q or medical clearance before high-intensity training?", "Screening shows you took reasonable care.", "Law of negligence", "Without screening, liability for medical incidents rises sharply.", "PRACTICE"),
    ],
  },

  "Textiles & Apparel": {
    regulators: ["Factory Inspector", "State Pollution Control Board (dyeing / processing)", "Labour department / EPFO / ESIC", "Legal Metrology department", "Textile Committee / export buyer auditors"],
    licences: ["Factory licence", "PCB consent (dyeing, printing, washing units)", "ESI / PF registration", "GST (with job-work ITC-04 filing)", "Trademark registration for brands"],
    counterparties: ["export buyers and brands", "job-workers (stitching, embroidery, dyeing)", "fabric and yarn suppliers", "retailers and marketplaces"],
    disputes: ["buyer rejections and chargebacks", "job-worker quality and material loss", "design copying", "worker wage disputes"],
    topics: [
      t(1, "Buyer rejections / chargebacks", "Is any buyer currently withholding payment, claiming chargebacks, or rejecting lots over quality or delay?", "Include debit notes you have not accepted.", "Sale of Goods Act 1930", "Rejected lots without clear inspection terms usually become your loss.", "DISPUTE"),
      t(1, "Labour / wage disputes", "Have workers or the labour department raised complaints about wages, overtime, PF, or working conditions?", "Include complaints at job-worker units that supply you.", "Code on Wages 2019 / Factories Act 1948", "Labour disputes can stop production and fail buyer social audits.", "DISPUTE"),
      t(2, "Job-work agreements", "Do your stitching, embroidery, and dyeing job-workers sign agreements covering quality, wastage limits, and material return timelines?", "Material sent on job work must come back within 1 year (inputs) or 3 years (capital goods).", "CGST Act Section 143 / Indian Contract Act", "Unreturned material can become a GST liability and a write-off.", "HAVE"),
      t(2, "Buyer PO and tech-pack terms", "Do buyer POs and tech packs set approved samples, tolerances, inspection basis, and chargeback rules in writing?", "AQL levels and sign-off on approved samples matter most.", "Sale of Goods Act 1930", "Undefined tolerances let buyers reject or discount at will.", "HAVE"),
      t(3, "Dyeing / effluent consent", "If you dye, print, or wash fabric, do you hold valid PCB consent and run an ETP or CETP as required?", "Textile clusters face strict zero-liquid-discharge enforcement.", "Water Act 1974", "Effluent violations lead to closure and power disconnection.", "LICENCE"),
      t(3, "Minimum wage and PF/ESIC", "Are all workers, including piece-rate workers, paid at least the state minimum wage with PF and ESIC deposited monthly?", "Piece-rate pay must still meet the minimum.", "Code on Wages 2019 / EPF Act 1952 / ESI Act 1948", "Arrears come with damages, interest, and buyer audit failures.", "FILING"),
      t(4, "Design protection", "Are your original prints and designs registered or documented so you can stop copies?", "Design registration gives 10-15 years of protection.", "Designs Act 2000 / Copyright Act 1957", "Without registration, copied designs are hard and costly to stop.", "PRACTICE"),
      t(4, "Stock and fire insurance", "Is your fabric and finished-goods stock insured, including stock at job-worker premises?", "Stock at job-worker sites is often excluded.", "Insurance terms", "Textile unit fires spread fast, and uninsured stock is a total loss.", "COVER"),
    ],
  },

  "Gems & Jewellery": {
    regulators: ["BIS (hallmarking)", "FIU-IND (PMLA reporting for precious metal dealers)", "Legal Metrology department", "GST / Income Tax", "GJEPC / Customs (exports)"],
    licences: ["BIS hallmarking registration", "GST", "Legal Metrology verified weighing scales", "Shop & Establishment / trade licence", "IEC and GJEPC membership (exporters)"],
    counterparties: ["retail customers", "karigars and job-workers", "wholesalers and suppliers (approval / jangad memos)", "gold-loan or metal-loan banks"],
    disputes: ["purity and weight complaints", "karigar gold-loss disputes", "approval-memo stock disputes", "cash-transaction tax notices"],
    topics: [
      t(1, "Purity / weight complaints", "Has any customer complained or filed a case about gold purity, stone quality, weight, or buy-back value?", "Include complaints to BIS or the consumer helpline.", "Consumer Protection Act 2019 / BIS Act 2016", "Purity disputes damage trust and can lead to BIS penalties.", "DISPUTE"),
      t(1, "Karigar / supplier gold disputes", "Do you have unresolved disputes with karigars or suppliers over gold given on job work or stock given on approval?", "Undocumented gold movement is the biggest risk.", "Indian Contract Act 1872 / Bharatiya Nyaya Sanhita (criminal breach of trust)", "Missing gold without records is very hard to recover.", "DISPUTE"),
      t(2, "Job-work issue / receipt records", "Do karigars sign for gold issued and returned, with agreed wastage limits recorded for every lot?", "A signed issue/receipt register is your evidence.", "Indian Contract Act 1872 / CGST Act Section 143", "Without signed records, wastage disputes and losses cannot be proven.", "PRACTICE"),
      t(2, "Approval / jangad memos", "Is every piece given or taken on approval (jangad) recorded on a signed memo with value and return date?", "Approval stock is the most common source of disputes.", "Indian Contract Act 1872", "Unrecorded approval stock leads to losses and police complaints.", "PRACTICE"),
      t(3, "BIS hallmarking with HUID", "Is every gold item you sell hallmarked with a 6-digit HUID, and is your BIS registration current?", "Hallmarking is mandatory in notified districts.", "BIS (Hallmarking) Regulations 2018 / Hallmarking Order", "Selling non-hallmarked gold can bring a penalty of at least ₹1 lakh, or up to 5× the value.", "LICENCE"),
      t(3, "Cash limits and PMLA KYC", "Do you refuse cash above ₹2 lakh per transaction and complete KYC for cash deals of ₹10 lakh or more?", "Dealers in precious metals are reporting entities under PMLA.", "Income Tax Act Section 269ST / PMLA 2002", "A penalty equal to the cash received, plus PMLA scrutiny.", "PRACTICE"),
      t(4, "Jeweller's block insurance", "Do you have a jeweller's block policy covering stock in the shop, in transit, and with karigars?", "Standard shop insurance usually excludes jewellery stock.", "Insurance terms", "A single theft or robbery without cover can be catastrophic.", "COVER"),
      t(4, "Scale verification", "Are your weighing scales verified and stamped by Legal Metrology every year, with certificates displayed?", "Unverified scales are a common inspection fine.", "Legal Metrology Act 2009", "Fines and seizure of scales can follow inspections.", "LICENCE"),
    ],
  },

  "Social Sector & NGO": {
    regulators: ["Income Tax department (12AB / 80G)", "MHA (FCRA)", "Registrar of Companies (Section 8) / Charity Commissioner / Registrar of Societies", "NITI Aayog (NGO Darpan)", "MCA (CSR-1)"],
    licences: ["Trust / Society / Section 8 registration", "12AB and 80G registration (5-year validity)", "FCRA registration (if receiving foreign funds)", "CSR-1 registration", "NGO Darpan ID"],
    counterparties: ["donors and CSR funders (grant agreements)", "implementation partners", "staff and volunteers", "beneficiaries"],
    disputes: ["donor queries on fund utilisation", "FCRA compliance actions", "trustee / governing body disputes", "beneficiary complaints"],
    topics: [
      t(1, "Donor / regulator queries", "Has any donor, the Income Tax department, or MHA questioned how your organisation used its funds?", "Include CSR audit observations.", "Income Tax Act / FCRA 2010", "Fund-use queries can lead to grant recovery and loss of exemptions.", "DISPUTE"),
      t(1, "Governance disputes", "Is there any dispute among trustees, members, or the governing body over control, elections, or funds?", "Include cases before the Charity Commissioner.", "Indian Trusts Act 1882 / Societies Registration Act 1860", "Governance disputes can freeze bank accounts and grants.", "DISPUTE"),
      t(2, "Grant agreements", "Does every grant or CSR fund come with a signed agreement setting out deliverables, reporting, and what happens to unspent funds?", "CSR funders require utilisation certificates.", "Companies (CSR Policy) Rules 2014", "Unclear terms can lead to fund recovery demands at the end of the project.", "HAVE"),
      t(2, "Staff and volunteer agreements", "Do staff and volunteers sign agreements covering conduct, confidentiality of beneficiary data, and child-protection rules?", "Essential if you work with children or vulnerable groups.", "POCSO Act 2012 / JJ Act 2015", "Misconduct by an unscreened volunteer creates serious liability.", "HAVE"),
      t(3, "12AB / 80G re-registration", "Are your 12AB and 80G registrations current under the 5-year renewal regime, with Form 10BD donor statements filed?", "Donors cannot claim deductions without Form 10BD filings.", "Income Tax Act Sections 12AB, 80G", "Losing exemptions makes the organisation taxable on its income.", "FILING"),
      t(3, "FCRA compliance", "If you receive foreign funds, are they received only in the FCRA SBI New Delhi account, with FC-4 returns filed on time?", "Foreign funds cannot be passed on to another NGO.", "FCRA 2010 (amended 2020)", "FCRA violations can lead to cancellation and freezing of foreign funds.", "FILING"),
      t(4, "Audit readiness", "Are your accounts audited each year, with Form 10B/10BB filed and utilisation certificates ready for every grant?", "Late audit filings risk your exemption.", "Income Tax Act Section 12A(1)(b)", "Missed audit filings can lead to tax on the full year's income.", "FILING"),
      t(4, "Beneficiary data protection", "Is beneficiary data (health, ID, financial) collected with consent and stored securely?", "NGOs count as data fiduciaries under the DPDP Act.", "Digital Personal Data Protection Act 2023", "Data leaks harm beneficiaries and expose the NGO to penalties.", "PRACTICE"),
    ],
  },

  "Government / PSU / Defence": {
    regulators: ["Procuring departments / PSUs", "GeM", "CVC (vigilance)", "Ministry of Defence / DPIIT (defence licensing)", "Labour department (site compliance)"],
    licences: ["GeM seller registration", "Vendor empanelment with departments / PSUs", "Industrial licence for notified defence items", "Contract Labour Act licence (site work)", "GST"],
    counterparties: ["government departments and PSUs", "sub-contractors and consortium partners", "banks (performance guarantees)"],
    disputes: ["delayed payments and withheld bills", "liquidated damages deductions", "blacklisting / debarment", "bank guarantee invocation"],
    topics: [
      t(1, "Payment / LD disputes", "Is any department or PSU withholding your bills, deducting liquidated damages, or delaying payment beyond contract terms?", "Include deductions you have objected to.", "Indian Contract Act 1872 / Arbitration Act 1996", "Government payment disputes can lock up capital for years.", "DISPUTE"),
      t(1, "Blacklisting / debarment notices", "Have you ever received a show-cause notice for blacklisting, debarment, or bank guarantee forfeiture?", "Include GeM suspension notices.", "GFR 2017 / department procurement manuals", "Debarment shuts you out of all government business for years.", "DISPUTE"),
      t(2, "Tender terms review", "Before bidding, does a lawyer or expert review tender terms on LD caps, termination, arbitration, and payment timelines?", "Bid terms become your contract once accepted.", "GFR 2017 / Indian Contract Act", "Accepting one-sided terms unreviewed is the root of most government contract losses.", "PRACTICE"),
      t(2, "Sub-contractor back-to-back terms", "Do your sub-contracts mirror the government contract's specifications, LDs, warranties, and security requirements?", "Defence work also requires confidentiality flow-down.", "Indian Contract Act 1872 / Official Secrets Act 1923", "Gaps leave you absorbing penalties caused by sub-contractors.", "HAVE"),
      t(3, "Vendor registrations", "Are your GeM, vendor empanelment, and any defence or industrial licences current, with the right product categories listed?", "Expired registrations can disqualify bids.", "GFR 2017 / IDR Act 1951", "Lapsed registrations mean rejected bids and lost renewals.", "LICENCE"),
      t(3, "Site labour compliance", "On government sites, do you hold contract labour licences and pay minimum wages, PF, and ESIC as tender terms require?", "Departments increasingly verify these before releasing bills.", "Contract Labour Act 1970 / Code on Wages 2019", "Bills are withheld until labour compliance is shown.", "FILING"),
      t(4, "Bank guarantee exposure", "Do you track all performance and advance bank guarantees, with their expiry and release dates?", "Guarantees often stay with the department long after the work ends.", "Contract terms", "Unreleased guarantees block bank limits needed for new bids.", "PRACTICE"),
      t(4, "Arbitration / dispute spend", "In the last 3 years, did you spend significantly on arbitration or litigation against government clients?", "Include amounts still under arbitration.", "Arbitration and Conciliation Act 1996", "Recurring disputes signal that bids are priced without legal risk factored in.", "SPEND"),
    ],
  },

  "Other": {
    regulators: ["GST department", "Income Tax department", "Municipal authority", "State labour department"],
    licences: ["Udyam (MSME) registration", "GST (if above threshold or selling interstate / online)", "Shop & Establishment registration", "Professional tax", "Partnership deed / firm registration"],
    counterparties: ["clients and customers", "suppliers", "freelancers and staff", "landlord / housing society"],
    disputes: ["non-payment by clients", "scope disputes", "partner disagreements", "residential premises use complaints"],
    topics: [
      t(1, "Client non-payment", "Is any client currently refusing to pay or delaying payment for work you have already delivered?", "Include amounts overdue by more than 60 days.", "Indian Contract Act 1872 / MSMED Act 2006", "Small businesses often write off dues because there is no paper trail.", "DISPUTE"),
      t(1, "Partner / co-owner disputes", "Do you have any disagreement with a partner or co-owner over profit share, capital, or exit?", "Includes family business disputes.", "Indian Partnership Act 1932", "Partner disputes can freeze the bank account and the business.", "DISPUTE"),
      t(2, "Client contracts / quotes", "Do clients accept a written quote or contract with scope, price, and payment terms before you start work?", "Email or WhatsApp acceptance of a detailed quote counts.", "Indian Contract Act 1872", "Without written terms, scope and payment disputes rarely go your way.", "HAVE"),
      t(2, "Partnership deed", "If you have partners, is there a signed, registered partnership deed covering profit share, roles, and exit?", "An unregistered firm cannot sue third parties to enforce its contracts.", "Indian Partnership Act 1932, Section 69", "An unregistered firm has limited legal remedies.", "HAVE"),
      t(3, "Udyam and GST registration", "Are you registered on Udyam, and do you have GST registration if your turnover or online selling requires it?", "Udyam unlocks MSME payment-delay protection.", "MSMED Act 2006 / CGST Act 2017", "Missing GST registration leads to tax, interest, and penalties on past sales.", "LICENCE"),
      t(3, "Home / premises use permission", "If you run the business from home or a residential building, have you checked municipal and housing society rules for commercial use?", "Some activities need a trade licence even at home.", "State municipal acts / housing society bye-laws", "Commercial use without permission can lead to fines and sealing.", "PRACTICE"),
      t(4, "Business insurance", "Do you have any insurance covering your equipment, stock, or liability to clients?", "Home insurance usually excludes business use.", "Insurance terms", "One incident can wipe out savings put into the business.", "COVER"),
      t(4, "Income tax and TDS filings", "Do you file income tax returns on time and claim TDS credits deducted by your clients?", "Check Form 26AS every quarter.", "Income Tax Act 1961", "Missed TDS credits and late filing fees are pure avoidable loss.", "FILING"),
    ],
  },
};

// ─── Sub-category rules (checked first; may add facts and topics) ────────────

const SUB_RULES: SubRule[] = [
  { match: /\bbar\b|liquor|brewery|craft beer|winery|distillery/i,
    regulators: ["State Excise department"], licences: ["Excise licence (bar / FL / brewery / distillery)", "Label and brand registration with Excise"],
    topics: [
      t(3, "Excise licence", "Is your excise licence valid for the exact premises, seating, and type of liquor you serve or produce?", "Renewal is annual in most states, and changes need prior approval.", "State Excise Act", "Serving without a valid excise licence can lead to sealing, seizure, and prosecution.", "LICENCE"),
      t(1, "Excise violations", "Has your business ever been booked for serving after hours, serving minors, or selling on dry days?", "Includes compounded cases.", "State Excise Act", "Repeat violations can lead to licence suspension or cancellation.", "DISPUTE"),
    ] },
  { match: /pharmacy|chemist/i, exclusive: true,
    regulators: ["State Drug Controller / Drug Inspector", "CDSCO", "State Pharmacy Council", "NCB / State excise (narcotic drugs)", "Legal Metrology department", "GST department"],
    licences: ["Retail drug licence (Form 20 & 21) / wholesale (20B & 21B)", "Registered pharmacist named on the licence", "Schedule X licence (Form 20F) if applicable", "Shop & Establishment registration", "GST", "FSSAI registration (for nutraceuticals / baby food)"],
    counterparties: ["pharma distributors and C&F agents", "registered pharmacist and counter staff", "online pharmacy / delivery partners", "landlord", "prescribing doctors"],
    disputes: ["Drug Inspector show-cause notices and licence suspension", "customer complaints about wrong or expired medicine", "distributor disputes over expiry returns and credit", "pharmacist leaving and licence becoming non-compliant"],
    topics: [
      t(1, "Drug Inspector actions", "Has a Drug Inspector ever issued your pharmacy a show-cause notice, suspended your licence, or seized stock?", "Includes inspection reports with violations noted.", "Drugs and Cosmetics Act 1940, Sections 18 and 22", "Licence suspension stops all sales; repeat findings can lead to cancellation.", "DISPUTE"),
      t(1, "Wrong / expired medicine complaints", "Has any customer complained about being given a wrong, substituted, or expired medicine at your counter?", "Includes complaints settled at the counter.", "Consumer Protection Act 2019 / Drugs and Cosmetics Act 1940", "Dispensing errors can lead to consumer cases and criminal negligence complaints.", "DISPUTE"),
      t(3, "Drug licence and pharmacist", "Is your drug licence (Form 20/21) valid, with a registered pharmacist present during all opening hours?", "Selling without a pharmacist present is a licence violation.", "Drugs and Cosmetics Act 1940 / Rules 1945", "Licence suspension or cancellation, and prosecution for selling without a pharmacist.", "LICENCE"),
      t(3, "Schedule H / H1 registers", "Do you sell Schedule H/H1 drugs only on prescription and keep the H1 register with prescriber and patient details?", "Drug Inspectors check the H1 register first.", "Drugs and Cosmetics Rules, Rule 65", "Missing registers are the most common reason for licence suspension.", "PRACTICE"),
      t(3, "Cold chain records", "Do you store vaccines, insulin, and other cold-chain medicines in a dedicated fridge with daily temperature logs?", "Inspectors check temperature records for refrigerated drugs.", "Drugs and Cosmetics Rules, Rule 65 / storage conditions on the label", "Improperly stored drugs count as sub-standard, with seizure and licence action.", "PRACTICE"),
      t(3, "Narcotic / Schedule X controls", "If you stock narcotic or Schedule X drugs, do you hold the required licence and keep separate locked stock and registers?", "Codeine syrups and tramadol are frequent enforcement targets.", "NDPS Act 1985 / Drugs and Cosmetics Rules (Form 20F)", "NDPS violations carry imprisonment, not just fines.", "LICENCE"),
      t(2, "Expiry return terms", "Do your distributors agree in writing to take back near-expiry and expired stock for credit?", "Unclear return terms are a steady loss for chemists.", "Indian Contract Act 1872", "Expired stock you cannot return is a direct write-off.", "HAVE"),
      t(2, "Pharmacist employment terms", "Does your registered pharmacist have a written contract with a notice period long enough for you to find a replacement?", "Your licence depends on a named pharmacist — a sudden exit leaves you non-compliant.", "Drugs and Cosmetics Rules / Indian Contract Act 1872", "Without a replacement in time, you must stop selling prescription drugs.", "HAVE"),
      t(2, "Online / delivery partner terms", "If you take orders through an online pharmacy or delivery app, does your agreement cover prescription checks and who is liable for errors?", "Platforms often push dispensing liability back onto the chemist.", "Drugs and Cosmetics Act 1940 / IT Act 2000", "You may carry full liability for orders the platform collected.", "HAVE"),
      t(4, "Expired stock write-offs", "In the last year, did you write off significant expired or damaged stock that distributors refused to take back?", "Count the value at purchase price.", "Indian Contract Act 1872", "Recurring write-offs come straight out of margin.", "SPEND"),
      t(4, "Stock and dispensing liability insurance", "Is your stock insured against fire and theft, and do you have cover for claims from dispensing errors?", "Shop policies rarely cover professional liability.", "Insurance terms", "One fire or dispensing claim can wipe out a year's margin.", "COVER"),
    ] },
  { match: /medical equipment|surgical equipment/i, exclusive: true,
    regulators: ["CDSCO / State Licensing Authority (Medical Devices)", "BIS", "Legal Metrology department", "GST department", "Hospital procurement departments"],
    licences: ["Medical device registration for sale (Form MD-42) / manufacturing licence (MD-5 / MD-9)", "Import licence (MD-15) if importing", "GST", "IEC (if importing)", "ISO 13485 (buyer requirement)"],
    counterparties: ["OEM principals (distribution agreements)", "hospitals and clinics (supply and AMC contracts)", "government tenders / GeM", "service engineers"],
    disputes: ["device failure or patient injury claims", "hospital payment delays", "AMC penalty and downtime claims", "OEM termination of distributorship"],
    topics: [
      t(1, "Device failure claims", "Has any hospital or patient blamed a device you supplied for a failure, injury, or wrong reading?", "Include complaints passed on by the OEM.", "Consumer Protection Act 2019 (product liability) / Medical Devices Rules 2017", "Device liability claims can be large, and regulators may order recalls.", "DISPUTE"),
      t(1, "Hospital payment disputes", "Are hospitals or government buyers withholding payments or deducting penalties on your supplies or AMCs?", "Include disputed downtime penalties.", "Indian Contract Act 1872 / MSMED Act 2006", "Hospital receivables can stay stuck for months without clear terms.", "DISPUTE"),
      t(2, "OEM distribution agreement", "Does your OEM distribution agreement cover territory, exclusivity, warranty support, and stock buy-back if they terminate?", "OEMs often switch distributors with short notice.", "Indian Contract Act 1872", "Termination without buy-back leaves you with unsellable stock.", "HAVE"),
      t(2, "AMC / uptime terms", "Do your AMC and supply contracts with hospitals cap downtime penalties and say who pays for spares?", "Uptime guarantees are a common source of deductions.", "Indian Contract Act 1872, Section 74", "Uncapped uptime penalties can wipe out the AMC margin.", "HAVE"),
      t(3, "Medical device licence", "Do you hold the CDSCO licence or registration your devices need (MD-42 for sale, MD-15 for import, MD-5/9 for manufacture)?", "All notified medical devices are now regulated.", "Medical Devices Rules 2017", "Selling unlicensed devices is an offence, with seizure and prosecution.", "LICENCE"),
      t(3, "Device traceability records", "Do you keep batch or serial-number records of every device sold, so you can trace buyers in a recall?", "Required for field safety notices and recalls.", "Medical Devices Rules 2017 (post-market surveillance)", "Without traceability, a recall becomes impossible to execute.", "PRACTICE"),
      t(4, "Product liability insurance", "Do you carry product liability insurance covering patient injury from devices you supply or service?", "OEM cover may not extend to distributors or service work.", "Insurance terms", "An uninsured device claim can exceed years of margin.", "COVER"),
      t(4, "Tender penalty payouts", "In the last 2 years, did you pay liquidated damages or forfeit guarantees on hospital or government supply contracts?", "Include GeM penalties.", "GFR 2017 / contract terms", "Repeated LDs show bids are accepted without checking delivery risk.", "SPEND"),
    ] },
  { match: /hospital|nursing home/i,
    licences: ["AERB licence for radiology equipment", "PCPNDT registration (if ultrasound)", "NABH accreditation (optional / insurer requirement)"],
    topics: [
      t(3, "Hospital fire safety", "Does your hospital have a valid fire NOC, working sprinklers and alarms, and fire drills recorded for ICU and ward staff?", "Hospital fires have led to criminal cases against management.", "State Fire Services Acts / National Building Code", "Fire incidents without compliance can lead to arrest of management and sealing.", "LICENCE"),
      t(1, "Medico-legal case handling", "Do you register medico-legal cases and inform the police as required for accidents, poisoning, and assault?", "Emergency treatment cannot be refused pending police formalities.", "BNSS 2023 / Supreme Court ruling in Parmanand Katara (1989)", "Mishandled MLCs lead to police and court proceedings against doctors.", "PRACTICE"),
    ] },
  { match: /diagnostic|pathology|blood bank/i,
    licences: ["NABL accreditation (optional)", "Blood bank licence from CDSCO / State (if applicable)", "PCPNDT registration (if ultrasound)"],
    topics: [
      t(3, "Report sign-off", "Is every lab report signed by a registered pathologist or qualified doctor, not just a technician?", "Technician-only reports have been held illegal.", "NMC regulations / Supreme Court ruling (2017)", "Reports without valid sign-off can be held invalid and expose you to negligence claims.", "PRACTICE"),
      t(3, "PCPNDT compliance", "If you do ultrasound, are your PCPNDT registration, Form F records, and display of the \"no sex determination\" notice all in order?", "Incomplete Form F records are prosecuted.", "PCPNDT Act 1994", "Can lead to sealing of machines, registration suspension, and imprisonment.", "LICENCE"),
    ] },
  { match: /dental/i,
    regulators: ["State Dental Council"], licences: ["Dental Council registration for all dentists", "AERB registration for dental X-ray / OPG"],
    topics: [t(3, "Dental council and AERB", "Are all dentists registered with the State Dental Council, and are your X-ray/OPG units registered with AERB?", "Includes intraoral X-ray (RVG) units.", "Dentists Act 1948 / Atomic Energy (Radiation Protection) Rules 2004", "Unregistered X-ray units can be sealed by AERB.", "LICENCE")] },
  { match: /ivf|fertility/i,
    licences: ["ART clinic / bank registration with the National Registry"],
    topics: [t(3, "ART Act registration", "Is your clinic registered under the ART Act, with written consent from donors and couples, and records kept as required?", "Applies to IVF clinics and gamete banks.", "Assisted Reproductive Technology (Regulation) Act 2021", "Violations carry fines of up to ₹10 lakh and imprisonment.", "LICENCE")] },
  { match: /mental health|counsell?ing/i,
    topics: [t(3, "Mental Healthcare Act compliance", "Is your establishment registered as a mental health establishment, with client records kept confidential?", "Confidentiality is a statutory right of clients.", "Mental Healthcare Act 2017", "Breach of confidentiality or non-registration leads to penalties and complaints.", "LICENCE")] },
  { match: /telemedicine|health app|healthtech|medtech/i,
    topics: [
      t(3, "Telemedicine guidelines", "Do doctors on your platform follow the Telemedicine Practice Guidelines on identity checks, consent, and the list of drugs they can prescribe?", "Some drugs cannot be prescribed over teleconsultation.", "Telemedicine Practice Guidelines 2020", "Non-compliant prescriptions expose both the doctor and the platform.", "PRACTICE"),
      t(3, "Medical device software", "Have you checked whether your software or device counts as a medical device that needs CDSCO registration?", "Diagnostic software can be regulated as a medical device.", "Medical Devices Rules 2017", "Selling an unregistered medical device is an offence.", "LICENCE"),
    ] },
  { match: /ayurved|ayush|homeopath|naturopathy/i,
    regulators: ["NCISM / NCH / State AYUSH board"], licences: ["Practitioner registration with NCISM / NCH / State board", "AYUSH drug licence (if dispensing / manufacturing)"],
    topics: [t(3, "AYUSH registration and ad claims", "Are practitioners registered with the AYUSH board, and do ads avoid \"cure\" claims for listed diseases?", "Advertising cures for listed diseases is banned.", "Drugs and Magic Remedies Act 1954 / NCISM Act 2020", "Misleading cure claims can lead to prosecution and practitioner action.", "PRACTICE")] },
  { match: /fintech|payment gateway|wallet|prepaid|p2p|crypto|digital asset/i,
    topics: [
      t(3, "Payments / PPI authorisation", "Does your product hold the exact RBI authorisation it needs (PA, PPI, P2P NBFC) or operate through a licensed partner?", "Running money flows through a nodal account without a licence is high risk.", "Payment and Settlement Systems Act 2007", "Unauthorised payment operations carry criminal liability.", "LICENCE"),
      t(3, "VDA / FIU registration", "If you deal in crypto or digital assets, are you registered with FIU-IND and complying with KYC and reporting?", "VDA service providers are reporting entities under PMLA.", "PMLA 2002 (VDA notification, March 2023)", "Unregistered VDA platforms have been blocked and penalised.", "FILING"),
    ] },
  { match: /chit fund/i,
    topics: [t(3, "Chit Funds Act registration", "Is every chit group registered with the Chit Registrar, with security deposited before starting?", "Unregistered chits are illegal.", "Chit Funds Act 1982", "Running unregistered chits can lead to prosecution.", "LICENCE")] },
  { match: /insurance agent|insurance broker|insurance aggregator|insurtech|motor insurance/i,
    topics: [t(3, "IRDAI licence", "Do you and every person selling policies hold a valid IRDAI licence or POSP certification?", "Selling without a licence is prohibited.", "Insurance Act 1938 / IRDAI regulations", "Penalties and blacklisting by insurers.", "LICENCE")] },
  { match: /stock broker|portfolio|investment banking|mutual fund|wealth|financial planning/i,
    topics: [t(3, "SEBI / AMFI registration", "Do you hold the correct SEBI or AMFI registration for advice, distribution, or portfolio management, kept separate as the rules require?", "Advice and distribution must be kept separate.", "SEBI (Investment Advisers) Regulations 2013 / AMFI ARN", "Unregistered advice can lead to SEBI orders and refund directions.", "LICENCE")] },
  { match: /coaching|test prep|tutorial/i,
    topics: [t(3, "Coaching centre guidelines", "Do you avoid enrolling students under 16 and follow the pro-rata fee refund and registration rules for coaching centres?", "Many states have adopted these guidelines.", "Guidelines for Regulation of Coaching Centres 2024", "Fines and cancellation of registration.", "PRACTICE")] },
  { match: /^school|pre-school|montessori|waldorf|daycare|creche/i,
    topics: [
      t(3, "RTE and fee regulation", "Do you comply with RTE 25% EWS admissions (where applicable) and your state's fee regulation approval process?", "Fee hikes often need committee approval.", "RTE Act 2009 / state fee regulation acts", "Fee disputes and recognition withdrawal.", "PRACTICE"),
      t(4, "School transport safety", "Do your school buses meet safety norms: GPS, speed governors, female attendants, and verified drivers?", "Applies to contracted buses too.", "Motor Vehicles Act 1988 / CBSE and state guidelines", "Any bus incident creates criminal and civil liability for management.", "PRACTICE"),
    ] },
  { match: /edtech|online course|e-learning|upskilling/i,
    topics: [
      t(3, "Children's data consent", "If users are under 18, do you obtain verifiable parental consent and avoid tracking or targeted ads to them?", "A specific DPDP obligation.", "DPDP Act 2023, Section 9", "Higher penalty category, up to ₹200 crore.", "PRACTICE"),
      t(2, "Subscription and refund terms", "Are auto-renewals, EMI loan tie-ups, and refund terms clearly disclosed and agreed before purchase?", "EdTech loan mis-selling is a major complaint category.", "Consumer Protection Act 2019 / Dark Patterns Guidelines 2023", "Refund orders and CCPA action.", "HAVE"),
    ] },
  { match: /hotel|resort|guesthouse|guest house|b&b|homestay|airbnb/i,
    topics: [t(3, "Homestay / hotel registration", "Is your property registered with the state tourism department or local authority as a hotel or homestay?", "Many states require homestay registration.", "State tourism / homestay schemes", "Unregistered operation can lead to fines and OTA delisting.", "LICENCE")] },
  { match: /travel agency|tour operator|holiday package|visa assistance|pilgrimage|adventure/i,
    topics: [
      t(3, "TCS on overseas packages", "Do you collect and deposit TCS on overseas tour packages and file TCS returns on time?", "TCS applies to overseas package sales.", "Income Tax Act Section 206C(1G)", "Interest and penalties on uncollected TCS.", "FILING"),
      t(2, "Package / booking terms", "Do customers accept written terms on cancellation charges, refund timelines, and your liability for airline or hotel failures?", "Agencies are often held liable for vendor failures.", "Consumer Protection Act 2019", "Refund orders for third-party failures.", "HAVE"),
    ] },
  { match: /event|banquet|wedding|mice|live event/i,
    topics: [t(3, "Event permissions", "Do you obtain police permission, fire clearance for temporary structures, and PPL/IPRS licences for music at events?", "Each event may need fresh permissions.", "State police acts / Copyright Act 1957", "Events can be stopped mid-way, and organisers face liability.", "LICENCE")] },
  { match: /real estate agent|real estate consult/i,
    topics: [
      t(3, "RERA agent registration", "Are you registered as a RERA real estate agent in every state where you broker project sales?", "Registration is mandatory for agents selling RERA projects.", "RERA 2016, Section 9", "Penalty of ₹10,000 per day while the default continues.", "LICENCE"),
      t(2, "Brokerage agreements", "Do clients sign a brokerage agreement stating your commission and when it becomes payable, before you show properties?", "Commission claims based on verbal promises often fail.", "Indian Contract Act 1872", "Unrecoverable commission.", "HAVE"),
    ] },
  { match: /residential builder|commercial developer|housing developer|community developer|plot|land developer|rera-registered/i,
    topics: [
      t(3, "RERA escrow (70%)", "Do you deposit 70% of buyer collections in the RERA project account and withdraw only against certified progress?", "Withdrawals need CA, engineer, and architect certificates.", "RERA 2016, Section 4(2)(l)(D)", "Penalties of up to 5% of project cost and personal liability.", "PRACTICE"),
      t(2, "RERA-compliant sale agreement", "Do your buyer agreements follow the state RERA model agreement, including carpet area, possession date, and delay interest?", "Deviations from the model are often struck down.", "RERA 2016, Section 13", "Unenforceable clauses and refund orders with interest.", "HAVE"),
    ] },
  { match: /contractor|construction|infrastructure|interior contracting|modular/i,
    topics: [t(3, "Contract labour licence", "Do you hold a Contract Labour licence for each site, with worker wages, PF, and ESIC records maintained?", "Required where 20 or more contract workers are engaged.", "Contract Labour Act 1970", "Prosecution and blocked bill payments by principal employers.", "LICENCE")] },
  { match: /architect/i,
    topics: [t(3, "Council of Architecture registration", "Are the people using the title \"architect\" in your firm registered with the Council of Architecture?", "Only registered persons can use the title.", "Architects Act 1972", "Use of the title without registration is an offence.", "LICENCE")] },
  { match: /coworking|property management/i,
    topics: [t(2, "Leave & licence agreements", "Are member and tenant agreements written as registered leave-and-licence agreements with lock-in and exit terms?", "Registration is mandatory for leases in many states.", "Registration Act 1908 / state rent acts", "Unregistered agreements are hard to enforce for eviction or dues.", "HAVE")] },
  { match: /restaurant|dhaba|caf[eé]|fast food|food truck|street food|chaat|canteen|mess|fine dining|ice cream|dessert|juice|sweet shop|mithai/i,
    topics: [t(3, "Eating house / health trade licence", "Do you hold the municipal health trade licence and, where your state requires it, a police eating house licence?", "Both are inspected along with your FSSAI licence.", "State municipal / police acts", "Sealing for operating without local licences.", "LICENCE")] },
  { match: /cloud kitchen|tiffin/i,
    topics: [t(3, "Kitchen premises zoning", "Is your kitchen located in premises where commercial cooking is permitted under municipal zoning and fire rules?", "Residential-area kitchens are a frequent sealing target.", "Municipal / town-planning laws", "Sealing and loss of aggregator listing.", "LICENCE")] },
  { match: /manufacturer|processor|packaged|beverage|snack|dairy|pickle|papad|spice|organic food|bakery/i, cats: ["Food & Beverage"],
    topics: [t(3, "Food label compliance", "Do your product labels carry the FSSAI logo and licence number, ingredients, allergens, nutrition panel, veg/non-veg mark, and best-before date?", "Label errors are a frequent cause of FSSAI notices and recalls.", "FSS (Labelling & Display) Regulations 2020", "Recalls and penalties of up to ₹3 lakh for misbranding.", "PRACTICE")] },
  { match: /jewell|gold|diamond|bullion|\bgem|hallmark/i,
    regulators: ["BIS (hallmarking)", "FIU-IND"], licences: ["BIS hallmarking registration"],
    topics: [t(3, "Hallmarking with HUID", "Is every gold item you sell hallmarked with HUID, and is your BIS registration current?", "Mandatory in notified districts.", "BIS Hallmarking Order", "Penalties of at least ₹1 lakh.", "LICENCE")] },
  { match: /export/i,
    licences: ["IEC", "RCMC"],
    topics: [t(3, "Export realisation", "Are all export proceeds realised on time and open EDPMS entries cleared with your bank?", "Unrealised exports can lead to caution-listing.", "FEMA 1999", "Caution-listing and compounding penalties.", "FILING")] },
  { match: /import/i,
    topics: [t(3, "Import product compliance", "Do your imported goods carry the required BIS, FSSAI, or Legal Metrology importer labels before sale?", "Many products need certification before customs clearance.", "BIS Act 2016 / Legal Metrology Rules", "Goods held at customs or seized on sale.", "LICENCE")] },
  { match: /e-commerce|dropshipping|social commerce|quick commerce|dark store|d2c/i, cats: ["Retail & E-Commerce"],
    topics: [
      t(3, "E-commerce disclosures", "Do your listings show the seller name, country of origin, total price including charges, and grievance officer contact?", "Mandatory disclosures under the e-commerce rules.", "Consumer Protection (E-Commerce) Rules 2020", "CCPA penalties and delisting.", "PRACTICE"),
      t(1, "Marketplace account actions", "Has a marketplace ever suspended your account, withheld payouts, or raised a claim against you?", "Include A-to-Z or SAFE-T claims you lost.", "Seller agreement terms", "Frozen payouts disrupt cash flow.", "DISPUTE"),
    ] },
  { match: /franchise/i,
    topics: [t(2, "Franchise agreement", "Does your franchise agreement clearly cover territory, royalty, renewal, exit, and what happens to the outlet on termination?", "Termination and non-compete clauses decide your exit value.", "Indian Contract Act 1872 / Trade Marks Act 1999", "Losing the outlet investment on termination.", "HAVE")] },
  { match: /electronics|mobile \/ gadget|electrical equipment/i,
    topics: [t(3, "BIS CRS and e-waste EPR", "Are your electronic products BIS-registered under CRS, and do you meet e-waste EPR obligations if you are a producer or importer?", "Applies to many consumer electronics.", "BIS Act 2016 / E-Waste Rules 2022", "Seizure and environmental compensation.", "LICENCE")] },
  { match: /chemical|pharma manufacturer|paint|coating|adhesive|sealant/i,
    topics: [t(3, "Hazardous chemical / drug manufacturing", "Do you hold the required drug manufacturing licence (revised Schedule M) or hazardous chemical approvals, with safety audits done?", "Revised Schedule M applies to all drug manufacturers.", "Drugs and Cosmetics Rules (Schedule M) / MSIHC Rules 1989", "Licence suspension and major accident liability.", "LICENCE")] },
  { match: /plastic|packaging/i,
    topics: [t(3, "Plastic EPR registration", "Are you registered on the CPCB EPR portal as a producer, importer, or brand owner, with annual returns filed?", "Applies to most plastic packaging users.", "Plastic Waste Management Rules 2016 (amended 2022)", "Environmental compensation and registration suspension.", "FILING")] },
  { match: /cosmetics brand|perfume|fragrance|beauty products brand/i,
    topics: [t(3, "Cosmetics licence", "Do you hold a CDSCO cosmetics manufacturing or import registration, or make products only through a licensed manufacturer?", "Loan-licence arrangements must be documented.", "Cosmetics Rules 2020", "Seizure of stock and prosecution.", "LICENCE")] },
  { match: /\bspa\b|massage/i,
    topics: [t(3, "Spa licensing", "Does your spa hold the city's specific spa or massage licence, with staff verification and CCTV as required?", "Many cities have separate spa licensing rules.", "State / city police and municipal rules", "Raids, sealing, and licence cancellation.", "LICENCE")] },
  { match: /swimming|aquatic/i,
    topics: [t(3, "Pool safety", "Do you have certified lifeguards on duty, water quality records, and the municipal licence for your pool?", "Drowning incidents create criminal liability.", "Municipal / state sports regulations", "Criminal negligence cases after incidents.", "LICENCE")] },
  { match: /sports nutrition/i,
    topics: [t(3, "Nutraceutical compliance", "Are your supplements licensed under FSSAI nutraceutical rules, with no unapproved ingredients or medical claims?", "Steroid adulteration and medical claims are prosecuted.", "FSS (Nutraceuticals) Regulations 2022", "Product recalls and prosecution.", "LICENCE")] },
  { match: /transport|fleet|truck|tanker|cab|airport transfer|ambulance|auto rental/i,
    topics: [t(3, "Aggregator / fleet licensing", "If you run cabs or rentals, do you hold the state aggregator or rent-a-cab licence and verify driver backgrounds?", "Most states now license fleet aggregators.", "Motor Vehicle Aggregator Guidelines 2025 / state rules", "Vehicle impounding and passenger-safety liability.", "LICENCE")] },
  { match: /cold storage|cold chain/i,
    topics: [t(3, "Cold storage licences", "Do you hold the state cold storage licence and an FSSAI storage licence, with temperature logs maintained?", "Temperature logs are your defence in spoilage claims.", "State cold storage acts / FSS Act 2006", "Spoilage claims and penalties.", "LICENCE")] },
  { match: /courier|last-mile|delivery|packers|fulfil/i,
    topics: [t(2, "Declared value and liability", "Do customers declare the value of shipments, and do your terms limit liability for undeclared or fragile goods?", "Packers & movers face frequent damage claims.", "Carriage by Road Act 2007", "Full-value damage claims.", "HAVE")] },
  { match: /customs|cha\b|freight forward|cfs|icd|port handling/i,
    topics: [t(3, "Customs broker / MTO licence", "Do you hold a valid customs broker licence or MTO registration, and do you verify client KYC as required?", "Brokers must verify importer and exporter identity.", "Customs Brokers Licensing Regulations 2018 / MTG Act 1993", "Licence suspension for KYC failures.", "LICENCE")] },
  { match: /solar|wind|biomass|biogas|energy/i,
    topics: [t(3, "Grid / safety approvals", "Do your installations have DISCOM net-metering or connectivity approval and CEIG electrical safety clearance?", "Commissioning without approval risks penalties.", "Electricity Act 2003 / CEA Safety Regulations 2023", "Disconnection and liability for electrical accidents.", "LICENCE")] },
  { match: /e-waste|plastic waste|recycl|waste management|effluent|water treatment/i,
    topics: [t(3, "Recycler authorisation", "Are you authorised by the PCB and registered on the CPCB portal for every waste type you handle?", "EPR certificates are only valid from registered recyclers.", "E-Waste / PWM / Hazardous Waste Rules", "Fake or invalid certificates lead to severe penalties.", "LICENCE")] },
  { match: /oil & gas|mining|coal|generator|dg set/i,
    topics: [t(3, "PESO / mining approvals", "Do you hold PESO licences for fuel storage, and mining leases or permits valid for current operations?", "Fuel storage above set limits needs a PESO licence.", "Petroleum Act 1934 / MMDR Act 1957", "Closure and seizure.", "LICENCE")] },
  { match: /software|saas|it services|app development|ai \/|data analytics|cloud services|erp|cybersecurity|iot|ar \/ vr|robotics|digital transformation|legaltech|proptech|agritech/i,
    topics: [t(2, "Open-source licence compliance", "Do you track the open-source libraries in your product and their licence obligations (GPL, AGPL, etc.)?", "Copyleft licences can force you to disclose source code.", "Copyright Act 1957 / OSS licence terms", "Forced code disclosure or IP problems in due diligence.", "PRACTICE")] },
  { match: /game development|gaming studio|\bgaming\b/i,
    topics: [t(3, "Online gaming law", "Have you confirmed that your games involve no real-money stakes banned under the 2025 online gaming law?", "Real-money online games are now prohibited.", "Promotion and Regulation of Online Gaming Act 2025", "Criminal liability and blocking.", "LICENCE")] },
  { match: /drone/i,
    topics: [t(3, "Drone Rules compliance", "Are your drones registered with a UIN on Digital Sky, and do pilots hold remote pilot certificates?", "Flying in red and yellow zones needs permission.", "Drone Rules 2021", "Fines of up to ₹1 lakh and confiscation.", "LICENCE")] },
  { match: /car dealer|two-wheeler dealer|commercial vehicle dealer|ev two-wheeler/i,
    topics: [t(4, "Inventory funding exposure", "Is your vehicle inventory funding (trade advance) documented, with stock audits matching lender records?", "Mismatches lead to recall of credit limits.", "Loan agreement terms", "Sudden recall of credit lines.", "PRACTICE")] },
  { match: /used car/i,
    topics: [t(3, "Authorised dealer registration", "Do you hold an authorised dealer certificate (Form 29C) and report every used vehicle in your possession to the RTO?", "Required since the 2022 CMVR amendment.", "CMVR Rules 55A-55H", "Liability for vehicles in your possession.", "LICENCE")] },
  { match: /ev charging|battery/i,
    topics: [t(3, "EV charging / battery compliance", "Are your chargers installed with CEA safety approvals and a DISCOM connection, and battery EPR obligations met?", "Battery producers have EPR targets.", "CEA Regulations / Battery Waste Management Rules 2022", "Penalties and fire liability.", "LICENCE")] },
  { match: /driving school|driver training/i,
    topics: [t(3, "Driving school licence", "Is your driving school licensed by the RTO, with qualified instructors and dual-control vehicles?", "Accredited driver training centres have stricter norms.", "CMVR Rule 24 / Motor Vehicles Act", "Licence cancellation.", "LICENCE")] },
  { match: /\bhr\b|staffing|recruitment|executive search|\bbpo\b/i,
    topics: [
      t(3, "Placement agency licence", "Do you hold the state private placement agency licence and a Contract Labour licence for deployed staff?", "Required in several states.", "State placement agency laws / Contract Labour Act 1970", "Prosecution and client penalties.", "LICENCE"),
      t(4, "Deployed staff statutory dues", "Are PF, ESIC, and wages for deployed staff paid on time, with proof shared with clients every month?", "Clients withhold bills without proof.", "EPF Act 1952 / ESI Act 1948", "Damages, interest, and loss of clients.", "FILING"),
    ] },
  { match: /\bca\b|accounting|^audit firm|tax advisory|company secretary|valuation|bookkeeping/i,
    topics: [t(3, "Professional body compliance", "Do you meet your professional body's CPE hours, peer review, and independence rules for audit or attest clients?", "Peer review is mandatory for many audits.", "ICAI / ICSI / IBBI regulations", "Disciplinary action and loss of audit eligibility.", "PRACTICE")] },
  { match: /law firm|legal services/i,
    topics: [t(3, "Bar Council rules", "Do your website and social media follow Bar Council rules prohibiting advertising and soliciting clients?", "Only basic information is permitted.", "Bar Council of India Rules, Rule 36", "Disciplinary proceedings.", "PRACTICE")] },
  { match: /marketing|advertising|pr agency|pr \/|social media|influencer|brand consult/i,
    topics: [t(3, "Ad claims and endorsement rules", "Do you check client ad claims for proof and ensure influencers disclose paid partnerships?", "Agencies can be named in CCPA actions.", "CCPA Guidelines 2022 / ASCI Code", "Penalties and campaign withdrawal.", "PRACTICE")] },
  { match: /photograph|videograph|video production|film|animation|podcast|dubbing|voice-over|music \/ audio/i,
    topics: [t(2, "Model and location releases", "Do you collect signed model releases and location permissions for every shoot before publishing?", "Needed for commercial use of a person's image.", "Copyright Act 1957 / right to privacy", "Takedown and damages claims.", "HAVE")] },
  { match: /news|radio|\bott\b|streaming|channel|publishing house/i,
    topics: [t(3, "IT Rules / MIB compliance", "Do you follow the IT Rules 2021 Code of Ethics, with a grievance officer and content classification in place?", "Applies to digital news and OTT publishers.", "IT (Intermediary Guidelines & Digital Media Ethics Code) Rules 2021", "MIB blocking orders.", "PRACTICE")] },
  { match: /ngo|trust|society|foundation|section 8|co-?operative|welfare/i, cats: ["Social Sector & NGO", "Other"],
    topics: [t(3, "CSR-1 and Darpan", "If you take CSR funds, do you have CSR-1 registration and an active NGO Darpan ID?", "CSR funders cannot fund you without CSR-1.", "Companies (CSR Policy) Rules 2014", "Loss of CSR funding.", "LICENCE")] },
  { match: /freelancer|independent professional/i,
    topics: [t(2, "Client IP and payment terms", "Do client contracts say when IP passes to the client (only after full payment) and set late-payment terms?", "Protects you from clients using unpaid work.", "Copyright Act 1957 / Indian Contract Act", "Clients use your work without paying.", "HAVE")] },
  { match: /home-based/i,
    topics: [t(3, "FSSAI for home food", "If you sell food from home, do you have FSSAI registration and follow labelling rules?", "Even home bakers need registration.", "FSS Act 2006", "Penalties and platform delisting.", "LICENCE")] },
];

// ─── Resolution ──────────────────────────────────────────────────────────────

function uniq(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))];
}

/** "Restaurant / Dhaba" → "restaurant"; "E-Commerce Seller (Amazon / Flipkart)" → "e-commerce seller" */
export function businessNoun(subCategory: string): string {
  const first = subCategory.split(/[\/(]/)[0]!.trim();
  return first ? first.toLowerCase().replace(/\b(ca|ngo|it|saas|d2c|ev|ai|bpo|hr|pr|fpo|ott|sez|mice|cfs|icd|cha|ftwz|3pl)\b/g, (m) => m.toUpperCase()) : "business";
}

export function resolveBusinessProfile(category: string | null | undefined, subCategory: string | null | undefined): ResolvedProfile {
  const cat = (category ?? "").trim();
  const sub = (subCategory ?? "").trim() || cat || "Small Business";

  // Category profile — exact key, then case-insensitive, then "Other".
  const catKey = CATEGORY_PROFILES[cat] ? cat
    : Object.keys(CATEGORY_PROFILES).find((k) => k.toLowerCase() === cat.toLowerCase());
  const base = CATEGORY_PROFILES[catKey ?? "Other"]!;
  const resolvedCat = catKey ?? "Other";
  const rules = SUB_RULES.filter((r) => r.match.test(sub) && (!r.cats || r.cats.includes(resolvedCat)));

  const topicsByPillar = { 1: [], 2: [], 3: [], 4: [] } as Record<PillarId, Topic[]>;
  const seen = new Set<string>();
  const add = (tp: Topic) => {
    const key = `${tp.p}:${tp.topic.toLowerCase()}`;
    if (seen.has(key) || topicsByPillar[tp.p].length >= 5) return;
    seen.add(key);
    topicsByPillar[tp.p].push(tp);
  };
  // Sub-category topics first (most specific), then category topics — unless
  // an exclusive rule matched, in which case the category is not used at all.
  const exclusive = rules.some((r) => r.exclusive);
  const baseFacts: ProfileFacts = exclusive
    ? { regulators: [], licences: [], counterparties: [], disputes: [] }
    : base;
  for (const r of rules) r.topics.forEach(add);
  if (!exclusive) base.topics.forEach(add);

  return {
    category: catKey ?? (cat || "Other"),
    subCategory: sub,
    noun: businessNoun(sub),
    regulators: uniq([...rules.flatMap((r) => r.regulators ?? []), ...baseFacts.regulators]),
    licences: uniq([...rules.flatMap((r) => r.licences ?? []), ...baseFacts.licences]),
    counterparties: uniq([...rules.flatMap((r) => r.counterparties ?? []), ...baseFacts.counterparties]),
    disputes: uniq([...rules.flatMap((r) => r.disputes ?? []), ...baseFacts.disputes]),
    topicsByPillar,
    isGeneric: !catKey && rules.length === 0,
  };
}

export const PROFILE_CATEGORIES = Object.keys(CATEGORY_PROFILES);
