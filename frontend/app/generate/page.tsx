"use client";

import { useState, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NavHeader from "@/components/NavHeader";
import { KEYWORD_CATEGORIES } from "@/lib/keyword-categories";
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
    </svg>
  );
}

function BookmarkIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 3 3.414 3 4.517V17.25a.75.75 0 001.075.676L10 15.082l5.925 2.844A.75.75 0 0017 17.25V4.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0010 2z" clipRule="evenodd" />
    </svg>
  );
}

function CopyIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
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
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center">
      <div className="modal-content" style={{ maxWidth: "24rem", margin: "0 1rem", padding: "1.5rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, fontStyle: "italic", marginBottom: "0.5rem" }}>Delete Briefing</h3>
        <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", marginBottom: "1.25rem" }}>
          Are you sure you want to delete this saved briefing? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-secondary" style={{ fontSize: "0.8rem", padding: "0.5rem 1rem" }} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-danger" style={{ fontSize: "0.8rem", padding: "0.5rem 1rem" }} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
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
    <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {Object.entries(KEYWORD_CATEGORIES).map(([category, data]) => (
        <div
          key={category}
          style={{
            borderLeft: `3px solid ${data.color}`,
            paddingLeft: "1rem",
          }}
        >
          <p style={{
            fontSize: "0.65rem",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--muted-foreground)",
            marginBottom: "0.5rem",
          }}>
            {category}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {data.keywords.map((kw) => {
              const isSelected = selectedKeywords.includes(kw);
              return (
                <label
                  key={kw}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    padding: "0.3rem 0.6rem",
                    borderRadius: "4px",
                    border: isSelected
                      ? `1px solid ${data.color}`
                      : "1px solid var(--border)",
                    background: isSelected ? `${data.color}0D` : "white",
                    color: isSelected ? "var(--ink)" : "var(--muted-foreground)",
                    fontWeight: isSelected ? 600 : 400,
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(kw)}
                    style={{
                      accentColor: data.color,
                      width: "0.85rem",
                      height: "0.85rem",
                      cursor: "pointer",
                    }}
                  />
                  {kw}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      {selectedKeywords.length > 0 && (
        <div className="text-center">
          <button
            type="button"
            className="icon-btn"
            onClick={onClearAll}
            style={{ fontSize: "0.75rem", fontStyle: "italic", padding: "0.25rem 0.5rem" }}
          >
            Clear all ({selectedKeywords.length})
          </button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Time Slider                                                         */
/* ------------------------------------------------------------------ */

const DAY_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

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
      <span style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", marginBottom: "0.5rem" }}>
        Last{" "}
        <span className="mono-label">
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
        style={{ width: "340px" }}
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
      <label style={{ fontSize: "0.7rem", fontFamily: "'Inter', sans-serif", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)", display: "block", marginBottom: "0.3rem", textAlign: "center" }}>
        {label}
      </label>
      <div className="flex" style={{ background: "var(--muted)", borderRadius: "4px", padding: "2px", border: "1px solid var(--border)" }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`toggle-btn ${value === opt.value ? "active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Briefing Content View                                               */
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="icon-btn"
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", fontStyle: "italic" }}
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          {!isSaved && onSave && (
            <button type="button" className="btn-secondary" style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem", display: "flex", alignItems: "center", gap: "0.35rem" }} onClick={onSave}>
              <BookmarkIcon className="w-3.5 h-3.5" />
              Save
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem", display: "flex", alignItems: "center", gap: "0.35rem" }}
            onClick={() => { handleCopy(); onCopy(); }}
          >
            <CopyIcon className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy"}
          </button>
          {isSaved && onDelete && (
            <button type="button" className="btn-danger" style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem", display: "flex", alignItems: "center", gap: "0.35rem" }} onClick={onDelete}>
              <TrashIcon className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
          <button
            type="button"
            style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem", display: "flex", alignItems: "center", gap: "0.35rem" }}
            onClick={onNewBriefing}
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Briefing
          </button>
        </div>
      </div>

      {/* Meta bar */}
      <div className="flex items-center gap-3 mono-label" style={{ fontSize: "0.75rem" }}>
        {meta.articlesAnalyzed != null && (
          <>
            <span>{meta.articlesAnalyzed} articles</span>
            <span>&middot;</span>
          </>
        )}
        <span>{meta.mode === "simple" ? "Simple" : "Extended"}</span>
        <span>&middot;</span>
        <span>{meta.days} day{meta.days !== 1 ? "s" : ""}</span>
        <span>&middot;</span>
        <span>{meta.language === "en" ? "English" : "German"}</span>
        {isSaved && (
          <>
            <span>&middot;</span>
            <span style={{ fontStyle: "italic" }}>Saved</span>
          </>
        )}
      </div>

      {/* Briefing content */}
      <div className="briefing-content" style={{ borderLeft: "3px solid var(--copper)", paddingLeft: "1.25rem", paddingTop: "0.25rem" }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing}</ReactMarkdown>
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <details style={{ fontSize: "0.875rem" }}>
          <summary style={{ cursor: "pointer", color: "var(--muted-foreground)", fontWeight: 700, fontStyle: "italic" }}>
            Sources ({sources.length})
          </summary>
          <ul style={{ marginTop: "0.5rem", paddingLeft: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {sources.map((src, i) => (
              <li key={i} style={{ color: "var(--muted-foreground)" }}>
                <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  {src.title}
                </a>
                <span className="mono-label" style={{ fontSize: "0.7rem", marginLeft: "0.4rem" }}>
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
    <section style={{ marginTop: "2.5rem" }}>
      <h2 style={{ fontSize: "0.7rem", fontFamily: "'Inter', sans-serif", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", marginBottom: "0.75rem" }}>
        Saved Briefings
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {briefings.map((b) => {
          const firstLine = b.briefing.split("\n").find((l) => l.trim().length > 0) || "";
          const preview = firstLine.replace(/^#+\s*/, "").slice(0, 90);
          const date = new Date(b.savedAt);
          const timeAgo = getTimeAgo(date);

          return (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                cursor: "pointer",
                background: "white",
                boxShadow: "2px 2px 0px var(--border)",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              }}
              onClick={() => onSelect(b)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--copper)";
                (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0px var(--copper)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0px var(--border)";
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "0.875rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {preview || "Untitled briefing"}
                </p>
                <div className="flex items-center gap-2 mono-label" style={{ marginTop: "0.15rem", fontSize: "0.7rem" }}>
                  <span>{timeAgo}</span>
                  <span>&middot;</span>
                  <span>{b.mode === "simple" ? "Simple" : "Extended"}</span>
                  <span>&middot;</span>
                  <span>{b.days}d</span>
                  {b.keywords.length > 0 && (
                    <>
                      <span>&middot;</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "150px" }}>
                        {b.keywords.slice(0, 3).join(", ")}
                        {b.keywords.length > 3 ? ` +${b.keywords.length - 3}` : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={(e) => { e.stopPropagation(); onDelete(b.id); }}
                title="Delete"
                style={{ opacity: 0.3, transition: "opacity 0.15s ease" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.color = "#8B2500"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.3"; (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)"; }}
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
  const [keywords, setKeywords] = useState<string[]>([]);
  const [sliderIdx, setSliderIdx] = useState(2);
  const [committedIdx, setCommittedIdx] = useState(2);
  const [mode, setMode] = useState<"simple" | "extended">("simple");
  const [language, setLanguage] = useState<"en" | "de">("en");

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<ViewState>("form");
  const [currentBriefing, setCurrentBriefing] = useState<BriefingResult | null>(null);
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [selectedSaved, setSelectedSaved] = useState<SavedBriefing | null>(null);

  const [savedBriefings, setSavedBriefings] = useState<SavedBriefing[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
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
      keywords: currentBriefing.meta.keywordsUsed === "all" ? [] : currentBriefing.meta.keywordsUsed,
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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavHeader currentPage="generate" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        {/* ---- FORM VIEW ---- */}
        {view === "form" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <KeywordFilter
              selectedKeywords={keywords}
              onToggle={toggleKeyword}
              onClearAll={() => setKeywords([])}
            />

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

            {/* Generate button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                style={{ fontSize: "1rem", padding: "0.8rem 2rem" }}
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2.5">
                    <span className="spinner" style={{ width: "1rem", height: "1rem", borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} />
                    Generating...
                  </span>
                ) : (
                  "Generate Briefing"
                )}
              </button>
            </div>

            <TimeSlider
              displayValue={sliderIdx}
              onDrag={setSliderIdx}
              onCommit={() => setCommittedIdx(sliderIdx)}
            />

            {error && <div className="error-box">{error}</div>}

            {isGenerating && (
              <div className="flex items-center justify-center" style={{ padding: "4rem 0" }}>
                <div className="flex flex-col items-center gap-3" style={{ color: "var(--muted-foreground)" }}>
                  <div className="spinner" style={{ width: "1.5rem", height: "1.5rem" }} />
                  <span style={{ fontSize: "0.875rem" }}>Analyzing articles and generating briefing...</span>
                </div>
              </div>
            )}

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
            onDelete={currentSavedId ? () => setDeleteTarget(currentSavedId) : undefined}
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
            onBack={() => { setView("form"); setSelectedSaved(null); }}
            onCopy={() => {}}
            onDelete={() => setDeleteTarget(selectedSaved.id)}
            onNewBriefing={handleNewBriefing}
          />
        )}
      </main>

      {deleteTarget && (
        <DeleteConfirmDialog
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

    </div>
  );
}
