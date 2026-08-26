export interface CaseStudyDetails {
  id: string;
  slug: string;
  businessIndustry: string;
  legalSituation: string;
  disputeNature: string;
  keyLegalIssue: string;
  businessImpact: string;
  resolution: string;
  takeaway: string;
  lhsPillars: string[];
  recommendation: string;
  sourceTitle: string;
  sourceUrl: string;
}

export interface SimilarCaseStudy {
  caseStudyId: string;
  title: string;
  summary: string;
  relevance: string;
  readMoreUrl: string;
  caseStudy: CaseStudyDetails;
}

interface CatalogEntry extends CaseStudyDetails {
  cardTitle: string;
  cardSummary: string;
  industries: string[];
  keywords: string[];
}

const CASE_STUDIES: CatalogEntry[] = [
  {
    id: "amazon-future-retail-emergency-arbitration",
    slug: "amazon-future-retail-emergency-arbitration",
    cardTitle: "Retail Deal Restricted by Investor Rights",
    cardSummary: "Amazon invoked contractual protections and SIAC emergency arbitration after Future Retail agreed to a competing transaction. The dispute reached the Supreme Court on enforceability of the emergency award.",
    businessIndustry: "Retail, ecommerce and investment-backed companies",
    legalSituation: "A major retail group entered a transaction that an investor alleged breached existing shareholder and investment agreements.",
    disputeNature: "Contractual restrictions, investor rights and emergency arbitration in a time-sensitive business transaction.",
    keyLegalIssue: "Whether an emergency arbitrator's award under agreed institutional rules could be enforced under Section 17 of the Arbitration and Conciliation Act, 1996.",
    businessImpact: "The proposed transaction faced injunctions, delay and prolonged multi-forum proceedings, showing how reserved matters and transfer restrictions can affect strategic deals.",
    resolution: "In Amazon.com NV Investment Holdings LLC v Future Retail Ltd. (2021), the Supreme Court held that an SIAC emergency arbitrator's award was enforceable under Section 17(1) of the Arbitration Act.",
    takeaway: "Investor, shareholder and acquisition documents must be reviewed together before a business signs a competing or restructuring transaction.",
    lhsPillars: ["Contractual Health", "Litigation Health"],
    recommendation: "Maintain a consolidated obligations register for shareholder agreements, reserved matters, exclusivity clauses and dispute-resolution provisions before approving strategic transactions.",
    sourceTitle: "Amazon.com NV Investment Holdings LLC v Future Retail Ltd., Supreme Court of India, 6 August 2021",
    sourceUrl: "https://api.sci.gov.in/supremecourt/2021/3947/3947_2021_32_1501_29084_Judgement_06-Aug-2021.pdf",
    industries: ["retail", "ecommerce", "trading", "startup", "company", "distribution"],
    keywords: ["shareholder", "investor", "investment", "acquisition", "arbitration", "exclusivity", "transaction", "contract"],
  },
  {
    id: "nestle-india-fssai-maggi",
    slug: "nestle-india-fssai-maggi",
    cardTitle: "Food Product Recall and Regulatory Testing",
    cardSummary: "FSSAI and state authorities ordered the withdrawal and recall of Maggi products. Nestlé challenged the process, and the Bombay High Court required fresh testing through accredited laboratories.",
    businessIndustry: "Food manufacturing, restaurants, packaged food and retail",
    legalSituation: "A food business faced nationwide regulatory action concerning product safety testing, labelling and market withdrawal.",
    disputeNature: "Food-safety enforcement, product recall, laboratory evidence and procedural fairness.",
    keyLegalIssue: "Whether the regulator's ban and recall process complied with the Food Safety and Standards Act and principles of natural justice.",
    businessImpact: "Products were withdrawn from sale, manufacturing was interrupted and the brand faced significant operational and reputational consequences.",
    resolution: "In Nestlé India Ltd. v FSSAI (2015), the Bombay High Court set aside the impugned orders on procedural grounds and directed fresh testing at accredited laboratories before products could return to market.",
    takeaway: "Food businesses need test records, traceability, compliant labels and a documented recall-response process before a regulator intervenes.",
    lhsPillars: ["Compliance Health", "Litigation Health"],
    recommendation: "Keep FSSAI licences, batch tests, supplier certificates, label approvals and recall procedures in one auditable compliance file.",
    sourceTitle: "Nestlé India Ltd. v Food Safety and Standards Authority of India, Bombay High Court, 13 August 2015",
    sourceUrl: "https://indiankanoon.org/doc/66718388/",
    industries: ["food", "restaurant", "cafe", "catering", "cloud kitchen", "retail", "manufacturing"],
    keywords: ["fssai", "food", "safety", "hygiene", "label", "recall", "quality", "consumer"],
  },
  {
    id: "mcdonalds-bakshi-franchise-arbitration",
    slug: "mcdonalds-bakshi-franchise-arbitration",
    cardTitle: "Franchise Governance Dispute",
    cardSummary: "McDonald's India and its joint-venture partner Vikram Bakshi became involved in disputes concerning management and contractual rights in their restaurant venture, leading to court and arbitration proceedings.",
    businessIndustry: "Restaurants, hospitality, franchises and joint ventures",
    legalSituation: "A restaurant joint venture faced a breakdown between the brand owner and local operating partner over management and contractual rights.",
    disputeNature: "Franchise governance, joint-venture control, management rights and arbitration.",
    keyLegalIssue: "How disputes arising from franchise and joint-venture agreements should be resolved when governance and contractual remedies overlap.",
    businessImpact: "The dispute consumed management time, affected the operating relationship and required proceedings before multiple legal forums.",
    resolution: "The Delhi High Court allowed the contractual arbitration process to proceed, reinforcing the importance of clear dispute-resolution and governance provisions in franchise structures.",
    takeaway: "A franchise agreement alone is not enough; governance, deadlock, termination and transition rights must align across every joint-venture document.",
    lhsPillars: ["Contractual Health", "Litigation Health"],
    recommendation: "Review franchise and shareholder documents together and include practical deadlock, termination, brand-control and handover procedures.",
    sourceTitle: "McDonald's India Pvt. Ltd. v Vikram Bakshi and others, Delhi High Court, 21 July 2016",
    sourceUrl: "https://www.business-standard.com/article/pti-stories/mcdonald-s-bakshi-dispute-be-decided-by-arbitration-hc-116072101518_1.html",
    industries: ["restaurant", "food", "cafe", "hospitality", "franchise", "retail"],
    keywords: ["franchise", "joint venture", "partner", "management", "termination", "arbitration", "agreement"],
  },
  {
    id: "bichhri-industrial-pollution",
    slug: "bichhri-industrial-pollution",
    cardTitle: "Industrial Pollution and Remediation Liability",
    cardSummary: "Chemical units in Bichhri village caused severe environmental contamination. The Supreme Court applied the polluter-pays principle and placed remediation liability on the responsible industries.",
    businessIndustry: "Manufacturing, chemicals, factories and industrial operations",
    legalSituation: "Industrial activity contaminated local soil and water, triggering constitutional environmental proceedings and remediation claims.",
    disputeNature: "Pollution control, hazardous industrial activity, regulatory compliance and environmental remediation.",
    keyLegalIssue: "Whether polluting industries were financially responsible for restoring environmental damage caused by their operations.",
    businessImpact: "The industries faced closure-related consequences and liability for the cost of remedial measures, beyond routine regulatory penalties.",
    resolution: "In Indian Council for Enviro-Legal Action v Union of India (1996), the Supreme Court applied the polluter-pays principle and held the offending industries liable for remediation costs.",
    takeaway: "Pollution-control consent is not a paperwork exercise; environmental harm can create direct cleanup liability and threaten continued operations.",
    lhsPillars: ["Compliance Health", "Litigation Health", "Legal Cost Efficiency"],
    recommendation: "Track consent-to-operate conditions, hazardous-waste records, effluent testing and incident-response obligations with periodic independent audits.",
    sourceTitle: "Indian Council for Enviro-Legal Action v Union of India, Supreme Court of India, 13 February 1996",
    sourceUrl: "https://indiankanoon.org/doc/1818014/",
    industries: ["manufacturing", "factory", "production", "chemical", "industrial", "pharma"],
    keywords: ["pollution", "environment", "hazardous", "waste", "pcb", "consent", "factory", "remediation"],
  },
  {
    id: "silpi-industries-msme-arbitration",
    slug: "silpi-industries-msme-arbitration",
    cardTitle: "MSME Payment Recovery and Counterclaims",
    cardSummary: "Suppliers pursued claims under the MSMED Act against a public transport corporation. The Supreme Court clarified limitation and counterclaim rules for MSME arbitration.",
    businessIndustry: "MSMEs, manufacturers, suppliers and service businesses",
    legalSituation: "Small suppliers used the MSMED Act process to recover commercial claims, while the buyer raised counterclaims.",
    disputeNature: "Delayed payment recovery, statutory MSME arbitration, limitation periods and buyer counterclaims.",
    keyLegalIssue: "Whether the Limitation Act applies to MSMED Act arbitration and whether a buyer's counterclaim can be heard in the same proceeding.",
    businessImpact: "The ruling affects how quickly MSMEs must pursue unpaid invoices and how buyers document quality, delay or performance counterclaims.",
    resolution: "In Silpi Industries v Kerala State Road Transport Corporation (2021), the Supreme Court held that limitation applies to MSMED arbitration and that counterclaims are maintainable.",
    takeaway: "MSME registration strengthens recovery options, but invoices, acceptance records and claims still need to be documented and pursued on time.",
    lhsPillars: ["Contractual Health", "Litigation Health", "Legal Cost Efficiency"],
    recommendation: "Use signed purchase orders, milestone acceptance records, MSME disclosures and an aged-receivables escalation process before invoices become time-barred.",
    sourceTitle: "Silpi Industries v Kerala State Road Transport Corporation, Supreme Court of India, 29 June 2021",
    sourceUrl: "https://indiankanoon.org/doc/134928159/",
    industries: ["manufacturing", "service", "trading", "wholesale", "distribution", "msme", "consulting"],
    keywords: ["payment", "invoice", "dues", "receivable", "vendor", "supplier", "msme", "arbitration", "contract"],
  },
  {
    id: "phonepe-bharatpe-trademark",
    slug: "phonepe-bharatpe-trademark",
    cardTitle: "Fintech Brand and Trademark Conflict",
    cardSummary: "PhonePe sought an interim injunction against BharatPe over use of the element “Pe.” The Delhi High Court examined whether that shared element independently carried enforceable distinctiveness.",
    businessIndustry: "Technology, fintech, startups and digital platforms",
    legalSituation: "Two fintech brands used marks containing the same common suffix, leading to a trademark infringement and passing-off dispute.",
    disputeNature: "Brand clearance, trademark distinctiveness, passing off and interim injunctions.",
    keyLegalIssue: "Whether a business could claim exclusivity over a common or descriptive element separated from its registered composite mark.",
    businessImpact: "The dispute created litigation cost and brand uncertainty at a stage when both businesses depended heavily on recognition of their names.",
    resolution: "In PhonePe Pvt. Ltd. v Ezy Services (BharatPe) (2021), the Delhi High Court declined the interim injunction, finding that exclusivity over the common element required stronger proof.",
    takeaway: "Registering a composite logo or name does not automatically guarantee exclusivity over every descriptive or common fragment within it.",
    lhsPillars: ["Contractual Health", "Litigation Health"],
    recommendation: "Run trademark clearance before launch, register word and device marks separately where appropriate, and preserve evidence of acquired distinctiveness.",
    sourceTitle: "PhonePe Pvt. Ltd. v Ezy Services (BharatPe), Delhi High Court, 15 April 2021",
    sourceUrl: "https://indiankanoon.org/doc/17509216/",
    industries: ["technology", "tech", "software", "saas", "startup", "fintech", "digital", "app", "service"],
    keywords: ["trademark", "brand", "name", "logo", "ip", "infringement", "passing off", "copyright"],
  },
  {
    id: "oyo-zostel-term-sheet",
    slug: "oyo-zostel-term-sheet",
    cardTitle: "Startup Acquisition Term-Sheet Dispute",
    cardSummary: "OYO and Zostel disputed whether an acquisition term sheet created enforceable rights, including a claimed equity entitlement. The matter proceeded through arbitration and court review.",
    businessIndustry: "Startups, technology, hospitality and funded companies",
    legalSituation: "A proposed startup acquisition did not close, but one party claimed continuing rights based on the term sheet and later arbitration.",
    disputeNature: "Term-sheet enforceability, acquisition conditions, equity claims and arbitration.",
    keyLegalIssue: "Whether preliminary transaction documents and an arbitral award could create an equity entitlement when definitive agreements were not completed.",
    businessImpact: "The unresolved transaction produced years of arbitration and court proceedings and created uncertainty over ownership and strategic control.",
    resolution: "In Oravel Stays Pvt. Ltd. v Zostel Hospitality Pvt. Ltd. (2025), the Delhi High Court set aside the relevant arbitral outcome and rejected enforcement of the claimed equity entitlement.",
    takeaway: "Term sheets must clearly identify which clauses are binding and what happens if due diligence or definitive agreements are never completed.",
    lhsPillars: ["Contractual Health", "Litigation Health"],
    recommendation: "Mark binding and non-binding clauses expressly, document conditions precedent, and prohibit equity or control rights from arising before signed definitive agreements.",
    sourceTitle: "Oravel Stays Pvt. Ltd. v Zostel Hospitality Pvt. Ltd., Delhi High Court, 13 May 2025",
    sourceUrl: "https://delhihighcourt.nic.in/app/showFileJudgment/58713052025OMPCOMM1512021_181740.pdf",
    industries: ["startup", "technology", "tech", "hospitality", "company", "service", "software"],
    keywords: ["term sheet", "funding", "acquisition", "equity", "founder", "investor", "merger", "arbitration", "contract"],
  },
  {
    id: "ima-vp-shantha-service-liability",
    slug: "ima-vp-shantha-service-liability",
    cardTitle: "Paid Services and Consumer Liability",
    cardSummary: "The Supreme Court considered when paid medical services fall within consumer-protection law, establishing a major principle for professional service accountability.",
    businessIndustry: "Professional services, healthcare and client-facing businesses",
    legalSituation: "Consumers sought remedies for alleged deficiencies in paid professional services.",
    disputeNature: "Consumer protection, professional duty, service quality and deficiency claims.",
    keyLegalIssue: "Whether services rendered for consideration fall within the definition of “service” under consumer-protection legislation.",
    businessImpact: "The ruling confirmed that many paid service providers can face consumer claims for deficient service, making scope, records and complaint handling commercially important.",
    resolution: "In Indian Medical Association v V.P. Shantha (1995), the Supreme Court held that medical services rendered for consideration generally fall within consumer-protection law, subject to identified exceptions.",
    takeaway: "Client-facing businesses should define deliverables, maintain service records and respond to complaints before they become formal consumer disputes.",
    lhsPillars: ["Litigation Health", "Contractual Health", "Compliance Health"],
    recommendation: "Use written scopes of work, informed-consent or acceptance records, service-quality controls and a documented complaint-resolution process.",
    sourceTitle: "Indian Medical Association v V.P. Shantha, Supreme Court of India, 13 November 1995",
    sourceUrl: "https://indiankanoon.org/doc/723973/",
    industries: ["service", "consulting", "professional", "healthcare", "clinic", "agency", "education"],
    keywords: ["consumer", "client", "service", "deficiency", "quality", "complaint", "negligence", "professional"],
  },
  {
    id: "mohit-minerals-ocean-freight-gst",
    slug: "mohit-minerals-ocean-freight-gst",
    cardTitle: "GST Exposure on Import Freight",
    cardSummary: "Mohit Minerals challenged IGST imposed on ocean freight for CIF imports. The Supreme Court examined the levy and the legal effect of GST Council recommendations.",
    businessIndustry: "Importers, traders, manufacturers and distribution businesses",
    legalSituation: "An importer challenged an additional GST levy connected to ocean-freight services already embedded in imported goods supplied on CIF terms.",
    disputeNature: "GST classification, reverse-charge liability, delegated legislation and overlapping taxation.",
    keyLegalIssue: "Whether the importer could be separately subjected to IGST on ocean freight under the challenged notifications.",
    businessImpact: "The dispute affected landed-cost calculations, tax positions and compliance treatment for import-dependent businesses.",
    resolution: "In Union of India v Mohit Minerals Pvt. Ltd. (2022), the Supreme Court rejected the challenged ocean-freight levy in the circumstances before it and clarified that GST Council recommendations are not binding legislation.",
    takeaway: "Import and supply contracts must be reviewed together with current GST notifications before a business accepts a tax position or builds it into pricing.",
    lhsPillars: ["Compliance Health", "Legal Cost Efficiency"],
    recommendation: "Document Incoterms, freight responsibility and tax treatment for imports, and review material GST positions when notifications or judicial interpretations change.",
    sourceTitle: "Union of India v Mohit Minerals Pvt. Ltd., Supreme Court of India, 19 May 2022",
    sourceUrl: "https://digiscr.sci.gov.in/view_judgment?id=MzA2OTE=",
    industries: ["trading", "retail", "wholesale", "distribution", "manufacturing", "import", "export"],
    keywords: ["gst", "tax", "import", "freight", "filing", "return", "notice", "compliance"],
  },
];

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreEntry(entry: CatalogEntry, profile: string, signal: string): number {
  let score = 0;
  for (const industry of entry.industries) {
    if (profile.includes(normalise(industry))) score += 8;
  }
  for (const keyword of entry.keywords) {
    const term = normalise(keyword);
    if (signal.includes(term)) score += 12;
    if (profile.includes(term)) score += 3;
  }
  return score;
}

export function selectCaseStudies(
  businessType: string,
  category: string,
  risks: Array<{ title?: string; gap?: string; consequence?: string }> = [],
): SimilarCaseStudy[] {
  const profile = normalise(`${businessType} ${category}`);
  const signals = risks.slice(0, 3).map((risk) =>
    normalise(`${risk.title ?? ""} ${risk.gap ?? ""} ${risk.consequence ?? ""}`),
  );
  while (signals.length < 3) signals.push(profile);

  const selected = new Set<string>();
  return signals.map((signal, index) => {
    const ranked = CASE_STUDIES
      .filter((entry) => !selected.has(entry.id))
      .map((entry, catalogIndex) => ({
        entry,
        score: scoreEntry(entry, profile, signal) - catalogIndex * 0.001,
      }))
      .sort((a, b) => b.score - a.score);

    const entry = ranked[0]?.entry ?? CASE_STUDIES[index % CASE_STUDIES.length]!;
    selected.add(entry.id);
    const riskTitle = risks[index]?.title?.trim();
    const businessLabel = businessType.trim() || category.trim() || "business";

    return {
      caseStudyId: entry.id,
      title: entry.cardTitle,
      summary: entry.cardSummary,
      relevance: riskTitle
        ? `Relevant to this ${businessLabel} because the report flagged “${riskTitle}” as a legal exposure.`
        : `Relevant to the contracts, compliance and dispute exposure commonly faced by ${businessLabel} businesses.`,
      readMoreUrl: entry.sourceUrl,
      caseStudy: {
        id: entry.id,
        slug: entry.slug,
        businessIndustry: entry.businessIndustry,
        legalSituation: entry.legalSituation,
        disputeNature: entry.disputeNature,
        keyLegalIssue: entry.keyLegalIssue,
        businessImpact: entry.businessImpact,
        resolution: entry.resolution,
        takeaway: entry.takeaway,
        lhsPillars: entry.lhsPillars,
        recommendation: entry.recommendation,
        sourceTitle: entry.sourceTitle,
        sourceUrl: entry.sourceUrl,
      },
    };
  });
}