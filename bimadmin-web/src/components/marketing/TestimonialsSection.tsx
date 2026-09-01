import React, { useEffect, useState } from "react";
import { Star, Quote } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Testimonial {
  id: string;
  stars: number;
  comment: string;
  author_name: string;
  role_label: string | null;
  business_name: string;
  avatar_url: string | null;
  avatar_color: string;
}

const COLOR_HEX: Record<string, string> = {
  violet: "#6D3CE5",
  amber: "#FF8A1E",
  emerald: "#12B76A",
  coral: "#FF5A3C",
};

function Stars({ count, size = 13 }: { count: number; size?: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= count ? "text-amber-500 fill-amber-500" : "text-line fill-line"}
        />
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [summary, setSummary] = useState<{ average: number; total: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([supabase.rpc("public_testimonials"), supabase.rpc("rating_summary")]).then(
      ([testimonialsRes, summaryRes]) => {
        if (testimonialsRes.data) setItems(testimonialsRes.data as Testimonial[]);
        const s = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data;
        if (s && s.total > 0) setSummary({ average: Number(s.average), total: s.total });
        setLoaded(true);
      }
    );
  }, []);

  // Render nothing at all until there are real approved testimonials.
  // An empty "what our customers say" section is worse than no section,
  // and inventing placeholder quotes would be dishonest to visitors.
  if (!loaded || items.length === 0) return null;

  return (
    <section className="max-w-5xl mx-auto px-5 py-20">
      <div className="text-center mb-10">
        <h2 className="font-display text-2xl">What intermediaries say</h2>
        {summary && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <Stars count={Math.round(summary.average)} size={15} />
            <span className="text-[13.5px] text-ink-soft">
              {summary.average} out of 5, from {summary.total} {summary.total === 1 ? "person" : "people"} using BimAdmin
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((t) => (
          <figure key={t.id} className="wb-card p-5 flex flex-col">
            <Quote size={18} className="text-violet-300 shrink-0 mb-2.5" />
            <blockquote className="text-[13.5px] text-ink leading-relaxed flex-1">{t.comment}</blockquote>
            <figcaption className="flex items-center gap-3 mt-4 pt-4 border-t border-line">
              {t.avatar_url ? (
                <img src={t.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-semibold shrink-0"
                  style={{ backgroundColor: COLOR_HEX[t.avatar_color] ?? COLOR_HEX.violet }}
                >
                  {(t.author_name || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate">{t.author_name}</p>
                <p className="text-[11.5px] text-ink-faint truncate">
                  {t.role_label ? `${t.role_label}, ` : ""}{t.business_name}
                </p>
              </div>
              <Stars count={t.stars} />
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
