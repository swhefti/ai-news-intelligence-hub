"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  KEYWORD_CATEGORIES,
  getCategoryColor,
} from "@/lib/keyword-categories";
import {
  SavedBriefing,
  getSavedBriefings,
  saveBriefing as storageSave,
  deleteBriefing as storageDelete,
} from "@/lib/briefing-storage";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ViewState = "form" | "newBriefing" | "savedBriefing";

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
/* SVG Icons                                                           */
/* ------------------------------------------------------------------ */

function ArrowLeftIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function BookmarkIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 3 3.414 3 4.517V17.25a.75.75 0 001.075.676L10 15.082l5.925 2.844A.75.75 0 0017 17.25V4.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0010 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CopyIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Delete Confirmation Dialog                                          */
/* ------------------------------------------------------------------ */

function DeleteConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-xl p-6 max-w-sm mx-4 shadow-lg">
        <h3 className="text-base font-semibold mb-2">Delete Briefing</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Are you sure you want to delete this saved briefing? This action
          cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
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
      className="text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all duration-150 cursor-pointer"
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
    <section className="space-y-3">
      {Object.entries(KEYWORD_CATEGORIES).map(([category, data]) => (
        <div key={category} className="text-center">
          <p className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
            {category}
          </p>
          <div className="flex flex-wrap gap-1.5 justify-center">
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
      {selectedKeywords.length > 0 && (
        <div className="text-center mt-2">
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
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
    <section className="flex flex-col items-center">
      <span className="text-xs text-muted-foreground mb-2">
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
        className="w-[340px] h-1 rounded-full appearance-none cursor-pointer bg-border
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-foreground
          [&::-webkit-slider-thumb]:shadow-sm
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-3.5
          [&::-moz-range-thumb]:h-3.5
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-foreground
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-pointer"
      />
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
    <div>
      <label className="text-[11px] text-muted-foreground block mb-1 text-center">
        {label}
      </label>
      <div className="flex bg-muted rounded-lg p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-xs py-1 px-4 rounded-md transition-all duration-150 font-medium ${
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
/* Briefing Content View (replaces form when viewing a briefing)       */
/* ------------------------------------------------------------------ */

function BriefingContentView({
  briefing,
  sources,
  meta,
  isSaved,
  onBack,
  onSave,
  onCopy,
  onDelete,
  onNewBriefing,
}: {
  briefing: string;
  sources: BriefingSource[];
  meta: {
    days: number;
    mode: "simple" | "extended";
    language: "en" | "de";
    articlesAnalyzed?: number;
  };
  isSaved: boolean;
  onBack: () => void;
  onSave?: () => void;
  onCopy: () => void;
  onDelete?: () => void;
  onNewBriefing: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(briefing).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          {!isSaved && onSave && (
            <button
              type="button"
              onClick={onSave}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <BookmarkIcon className="w-3.5 h-3.5" />
              Save
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              handleCopy();
              onCopy();
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <CopyIcon className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy"}
          </button>
          {isSaved && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-red-600 dark:text-red-400"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onNewBriefing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-all font-medium"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Briefing
          </button>
        </div>
      </div>

      {/* Meta bar */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {meta.articlesAnalyzed != null && (
          <>
            <span>{meta.articlesAnalyzed} articles</span>
            <span>&middot;</span>
          </>
        )}
        <span>{meta.mode === "simple" ? "Simple" : "Extended"}</span>
        <span>&middot;</span>
        <span>
          {meta.days} day{meta.days !== 1 ? "s" : ""}
        </span>
        <span>&middot;</span>
        <span>{meta.language === "en" ? "English" : "German"}</span>
        {isSaved && (
          <>
            <span>&middot;</span>
            <span className="text-accent">Saved</span>
          </>
        )}
      </div>

      {/* Briefing content */}
      <div className="briefing-content border-l-4 border-accent pl-5 py-1">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing}</ReactMarkdown>
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium">
            Sources ({sources.length})
          </summary>
          <ul className="mt-2 space-y-1.5 pl-4">
            {sources.map((src, i) => (
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History List                                                        */
/* ------------------------------------------------------------------ */

function HistoryList({
  briefings,
  onSelect,
  onDelete,
}: {
  briefings: SavedBriefing[];
  onSelect: (b: SavedBriefing) => void;
  onDelete: (id: string) => void;
}) {
  if (briefings.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
        Saved Briefings
      </h2>
      <div className="space-y-2">
        {briefings.map((b) => {
          // Extract first heading or first ~80 chars as preview
          const firstLine = b.briefing.split("\n").find((l) => l.trim().length > 0) || "";
          const preview = firstLine.replace(/^#+\s*/, "").slice(0, 90);
          const date = new Date(b.savedAt);
          const timeAgo = getTimeAgo(date);

          return (
            <div
              key={b.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-accent/40 hover:bg-muted/50 transition-all cursor-pointer group"
              onClick={() => onSelect(b)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{preview || "Untitled briefing"}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span>{timeAgo}</span>
                  <span>&middot;</span>
                  <span>{b.mode === "simple" ? "Simple" : "Extended"}</span>
                  <span>&middot;</span>
                  <span>{b.days}d</span>
                  {b.keywords.length > 0 && (
                    <>
                      <span>&middot;</span>
                      <span className="truncate max-w-[150px]">
                        {b.keywords.slice(0, 3).join(", ")}
                        {b.keywords.length > 3 ? ` +${b.keywords.length - 3}` : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(b.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-all"
                title="Delete"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/* ------------------------------------------------------------------ */
/* Main Generate Page                                                  */
/* ------------------------------------------------------------------ */

export default function GeneratePage() {
  // Form state
  const [keywords, setKeywords] = useState<string[]>([]);
  const [sliderIdx, setSliderIdx] = useState(2); // index 2 = 3 days
  const [committedIdx, setCommittedIdx] = useState(2);
  const [mode, setMode] = useState<"simple" | "extended">("simple");
  const [language, setLanguage] = useState<"en" | "de">("en");

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [view, setView] = useState<ViewState>("form");
  const [currentBriefing, setCurrentBriefing] = useState<BriefingResult | null>(null);
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [selectedSaved, setSelectedSaved] = useState<SavedBriefing | null>(null);

  // History
  const [savedBriefings, setSavedBriefings] = useState<SavedBriefing[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Load saved briefings on mount
  useEffect(() => {
    setSavedBriefings(getSavedBriefings());
  }, []);

  const refreshHistory = useCallback(() => {
    setSavedBriefings(getSavedBriefings());
  }, []);

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
      setCurrentBriefing(data);
      setCurrentSavedId(null);
      setView("newBriefing");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsGenerating(false);
    }
  }, [committedIdx, keywords, mode, language]);

  const handleSaveCurrent = useCallback(() => {
    if (!currentBriefing) return;
    const saved = storageSave({
      days: currentBriefing.meta.days,
      mode: currentBriefing.meta.mode,
      language: currentBriefing.meta.language,
      keywords:
        currentBriefing.meta.keywordsUsed === "all"
          ? []
          : currentBriefing.meta.keywordsUsed,
      briefing: currentBriefing.briefing,
      sources: currentBriefing.sources,
    });
    setCurrentSavedId(saved.id);
    refreshHistory();
  }, [currentBriefing, refreshHistory]);

  const handleSelectSaved = useCallback((b: SavedBriefing) => {
    setSelectedSaved(b);
    setView("savedBriefing");
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    storageDelete(deleteTarget);
    refreshHistory();
    // If we're viewing the deleted briefing, go back to form
    if (view === "savedBriefing" && selectedSaved?.id === deleteTarget) {
      setView("form");
      setSelectedSaved(null);
    }
    if (view === "newBriefing" && currentSavedId === deleteTarget) {
      setCurrentSavedId(null);
    }
    setDeleteTarget(null);
  }, [deleteTarget, view, selectedSaved, currentSavedId, refreshHistory]);

  const handleNewBriefing = useCallback(() => {
    setView("form");
    setCurrentBriefing(null);
    setCurrentSavedId(null);
    setSelectedSaved(null);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

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
        {/* ---- FORM VIEW ---- */}
        {view === "form" && (
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
            <div className="flex gap-4 justify-center">
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

            {/* Loading state */}
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

            {/* History list */}
            <HistoryList
              briefings={savedBriefings}
              onSelect={handleSelectSaved}
              onDelete={(id) => setDeleteTarget(id)}
            />
          </div>
        )}

        {/* ---- NEW BRIEFING VIEW ---- */}
        {view === "newBriefing" && currentBriefing && (
          <BriefingContentView
            briefing={currentBriefing.briefing}
            sources={currentBriefing.sources}
            meta={{
              days: currentBriefing.meta.days,
              mode: currentBriefing.meta.mode,
              language: currentBriefing.meta.language,
              articlesAnalyzed: currentBriefing.meta.articlesAnalyzed,
            }}
            isSaved={currentSavedId !== null}
            onBack={handleNewBriefing}
            onSave={handleSaveCurrent}
            onCopy={() => {}}
            onDelete={
              currentSavedId
                ? () => setDeleteTarget(currentSavedId)
                : undefined
            }
            onNewBriefing={handleNewBriefing}
          />
        )}

        {/* ---- SAVED BRIEFING VIEW ---- */}
        {view === "savedBriefing" && selectedSaved && (
          <BriefingContentView
            briefing={selectedSaved.briefing}
            sources={selectedSaved.sources}
            meta={{
              days: selectedSaved.days,
              mode: selectedSaved.mode,
              language: selectedSaved.language,
            }}
            isSaved={true}
            onBack={() => {
              setView("form");
              setSelectedSaved(null);
            }}
            onCopy={() => {}}
            onDelete={() => setDeleteTarget(selectedSaved.id)}
            onNewBriefing={handleNewBriefing}
          />
        )}
      </main>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

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
