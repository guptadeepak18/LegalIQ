import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ClerkProvider, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { ThemeProvider } from "@/components/ThemeProvider";
import { basePath, stripBase, clerkAppearance } from "@/lib/clerk";
import LandingPage from "@/pages/LandingPage";
import OnboardPage from "@/pages/OnboardPage";
import AssessPage from "@/pages/AssessPage";
import ResultsPage from "@/pages/ResultsPage";
import ConsultPage from "@/pages/ConsultPage";
import ReviewPage from "@/pages/ReviewPage";
import SignInPage from "@/pages/SignInPage";
import SignUpPage from "@/pages/SignUpPage";
import AdminLoginPage from "@/pages/admin/LoginPage";
import DashboardPage from "@/pages/admin/DashboardPage";
import LeadsPage from "@/pages/admin/LeadsPage";
import LeadDetailPage from "@/pages/admin/LeadDetailPage";
import AIInsightsPage from "@/pages/admin/AIInsightsPage";
import AnalyticsPage from "@/pages/admin/AnalyticsPage";
import ReviewsPage from "@/pages/admin/ReviewsPage";
import SettingsPage from "@/pages/admin/SettingsPage";
import EmailTemplatesPage from "@/pages/admin/EmailTemplatesPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev, auto-set in prod.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/onboard" component={OnboardPage} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/assess" component={AssessPage} />
      <Route path="/results" component={ResultsPage} />
      <Route path="/consult" component={ConsultPage} />
      <Route path="/review" component={ReviewPage} />
      <Route path="/admin" component={AdminLoginPage} />
      <Route path="/admin/dashboard" component={DashboardPage} />
      <Route path="/admin/leads" component={LeadsPage} />
      <Route path="/admin/leads/:id" component={LeadDetailPage} />
      <Route path="/admin/ai-insights" component={AIInsightsPage} />
      <Route path="/admin/analytics" component={AnalyticsPage} />
      <Route path="/admin/reviews" component={ReviewsPage} />
      <Route path="/admin/email-templates" component={EmailTemplatesPage} />
      <Route path="/admin/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to continue your legal health assessment",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Verify your email to get your Legal Health Score",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <Router />
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "!bg-[var(--card-glass-bg)] !border-[var(--card-glass-border)] !backdrop-blur-xl",
              title: "!text-foreground",
              description: "!text-muted-foreground",
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
