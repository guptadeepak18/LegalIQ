import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Sparkles, BarChart2,
  Star, Settings, Menu, X, LogOut,
  ChevronRight, Mail, PanelsTopLeft, FileBadge,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  clearAdminSession,
  getStoredAdminProfile,
  hasAdminPermission,
  loadAdminProfile,
  type AdminPermission,
  type AdminProfile,
} from "@/lib/adminAccess";

const NAV_ITEMS = [
  { to: "/admin/dashboard",       label: "Dashboard",       icon: LayoutDashboard, section: "main", permission: "dashboard" as AdminPermission },
  { to: "/admin/leads",           label: "Lead Manager",    icon: Users,           section: "main", permission: "leads:view" as AdminPermission },
  { to: "/admin/ai-insights",     label: "AI Insights",     icon: Sparkles,        section: "main", badge: "AI", permission: "ai" as AdminPermission },
  { to: "/admin/analytics",       label: "Analytics",       icon: BarChart2,       section: "main", permission: "analytics" as AdminPermission },
  { to: "/admin/reviews",         label: "Reviews",         icon: Star,            section: "main", permission: "reviews" as AdminPermission },
  { to: "/admin/email-templates", label: "Email Templates", icon: Mail,            section: "config", permission: "email" as AdminPermission },
  { to: "/admin/brochure-templates", label: "Brochure Templates", icon: PanelsTopLeft, section: "config", permission: "brochures" as AdminPermission },
  { to: "/admin/certificate-templates", label: "Certificate Templates", icon: FileBadge, section: "config", permission: "brochures" as AdminPermission },
  { to: "/admin/settings",        label: "Settings",        icon: Settings,        section: "config" },
];

interface AdminLayoutProps {
  active: string;
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

function NavItem({
  item,
  isActive,
  onClick,
}: {
  item: typeof NAV_ITEMS[0];
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative overflow-hidden`}
      style={{
        color: isActive ? "#C9A84C" : "var(--liq-text-3)",
      }}
    >
      {isActive && (
        <motion.div
          layoutId="activeNavBg"
          className="absolute inset-0 bg-[#C9A84C]/10 rounded-xl"
        />
      )}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#C9A84C] rounded-r-full" />
      )}
      <item.icon
        size={16}
        className={`relative z-10 flex-shrink-0 transition-colors`}
        style={{
          color: isActive ? "#C9A84C" : "var(--liq-text-3)",
        }}
      />
      <span className="relative z-10 flex-1 text-left">{item.label}</span>
      {item.badge && (
        <span className="relative z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
          {item.badge}
        </span>
      )}
    </button>
  );
}

function SidebarLogo() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className="px-5 py-5 border-b" style={{ borderColor: "var(--nav-border)" }}>
      <div className="flex items-center gap-3">
        <img
          src="/rtc-logo-transparent.png"
          alt="Rest The Case"
          style={{
            height: 44,
            width: "auto",
            objectFit: "contain",
            flexShrink: 0,
            filter: isDark ? "brightness(0) invert(1)" : "none",
          }}
        />
        <div>
          <div className="font-serif text-sm font-bold liq-text-1 leading-none tracking-tight">LegalIQ</div>
          <div className="type-caption liq-text-4 mt-0.5 leading-none tracking-widest uppercase" style={{ fontSize: "9px" }}>Admin Portal</div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  active,
  profile,
  onNavigate,
  onClose,
}: {
  active: string;
  profile: AdminProfile;
  onNavigate: (to: string) => void;
  onClose?: () => void;
}) {
  const [, navigate] = useLocation();
  function logout() {
    clearAdminSession();
    navigate("/admin");
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || hasAdminPermission(profile, item.permission));
  const mainItems = visibleItems.filter((i) => i.section === "main");
  const configItems = visibleItems.filter((i) => i.section === "config");

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <SidebarLogo />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="type-label admin-section-label px-3 mb-2 liq-text-4">
          Main
        </div>
        {mainItems.map((item) => {
          const isActive = active === item.to || (item.to !== "/admin/dashboard" && active.startsWith(item.to + "/"));
          return (
            <NavItem
              key={item.to}
              item={item}
              isActive={isActive}
              onClick={() => { onNavigate(item.to); onClose?.(); }}
            />
          );
        })}

        <div className="type-label admin-section-label px-3 mb-2 mt-5 liq-text-4">
          Config
        </div>
        {configItems.map((item) => {
          const isActive = active === item.to;
          return (
            <NavItem
              key={item.to}
              item={item}
              isActive={isActive}
              onClick={() => { onNavigate(item.to); onClose?.(); }}
            />
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t" style={{ borderColor: "var(--nav-border)" }} />

      {/* User + logout */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-[#C9A84C]">A</span>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate liq-text-1">
              {profile.name || profile.email.split("@")[0]}
            </div>
            <div className="text-[10px] truncate liq-text-3">{profile.email}</div>
          </div>
        </div>
        <div className="flex items-center justify-between w-full mb-2">
          <ThemeToggle />
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs transition-colors px-2 py-1 hover:opacity-70 liq-text-3"
          >
            <LogOut size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ active, children, title, actions }: AdminLayoutProps) {
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [profile, setProfile] = useState<AdminProfile | null>(() => getStoredAdminProfile());
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("liq_admin_token");
    if (!token) {
      navigate("/admin");
      return;
    }
    loadAdminProfile()
      .then(setProfile)
      .catch(() => {
        clearAdminSession();
        navigate("/admin");
      })
      .finally(() => setProfileLoading(false));
  }, [navigate]);

  useEffect(() => {
    const syncStoredProfile = () => setProfile(getStoredAdminProfile());
    window.addEventListener("liq-admin-profile-updated", syncStoredProfile);
    return () => window.removeEventListener("liq-admin-profile-updated", syncStoredProfile);
  }, []);

  // Close sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [active]);

  if (profileLoading || !profile) {
    return <div className="min-h-screen" style={{ background: "var(--body-bg)" }} />;
  }

  const requiredPermission = active.startsWith("/admin/leads")
    ? "leads:view"
    : active === "/admin/dashboard"
      ? "dashboard"
      : active === "/admin/ai-insights"
        ? "ai"
        : active === "/admin/analytics"
          ? "analytics"
          : active === "/admin/reviews"
            ? "reviews"
              : active === "/admin/email-templates"
              ? "email"
                : active === "/admin/brochure-templates" || active === "/admin/certificate-templates"
                  ? "brochures"
              : undefined;
  const permitted = !requiredPermission || hasAdminPermission(profile, requiredPermission as AdminPermission);
  const protectedContent = permitted ? children : (
    <div className="px-6 py-10 max-w-2xl mx-auto">
      <div className="glass-card rounded-2xl p-6 border border-amber-500/20">
        <h2 className="type-h2 liq-text-1">Access restricted</h2>
        <p className="type-caption liq-text-3 mt-2">
          Your account does not have permission to view this area. Ask an administrator with user-management access to update your permissions.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ background: "var(--body-bg)" }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 xl:w-60 fixed inset-y-0 left-0 flex-col z-40 border-r shadow-lg" style={{ background: "var(--nav-bg)", borderColor: "var(--nav-border)", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
        <Sidebar active={active} profile={profile} onNavigate={navigate} />
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="sidebar"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 w-56 flex flex-col z-50 border-r lg:hidden"
              style={{ background: "var(--nav-bg)", borderColor: "var(--nav-border)" }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-3 right-3 p-1.5 text-white/30 hover:text-white/60 z-10"
              >
                <X size={15} />
              </button>
              <Sidebar active={active} profile={profile} onNavigate={navigate} onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 border-b px-4 py-3 flex items-center gap-3"
        style={{ background: "var(--nav-bg)", borderColor: "var(--nav-border)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <button onClick={() => setMobileOpen(true)} className="text-white/40 hover:text-white/70 p-1 liq-text-2">
          <Menu size={18} />
        </button>
        <img
          src="/rtc-logo-transparent.png"
          alt="RTC"
          style={{
            height: 22, width: "auto", objectFit: "contain", flexShrink: 0,
            filter: isDark ? "brightness(0) invert(1)" : "none",
          }}
        />
        <span className="font-serif text-sm font-bold liq-text-1">LegalIQ Admin</span>
        {title && (
          <>
            <ChevronRight size={12} className="liq-text-3" />
            <span className="text-sm liq-text-2">{title}</span>
          </>
        )}
      </div>

      {/* Main content */}
      <main className="lg:ml-56 xl:ml-60 flex-1 min-h-screen">
        {/* Desktop page header */}
        {(title || actions) && (
          <div className="hidden lg:flex items-center justify-between px-8 py-5 border-b"
            style={{ background: "var(--nav-bg)", borderColor: "var(--nav-border)" }}>
            <h1 className="font-serif text-xl font-bold liq-text-1">{title}</h1>
            <div className="flex items-center gap-4">
              {actions && <div>{actions}</div>}
            </div>
          </div>
        )}
        <div className="pt-14 lg:pt-0">
          {protectedContent}
        </div>
      </main>
    </div>
  );
}
