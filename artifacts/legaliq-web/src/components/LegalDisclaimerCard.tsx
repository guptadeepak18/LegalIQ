interface LegalDisclaimerCardProps {
  context?: "assessment" | "report";
  className?: string;
}

export function LegalDisclaimerCard({
  context = "assessment",
  className = "",
}: LegalDisclaimerCardProps) {
  const contextPhrase =
    context === "report"
      ? "this report and the Legal Health Score contained herein"
      : "this assessment and the Legal Health Score";

  return (
    <div
      className={`disclaimer-card ${className}`}
      style={{
        borderTop: "1px solid var(--disclaimer-divider)",
        borderBottom: "1px solid var(--disclaimer-divider)",
        padding: "1.5rem 0",
      }}
    >
      {/* Label */}
      <p
        className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3"
        style={{ color: "#C9A84C" }}
      >
        Legal Disclaimer
      </p>

      {/* Single paragraph */}
      <p
        className="liq-text-3 leading-[1.75] text-[12.5px]"
        style={{ maxWidth: "none" }}
      >
        {contextPhrase.charAt(0).toUpperCase() + contextPhrase.slice(1)}{" "}
        is produced by LegalIQ, a service of{" "}
        <span className="liq-text-2 font-medium">Rest The Case</span>, for
        informational purposes only. It does not constitute legal advice, a
        legal opinion, or professional counsel of any kind, and should not be
        relied upon as a substitute for consultation with a qualified legal
        professional. The results are generated using artificial intelligence
        based solely on the information provided during the assessment and may
        be incomplete, inaccurate, or inapplicable to your specific legal
        circumstances. Rest The Case, LegalIQ, and their associated attorneys,
        employees, and agents expressly disclaim all liability for any loss,
        damage, cost, or expense — direct or consequential — arising from
        reliance on, or action taken in response to, the contents of{" "}
        {context === "report" ? "this report" : "this assessment"}. For
        professional legal guidance tailored to your business, please consult a
        qualified Advocate or engage{" "}
        <a
          href="https://restthecase.com/virtualCLOPackage"
          target="_blank"
          rel="noreferrer"
          className="font-medium underline underline-offset-2 decoration-[#C9A84C]/50 hover:decoration-[#C9A84C] transition-colors"
          style={{ color: "#C9A84C" }}
        >
          Rest The Case's Virtual Chief Legal Officer (VCLO) service
        </a>
        .
      </p>
    </div>
  );
}
