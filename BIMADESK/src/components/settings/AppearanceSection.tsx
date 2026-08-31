import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAccessibility, FontScale } from "@/contexts/AccessibilityContext";

const THEME_OPTIONS = [
  { key: "light" as const, label: "Light", icon: Sun },
  { key: "dark" as const, label: "Dark", icon: Moon },
  { key: "system" as const, label: "System", icon: Monitor },
];

const FONT_OPTIONS: { key: FontScale; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "large", label: "Large" },
  { key: "larger", label: "Larger" },
];

export function AppearanceSection() {
  const { preference, setPreference } = useTheme();
  const { fontScale, setFontScale, reduceMotion, setReduceMotion } = useAccessibility();

  return (
    <div className="space-y-4 max-w-lg">
      <div className="wb-card p-5">
        <p className="text-[13px] font-semibold mb-1">Theme</p>
        <p className="text-[12px] text-ink-faint mb-3">Choose how BimaDesk looks on this device.</p>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPreference(opt.key)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-[10px] border transition-colors ${
                preference === opt.key ? "border-violet-500 bg-violet-50 text-violet-700" : "border-line text-ink-soft hover:bg-paper-sunk"
              }`}
            >
              <opt.icon size={16} />
              <span className="text-[12px] font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="wb-card p-5">
        <p className="text-[13px] font-semibold mb-1">Text size</p>
        <p className="text-[12px] text-ink-faint mb-3">Make text throughout the app easier to read.</p>
        <div className="flex gap-2">
          {FONT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFontScale(opt.key)}
              className={`flex-1 py-2.5 rounded-[10px] border text-[12.5px] font-medium transition-colors ${
                fontScale === opt.key ? "border-violet-500 bg-violet-50 text-violet-700" : "border-line text-ink-soft hover:bg-paper-sunk"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-faint mt-3">
          Uses your browser's zoom support to scale the whole interface. Works in current Chrome, Edge, and Safari, and Firefox
          from version 126 onward.
        </p>
      </div>

      <div className="wb-card p-5 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold">Reduce motion</p>
          <p className="text-[12px] text-ink-faint mt-0.5">Turns off animations and transitions throughout the app.</p>
        </div>
        <button
          onClick={() => setReduceMotion(!reduceMotion)}
          className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${reduceMotion ? "bg-violet-500" : "bg-paper-sunk border border-line"}`}
          aria-label="Toggle reduced motion"
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${reduceMotion ? "left-5" : "left-0.5"}`} />
        </button>
      </div>
    </div>
  );
}
