import { create } from "zustand";

export interface SeedAnswer {
  questionId: number;
  question: string;
  pillar: string;
  answer: "YES" | "NO" | "UNSURE" | "N/A";
  isReverseScored: boolean;
  isSeed: boolean;
}

export interface AssessmentResult {
  assessmentId: string;
  totalScore: number;
  riskLevel: "CRITICAL" | "MODERATE" | "HEALTHY";
  litigationScore: number;
  contractualScore: number;
  complianceScore: number;
  costScore: number;
  futureScore: number;
  report: {
    summary: string;
    pillarAssessments: Record<string, string>;
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
  };
}

interface Store {
  // OTP flow
  phone: string;
  email: string;
  phoneToken: string;
  emailToken: string;
  setPhone: (v: string) => void;
  setEmail: (v: string) => void;
  setPhoneToken: (v: string) => void;
  setEmailToken: (v: string) => void;

  // Lead
  leadId: string;
  name: string;
  company: string;
  city: string;
  category: string;
  subCategory: string;
  businessType: string;
  whatsappOptIn: boolean;
  setLeadId: (v: string) => void;
  setLeadInfo: (info: {
    name: string;
    company: string;
    city: string;
    category: string;
    subCategory: string;
    businessType: string;
    whatsappOptIn: boolean;
  }) => void;

  // Assessment
  answers: SeedAnswer[];
  setAnswers: (v: SeedAnswer[]) => void;

  // Result
  result: AssessmentResult | null;
  setResult: (v: AssessmentResult) => void;

  // Reset
  reset: () => void;
}

export const useStore = create<Store>((set) => ({
  phone: "",
  email: "",
  phoneToken: "",
  emailToken: "",
  setPhone: (v) => set({ phone: v }),
  setEmail: (v) => set({ email: v }),
  setPhoneToken: (v) => set({ phoneToken: v }),
  setEmailToken: (v) => set({ emailToken: v }),

  leadId: "",
  name: "",
  company: "",
  city: "",
  category: "",
  subCategory: "",
  businessType: "",
  whatsappOptIn: false,
  setLeadId: (v) => set({ leadId: v }),
  setLeadInfo: (info) => set(info),

  answers: [],
  setAnswers: (v) => set({ answers: v }),

  result: null,
  setResult: (v) => set({ result: v }),

  reset: () =>
    set({
      phone: "",
      email: "",
      phoneToken: "",
      emailToken: "",
      leadId: "",
      name: "",
      company: "",
      city: "",
      category: "",
      subCategory: "",
      businessType: "",
      whatsappOptIn: false,
      answers: [],
      result: null,
    }),
}));
