"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  KEYWORD_CATEGORIES,
  getCategoryColor,
} from "@/lib/keyword-categories";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface BriefingSource {
  title: string;
  url: string;
  source_name: string;
}

interface BriefingResult {
  briefing: string;
  sources: BriefingSource[];
  meta: {
    days: number;
    mode: "simple" | "extended";
    language: "en" | "de";
    articlesAnalyzed: number;
    keywordsUsed: string[] | "all";
  };
}

/* ------------------------------------------------------------------ */
/* Keyword Chip                                                        */
/* ------------------------------------------------------------------ */

function KeywordChip({
  keyword,
  isSelected,
  onClick,
  color,
}: {
  keyword: string;
  isSelected: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150 cursor-pointer"
      style={
        isSelected
          ? {
              backgroundColor: color,
              borderColor: color,
              color: "#ffffff",
            }
          : {
              backgroundColor: "transparent",
              borderColor: color + "60",
              color: color,
            }
      }
    >
      {keyword}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Keyword Filter Section                                              */
/* ------------------------------------------------------------------ */

function KeywordFilter({
  selectedKeywords,
  onToggle,
  onClearAll,
}: {
  selectedKeywords: string[];
  onToggle: (kw: string) => void;
  onClearAll: () => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium">
          Filter by topics{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        {selectedKeywords.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Leave all unselected to include everything
      </p>

      <div className="space-y-4">
        {Object.entries(KEYWORD_CATEGORIES).map(([category, data]) => (
          <div key={category}>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
              {category}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.keywords.map((kw) => (
                <KeywordChip
                  key={kw}
                  keyword={kw}
                  isSelected={selectedKeywords.includes(kw)}
                  onClick={() => onToggle(kw)}
                  color={data.color}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Time Slider (release-only, same as Explore)                         */
/* ------------------------------------------------------------------ */

const DAY_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 21, 30];

function TimeSlider({
  displayValue,
  onDrag,
  onCommit,
}: {
  displayValue: number;
  onDrag: (idx: number) => void;
  onCommit: () => void;
}) {
  const dayLabel = DAY_STEPS[displayValue];

  return (
    <section>
      <label className="text-sm font-medium">Time range</label>
      <div className="flex items-center gap-4 mt-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[80px] text-right">
          Last{" "}
          <span className="font-medium text-foreground">
            {dayLabel} day{dayLabel !== 1 ? "s" : ""}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={DAY_STEPS.length - 1}
          step={1}
          value={displayValue}
          onChange={(e) => onDrag(parseInt(e.target.value, 10))}
          onMouseUp={onCommit}
          onTouchEnd={onCommit}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-border
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-foreground
            [&::-webkit-slider-thumb]:shadow-sm
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-foreground
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer"
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle (segmented control)                                          */
/* ------------------------------------------------------------------ */

function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex-1">
      <label className="text-sm font-medium block mb-2">{label}</label>
      <div className="flex bg-muted rounded-lg p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 text-sm py-1.5 px-3 rounded-md transition-all duration-150 font-medium ${
              value === opt.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Briefing Display                                                    */
/* ------------------------------------------------------------------ */

function BriefingDisplay({
  result,
  onRegenerate,
  isRegenerating,
}: {
  result: BriefingResult;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result.briefing).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result.briefing]);

  return (
    <section className="space-y-4">
      {/* Meta bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {result.meta.articlesAnalyzed} articles analyzed
          </span>
          <span>&middot;</span>
          <span>
            {result.meta.mode === "simple" ? "Simple" : "Extended"} mode
          </span>
          <span>&middot;</span>
          <span>
            Last {result.meta.days} day{result.meta.days !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Regenerate
          </button>
        </div>
      </div>

      {/* Briefing content */}
      <div
        className="briefing-content border-l-4 border-accent pl-5 py-1"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {result.briefing}
        </ReactMarkdown>
      </div>

      {/* Sources */}
      {result.sources.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium">
            Sources ({result.sources.length})
          </summary>
          <ul className="mt-2 space-y-1.5 pl-4">
            {result.sources.map((src, i) => (
              <li key={i} className="text-muted-foreground">
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  {src.title}
                </a>
                <span className="text-xs ml-1.5 opacity-70">
                  ({src.source_name})
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Main Generate Page                                                  */
/* ------------------------------------------------------------------ */

export default function GeneratePage() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [sliderIdx, setSliderIdx] = useState(2); // index 2 = 3 days
  const [committedIdx, setCommittedIdx] = useState(2);
  const [mode, setMode] = useState<"simple" | "extended">("simple");
  const [language, setLanguage] = useState<"en" | "de">("en");

  const [isGenerating, setIsGenerating] = useState(false);
  const [briefing, setBriefing] = useState<BriefingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleKeyword = useCallback((kw: string) => {
    setKeywords((prev) =>
      prev.includes(kw) ? prev.filter((k) => k !== kw) : [...prev, kw]
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/generate-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: DAY_STEPS[committedIdx],
          keywords,
          mode,
          language,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate briefing");

      const data: BriefingResult = await res.json();
      setBriefing(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsGenerating(false);
    }
  }, [committedIdx, keywords, mode, language]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Generate Briefing</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Get an AI-powered summary of the latest AI news
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-sm px-3 py-1.5 rounded-lg border border-border hover:border-accent hover:text-accent transition-colors"
            >
              Chat
            </Link>
            <Link
              href="/explore"
              className="text-sm px-3 py-1.5 rounded-lg border border-border hover:border-accent hover:text-accent transition-colors"
            >
              Explore
            </Link>
            <Link
              href="/dashboard"
              className="text-sm px-3 py-1.5 rounded-lg border border-border hover:border-accent hover:text-accent transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        <div className="space-y-8">
          {/* Generate button — prominent, top */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-8 py-3 rounded-xl font-semibold text-base transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed
                bg-foreground text-background hover:opacity-90 active:scale-[0.98]"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2.5">
                  <span className="h-4 w-4 border-2 border-background/40 border-t-background rounded-full animate-spin" />
                  Generating...
                </span>
              ) : (
                "Generate Briefing"
              )}
            </button>
          </div>

          {/* Keyword filter */}
          <KeywordFilter
            selectedKeywords={keywords}
            onToggle={toggleKeyword}
            onClearAll={() => setKeywords([])}
          />

          {/* Time slider */}
          <TimeSlider
            displayValue={sliderIdx}
            onDrag={setSliderIdx}
            onCommit={() => setCommittedIdx(sliderIdx)}
          />

          {/* Toggle row */}
          <div className="flex gap-4">
            <SegmentedToggle
              label="Detail level"
              options={[
                { value: "simple" as const, label: "Simple" },
                { value: "extended" as const, label: "Extended" },
              ]}
              value={mode}
              onChange={setMode}
            />
            <SegmentedToggle
              label="Language"
              options={[
                { value: "en" as const, label: "English" },
                { value: "de" as const, label: "German" },
              ]}
              value={language}
              onChange={setLanguage}
            />
          </div>

          {/* Error state */}
          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Briefing result */}
          {briefing && !isGenerating && (
            <BriefingDisplay
              result={briefing}
              onRegenerate={handleGenerate}
              isRegenerating={isGenerating}
            />
          )}

          {/* Loading state (shown in result area during generation) */}
          {isGenerating && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">
                  Analyzing articles and generating briefing...
                </span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer nav */}
      <footer className="border-t border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-accent transition-colors">
            Home
          </Link>
          <span className="text-border">|</span>
          <Link
            href="/explore"
            className="hover:text-accent transition-colors"
          >
            Explore
          </Link>
          <span className="text-border">|</span>
          <Link
            href="/dashboard"
            className="hover:text-accent transition-colors"
          >
            Dashboard
          </Link>
          <span className="text-border">|</span>
          <span className="text-foreground font-medium">Generate</span>
        </div>
      </footer>
    </div>
  );
}
