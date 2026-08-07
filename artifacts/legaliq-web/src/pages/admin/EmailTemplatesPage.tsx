import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Plus, Edit3, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, Clock, CheckCircle, XCircle,
  AlertTriangle, Eye, X, Save, FlaskConical, Settings2, AtSign, User, Reply,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders() {
  const t = localStorage.getItem("liq_admin_token");
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return fetch(`${API_BASE}${path}`, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } })
    .then((r) => r.json() as Promise<T>);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  eventKey: string;
  name: string;
  description: string | null;
  subject: string;
  htmlBody: string;
  variables: string | null;
  isActive: boolean;
  updatedAt: string | null;
}

interface EmailLog {
  id: string;
  eventKey: string;
  recipientEmail: string;
  leadId: string | null;
  subject: string | null;
  status: string;
  error: string | null;
  sentAt: string;
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
    sent:    { icon: CheckCircle,    color: "#22C55E", bg: "rgba(34,197,94,0.10)",  label: "Sent" },
    failed:  { icon: XCircle,        color: "#EF4444", bg: "rgba(239,68,68,0.10)",  label: "Failed" },
    skipped: { icon: AlertTriangle,  color: "#F59E0B", bg: "rgba(245,158,11,0.10)", label: "Skipped" },
  };
  const s = map[status] ?? map.skipped;
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}>
      <Icon size={11} /> {s.label}
    </span>
  );
}

// ── Template editor modal ────────────────────────────────────────────────────

function TemplateEditor({
  template,
  onClose,
  onSave,
}: {
  template: EmailTemplate | null; // null = create new
  onClose: () => void;
  onSave: (data: Partial<EmailTemplate> & { eventKey?: string }) => void;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [form, setForm] = useState({
    eventKey:    template?.eventKey    ?? "",
    name:        template?.name        ?? "",
    description: template?.description ?? "",
    subject:     template?.subject     ?? "",
    htmlBody:    template?.htmlBody    ?? "",
    variables:   template?.variables   ?? "",
  });
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const isNew = template === null;

  async function sendTest() {
    if (!testEmail || !template) return;
    setTestSending(true);
    setTestMsg(null);
    try {
      const r = await apiFetch<{ success: boolean; message: string }>(
        `/admin/email-templates/${template.id}/test`,
        { method: "POST", body: JSON.stringify({ email: testEmail }) }
      );
      setTestMsg(r.success ? `✓ Test sent to ${testEmail}` : `✗ ${r.message}`);
    } catch {
      setTestMsg("✗ Network error");
    } finally {
      setTestSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--nav-bg)", border: "1px solid rgba(201,168,76,0.2)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(201,168,76,0.12)" }}>
          <div>
            <h2 className="font-bold liq-text-1 text-sm">{isNew ? "New Email Template" : "Edit Template"}</h2>
            {!isNew && <p className="text-xs liq-text-3 mt-0.5">{template.eventKey}</p>}
          </div>
          <div className="flex items-center gap-3">
            {/* Tab switcher */}
            <div className="flex items-center rounded-lg overflow-hidden border" style={{ borderColor: "rgba(201,168,76,0.18)" }}>
              {(["edit", "preview"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className="px-4 py-1.5 text-xs font-semibold transition-all capitalize"
                  style={{ background: tab === t ? "#C9A84C" : "transparent", color: tab === t ? "#0A0A0A" : "var(--liq-text-3)" }}>
                  {t === "edit" ? <><Edit3 size={11} className="inline mr-1.5" />Edit</> : <><Eye size={11} className="inline mr-1.5" />Preview</>}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg liq-text-3 hover:liq-text-1 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {tab === "edit" ? (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {isNew && (
                  <div>
                    <label className="block text-xs font-semibold liq-text-3 mb-1.5">Event Key <span className="text-red-400">*</span></label>
                    <input value={form.eventKey} onChange={(e) => setForm(f => ({ ...f, eventKey: e.target.value }))}
                      placeholder="e.g. password_reset"
                      className="w-full px-3 py-2 rounded-lg text-sm liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors"
                      style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                    <p className="text-[10px] liq-text-4 mt-1">Unique identifier used in code to trigger this email.</p>
                  </div>
                )}
                <div className={isNew ? "" : "col-span-2"}>
                  <label className="block text-xs font-semibold liq-text-3 mb-1.5">Template Name <span className="text-red-400">*</span></label>
                  <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Password Reset Email"
                    className="w-full px-3 py-2 rounded-lg text-sm liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors"
                    style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold liq-text-3 mb-1.5">Description</label>
                <input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="When is this email triggered?"
                  className="w-full px-3 py-2 rounded-lg text-sm liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors"
                  style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
              </div>

              <div>
                <label className="block text-xs font-semibold liq-text-3 mb-1.5">Subject Line <span className="text-red-400">*</span></label>
                <input value={form.subject} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Your Legal Health Score is Ready — {{score}}/100"
                  className="w-full px-3 py-2 rounded-lg text-sm liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors"
                  style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold liq-text-3">HTML Body <span className="text-red-400">*</span></label>
                  {form.variables && (
                    <span className="text-[10px] liq-text-4">Variables: <span className="text-[#C9A84C] font-mono">{form.variables}</span></span>
                  )}
                </div>
                <textarea value={form.htmlBody} onChange={(e) => setForm(f => ({ ...f, htmlBody: e.target.value }))}
                  rows={18}
                  placeholder="<div>Your email HTML here. Use {{name}}, {{company}}, etc.</div>"
                  className="w-full px-3 py-2 rounded-lg text-xs liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors font-mono resize-y"
                  style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)", lineHeight: "1.6" }} />
              </div>

              <div>
                <label className="block text-xs font-semibold liq-text-3 mb-1.5">Available Variables (for reference)</label>
                <input value={form.variables} onChange={(e) => setForm(f => ({ ...f, variables: e.target.value }))}
                  placeholder="{{name}}, {{company}}, {{score}}, ..."
                  className="w-full px-3 py-2 rounded-lg text-sm liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors font-mono"
                  style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="mb-4 p-3 rounded-lg text-xs liq-text-3" style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)" }}>
                Preview uses your current unsaved HTML. Variable placeholders will appear as-is unless you send a test.
              </div>
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: "rgba(201,168,76,0.15)" }}>
                <div className="px-4 py-2 text-xs liq-text-3 border-b" style={{ background: "rgba(0,0,0,0.2)", borderColor: "rgba(201,168,76,0.12)" }}>
                  Subject: <span className="liq-text-1 font-semibold">{form.subject || "(no subject)"}</span>
                </div>
                <iframe
                  srcDoc={form.htmlBody}
                  title="Email preview"
                  className="w-full"
                  style={{ height: "500px", border: "none", background: "#0A0A0A" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-4" style={{ borderColor: "rgba(201,168,76,0.12)" }}>
          {/* Test send */}
          {!isNew && (
            <div className="flex items-center gap-2 flex-1">
              <input
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="px-3 py-1.5 rounded-lg text-xs liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors w-44"
                style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.15)" }}
              />
              <button onClick={sendTest} disabled={testSending || !testEmail}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40"
                style={{ borderColor: "rgba(201,168,76,0.3)", color: "#C9A84C" }}>
                <FlaskConical size={12} /> {testSending ? "Sending…" : "Send Test"}
              </button>
              {testMsg && <span className={`text-xs ${testMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{testMsg}</span>}
            </div>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold liq-text-3 hover:liq-text-1 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => onSave({ ...form })}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-[#C9A84C] text-[#0A0A0A] hover:bg-[#E2C97E] transition-colors">
              <Save size={13} /> {isNew ? "Create Template" : "Save Changes"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

interface EmailSettings {
  senderName: string;
  senderEmail: string;
  replyTo: string;
}

// ── Sender config panel ──────────────────────────────────────────────────────

function SenderConfigPanel() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EmailSettings | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["email-settings"],
    queryFn: () => apiFetch<{ success: boolean; settings: EmailSettings }>("/admin/email-settings"),
  });

  const settings = data?.settings;

  const saveMutation = useMutation({
    mutationFn: (s: EmailSettings) =>
      apiFetch<{ success: boolean; settings: EmailSettings }>("/admin/email-settings", {
        method: "PUT",
        body: JSON.stringify(s),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-settings"] });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function startEdit() {
    if (!settings) return;
    setForm({ ...settings });
    setEditing(true);
  }

  const fields: Array<{ key: keyof EmailSettings; label: string; icon: typeof AtSign; hint: string }> = [
    { key: "senderName",  label: "Sender Name",  icon: User,   hint: "Display name shown in the inbox" },
    { key: "senderEmail", label: "Sender Email", icon: AtSign, hint: "Must be the connected Gmail account" },
    { key: "replyTo",     label: "Reply-To",     icon: Reply,  hint: "Where replies land (can differ from sender)" },
  ];

  return (
    <div className="glass-card rounded-2xl p-5" style={{ border: "1px solid rgba(201,168,76,0.15)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(201,168,76,0.10)", border: "1px solid rgba(201,168,76,0.2)" }}>
            <Settings2 size={14} className="text-[#C9A84C]" />
          </div>
          <div>
            <p className="text-sm font-bold liq-text-1">Sender Configuration</p>
            <p className="text-[10px] liq-text-4">Emails are sent via your connected Gmail account</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[11px] text-emerald-400 font-semibold">✓ Saved</span>}
          {!editing ? (
            <button onClick={startEdit} disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
              style={{ borderColor: "rgba(201,168,76,0.3)", color: "#C9A84C" }}>
              <Edit3 size={11} /> Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold liq-text-3 hover:liq-text-1 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => form && saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#C9A84C] text-[#0A0A0A] hover:bg-[#E2C97E] transition-all">
                <Save size={11} /> {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-3 gap-3">
          {[0,1,2].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "rgba(201,168,76,0.06)" }} />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          {fields.map(({ key, label, icon: Icon, hint }) => (
            <div key={key} className="rounded-xl p-3" style={{ background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.1)" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={10} className="liq-text-4" />
                <span className="text-[10px] font-semibold liq-text-4 uppercase tracking-wider">{label}</span>
              </div>
              {editing && form ? (
                <input
                  value={form[key]}
                  onChange={e => setForm(f => f ? { ...f, [key]: e.target.value } : f)}
                  className="w-full text-xs liq-text-1 bg-transparent border-b outline-none pb-0.5 transition-colors"
                  style={{ borderColor: "rgba(201,168,76,0.4)" }}
                />
              ) : (
                <p className="text-xs liq-text-1 font-semibold truncate">{settings?.[key] ?? "—"}</p>
              )}
              <p className="text-[9px] liq-text-4 mt-1">{hint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function EmailTemplatesPage() {
  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<EmailTemplate | null | "new">(undefined as unknown as "new");
  const [showEditor, setShowEditor] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<string>("");

  const { data: tplData, isLoading: tplLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => apiFetch<{ success: boolean; templates: EmailTemplate[] }>("/admin/email-templates"),
  });

  const { data: logData } = useQuery({
    queryKey: ["email-logs"],
    queryFn: () => apiFetch<{ success: boolean; logs: EmailLog[] }>("/admin/email-logs"),
    enabled: logsOpen,
    refetchInterval: logsOpen ? 30_000 : false,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string | null; data: Record<string, unknown> }) => {
      if (id) {
        return apiFetch(`/admin/email-templates/${id}`, { method: "PUT", body: JSON.stringify(data) });
      }
      return apiFetch("/admin/email-templates", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      setShowEditor(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/admin/email-templates/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
  });

  const templates = tplData?.templates ?? [];
  const logs = logData?.logs ?? [];

  const filteredLogs = logFilter
    ? logs.filter(l => l.eventKey.includes(logFilter) || l.recipientEmail.includes(logFilter) || l.status === logFilter)
    : logs;

  const logStats = {
    total: logs.length,
    sent: logs.filter(l => l.status === "sent").length,
    failed: logs.filter(l => l.status === "failed").length,
    skipped: logs.filter(l => l.status === "skipped").length,
  };

  function openEdit(t: EmailTemplate) { setEditTarget(t); setShowEditor(true); }
  function openNew() { setEditTarget(null); setShowEditor(true); }

  function handleSave(data: Partial<EmailTemplate>) {
    const id = editTarget && editTarget !== "new" ? (editTarget as EmailTemplate).id : null;
    saveMutation.mutate({ id, data: data as Record<string, unknown> });
  }

  return (
    <AdminLayout active="/admin/email-templates" title="Email Templates">
      <div className="space-y-6">

        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold liq-text-1">Email Templates</h1>
            <p className="text-xs liq-text-3 mt-0.5">Customise every automated email sent by LegalIQ. Changes take effect immediately.</p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A84C] text-[#0A0A0A] text-xs font-bold hover:bg-[#E2C97E] transition-all shadow-md shadow-[#C9A84C]/20">
            <Plus size={14} /> New Template
          </button>
        </div>

        {/* Sender configuration */}
        <SenderConfigPanel />

        {/* Templates grid */}
        {tplLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: "rgba(201,168,76,0.06)" }} />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <motion.div key={t.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden group">

                {/* Active indicator */}
                <div className="absolute top-0 left-0 h-0.5 w-full"
                  style={{ background: t.isActive ? "linear-gradient(90deg, #C9A84C, transparent)" : "transparent" }} />

                <div className="flex items-start justify-between gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(201,168,76,0.10)", border: "1px solid rgba(201,168,76,0.2)" }}>
                    <Mail size={14} className="text-[#C9A84C]" />
                  </div>
                  {/* Active toggle */}
                  <button
                    onClick={() => toggleMutation.mutate({ id: t.id, isActive: !t.isActive })}
                    className="flex-shrink-0 transition-all"
                    title={t.isActive ? "Disable template" : "Enable template"}>
                    {t.isActive
                      ? <ToggleRight size={22} className="text-[#C9A84C]" />
                      : <ToggleLeft  size={22} className="liq-text-4" />}
                  </button>
                </div>

                <div className="flex-1">
                  <p className="text-sm font-bold liq-text-1 leading-snug mb-1">{t.name}</p>
                  <p className="text-[11px] liq-text-3 leading-relaxed line-clamp-2">{t.description || "No description"}</p>
                </div>

                <div className="pt-2 border-t" style={{ borderColor: "rgba(201,168,76,0.1)" }}>
                  <p className="text-[10px] font-mono liq-text-4 truncate mb-2">Subject: {t.subject}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md liq-text-4"
                      style={{ background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.12)" }}>
                      {t.eventKey}
                    </span>
                    <button onClick={() => openEdit(t)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#C9A84C] hover:text-[#E2C97E] transition-colors">
                      <Edit3 size={11} /> Edit
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Email logs panel */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button onClick={() => setLogsOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#C9A84C]/[0.03] transition-colors">
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-[#C9A84C]" />
              <span className="text-sm font-bold liq-text-1">Email Send Log</span>
              {logData && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">{logStats.sent} sent</span>
                  {logStats.failed > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold">{logStats.failed} failed</span>}
                </div>
              )}
            </div>
            {logsOpen ? <ChevronDown size={16} className="liq-text-3" /> : <ChevronRight size={16} className="liq-text-3" />}
          </button>

          <AnimatePresence>
            {logsOpen && (
              <motion.div
                initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                style={{ overflow: "hidden" }}>
                <div className="px-6 pb-6">
                  {/* Filter bar */}
                  <div className="flex items-center gap-2 mb-4">
                    <input value={logFilter} onChange={e => setLogFilter(e.target.value)}
                      placeholder="Filter by event, email, or status…"
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors"
                      style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.15)" }} />
                    {logFilter && (
                      <button onClick={() => setLogFilter("")} className="p-1.5 rounded-lg liq-text-3 hover:liq-text-1">
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {filteredLogs.length === 0 ? (
                    <p className="text-xs liq-text-4 text-center py-8">No email logs yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
                            {["Event", "Recipient", "Subject", "Status", "Sent At"].map(h => (
                              <th key={h} className="text-left pb-2 pr-4 liq-text-4 font-semibold uppercase text-[10px] tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLogs.slice(0, 100).map((log) => (
                            <tr key={log.id} style={{ borderBottom: "1px solid rgba(201,168,76,0.05)" }}>
                              <td className="py-2.5 pr-4">
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded liq-text-3"
                                  style={{ background: "rgba(201,168,76,0.07)" }}>{log.eventKey}</span>
                              </td>
                              <td className="py-2.5 pr-4 liq-text-2 max-w-[180px] truncate">{log.recipientEmail}</td>
                              <td className="py-2.5 pr-4 liq-text-3 max-w-[200px] truncate">{log.subject ?? "—"}</td>
                              <td className="py-2.5 pr-4"><StatusBadge status={log.status} /></td>
                              <td className="py-2.5 liq-text-4 whitespace-nowrap">
                                {new Date(log.sentAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredLogs.length > 100 && (
                        <p className="text-[10px] liq-text-4 text-center mt-3">Showing 100 of {filteredLogs.length} logs.</p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Editor modal */}
      <AnimatePresence>
        {showEditor && (
          <TemplateEditor
            template={editTarget === null || editTarget === ("new" as unknown) ? null : editTarget as EmailTemplate}
            onClose={() => setShowEditor(false)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
