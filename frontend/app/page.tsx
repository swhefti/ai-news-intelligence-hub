"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
/* Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [activeTab, setActiveTab] = useState<"ask" | "briefing">("ask");
  const [articleCount, setArticleCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setArticleCount(data.articleCount))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">AI News Intelligence Hub</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ask questions about the latest AI news
            </p>
          </div>
          <div className="flex items-center gap-4">
            {articleCount !== null && (
              <div className="text-right">
                <span className="text-2xl font-bold text-accent">
                  {articleCount}
                </span>
                <p className="text-xs text-muted-foreground">
                  articles indexed
                </p>
              </div>
            )}
            <Link
              href="/generate"
              className="text-sm px-3 py-1.5 rounded-lg border border-border hover:border-accent hover:text-accent transition-colors"
            >
              Generate
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
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("ask")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "ask"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Ask a Question
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("briefing")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "briefing"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
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
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? "Searching..." : "Ask"}
        </button>
      </form>

      {/* Loading state */}
      {loading && (
        <div className="mt-8 flex items-center gap-3 text-muted-foreground">
          <div className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span>Searching knowledge base and generating answer...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-8 p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-8 space-y-6">
          <div className="whitespace-pre-wrap leading-relaxed">
            {result.answer}
          </div>
          <SourceList sources={result.sources} />
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div className="mt-16 text-center text-muted-foreground">
          <p className="text-lg">Ask a question to get started</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[
              "What are the latest AI safety developments?",
              "What has Anthropic announced recently?",
              "What's new in open source AI models?",
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuestion(suggestion)}
                className="text-sm px-3 py-1.5 rounded-full border border-border hover:border-accent hover:text-accent transition-colors"
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
  const [dayIndex, setDayIndex] = useState(1); // default: 2 days
  const [lengthIndex, setLengthIndex] = useState(2); // default: standard
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
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            Get a summary of the most important AI developments
          </p>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:opacity-90 transition-opacity text-base"
          >
            Generate Briefing
          </button>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && !loading && (
        <div className="border border-border rounded-lg p-6 space-y-6">
          <h3 className="font-medium">Configure your briefing</h3>

          {/* Time range slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Time Range</label>
              <span className="text-sm text-accent font-medium">
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
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>24 hours</span>
              <span>2 weeks</span>
            </div>
          </div>

          {/* Length slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Detail Level</label>
              <span className="text-sm text-accent font-medium">
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
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Compact</span>
              <span>Detailed</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              className="px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Generate
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="px-5 py-2.5 rounded-lg border border-border hover:border-accent transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="mt-8 flex items-center gap-3 text-muted-foreground">
          <div className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span>Generating your briefing...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-8 p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Briefing result */}
      {result && (
        <div className="mt-2 space-y-6">
          {/* Meta bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-muted">
                {result.timeRange}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-muted">
                {LENGTH_LABELS[length]}
              </span>
              <span>{result.articleCount} articles analyzed</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="text-sm px-3 py-1.5 rounded-lg border border-border hover:border-accent hover:text-accent transition-colors"
              >
                {copied ? "Copied!" : "Copy to clipboard"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setShowSettings(true);
                }}
                className="text-sm px-3 py-1.5 rounded-lg border border-border hover:border-accent hover:text-accent transition-colors"
              >
                New briefing
              </button>
            </div>
          </div>

          {/* Briefing content */}
          <div className="border-l-4 border-accent/20 pl-6 py-2">
            <div className="briefing-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.briefing}
              </ReactMarkdown>
            </div>
          </div>

          <div className="font-sans">
            <SourceList sources={result.sources} />
          </div>
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
    <div className="border-t border-border pt-4">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        Sources ({sources.length})
      </h2>
      <ul className="space-y-2">
        {sources.map((source, i) => (
          <li key={i}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 p-3 rounded-lg border border-border hover:border-accent hover:bg-accent-light transition-colors"
            >
              <span className="text-xs font-mono text-muted-foreground mt-0.5">
                {i + 1}
              </span>
              <div className="min-w-0">
                <span className="text-sm font-medium text-accent group-hover:underline block truncate">
                  {source.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {source.source_name}
                  {source.published_at &&
                    ` · ${new Date(source.published_at).toLocaleDateString()}`}
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
