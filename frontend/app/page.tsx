"use client";

import { useState, useEffect, FormEvent } from "react";

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

export default function Home() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articleCount, setArticleCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setArticleCount(data.articleCount))
      .catch(() => {});
  }, []);

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
          {articleCount !== null && (
            <div className="text-right">
              <span className="text-2xl font-bold text-accent">{articleCount}</span>
              <p className="text-xs text-muted-foreground">articles indexed</p>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
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
            {/* Answer */}
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap leading-relaxed">
                {result.answer}
              </div>
            </div>

            {/* Sources */}
            {result.sources.length > 0 && (
              <div className="border-t border-border pt-4">
                <h2 className="text-sm font-medium text-muted-foreground mb-3">
                  Sources ({result.sources.length})
                </h2>
                <ul className="space-y-2">
                  {result.sources.map((source, i) => (
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
            )}
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
      </main>
    </div>
  );
}
