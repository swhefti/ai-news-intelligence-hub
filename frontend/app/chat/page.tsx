"use client";

import { useState, FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NavHeader from "@/components/NavHeader";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Source {
  title: string;
  url: string;
  source_name: string;
  published_at: string;
}

interface QueryResult {
  answer: string;
  sources: Source[];
}

interface BriefingResult {
  briefing: string;
  sources: Source[];
  timeRange: string;
  articleCount: number;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DAY_STEPS = [1, 2, 3, 5, 7, 10, 14];
const DAY_LABELS: Record<number, string> = {
  1: "Last 24 hours",
  2: "Last 2 days",
  3: "Last 3 days",
  5: "Last 5 days",
  7: "Last week",
  10: "Last 10 days",
  14: "Last 2 weeks",
};

const LENGTH_STEPS = ["compact", "brief", "standard", "extended", "detailed"] as const;
const LENGTH_LABELS: Record<string, string> = {
  compact: "Compact (3-5 sentences)",
  brief: "Brief (5-10 sentences)",
  standard: "Standard (10-15 sentences)",
  extended: "Extended (15-25 sentences)",
  detailed: "Detailed (35-50 sentences)",
};

/* ------------------------------------------------------------------ */
/* Chat Page                                                           */
/* ------------------------------------------------------------------ */

export default function ChatPage() {
  const [activeTab, setActiveTab] = useState<"ask" | "briefing">("ask");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavHeader currentPage="chat" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1" style={{ padding: "0.25rem", background: "var(--muted)", borderRadius: "6px", width: "fit-content", marginBottom: "1.5rem" }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === "ask" ? "active" : ""}`}
            onClick={() => setActiveTab("ask")}
          >
            Ask a Question
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "briefing" ? "active" : ""}`}
            onClick={() => setActiveTab("briefing")}
          >
            Generate Briefing
          </button>
        </div>

        {activeTab === "ask" ? <AskTab /> : <BriefingTab />}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ask Tab                                                             */
/* ------------------------------------------------------------------ */

function AskTab() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get answer");
      }

      const data: QueryResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What are the latest developments in AI safety?"
          disabled={loading}
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={loading || !question.trim()}>
          {loading ? "Searching..." : "Ask"}
        </button>
      </form>

      {/* Loading state */}
      {loading && (
        <div className="mt-8 flex items-center gap-3" style={{ color: "var(--muted-foreground)" }}>
          <div className="spinner" style={{ width: "1rem", height: "1rem" }} />
          <span>Searching knowledge base and generating answer...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="error-box mt-8">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-8" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {result.answer}
          </div>
          <SourceList sources={result.sources} />
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div className="mt-16 text-center" style={{ color: "var(--muted-foreground)" }}>
          <p style={{ fontSize: "1.1rem", fontStyle: "italic" }}>Ask a question to get started</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[
              "What are the latest AI safety developments?",
              "What has Anthropic announced recently?",
              "What's new in open source AI models?",
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chip-btn"
                onClick={() => setQuestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Briefing Tab                                                        */
/* ------------------------------------------------------------------ */

function BriefingTab() {
  const [dayIndex, setDayIndex] = useState(1);
  const [lengthIndex, setLengthIndex] = useState(2);
  const [showSettings, setShowSettings] = useState(false);
  const [result, setResult] = useState<BriefingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const days = DAY_STEPS[dayIndex];
  const length = LENGTH_STEPS[lengthIndex];

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, length }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate briefing");
      }

      const data: BriefingResult = await response.json();
      setResult(data);
      setShowSettings(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result.briefing).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      {/* Generate button / settings toggle */}
      {!showSettings && !loading && !result && (
        <div className="text-center" style={{ padding: "3rem 0" }}>
          <p style={{ color: "var(--muted-foreground)", marginBottom: "1rem", fontStyle: "italic" }}>
            Get a summary of the most important AI developments
          </p>
          <button type="button" onClick={() => setShowSettings(true)}>
            Generate Briefing
          </button>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && !loading && (
        <div className="bp-card" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <h3 style={{ fontWeight: 700, fontStyle: "italic" }}>Configure your briefing</h3>

          {/* Time range slider */}
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: "0.5rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 700 }}>Time Range</label>
              <span className="mono-label" style={{ fontSize: "0.8rem" }}>
                {DAY_LABELS[days]}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={DAY_STEPS.length - 1}
              step={1}
              value={dayIndex}
              onChange={(e) => setDayIndex(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div className="flex justify-between" style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
              <span>24 hours</span>
              <span>2 weeks</span>
            </div>
          </div>

          {/* Length slider */}
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: "0.5rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 700 }}>Detail Level</label>
              <span className="mono-label" style={{ fontSize: "0.8rem" }}>
                {LENGTH_LABELS[length]}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={LENGTH_STEPS.length - 1}
              step={1}
              value={lengthIndex}
              onChange={(e) => setLengthIndex(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div className="flex justify-between" style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
              <span>Compact</span>
              <span>Detailed</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button type="button" onClick={handleGenerate}>
              Generate
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowSettings(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="mt-8 flex items-center gap-3" style={{ color: "var(--muted-foreground)" }}>
          <div className="spinner" style={{ width: "1rem", height: "1rem" }} />
          <span>Generating your briefing...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="error-box mt-8">{error}</div>
      )}

      {/* Briefing result */}
      {result && (
        <div className="mt-2" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Meta bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="mono-label" style={{ fontSize: "0.75rem" }}>{result.timeRange}</span>
              <span className="mono-label" style={{ fontSize: "0.75rem" }}>{LENGTH_LABELS[length]}</span>
              <span className="mono-label" style={{ fontSize: "0.75rem" }}>{result.articleCount} articles</span>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" style={{ fontSize: "0.8rem", padding: "0.4rem 0.9rem" }} onClick={handleCopy}>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: "0.8rem", padding: "0.4rem 0.9rem" }}
                onClick={() => { setResult(null); setShowSettings(true); }}
              >
                New briefing
              </button>
            </div>
          </div>

          {/* Briefing content */}
          <div style={{ borderLeft: "3px solid var(--copper)", paddingLeft: "1.5rem", paddingTop: "0.25rem", paddingBottom: "0.25rem" }}>
            <div className="briefing-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.briefing}
              </ReactMarkdown>
            </div>
          </div>

          <SourceList sources={result.sources} />
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Shared: Source List                                                  */
/* ------------------------------------------------------------------ */

function SourceList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
      <h2 style={{ fontSize: "0.8rem", fontFamily: "'Inter', sans-serif", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)", marginBottom: "0.75rem" }}>
        Sources ({sources.length})
      </h2>
      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {sources.map((source, i) => (
          <li key={i}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                padding: "0.75rem",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                textDecoration: "none",
                transition: "border-color 0.15s ease",
              }}
            >
              <span className="mono-label" style={{ fontSize: "0.7rem", marginTop: "0.15rem" }}>
                {i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--ink)", display: "block" }}>
                  {source.title}
                </span>
                <span className="mono-label" style={{ fontSize: "0.7rem" }}>
                  {source.source_name}
                  {source.published_at &&
                    ` \u00b7 ${new Date(source.published_at).toLocaleDateString()}`}
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
