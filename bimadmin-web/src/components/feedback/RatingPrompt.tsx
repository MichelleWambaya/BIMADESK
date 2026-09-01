import React, { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

const DISMISS_KEY = "bimadesk_rating_dismissed";

export function RatingPrompt() {
  const { session, profile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !profile?.organizationId) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    // The threshold check lives in the database (see
    // 0011_ratings_testimonials.sql), so it can be changed without
    // redeploying the frontend.
    supabase.rpc("should_prompt_for_rating").then(({ data, error }) => {
      if (!error && data === true) setVisible(true);
    });
  }, [session, profile?.organizationId]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function submit() {
    if (stars === 0) return setError("Choose a star rating first.");
    if (!profile?.organizationId || !session) return;

    setSubmitting(true);
    setError(null);

    const { error } = await supabase.from("ratings").insert({
      organization_id: profile.organizationId,
      user_id: session.user.id,
      stars,
      // Only store the comment if they agreed it can be shown publicly.
      // Storing it otherwise would mean holding a quote we can never use,
      // which is just data we don't need.
      comment: consent && comment.trim() ? comment.trim() : null,
      role_label: consent && roleLabel.trim() ? roleLabel.trim() : null,
    });

    setSubmitting(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => setVisible(false), 2200);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:w-[360px] z-40 wb-card p-4 shadow-raised">
      {done ? (
        <div className="text-center py-3">
          <p className="text-[14px] font-semibold">Thank you</p>
          <p className="text-[12.5px] text-ink-soft mt-1">
            {consent && comment.trim()
              ? "We may feature your comment on our site once it's reviewed."
              : "Your rating helps us know what to work on next."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13.5px] font-semibold">How is BimAdmin working for you?</p>
              <p className="text-[12px] text-ink-soft mt-0.5">Takes a few seconds, and it genuinely shapes what we build.</p>
            </div>
            <button onClick={dismiss} className="wb-btn-ghost !p-1 shrink-0" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>

          <div className="flex gap-1 mt-3" onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setStars(n)}
                onMouseEnter={() => setHovered(n)}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                className="p-0.5"
              >
                <Star
                  size={26}
                  className={n <= (hovered || stars) ? "text-amber-500 fill-amber-500" : "text-line fill-line"}
                />
              </button>
            ))}
          </div>

          {stars > 0 && (
            <div className="mt-3 space-y-2.5">
              <textarea
                className="wb-input"
                rows={3}
                placeholder={stars >= 4 ? "What's working well?" : "What would make this better?"}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              {comment.trim().length > 0 && (
                <>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 accent-violet-500 shrink-0"
                    />
                    <span className="text-[11.5px] text-ink-soft">
                      You may show this on your website with my name and business name.
                    </span>
                  </label>
                  {consent && (
                    <input
                      className="wb-input !text-[12.5px]"
                      placeholder="Your title, for example Insurance Broker (optional)"
                      value={roleLabel}
                      onChange={(e) => setRoleLabel(e.target.value)}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {error && <p className="text-[12px] text-coral-500 mt-2">{error}</p>}

          <div className="flex justify-end gap-2 mt-3">
            <button className="wb-btn-ghost !text-[12.5px]" onClick={dismiss}>Not now</button>
            <button className="wb-btn-primary !text-[12.5px]" disabled={submitting || stars === 0} onClick={submit}>
              {submitting ? "Sending" : "Send"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
