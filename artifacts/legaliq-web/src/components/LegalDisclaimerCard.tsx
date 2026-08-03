import { Info } from "lucide-react";

interface LegalDisclaimerCardProps {
  context?: "assessment" | "report";
  className?: string;
}

export function LegalDisclaimerCard({
  context = "assessment",
  className = "",
}: LegalDisclaimerCardProps) {
  return (
    <div
      className={`flex gap-5 rounded-2xl px-6 py-5 ${className}`}
      style={{
        background: "var(--disclaimer-bg)",
        border: "1px solid var(--disclaimer-border)",
        boxShadow: "var(--disclaimer-shadow)",
      }}
    >
      {/* Left accent + icon */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-0.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: "rgba(201,168,76,0.12)",
            border: "1px solid rgba(201,168,76,0.25)",
          }}
        >
          <Info size={13} className="text-[#C9A84C]" strokeWidth={2.5} />
        </div>
        <div
          className="w-px flex-1 min-h-[1.5rem]"
          style={{ background: "rgba(201,168,76,0.18)" }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Label */}
        <p
          className="text-[10px] font-bold tracking-[0.16em] uppercase"
          style={{ color: "#C9A84C" }}
        >
          Legal Disclaimer
        </p>

        {/* Paragraph */}
        <p className="text-[12.5px] liq-text-3 leading-[1.8] font-semibold">
          This {context === "report" ? "report" : "assessment"} and the Legal
          Health Score are produced by <span className="liq-text-2 font-medium">LegalIQ by Rest The Case</span> for
          informational purposes only. They do not constitute legal advice, a
          legal opinion, or professional counsel of any kind, and must not be
          relied upon as a substitute for consultation with a qualified legal
          professional. Results are AI-generated from the information you
          provided and may be incomplete or inapplicable to your specific
          circumstances. Rest The Case expressly disclaims all liability for
          any action taken or not taken in reliance on this{" "}
          {context === "report" ? "report" : "assessment"}.
        </p>

        {/* Inline CTA */}
        <p className="text-[11.5px] liq-text-4">
          Need personalised legal guidance?{" "}
          <a
            href="https://restthecase.com/virtualCLOPackage"
            target="_blank"
            rel="noreferrer"
            className="font-semibold transition-colors hover:text-[#C9A84C]"
            style={{ color: "#C9A84C" }}
          >
            Explore the Rest The Case VCLO Service →
          </a>
        </p>
      </div>
    </div>
  );
}
