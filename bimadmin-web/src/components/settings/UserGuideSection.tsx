import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, PlayCircle, BookOpen } from "lucide-react";
import { GUIDE_CHAPTERS, GUIDE_VIDEO_URL, GUIDE_VIDEO_TITLE } from "@/data/guideContent";

export function UserGuideSection() {
  const [query, setQuery] = useState("");
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set([GUIDE_CHAPTERS[0].id]));

  const isSearching = query.trim().length > 1;

  const filtered = useMemo(() => {
    if (!isSearching) return GUIDE_CHAPTERS;
    const q = query.toLowerCase();
    return GUIDE_CHAPTERS.map((chapter) => ({
      ...chapter,
      steps: chapter.steps.filter((s) => s.heading.toLowerCase().includes(q) || s.body.toLowerCase().includes(q)),
    })).filter((c) => c.steps.length > 0 || c.title.toLowerCase().includes(q));
  }, [query, isSearching]);

  function toggle(id: string) {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <p className="text-[13px] text-ink-soft">
          Everything BimAdmin does, explained in plain terms. Search if you're looking for something specific.
        </p>
      </div>

      {GUIDE_VIDEO_URL && (
        <div className="wb-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
            <PlayCircle size={15} className="text-violet-500" />
            <p className="text-[13px] font-medium">{GUIDE_VIDEO_TITLE}</p>
          </div>
          <div className="aspect-video bg-ink">
            <iframe
              src={GUIDE_VIDEO_URL}
              title={GUIDE_VIDEO_TITLE}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          className="wb-input !pl-9"
          placeholder="Search the guide"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-[13px] text-ink-faint px-1">Nothing in the guide matches that. Try a different word.</p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((chapter) => {
            const isOpen = isSearching || openChapters.has(chapter.id);
            return (
              <div key={chapter.id} className="wb-card overflow-hidden">
                <button
                  className="w-full flex items-start gap-2.5 px-4 py-3 text-left hover:bg-paper-sunk"
                  onClick={() => toggle(chapter.id)}
                >
                  {isOpen ? (
                    <ChevronDown size={15} className="text-ink-faint shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight size={15} className="text-ink-faint shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold">{chapter.title}</p>
                    <p className="text-[11.5px] text-ink-faint mt-0.5">{chapter.summary}</p>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-line divide-y divide-line">
                    {chapter.steps.map((step) => (
                      <div key={step.heading} className="px-4 py-3">
                        <p className="text-[13px] font-medium">{step.heading}</p>
                        <p className="text-[12.5px] text-ink-soft mt-1 leading-relaxed">{step.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="wb-card p-4 flex items-start gap-2.5">
        <BookOpen size={15} className="text-ink-faint shrink-0 mt-0.5" />
        <p className="text-[12px] text-ink-soft">
          Still stuck on something this guide doesn't cover? That's useful to know, it usually means the app itself needs to be
          clearer. Get in touch and tell us what you were trying to do.
        </p>
      </div>
    </div>
  );
}
