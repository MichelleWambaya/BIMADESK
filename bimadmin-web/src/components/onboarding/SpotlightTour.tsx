import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, ArrowLeft, X, Check } from "lucide-react";

/**
 * A guided tour that cuts a hole in a dim overlay around a real element,
 * then walks the person through the app step by step.
 *
 * Anchoring is by `data-tour` attribute rather than CSS selector or ref,
 * so a step survives markup changes and a component does not need to know
 * it is part of the tour.
 *
 * The awkward parts of a tour like this, and how each is handled:
 *
 *   Element not on screen yet      Steps carry a `route`. If we are not
 *                                  there, navigate first and wait for the
 *                                  element to appear rather than measuring
 *                                  a null.
 *   Element below the fold         Scrolled into view before measuring,
 *                                  then re-measured after the scroll
 *                                  settles.
 *   Element never appears          A step whose target is missing is
 *                                  skipped, not fatal. A free user has no
 *                                  team settings, and the tour should not
 *                                  dead-end on that.
 *   Layout moves under us          Position is recalculated on scroll and
 *                                  resize while a step is open.
 *   Tooltip runs off screen        Placement flips side when there is not
 *                                  room, and is clamped to the viewport.
 */

export interface TourStep {
  /** Value of the data-tour attribute to highlight. Omit for a step that
   *  is just a message with no anchor, like the welcome or the finish. */
  target?: string;
  title: string;
  body: string;
  /** Navigate here first if we are not already on it. */
  route?: string;
  placement?: "top" | "bottom" | "left" | "right";
  /** Skip this step when the predicate is false, for plan-gated features. */
  when?: () => boolean;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const CARD_W = 320;
const GAP = 14;

export function SpotlightTour({
  steps,
  open,
  onClose,
  onFinish,
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  onFinish?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const pollRef = useRef<number | null>(null);

  const visibleSteps = steps.filter((s) => !s.when || s.when());
  const step = visibleSteps[index];

  const measure = useCallback((el: Element) => {
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  // Find and measure the target for the current step. Polls briefly,
  // because after a route change the element may not have mounted yet.
  useEffect(() => {
    if (!open || !step) return;

    if (!step.target) {
      setRect(null);
      setSearching(false);
      return;
    }

    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      return;
    }

    let attempts = 0;
    setSearching(true);

    function tick() {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Measure after the smooth scroll has had time to land, otherwise
        // the hole is cut where the element used to be.
        window.setTimeout(() => {
          const again = document.querySelector(`[data-tour="${step.target}"]`);
          if (again) measure(again);
          setSearching(false);
        }, 340);
        return;
      }
      attempts += 1;
      // About two seconds, then give up and move on. A missing target is
      // a skippable step, not a broken tour.
      if (attempts > 20) {
        setSearching(false);
        setRect(null);
        setIndex((i) => (i + 1 < visibleSteps.length ? i + 1 : i));
        return;
      }
      pollRef.current = window.setTimeout(tick, 100);
    }

    tick();
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, step?.target, step?.route, location.pathname]);

  // Keep the hole aligned if the page moves while a step is open.
  useEffect(() => {
    if (!open || !step?.target) return;
    function reposition() {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) measure(el);
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, step?.target, measure]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  function next() {
    if (index + 1 >= visibleSteps.length) {
      onFinish?.();
      onClose();
      return;
    }
    setIndex(index + 1);
  }

  function back() {
    setIndex((i) => Math.max(0, i - 1));
  }

  if (!open || !step) return null;

  const isLast = index + 1 >= visibleSteps.length;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Card position. Centred when there is nothing to anchor to, otherwise
  // beside the hole, flipping and clamping to stay on screen.
  let cardStyle: React.CSSProperties;
  if (!rect) {
    cardStyle = { top: vh / 2 - 90, left: Math.max(16, vw / 2 - CARD_W / 2) };
  } else {
    const wantBelow = step.placement !== "top";
    const roomBelow = vh - (rect.top + rect.height) > 200;
    const below = wantBelow ? roomBelow : false;

    let top = below ? rect.top + rect.height + GAP : rect.top - GAP - 180;
    if (top < 12) top = rect.top + rect.height + GAP;
    if (top > vh - 190) top = Math.max(12, vh - 200);

    let left = rect.left + rect.width / 2 - CARD_W / 2;
    left = Math.min(Math.max(12, left), vw - CARD_W - 12);

    cardStyle = { top, left };
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/*
        The dim layer is four rectangles around the target rather than one
        div with a box-shadow hole. Four panels let clicks pass through to
        the highlighted element itself, so the person can actually use the
        thing being explained; a single overlay would swallow them.
      */}
      {rect ? (
        <>
          <div className="absolute bg-ink/65 left-0 right-0" style={{ top: 0, height: Math.max(0, rect.top - PAD) }} onClick={onClose} />
          <div className="absolute bg-ink/65 left-0 right-0 bottom-0" style={{ top: rect.top + rect.height + PAD }} onClick={onClose} />
          <div className="absolute bg-ink/65" style={{ top: rect.top - PAD, left: 0, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2 }} onClick={onClose} />
          <div className="absolute bg-ink/65" style={{ top: rect.top - PAD, left: rect.left + rect.width + PAD, right: 0, height: rect.height + PAD * 2 }} onClick={onClose} />

          <div
            className="absolute rounded-[12px] pointer-events-none transition-all duration-300 ease-out"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              boxShadow: "0 0 0 2px rgb(var(--color-violet-400)), 0 0 0 6px rgb(var(--color-violet-500) / 0.25)",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-ink/70" onClick={onClose} />
      )}

      <div
        className="absolute bg-paper-raised rounded-[16px] shadow-raised border border-line p-4 transition-all duration-300 ease-out"
        style={{ ...cardStyle, width: CARD_W }}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-[14px] font-semibold">{step.title}</p>
          <button onClick={onClose} className="wb-btn-ghost !p-1 shrink-0" aria-label="Close tour">
            <X size={14} />
          </button>
        </div>

        <p className="text-[12.5px] text-ink-soft leading-relaxed">{step.body}</p>

        {searching && <p className="text-[11px] text-ink-faint mt-2">Finding that on screen…</p>}

        <div className="flex items-center gap-1.5 mt-3.5">
          {visibleSteps.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === index ? "w-4 bg-violet-500" : i < index ? "w-1 bg-violet-300" : "w-1 bg-line"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] text-ink-faint">
            {index + 1} of {visibleSteps.length}
          </span>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <button onClick={back} className="wb-btn-ghost !text-[12px] flex items-center gap-1">
                <ArrowLeft size={12} /> Back
              </button>
            )}
            <button onClick={next} className="wb-btn-primary !text-[12px] flex items-center gap-1">
              {isLast ? (
                <>
                  <Check size={12} /> Done
                </>
              ) : (
                <>
                  Next <ArrowRight size={12} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
