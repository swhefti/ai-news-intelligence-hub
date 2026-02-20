"use client";

import { useState, FormEvent } from "react";
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

/* ------------------------------------------------------------------ */
/* Chat Page                                                           */
/* ------------------------------------------------------------------ */

export default function ChatPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavHeader currentPage="chat" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 flex flex-col">
        <AskSection />
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ask Section                                                         */
/* ------------------------------------------------------------------ */

function AskSection() {
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

  const hasContent = loading || result || error;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: hasContent ? "flex-start" : "center" }}>
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

      {/* Empty state — subtle suggestions */}
      {!loading && !result && !error && (
        <div className="text-center" style={{ color: "var(--muted-foreground)", marginTop: "1.5rem" }}>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "What are the latest AI safety developments?",
              "What has Anthropic announced recently?",
              "What's new in open source AI models?",
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="icon-btn"
                onClick={() => setQuestion(suggestion)}
                style={{
                  fontSize: "0.78rem",
                  color: "var(--muted-foreground)",
                  fontStyle: "italic",
                  padding: "0.3rem 0.65rem",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  transition: "border-color 0.15s ease, color 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--copper)"; e.currentTarget.style.color = "var(--copper)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted-foreground)"; }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
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
