import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import LandingPage from "@/pages/LandingPage";
import OnboardPage from "@/pages/OnboardPage";
import AssessPage from "@/pages/AssessPage";
import ResultsPage from "@/pages/ResultsPage";
import ConsultPage from "@/pages/ConsultPage";
import ReviewPage from "@/pages/ReviewPage";
import AdminLoginPage from "@/pages/admin/LoginPage";
import DashboardPage from "@/pages/admin/DashboardPage";
import LeadsPage from "@/pages/admin/LeadsPage";
import LeadDetailPage from "@/pages/admin/LeadDetailPage";
import AIInsightsPage from "@/pages/admin/AIInsightsPage";
import AnalyticsPage from "@/pages/admin/AnalyticsPage";
import ReviewsPage from "@/pages/admin/ReviewsPage";
import SettingsPage from "@/pages/admin/SettingsPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/onboard" component={OnboardPage} />
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
      <Route path="/admin/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
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
