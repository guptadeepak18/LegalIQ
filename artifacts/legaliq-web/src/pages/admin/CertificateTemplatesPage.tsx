import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Eye, FileBadge, FileUp, Image, Pencil, Plus, Replace, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { API_BASE, apiFetch, authHeaders } from "@/lib/api";

type CertificateTemplate = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  assetContentType: string;
  assetSizeBytes: number;
  version: number;
  updatedAt?: string;
};

type UploadResponse = {
  uploadUrl: string;
  objectPath: string;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function TemplateDialog({ template, onClose }: { template?: CertificateTemplate; onClose: () => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const isEdit = Boolean(template);

  async function uploadFile(selected: File) {
    const ticket = await apiFetch<UploadResponse>("/admin/certificate-templates/upload-url", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ fileName: selected.name, contentType: selected.type, size: selected.size }),
    });
    const uploadUrl = ticket.uploadUrl;
    if (!uploadUrl) throw new Error("Upload URL was not returned by the server.");
    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("PUT", uploadUrl);
      request.setRequestHeader("Content-Type", selected.type);
      request.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.round((event.loaded / event.total) * 100));
      request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("The file upload failed. Please try again."));
      request.onerror = () => reject(new Error("The file upload could not be completed."));
      request.send(selected);
    });
    return { objectPath: ticket.objectPath, contentType: selected.type, originalFilename: selected.name };
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Enter a template name.");
      if (!isEdit && !file) throw new Error("Choose a PDF or image file to create a template.");
      setUploading(Boolean(file));
      setProgress(0);
      const uploaded = file ? await uploadFile(file) : {};
      const body = { name: name.trim(), description: description.trim() || null, config: {}, ...uploaded };
      return isEdit
        ? apiFetch(`/admin/certificate-templates/${template!.id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) })
        : apiFetch("/admin/certificate-templates/finalize", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificate-templates"] });
      toast.success(isEdit ? "Certificate template updated" : "Certificate template created");
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, "Could not save the certificate template.")),
    onSettled: () => setUploading(false),
  });

  const acceptable = "application/pdf,image/png,image/jpeg";
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
    <motion.div initial={{ opacity: 0, y: 16, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .97 }}
      className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" style={{ background: "var(--nav-bg)", border: "1px solid rgba(201,168,76,.22)" }}>
      <div className="flex justify-between items-center px-6 py-4 border-b" style={{ borderColor: "rgba(201,168,76,.14)" }}>
        <div><h2 className="font-serif text-lg font-bold liq-text-1">{isEdit ? "Edit certificate template" : "New certificate template"}</h2><p className="text-xs liq-text-3 mt-1">Upload a branded PDF or certificate background image.</p></div>
        <button className="p-2 liq-text-3 hover:liq-text-1" onClick={onClose}><X size={17} /></button>
      </div>
      <div className="p-6 space-y-5">
        <label className="block text-xs font-semibold liq-text-2">Template name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Legal Health Certificate" className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm liq-text-1 border outline-none focus:border-[#C9A84C]" style={{ background: "rgba(201,168,76,.04)", borderColor: "rgba(201,168,76,.2)" }} />
        </label>
        <label className="block text-xs font-semibold liq-text-2">Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="When should this certificate be used?" className="mt-1.5 w-full rounded-lg px-3 py-2 text-sm liq-text-1 border outline-none focus:border-[#C9A84C] resize-none" style={{ background: "rgba(201,168,76,.04)", borderColor: "rgba(201,168,76,.2)" }} />
        </label>
        <input ref={inputRef} type="file" accept={acceptable} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded-xl border border-dashed border-[#C9A84C]/40 p-5 text-center hover:bg-[#C9A84C]/5 transition-colors">
          {file ? <><FileBadge className="mx-auto text-[#C9A84C] mb-2" size={25} /><span className="block text-xs font-bold liq-text-1 truncate">{file.name}</span><span className="text-[11px] liq-text-3">Click to choose another file</span></> : <><Upload className="mx-auto text-[#C9A84C] mb-2" size={24} /><span className="text-xs font-bold liq-text-1">{isEdit ? "Replace file (optional)" : "Choose PDF or image"}</span><span className="block text-[11px] liq-text-3 mt-1">PDF, PNG, or JPEG</span></>}
        </button>
        {uploading && <div><div className="flex justify-between text-[11px] liq-text-3 mb-1"><span>Uploading securely…</span><span>{progress}%</span></div><div className="h-1.5 rounded-full bg-[#C9A84C]/10"><div className="h-full rounded-full bg-[#C9A84C]" style={{ width: `${progress}%` }} /></div></div>}
      </div>
      <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: "rgba(201,168,76,.14)" }}>
        <button disabled={save.isPending} onClick={onClose} className="px-4 py-2 text-xs font-semibold liq-text-3">Cancel</button>
        <button disabled={save.isPending} onClick={() => save.mutate()} className="px-4 py-2 rounded-lg bg-[#C9A84C] text-[#0A0A0A] text-xs font-bold disabled:opacity-50">{save.isPending ? "Saving…" : isEdit ? "Save changes" : "Create template"}</button>
      </div>
    </motion.div>
  </div>;
}

export default function CertificateTemplatesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CertificateTemplate | null | undefined>(undefined);
  const [preview, setPreview] = useState<CertificateTemplate | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["certificate-templates"], queryFn: () => apiFetch<{ templates: CertificateTemplate[] }>("/admin/certificate-templates", { headers: authHeaders() }) });
  const templates = data?.templates ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["certificate-templates"] });
  const activate = useMutation({ mutationFn: (id: string) => apiFetch(`/admin/certificate-templates/${id}/activate`, { method: "POST", headers: authHeaders() }), onSuccess: () => { refresh(); toast.success("Active certificate template updated"); }, onError: (e) => toast.error(errorMessage(e, "Could not set the active template.")) });
  const remove = useMutation({ mutationFn: (id: string) => apiFetch(`/admin/certificate-templates/${id}`, { method: "DELETE", headers: authHeaders() }), onSuccess: () => { refresh(); toast.success("Certificate template deleted"); }, onError: (e) => toast.error(errorMessage(e, "Could not delete template.")) });
  async function openPreview(template: CertificateTemplate) {
    try {
      const response = await fetch(`${API_BASE}/admin/certificate-templates/${template.id}/preview`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Preview is unavailable.");
      const url = URL.createObjectURL(await response.blob());
      setPreviewUrl(url); setPreview(template);
    } catch (e) { toast.error(errorMessage(e, "Could not open template preview.")); }
  }
  function closePreview() { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setPreview(null); }
  return <AdminLayout active="/admin/certificate-templates" title="Certificate Templates">
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-7 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="font-serif text-2xl font-bold liq-text-1">Certificate Templates</h1><p className="text-xs liq-text-3 mt-1">Manage the branded certificates available after an assessment.</p></div><button onClick={() => setEditing(null)} className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A84C] text-[#0A0A0A] text-xs font-bold"><Plus size={15} /> New template</button></div>
      {error ? <div className="rounded-2xl p-6 text-center text-sm text-red-400 border border-red-400/20 bg-red-400/10">Failed to load certificate templates. Please refresh and try again.</div> : isLoading ? <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{[0,1,2].map(i => <div key={i} className="h-56 animate-pulse rounded-2xl bg-[#C9A84C]/5" />)}</div> : templates.length === 0 ? <div className="glass-card rounded-2xl p-12 text-center"><FileBadge className="mx-auto text-[#C9A84C] mb-4" size={30} /><h2 className="text-sm font-bold liq-text-1">No certificate templates yet</h2><p className="text-xs liq-text-3 mt-2 mb-5">Upload your first branded certificate to make it available for assessment downloads.</p><button onClick={() => setEditing(null)} className="text-xs font-bold text-[#C9A84C]"><Plus size={14} className="inline mr-1" /> Create first template</button></div> :
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{templates.map(t => <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card relative rounded-2xl p-5 flex flex-col gap-4 overflow-hidden"><div className="absolute h-1 top-0 left-0 right-0" style={{ background: t.isActive ? "#C9A84C" : "transparent" }} /><div className="flex justify-between gap-3"><div className="flex gap-3 min-w-0"><div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 text-[#C9A84C] flex items-center justify-center">{t.assetContentType.startsWith("image/") ? <Image size={18} /> : <FileBadge size={18} />}</div><div className="min-w-0"><h2 className="text-sm font-bold liq-text-1 truncate">{t.name}</h2><p className="text-[10px] liq-text-4 truncate mt-1">v{t.version} · {(t.assetSizeBytes / 1024 / 1024).toFixed(1)} MB</p></div></div>{t.isActive && <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 size={12} /> Active</span>}</div><p className="text-xs liq-text-3 min-h-9 line-clamp-2">{t.description || "No description provided."}</p><div className="border-t pt-4 mt-auto flex flex-wrap gap-2" style={{ borderColor: "rgba(201,168,76,.15)" }}><button onClick={() => openPreview(t)} className="text-xs font-semibold liq-text-2 hover:text-[#C9A84C] flex gap-1 items-center"><Eye size={13} /> Preview</button><button onClick={() => setEditing(t)} className="text-xs font-semibold text-[#C9A84C] flex gap-1 items-center"><Pencil size={13} /> Edit</button><button onClick={() => setEditing(t)} className="text-xs font-semibold liq-text-3 flex gap-1 items-center"><Replace size={13} /> Replace</button>{!t.isActive && <button disabled={activate.isPending} onClick={() => activate.mutate(t.id)} className="ml-auto text-xs font-bold px-2.5 py-1 rounded-md bg-[#C9A84C]/10 text-[#C9A84C]">Set active</button>}<button disabled={remove.isPending || t.isActive} onClick={() => { if (window.confirm(`Delete "${t.name}"? This cannot be undone.`)) remove.mutate(t.id); }} className="p-1 liq-text-4 hover:text-red-400 disabled:opacity-30" title={t.isActive ? "Select another active template before deleting" : "Delete template"}><Trash2 size={14} /></button></div></motion.div>)}</div>}
    </div>
    <AnimatePresence>{editing !== undefined && <TemplateDialog template={editing ?? undefined} onClose={() => setEditing(undefined)} />}{preview && previewUrl && <div className="fixed inset-0 z-50 p-4 flex items-center justify-center"><div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={closePreview} /><motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-5xl h-[88vh] rounded-2xl overflow-hidden" style={{ background: "var(--nav-bg)" }}><div className="h-12 px-5 flex items-center justify-between border-b" style={{ borderColor: "rgba(201,168,76,.15)" }}><span className="text-sm font-bold liq-text-1">{preview.name}</span><button onClick={closePreview} className="liq-text-3"><X size={18} /></button></div><iframe title={`${preview.name} preview`} src={previewUrl} className="w-full h-[calc(100%-3rem)] bg-white" /></motion.div></div>}</AnimatePresence>
  </AdminLayout>;
}