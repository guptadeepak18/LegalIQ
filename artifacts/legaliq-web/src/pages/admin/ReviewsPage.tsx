import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Star, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { apiFetch, authHeaders } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { toast } from "sonner";

interface Review {
  id: string; reviewerName: string; company: string; city?: string; rating: number;
  headline: string; body: string; lhsScore?: number; riskLevel?: string; verifiedUser?: boolean;
  status: string; createdAt: string; businessType?: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={12} className={s <= rating ? "star-filled fill-current" : "star-empty"} />
      ))}
    </div>
  );
}

const FILTER_TABS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;
const STATUS_STYLE: Record<string, string> = {
  PENDING:  "text-amber-400 bg-amber-500/10 border-amber-500/25",
  APPROVED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  REJECTED: "text-red-400 bg-red-500/10 border-red-500/25",
};

export default function ReviewsPage() {
  const [, navigate] = useLocation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTER_TABS[number]>("PENDING");
  const [moderating, setModerating] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("liq_admin_token");
    if (!token) { navigate("/admin"); return; }
    apiFetch<{ success: boolean; reviews: Review[]; pendingCount: number }>("/admin/reviews", { headers: authHeaders() })
      .then((res) => { setReviews(res.reviews); setPendingCount(res.pendingCount); })
      .catch(() => toast.error("Failed to load reviews"))
      .finally(() => setLoading(false));
  }, [navigate]);

  async function moderate(id: string, action: "APPROVE" | "REJECT") {
    setModerating(id);
    try {
      await apiFetch(`/admin/reviews/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ action }) });
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status: action === "APPROVE" ? "APPROVED" : "REJECTED" } : r));
      setPendingCount((n) => Math.max(0, n - 1));
      toast.success(`Review ${action === "APPROVE" ? "approved" : "rejected"}`);
    } catch { toast.error("Moderation failed"); }
    finally { setModerating(null); }
  }

  const filtered = reviews.filter((r) => filter === "ALL" ? true : r.status === filter);

  return (
    <AdminLayout
      active="/admin/reviews"
      title="Reviews"
      actions={pendingCount > 0 ? (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-amber-400 bg-amber-500/10 border-amber-500/25">
          {pendingCount} pending
        </span>
      ) : undefined}
    >
      <div className="px-6 py-8 max-w-5xl mx-auto dark:bg-slate-950" style={{ background: "#FFFFFF" }}>
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {FILTER_TABS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-medium transition-all border ${
                filter === f
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-400/50 dark:border-blue-500/30"
                  : "dark:text-blue-200/50 text-gray-600 dark:hover:text-blue-300 hover:text-gray-800 border-gray-300 dark:border-blue-700/30 dark:hover:border-blue-500/40 hover:border-gray-400"
              }`}>
              {f}
              {f === "PENDING" && pendingCount > 0 && (
                <span className="ml-1.5 text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="text-[#C9A84C] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-2xl p-16 text-center dark:text-blue-200/40 dark:bg-blue-950/40" style={{ color: "var(--liq-text-3)" }}>
            No {filter.toLowerCase()} reviews
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="glass-card rounded-2xl p-5 dark:bg-blue-950/40">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <StarRating rating={r.rating} />
                      {r.lhsScore !== undefined && <span className="text-xs text-[#C9A84C] font-bold">{r.lhsScore}/100</span>}
                      {r.verifiedUser && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 bg-emerald-500/8 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle size={9} /> Verified
                        </span>
                      )}
                    </div>
                    <p className="font-semibold dark:text-white/85 text-sm mb-0.5" style={{ color: "var(--liq-text-1)" }}>"{r.headline}"</p>
                    <p className="text-xs dark:text-white/45 leading-relaxed" style={{ color: "var(--liq-text-2)" }}>{r.body}</p>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[r.status] ?? "text-white/30 bg-white/5 border-white/10"}`}>
                    {r.status}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t dark:border-blue-700/20" style={{ borderColor: "rgba(59,130,246,0.08)" }}>
                  <div>
                    <div className="text-sm font-medium dark:text-white/70" style={{ color: "var(--liq-text-1)" }}>{r.reviewerName}</div>
                    <div className="text-[11px] dark:text-white/30" style={{ color: "var(--liq-text-3)" }}>
                      {r.company}{r.city ? ` · ${r.city}` : ""}{r.businessType ? ` · ${r.businessType}` : ""}
                    </div>
                  </div>

                  {r.status === "PENDING" && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => moderate(r.id, "APPROVE")} disabled={moderating === r.id}
                        className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 border border-emerald-500/25 bg-emerald-500/8 hover:bg-emerald-500/18 px-3 py-1.5 rounded-xl transition-all disabled:opacity-40">
                        {moderating === r.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                        Approve
                      </button>
                      <button onClick={() => moderate(r.id, "REJECT")} disabled={moderating === r.id}
                        className="flex items-center gap-1.5 text-xs font-bold text-red-400 border border-red-500/25 bg-red-500/8 hover:bg-red-500/18 px-3 py-1.5 rounded-xl transition-all disabled:opacity-40">
                        <XCircle size={11} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
