import { shadcn } from "@clerk/themes";

export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

export const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/rtc-logo-transparent.png`,
  },
  variables: {
    colorPrimary: "#C9A84C",
    colorForeground: "#1a1410",
    colorMutedForeground: "rgba(26,20,16,0.65)",
    colorDanger: "#DC2626",
    colorBackground: "#F7F1E3",
    colorInput: "#FFFFFF",
    colorInputForeground: "#1a1410",
    colorNeutral: "rgba(26,20,16,0.18)",
    fontFamily: "'Space Grotesk', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#F7F1E3] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl border border-[#C9A84C]/25",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-serif text-2xl font-bold text-[#1a1410]",
    headerSubtitle: "text-[#1a1410]/65 text-sm",
    socialButtonsBlockButton: "border border-[#C9A84C]/30 hover:bg-[#C9A84C]/10 rounded-xl",
    socialButtonsBlockButtonText: "text-[#1a1410] font-semibold",
    formFieldLabel: "text-[#1a1410]/80 font-semibold text-xs",
    footerActionLink: "text-[#C9A84C] hover:text-[#a8863a] font-semibold",
    footerActionText: "text-[#1a1410]/65",
    dividerText: "text-[#1a1410]/45",
    identityPreviewEditButton: "text-[#C9A84C]",
    formFieldSuccessText: "text-emerald-600",
    alertText: "text-red-600",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-12 w-12 object-contain",
    formButtonPrimary: "bg-[#C9A84C] hover:bg-[#E2C97E] text-[#0A0A0A] font-bold rounded-xl",
    formFieldInput: "rounded-xl border-[#C9A84C]/25 bg-white text-[#1a1410]",
    footerAction: "text-sm",
    dividerLine: "bg-[#C9A84C]/20",
    alert: "rounded-xl",
    otpCodeFieldInput: "rounded-xl border-[#C9A84C]/30",
    formFieldRow: "mb-3",
    main: "px-2",
  },
};
