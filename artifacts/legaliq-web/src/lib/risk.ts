export function riskBadgeClass(riskLevel?: string | null): string {
  switch (riskLevel) {
    case "CRITICAL":
      return "risk-critical";
    case "RISKY":
      return "risk-risky";
    case "STABLE":
    case "MODERATE":
      return "risk-stable";
    case "HEALTHY":
      return "risk-healthy";
    default:
      return "risk-moderate";
  }
}
