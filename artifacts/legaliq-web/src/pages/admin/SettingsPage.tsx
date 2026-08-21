import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle, Download, Eye, EyeOff, FileSpreadsheet, Info, KeyRound,
  Lock, Pencil, Plus, Save, Shield, UserRound, UsersRound, X, Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { API_BASE, apiFetch, authHeaders } from "@/lib/api";
import {
  ADMIN_PERMISSION_OPTIONS,
  hasAdminPermission,
  loadAdminProfile,
  storeAdminProfile,
  type AdminPermission,
  type AdminProfile,
} from "@/lib/adminAccess";

function PasswordInput({
  label, value, onChange, visible, onToggle, autoComplete,
}: {
  label: string; value: string; onChange: (value: string) => void;
  visible: boolean; onToggle: () => void; autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="type-caption liq-text-2 mb-1.5 block">{label}</span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className="liq-input w-full pr-10"
          minLength={8}
        />
        <button type="button" onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-3 top-1/2 -translate-y-1/2 liq-text-4 hover:liq-text-1 transition-colors">
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </label>
  );
}

interface AdminUser extends AdminProfile {
  createdAt?: string;
  updatedAt?: string;
}

interface AdminUserForm {
  id?: string;
  name: string;
  email: string;
  password: string;
  isActive: boolean;
  permissions: AdminPermission[];
}

const emptyAdminForm: AdminUserForm = {
  name: "", email: "", password: "", isActive: true, permissions: [],
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminForm, setAdminForm] = useState<AdminUserForm | null>(null);
  const [savingAdmin, setSavingAdmin] = useState(false);

  const can = (permission: AdminPermission) => hasAdminPermission(profile, permission);
  const canManageAdmins = can("admin-users");

  useEffect(() => {
    loadAdminProfile()
      .then((admin) => {
        setProfile(admin);
        setProfileName(admin.name);
        setProfileEmail(admin.email);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not load your profile"))
      .finally(() => setLoading(false));
  }, []);

  async function refreshAdmins() {
    if (!canManageAdmins) return;
    setLoadingAdmins(true);
    try {
      const response = await apiFetch<{ success: boolean; admins: AdminUser[] }>("/auth/admin-users", {
        headers: authHeaders(),
      });
      setAdmins(response.admins);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not load admin users");
    } finally {
      setLoadingAdmins(false);
    }
  }

  useEffect(() => {
    if (profile && hasAdminPermission(profile, "admin-users")) void refreshAdmins();
  // refreshAdmins relies on current profile; run it when the authenticated profile becomes available.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.permissions.join("|")]);

  const selectedPermissionLabels = useMemo(() =>
    profile?.permissions.map((permission) =>
      ADMIN_PERMISSION_OPTIONS.find((option) => option.value === permission)?.label ?? permission,
    ) ?? [], [profile]);

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const response = await apiFetch<{ success: boolean; admin: AdminProfile; token?: string; message: string }>("/auth/profile", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ name: profileName, email: profileEmail }),
      });
      if (response.token) localStorage.setItem("liq_admin_token", response.token);
      storeAdminProfile(response.admin);
      setProfile(response.admin);
      setProfileName(response.admin.name);
      setProfileEmail(response.admin.email);
      toast.success(response.message);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not update your profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Complete all password fields");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      const response = await apiFetch<{ success: boolean; token: string; message: string }>("/auth/change-password", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      localStorage.setItem("liq_admin_token", response.token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(response.message);
      toast.success(response.message);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not change password";
      setPasswordError(message);
      toast.error(message);
    } finally {
      setChangingPassword(false);
    }
  }

  function toggleAdminPermission(permission: AdminPermission) {
    setAdminForm((current) => current ? {
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    } : current);
  }

  function beginEditAdmin(admin: AdminUser) {
    setAdminForm({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      password: "",
      isActive: admin.isActive,
      permissions: admin.permissions,
    });
  }

  async function handleAdminSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminForm) return;
    if (!adminForm.name.trim() || !adminForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!adminForm.id && adminForm.password.length < 8) {
      toast.error("Set an initial password of at least 8 characters");
      return;
    }
    if (adminForm.id && adminForm.password && adminForm.password.length < 8) {
      toast.error("New passwords must be at least 8 characters");
      return;
    }
    setSavingAdmin(true);
    try {
      const body = {
        name: adminForm.name,
        email: adminForm.email,
        isActive: adminForm.isActive,
        permissions: adminForm.permissions,
        ...(adminForm.password ? { password: adminForm.password } : {}),
      };
      const response = adminForm.id
        ? await apiFetch<{ success: boolean; admin: AdminUser; message: string }>(`/auth/admin-users/${adminForm.id}`, {
          method: "PATCH", headers: authHeaders(), body: JSON.stringify(body),
        })
        : await apiFetch<{ success: boolean; admin: AdminUser }>("/auth/admin-users", {
          method: "POST", headers: authHeaders(), body: JSON.stringify({ ...body, password: adminForm.password }),
        });
      setAdminForm(null);
      await refreshAdmins();
      if (response.admin.id === profile?.id) {
        storeAdminProfile(response.admin);
        setProfile(response.admin);
      }
      toast.success(adminForm.id ? "Admin account updated" : "Admin account created");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not save the admin account");
    } finally {
      setSavingAdmin(false);
    }
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const response = await fetch(`${API_BASE}/admin/export`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `legaliq-leads-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("CSV download started");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminLayout active="/admin/settings" title="Settings">
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-6">
          <h2 className="type-h2 liq-text-1 mb-1 flex items-center gap-2">
            <UserRound size={15} className="text-[#C9A84C]" /> My Profile
          </h2>
          <p className="type-caption liq-text-3 mb-5">Update the name and email address shown for your administrator account.</p>
          <form onSubmit={handleProfileSave} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
            <label className="block">
              <span className="type-caption liq-text-2 mb-1.5 block">Display name</span>
              <input className="liq-input w-full" value={profileName} disabled={loading}
                onChange={(event) => setProfileName(event.target.value)} autoComplete="name" />
            </label>
            <label className="block">
              <span className="type-caption liq-text-2 mb-1.5 block">Admin email</span>
              <input className="liq-input w-full" value={profileEmail} disabled={loading} type="email"
                onChange={(event) => setProfileEmail(event.target.value)} autoComplete="email" />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={savingProfile || loading}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-40"
                style={{ background: "#C9A84C", color: "#0A0A0A" }}>
                <Save size={15} /> {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="glass-card rounded-2xl p-6">
          <h2 className="type-h2 liq-text-1 mb-1 flex items-center gap-2">
            <Lock size={15} className="text-[#C9A84C]" /> Change Password
          </h2>
          <p className="type-caption liq-text-3 mb-5">Verify your current password before setting a new password of at least 8 characters.</p>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
            <PasswordInput label="Current password" value={currentPassword} visible={showCurrentPassword}
              onChange={(value) => { setCurrentPassword(value); setPasswordError(null); setPasswordSuccess(null); }}
              onToggle={() => setShowCurrentPassword((value) => !value)} autoComplete="current-password" />
            <div className="grid sm:grid-cols-2 gap-4">
              <PasswordInput label="New password" value={newPassword} visible={showNewPassword}
                onChange={(value) => { setNewPassword(value); setPasswordError(null); setPasswordSuccess(null); }}
                onToggle={() => setShowNewPassword((value) => !value)} autoComplete="new-password" />
              <PasswordInput label="Confirm new password" value={confirmPassword} visible={showConfirmPassword}
                onChange={(value) => { setConfirmPassword(value); setPasswordError(null); setPasswordSuccess(null); }}
                onToggle={() => setShowConfirmPassword((value) => !value)} autoComplete="new-password" />
            </div>
            {passwordError && <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/8 px-3 py-2.5 text-xs text-red-400">{passwordError}</div>}
            {passwordSuccess && <div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5 text-xs text-emerald-400">{passwordSuccess}</div>}
            <button type="submit" disabled={changingPassword}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: "#C9A84C", color: "#0A0A0A" }}>
              <KeyRound size={15} /> {changingPassword ? "Changing password…" : "Change password"}
            </button>
          </form>
        </motion.div>

        {canManageAdmins && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass-card rounded-2xl p-6">
            <div className="flex flex-wrap gap-3 items-start justify-between mb-5">
              <div>
                <h2 className="type-h2 liq-text-1 flex items-center gap-2"><UsersRound size={15} className="text-[#C9A84C]" /> Admin Users</h2>
                <p className="type-caption liq-text-3 mt-1">Create accounts and give each administrator only the access they need.</p>
              </div>
              <button type="button" onClick={() => setAdminForm({ ...emptyAdminForm })}
                className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold bg-[#C9A84C] text-[#0A0A0A]">
                <Plus size={14} /> Add admin
              </button>
            </div>

            {loadingAdmins ? (
              <p className="type-caption liq-text-3 py-4">Loading administrator accounts…</p>
            ) : (
              <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-xl">
                <table className="w-full min-w-[680px] text-left">
                  <thead className="bg-black/[0.03] dark:bg-white/[0.04]">
                    <tr className="type-caption liq-text-3">
                      <th className="px-4 py-3 font-medium">Admin</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Permissions</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => (
                      <tr key={admin.id} className="border-t border-black/5 dark:border-white/5">
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold liq-text-1">{admin.name}</div>
                          <div className="type-caption liq-text-3">{admin.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${admin.isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-400"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${admin.isActive ? "bg-emerald-500" : "bg-red-400"}`} />
                            {admin.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 type-caption liq-text-3">{admin.permissions.length} of {ADMIN_PERMISSION_OPTIONS.length}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => beginEditAdmin(admin)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C9A84C] hover:opacity-75">
                            <Pencil size={12} /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {adminForm && (
              <form onSubmit={handleAdminSave} className="mt-5 rounded-xl border border-[#C9A84C]/25 bg-[#C9A84C]/[0.04] p-5">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div>
                    <h3 className="type-h3 liq-text-1">{adminForm.id ? "Edit administrator" : "New administrator"}</h3>
                    <p className="type-caption liq-text-3 mt-1">{adminForm.id ? "Leave password blank to keep the current password." : "Set an initial password and choose the exact access to grant."}</p>
                  </div>
                  <button type="button" onClick={() => setAdminForm(null)} aria-label="Close admin form" className="liq-text-3 hover:liq-text-1"><X size={16} /></button>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block"><span className="type-caption liq-text-2 mb-1.5 block">Name</span>
                    <input className="liq-input w-full" value={adminForm.name} onChange={(event) => setAdminForm({ ...adminForm, name: event.target.value })} autoComplete="name" />
                  </label>
                  <label className="block"><span className="type-caption liq-text-2 mb-1.5 block">Email</span>
                    <input className="liq-input w-full" value={adminForm.email} onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })} type="email" autoComplete="email" />
                  </label>
                  <label className="block"><span className="type-caption liq-text-2 mb-1.5 block">{adminForm.id ? "Reset password (optional)" : "Initial password"}</span>
                    <input className="liq-input w-full" value={adminForm.password} onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })} type="password" minLength={8} autoComplete="new-password" />
                  </label>
                  <label className="flex items-center gap-3 mt-5 cursor-pointer">
                    <input type="checkbox" checked={adminForm.isActive} onChange={(event) => setAdminForm({ ...adminForm, isActive: event.target.checked })} className="accent-[#C9A84C]" />
                    <span><span className="text-sm font-semibold liq-text-1">Account active</span><span className="type-caption liq-text-3 block">Inactive accounts cannot sign in.</span></span>
                  </label>
                </div>
                <fieldset className="mt-5">
                  <legend className="text-sm font-semibold liq-text-1 mb-3">Permissions</legend>
                  <div className="grid md:grid-cols-2 gap-2">
                    {ADMIN_PERMISSION_OPTIONS.map((option) => (
                      <label key={option.value} className="flex gap-3 rounded-xl border border-black/10 dark:border-white/10 p-3 cursor-pointer hover:border-[#C9A84C]/40 transition-colors">
                        <input type="checkbox" className="mt-0.5 accent-[#C9A84C]" checked={adminForm.permissions.includes(option.value)}
                          onChange={() => toggleAdminPermission(option.value)} />
                        <span><span className="text-sm font-semibold liq-text-1 block">{option.label}</span><span className="type-caption liq-text-3">{option.detail}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-5 flex gap-3">
                  <button type="submit" disabled={savingAdmin} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40" style={{ background: "#C9A84C", color: "#0A0A0A" }}>
                    <CheckCircle size={15} /> {savingAdmin ? "Saving…" : adminForm.id ? "Save changes" : "Create admin"}
                  </button>
                  <button type="button" onClick={() => setAdminForm(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold liq-text-2 border border-black/10 dark:border-white/10">Cancel</button>
                </div>
              </form>
            )}
          </motion.div>
        )}

        {can("leads:export") && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass-card rounded-2xl p-6">
            <h2 className="type-h2 liq-text-1 mb-1 flex items-center gap-2"><Download size={15} className="text-[#C9A84C]" /> Export Leads</h2>
            <p className="type-caption liq-text-3 mb-5">Download assessment data with scores, pillar breakdowns, and contact details.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <button type="button" onClick={handleExportCSV} className="flex items-center gap-3 p-4 rounded-xl border border-gray-300 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5 text-left">
                <Download size={17} className="text-[#C9A84C]" /><span><span className="type-h3 liq-text-1 block">Download CSV</span><span className="type-caption liq-text-3">All leads · full pillar scores</span></span>
              </button>
              <button type="button" onClick={handleExportCSV} disabled={exporting} className="flex items-center gap-3 p-4 rounded-xl border border-gray-300 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5 text-left disabled:opacity-40">
                <FileSpreadsheet size={17} className="text-emerald-500" /><span><span className="type-h3 liq-text-1 block">{exporting ? "Downloading…" : "Export for Google Sheets"}</span><span className="type-caption liq-text-3">CSV formatted for import</span></span>
              </button>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="glass-card rounded-2xl p-6">
          <h2 className="type-h2 liq-text-1 mb-4 flex items-center gap-2"><Shield size={15} className="text-emerald-500" /> Your Access</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3"><span className="type-caption liq-text-3 block">Account status</span><span className="text-sm font-semibold text-emerald-500">{profile?.isActive ? "Active" : "Inactive"}</span></div>
            <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3"><span className="type-caption liq-text-3 block">Granted permissions</span><span className="text-sm font-semibold liq-text-1">{selectedPermissionLabels.length} of {ADMIN_PERMISSION_OPTIONS.length}</span></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedPermissionLabels.map((label) => <span key={label} className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">{label}</span>)}
          </div>
        </motion.div>

        {can("settings") && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-6">
            <h2 className="type-h2 liq-text-1 mb-4 flex items-center gap-2"><Info size={15} className="text-[#C9A84C]" /> System Configuration</h2>
            <div className="space-y-0">
              {[
                { label: "Platform", value: "LegalIQ by Rest The Case" },
                { label: "Authentication", value: "Email + password (bcrypt hashed) with JWT sessions" },
                { label: "Assessment pillars", value: "Litigation · Contractual · Compliance · Cost Efficiency" },
                { label: "Access control", value: "Per-user, backend-enforced permissions" },
              ].map((item) => <div key={item.label} className="flex gap-4 py-3 border-b border-black/5 dark:border-white/5 last:border-0"><span className="type-caption liq-text-2 w-40 flex-shrink-0">{item.label}</span><span className="type-caption liq-text-1">{item.value}</span></div>)}
            </div>
          </motion.div>
        )}

        {can("ai") && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="glass-card rounded-2xl p-6">
            <h2 className="type-h2 liq-text-1 mb-2 flex items-center gap-2"><Zap size={15} className="text-[#C9A84C]" /> AI Features</h2>
            <p className="type-caption liq-text-3">Your account can use AI-powered portfolio insights, per-lead analysis, and outreach email drafting.</p>
          </motion.div>
        )}
      </div>
    </AdminLayout>
  );
}