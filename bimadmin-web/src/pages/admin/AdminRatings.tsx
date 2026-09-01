import React, { useEffect, useState } from "react";
import { Star, Check, X, MessageSquareQuote } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatDate } from "@/lib/date";

interface RatingRow {
  id: string;
  user_id: string;
  stars: number;
  comment: string | null;
  role_label: string | null;
  approved_as_testimonial: boolean;
  created_at: string;
  organization_id: string;
  orgName: string;
  authorName: string;
}

export function AdminRatings() {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [orgCount, setOrgCount] = useState<number>(0);

  async function load() {
    const [{ data: ratings }, { data: orgs }, { data: profiles }, { data: settings }] = await Promise.all([
      supabase.from("ratings").select("*").order("created_at", { ascending: false }),
      supabase.from("organizations").select("id, name"),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("platform_settings").select("key, value_int").eq("key", "testimonial_min_orgs").maybeSingle(),
    ]);

    const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name]));
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    setRows(
      (ratings ?? []).map((r) => ({
        ...r,
        orgName: orgMap.get(r.organization_id) ?? "Unknown",
        authorName: profileMap.get(r.user_id) ?? "Unknown",
      }))
    );
    setOrgCount((orgs ?? []).length);
    setThreshold(settings?.value_int ?? 100);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setApproved(id: string, approved: boolean) {
    await supabase
      .from("ratings")
      .update({ approved_as_testimonial: approved, approved_at: approved ? new Date().toISOString() : null })
      .eq("id", id);
    load();
  }

  const withComments = rows.filter((r) => r.comment && r.comment.trim().length > 0);
  const approvedCount = rows.filter((r) => r.approved_as_testimonial).length;
  const average = rows.length > 0 ? (rows.reduce((s, r) => s + r.stars, 0) / rows.length).toFixed(1) : null;
  const collectionOpen = threshold !== null && orgCount >= threshold;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-white font-display text-[22px]">Ratings and testimonials</h1>
        <p className="text-white/45 text-[13px] mt-0.5">
          Approve a comment to publish it on the landing page. Nothing goes public until you do.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white/[0.04] border border-white/10 rounded-[16px] p-4">
          <p className="text-white font-display text-[26px] leading-none">{average ?? "—"}</p>
          <p className="text-white/45 text-[11.5px] mt-1.5">Average rating</p>
        </div>
        <div className="bg-white/[0.04] border border-white/10 rounded-[16px] p-4">
          <p className="text-white font-display text-[26px] leading-none">{rows.length}</p>
          <p className="text-white/45 text-[11.5px] mt-1.5">Total ratings</p>
        </div>
        <div className="bg-white/[0.04] border border-white/10 rounded-[16px] p-4">
          <p className="text-white font-display text-[26px] leading-none">{withComments.length}</p>
          <p className="text-white/45 text-[11.5px] mt-1.5">With a usable comment</p>
        </div>
        <div className="bg-white/[0.04] border border-white/10 rounded-[16px] p-4">
          <p className="text-white font-display text-[26px] leading-none">{approvedCount}</p>
          <p className="text-white/45 text-[11.5px] mt-1.5">Live on the site</p>
        </div>
      </div>

      <div className={`rounded-[14px] p-4 border ${collectionOpen ? "bg-emerald-500/10 border-emerald-500/25" : "bg-white/[0.04] border-white/10"}`}>
        <p className={`text-[13px] font-medium ${collectionOpen ? "text-emerald-300" : "text-white/70"}`}>
          {collectionOpen
            ? "Rating prompts are live."
            : `Rating prompts are off until ${threshold} organizations sign up.`}
        </p>
        <p className="text-white/40 text-[12px] mt-1">
          {orgCount} of {threshold} organizations. Change the threshold in the platform_settings table, key
          testimonial_min_orgs, no redeploy needed.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/10 rounded-[16px] p-10 text-center">
          <MessageSquareQuote size={22} className="text-white/25 mx-auto mb-3" />
          <p className="text-white/50 text-[13px]">No ratings yet.</p>
        </div>
      ) : (
        <div className="bg-white/[0.04] border border-white/10 rounded-[16px] overflow-hidden divide-y divide-white/5">
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={12} className={n <= r.stars ? "text-amber-400 fill-amber-400" : "text-white/15 fill-white/15"} />
                      ))}
                    </div>
                    <p className="text-white text-[13px] truncate">{r.authorName}</p>
                    {r.approved_as_testimonial && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 shrink-0">Live</span>
                    )}
                  </div>
                  <p className="text-white/35 text-[10.5px] mt-0.5">
                    {r.role_label ? `${r.role_label}, ` : ""}{r.orgName} · {formatDate(r.created_at)}
                  </p>
                  {r.comment ? (
                    <p className="text-white/70 text-[12.5px] mt-2 leading-relaxed">{r.comment}</p>
                  ) : (
                    <p className="text-white/25 text-[11.5px] mt-2 italic">Rating only, no comment shared for publication.</p>
                  )}
                </div>
                {r.comment && (
                  <button
                    onClick={() => setApproved(r.id, !r.approved_as_testimonial)}
                    className={`shrink-0 flex items-center gap-1.5 text-[11.5px] px-2.5 py-1.5 rounded-[8px] border ${
                      r.approved_as_testimonial
                        ? "border-white/15 text-white/60 hover:bg-white/5"
                        : "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                    }`}
                  >
                    {r.approved_as_testimonial ? <><X size={12} /> Unpublish</> : <><Check size={12} /> Publish</>}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
