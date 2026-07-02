import { SignUp } from "@clerk/react";
import { LogoWatermark } from "@/components/LogoWatermark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { basePath } from "@/lib/clerk";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <LogoWatermark />

      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3.5 liq-nav">
        <div className="flex items-center gap-2">
          <img src="/rtc-logo-transparent.png" alt="Rest The Case" className="h-8 w-8 object-contain dark:hidden" />
          <img src="/rtc-logo-dark.png" alt="Rest The Case" className="h-8 w-8 object-contain hidden dark:block" />
          <span className="font-serif text-lg font-bold text-[#C9A84C]">LegalIQ</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="mt-10 w-full flex justify-center">
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          fallbackRedirectUrl={`${basePath}/onboard`}
        />
      </div>

      <p className="text-xs liq-text-4 mt-8 text-center max-w-xs relative z-10">
        Your data is encrypted and confidential. We never share your information.
      </p>
    </div>
  );
}
