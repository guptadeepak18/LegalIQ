import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, Edit3, ToggleLeft, ToggleRight,
  Eye, X, Save, Link as LinkIcon, Mail, Phone, Globe,
  Type, Palette, LayoutTemplate, FileOutput, CheckCircle, Quote
} from "lucide-react";
import { apiFetch, authHeaders } from "@/lib/api";
import { generateVCLOBrochurePDF } from "@/lib/pdfGenerator";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

interface BrochureConfig {
  colors: {
    navy: string;
    gold: string;
    accent: string;
  };
  contactEmail: string;
  contactPhone: string;
  website: string;
  tagline: string;
  coverTitle: string;
  coverSubtitle: string;
  vcloPitch: string;
  scoreLabel: string;
}

interface BrochureTemplate {
  id: string;
  name: string;
  description: string | null;
  templateKey: string;
  version: number;
  isActive: boolean;
  config: BrochureConfig;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_CONFIG: BrochureConfig = {
  colors: { navy: "#07091A", gold: "#C9A84C", accent: "#E2C97E" },
  contactEmail: "contact@restthecase.com",
  contactPhone: "+91 98765 43210",
  website: "www.restthecase.com",
  tagline: "Making the law accessible to everyone.",
  coverTitle: "Legal Health Assessment",
  coverSubtitle: "A comprehensive review of your legal standing and risk profile.",
  vcloPitch: "Need dedicated ongoing support? Our Virtual Chief Legal Officer program provides comprehensive legal oversight without the overhead of an in-house team.",
  scoreLabel: "Legal Health Score",
};

// ── Preview Component ────────────────────────────────────────────────────────

function BrochurePreview({ config, name }: { config: BrochureConfig; name: string }) {
  return (
    <div className="flex items-center justify-center p-8 min-h-[600px] h-full" style={{ background: "rgba(201,168,76,0.02)" }}>
      <div 
        className="w-[420px] h-[594px] shadow-2xl relative overflow-hidden flex flex-col transition-colors duration-300"
        style={{ backgroundColor: "#F4EFE4" }}
      >
        {/* Cover top accent */}
        <div className="h-3 w-full transition-colors duration-300" style={{ backgroundColor: config.colors.gold }} />
        
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
            <div className="text-xl font-bold transition-colors duration-300" style={{ color: config.colors.navy }}>Rest The Case</div>
        </div>

        {/* Content */}
        <div className="px-8 mt-10 flex-1">
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold mb-4 transition-colors duration-300" style={{ color: config.colors.accent }}>
            {name || "Template Name"}
          </h2>
          <h1 className="text-4xl leading-[1.1] mb-5 font-bold transition-colors duration-300" style={{ color: config.colors.navy }}>
            {config.coverTitle || "Document Title"}
          </h1>
          <p className="text-sm opacity-90 leading-relaxed max-w-[90%] transition-colors duration-300" style={{ color: "#1A1410" }}>
            {config.coverSubtitle || "Document subtitle goes here"}
          </p>
        </div>

        {/* Bottom Banner */}
        <div className="p-8 pb-10 transition-colors duration-300" style={{ backgroundColor: config.colors.navy, color: "#F4EFE4" }}>
           <div className="text-xs opacity-80 mb-1 uppercase tracking-wider font-semibold">{config.scoreLabel}</div>
           <div className="text-4xl mb-6 font-bold transition-colors duration-300" style={{ color: config.colors.gold }}>85/100</div>
           
           <div className="pt-4 flex items-center justify-between text-[10px] font-medium tracking-wide opacity-80" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
             <span>{config.website || "website.com"}</span>
             <span>{config.contactEmail || "email@example.com"}</span>
           </div>
        </div>
      </div>
    </div>
  );
}

// ── Editor Modal ─────────────────────────────────────────────────────────────

function TemplateEditor({
  template,
  onClose,
  onSave,
  isPending,
}: {
  template: BrochureTemplate | null;
  onClose: () => void;
  onSave: (data: Partial<BrochureTemplate>) => void;
  isPending: boolean;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [form, setForm] = useState({
    name:        template?.name        ?? "",
    description: template?.description ?? "",
    templateKey: template?.templateKey ?? "",
    isActive:    template?.isActive    ?? false,
    config:      template?.config      ?? DEFAULT_CONFIG,
  });

  const isNew = template === null;

  const updateConfig = (key: keyof BrochureConfig, value: string) => {
    setForm(f => ({ ...f, config: { ...f.config, [key]: value } }));
  };
  
  const updateColor = (colorKey: keyof BrochureConfig["colors"], value: string) => {
    setForm(f => ({ ...f, config: { ...f.config, colors: { ...f.config.colors, [colorKey]: value } } }));
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--nav-bg)", border: "1px solid rgba(201,168,76,0.2)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "rgba(201,168,76,0.12)" }}>
          <div>
            <h2 className="font-bold liq-text-1 text-sm">{isNew ? "New Brochure Template" : "Edit Template"}</h2>
            {!isNew && <p className="text-xs liq-text-3 mt-0.5">{template.templateKey} (v{template.version})</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg overflow-hidden border" style={{ borderColor: "rgba(201,168,76,0.18)" }}>
              {(["edit", "preview"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className="px-4 py-1.5 text-xs font-semibold transition-all capitalize"
                  style={{ background: tab === t ? "#C9A84C" : "transparent", color: tab === t ? "#0A0A0A" : "var(--liq-text-3)" }}>
                  {t === "edit" ? <><Edit3 size={11} className="inline mr-1.5" />Edit Config</> : <><Eye size={11} className="inline mr-1.5" />Preview PDF</>}
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
            <div className="p-6 space-y-8 max-w-4xl mx-auto">
              {/* General Details */}
              <section>
                <h3 className="text-xs font-bold liq-text-1 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <LayoutTemplate size={14} className="text-[#C9A84C]" /> General Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {isNew && (
                    <div>
                      <label className="block text-xs font-semibold liq-text-3 mb-1.5">Template Key <span className="text-red-400">*</span></label>
                      <input value={form.templateKey} onChange={(e) => setForm(f => ({ ...f, templateKey: e.target.value }))}
                        placeholder="e.g. standard_assessment"
                        className="w-full px-3 py-2 rounded-lg text-sm liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors"
                        style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                    </div>
                  )}
                  <div className={isNew ? "" : "col-span-2"}>
                    <label className="block text-xs font-semibold liq-text-3 mb-1.5">Template Name <span className="text-red-400">*</span></label>
                    <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Premium Legal Assessment"
                      className="w-full px-3 py-2 rounded-lg text-sm liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors"
                      style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold liq-text-3 mb-1.5">Description</label>
                    <input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Briefly describe when to use this template..."
                      className="w-full px-3 py-2 rounded-lg text-sm liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors"
                      style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                  </div>
                </div>
              </section>

              {/* Cover & Copy */}
              <section>
                <h3 className="text-xs font-bold liq-text-1 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FileText size={14} className="text-[#C9A84C]" /> Cover & Content
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold liq-text-3 mb-1.5">Cover Title</label>
                    <input value={form.config.coverTitle} onChange={(e) => updateConfig("coverTitle", e.target.value)}
                      placeholder="Legal Health Assessment"
                      className="w-full px-3 py-2 rounded-lg text-sm liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors"
                      style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold liq-text-3 mb-1.5">Score Label</label>
                    <input value={form.config.scoreLabel} onChange={(e) => updateConfig("scoreLabel", e.target.value)}
                      placeholder="Legal Health Score"
                      className="w-full px-3 py-2 rounded-lg text-sm liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors"
                      style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold liq-text-3 mb-1.5">Cover Subtitle</label>
                    <input value={form.config.coverSubtitle} onChange={(e) => updateConfig("coverSubtitle", e.target.value)}
                      placeholder="A comprehensive review..."
                      className="w-full px-3 py-2 rounded-lg text-sm liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors"
                      style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold liq-text-3 mb-1.5">VCLO Pitch (Back Page)</label>
                    <textarea value={form.config.vcloPitch} onChange={(e) => updateConfig("vcloPitch", e.target.value)}
                      rows={3}
                      placeholder="Need dedicated ongoing support?..."
                      className="w-full px-3 py-2 rounded-lg text-sm liq-text-1 border outline-none focus:border-[#C9A84C] transition-colors resize-none"
                      style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                  </div>
                </div>
              </section>

              {/* Branding */}
              <div className="grid md:grid-cols-2 gap-8">
                <section>
                  <h3 className="text-xs font-bold liq-text-1 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Palette size={14} className="text-[#C9A84C]" /> Colors & Typography
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold liq-text-3 mb-1">Navy (Primary)</label>
                        <div className="flex gap-2 items-center">
                          <input type="color" value={form.config.colors.navy} onChange={(e) => updateColor("navy", e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0 flex-shrink-0" />
                          <input value={form.config.colors.navy} onChange={(e) => updateColor("navy", e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs liq-text-1 border outline-none focus:border-[#C9A84C] font-mono"
                            style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold liq-text-3 mb-1">Gold (Accent)</label>
                        <div className="flex gap-2 items-center">
                          <input type="color" value={form.config.colors.gold} onChange={(e) => updateColor("gold", e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0 flex-shrink-0" />
                          <input value={form.config.colors.gold} onChange={(e) => updateColor("gold", e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs liq-text-1 border outline-none focus:border-[#C9A84C] font-mono"
                            style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold liq-text-3 mb-1">Cover Accent</label>
                        <div className="flex gap-2 items-center">
                          <input type="color" value={form.config.colors.accent} onChange={(e) => updateColor("accent", e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0 flex-shrink-0" />
                          <input value={form.config.colors.accent} onChange={(e) => updateColor("accent", e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs liq-text-1 border outline-none focus:border-[#C9A84C] font-mono"
                            style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold liq-text-1 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Quote size={14} className="text-[#C9A84C]" /> Brand & Contact
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold liq-text-3 mb-1 flex items-center gap-1"><FileText size={10}/> Tagline</label>
                      <input value={form.config.tagline} onChange={(e) => updateConfig("tagline", e.target.value)}
                        placeholder="Making the law accessible..."
                        className="w-full px-2 py-1.5 rounded-lg text-xs liq-text-1 border outline-none focus:border-[#C9A84C]"
                        style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold liq-text-3 mb-1 flex items-center gap-1"><Globe size={10}/> Website</label>
                        <input value={form.config.website} onChange={(e) => updateConfig("website", e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg text-xs liq-text-1 border outline-none focus:border-[#C9A84C]"
                          style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold liq-text-3 mb-1 flex items-center gap-1"><Mail size={10}/> Email</label>
                        <input value={form.config.contactEmail} onChange={(e) => updateConfig("contactEmail", e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg text-xs liq-text-1 border outline-none focus:border-[#C9A84C]"
                          style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold liq-text-3 mb-1 flex items-center gap-1"><Phone size={10}/> Phone</label>
                        <input value={form.config.contactPhone} onChange={(e) => updateConfig("contactPhone", e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg text-xs liq-text-1 border outline-none focus:border-[#C9A84C]"
                          style={{ background: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.18)" }} />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="p-0 h-full flex flex-col">
              <div className="px-6 py-3 border-b text-[11px] font-medium liq-text-3 flex items-center justify-center gap-2" style={{ background: "rgba(0,0,0,0.15)", borderColor: "rgba(201,168,76,0.12)" }}>
                <Eye size={12} className="text-[#C9A84C] opacity-70" />
                Preview shows the cover page using your current configuration.
              </div>
              <div className="flex-1 overflow-y-auto">
                <BrochurePreview config={form.config} name={form.name} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3 flex-shrink-0" style={{ borderColor: "rgba(201,168,76,0.12)", background: "var(--nav-bg)" }}>
          <button onClick={onClose} disabled={isPending} className="px-4 py-2 rounded-lg text-xs font-semibold liq-text-3 hover:liq-text-1 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            disabled={isPending || !form.name || (isNew && !form.templateKey)}
            onClick={() => onSave({ ...form })}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-[#C9A84C] text-[#0A0A0A] hover:bg-[#E2C97E] transition-colors disabled:opacity-50">
            <Save size={13} /> {isPending ? "Saving..." : (isNew ? "Create Template" : "Save Changes")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function BrochureTemplatesPage() {
  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<BrochureTemplate | null | "new">(undefined as unknown as "new");
  const [showEditor, setShowEditor] = useState(false);

  const { data: tplData, isLoading, error } = useQuery({
    queryKey: ["brochure-templates"],
    queryFn: () => apiFetch<{ success: boolean; templates: BrochureTemplate[] }>("/admin/brochure-templates", { headers: authHeaders() }),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string | null; data: Partial<BrochureTemplate> }) => {
      if (id) {
        return apiFetch(`/admin/brochure-templates/${id}`, { method: "PATCH", body: JSON.stringify(data), headers: authHeaders() });
      }
      return apiFetch("/admin/brochure-templates", { method: "POST", body: JSON.stringify(data), headers: authHeaders() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brochure-templates"] });
      setShowEditor(false);
      toast.success("Brochure template saved");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save template"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/admin/brochure-templates/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }), headers: authHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brochure-templates"] });
      toast.success("Template status updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update template"),
  });

  const templates = tplData?.templates ?? [];

  function openEdit(t: BrochureTemplate) { setEditTarget(t); setShowEditor(true); }
  function openNew() { setEditTarget(null); setShowEditor(true); }

  function handleSave(data: Partial<BrochureTemplate>) {
    const id = editTarget && editTarget !== "new" ? (editTarget as BrochureTemplate).id : null;
    saveMutation.mutate({ id, data });
  }

  return (
    <AdminLayout active="/admin/brochure-templates" title="Brochure Templates">
      <div className="space-y-6 max-w-7xl mx-auto px-6 py-8">

        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-serif liq-text-1">Brochure Templates</h1>
            <p className="text-xs liq-text-3 mt-1">Manage the visual design and copy for downloadable assessment PDFs.</p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A84C] text-[#0A0A0A] text-xs font-bold hover:bg-[#E2C97E] transition-all shadow-lg shadow-[#C9A84C]/20">
            <Plus size={15} /> New Template
          </button>
        </div>

        {/* Templates grid */}
        {error ? (
          <div className="p-6 text-center text-red-400 bg-red-400/10 rounded-2xl border border-red-400/20 text-sm font-semibold">
            Failed to load templates. Please try again.
          </div>
        ) : isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-56 rounded-2xl animate-pulse" style={{ background: "rgba(201,168,76,0.06)" }} />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mb-4">
              <FileText size={24} className="text-[#C9A84C]" />
            </div>
            <h3 className="text-sm font-bold liq-text-1 mb-1">No templates found</h3>
            <p className="text-xs liq-text-3 mb-6 max-w-md">You haven't created any brochure templates yet. Create your first template to define the PDF style.</p>
            <button onClick={openNew}
              className="flex items-center gap-2 px-5 py-2 rounded-lg border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-bold hover:bg-[#C9A84C]/10 transition-colors">
              <Plus size={14} /> Create First Template
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {templates.map((t) => (
              <motion.div key={t.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden group">
                
                {/* Active indicator */}
                <div className="absolute top-0 left-0 h-1 w-full"
                  style={{ background: t.isActive ? "linear-gradient(90deg, #C9A84C, transparent)" : "transparent" }} />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(201,168,76,0.10)", border: "1px solid rgba(201,168,76,0.2)" }}>
                      <FileOutput size={18} className="text-[#C9A84C]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold liq-text-1 leading-snug truncate pr-2" title={t.name}>{t.name}</p>
                      <p className="text-[10px] font-mono liq-text-4 mt-0.5 truncate" title={t.templateKey}>{t.templateKey} • v{t.version}</p>
                    </div>
                  </div>
                  
                  {/* Active toggle */}
                  <button
                    disabled={toggleMutation.isPending}
                    onClick={() => toggleMutation.mutate({ id: t.id, isActive: !t.isActive })}
                    className="flex-shrink-0 transition-all hover:scale-110 disabled:opacity-50"
                    title={t.isActive ? "Disable template" : "Enable template"}>
                    {t.isActive
                      ? <ToggleRight size={26} className="text-[#C9A84C]" />
                      : <ToggleLeft  size={26} className="liq-text-4" />}
                  </button>
                </div>

                <p className="text-[11px] liq-text-3 leading-relaxed line-clamp-2 min-h-[32px]">{t.description || "No description provided."}</p>

                {/* Color preview swatches */}
                <div className="flex gap-2 items-center">
                   <span className="text-[10px] font-semibold liq-text-4 mr-1 uppercase tracking-wider">Palette</span>
                   <div className="flex -space-x-1">
                     {[t.config.colors.navy, t.config.colors.gold, t.config.colors.accent].map((color, idx) => (
                        <div key={idx} className="w-4 h-4 rounded-full border border-white/10 shadow-sm" style={{ backgroundColor: color }} />
                     ))}
                   </div>
                </div>

                <div className="pt-4 border-t mt-auto flex items-center justify-between" style={{ borderColor: "rgba(201,168,76,0.15)" }}>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold liq-text-4">
                    {t.isActive ? <CheckCircle size={11} className="text-emerald-500" /> : <div className="w-2.5 h-2.5 rounded-full border border-current opacity-50" />}
                    {t.isActive ? <span className="text-emerald-500">Active</span> : "Inactive"}
                  </div>
                  <div className="flex items-center gap-2">
                  <button onClick={() => generateVCLOBrochurePDF({ templateId: t.id, version: t.version, config: t.config })}
                    className="flex items-center gap-1.5 text-[11px] font-bold liq-text-2 hover:text-[#C9A84C] px-2 py-1.5 rounded-lg">
                    <Eye size={11} /> PDF
                  </button>
                  <button onClick={() => openEdit(t)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-[#C9A84C] hover:text-[#E2C97E] transition-colors bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 px-3 py-1.5 rounded-lg">
                    <Edit3 size={11} /> Edit Config
                  </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Editor modal */}
      <AnimatePresence>
        {showEditor && (
          <TemplateEditor
            template={editTarget === null || editTarget === ("new" as unknown) ? null : editTarget as BrochureTemplate}
            onClose={() => setShowEditor(false)}
            onSave={handleSave}
            isPending={saveMutation.isPending}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
