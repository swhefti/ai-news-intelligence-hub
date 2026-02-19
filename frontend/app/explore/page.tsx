"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import cloud from "d3-cloud";
import {
  KEYWORD_CATEGORIES,
  getCategoryColor,
  getCategoryName,
} from "@/lib/keyword-categories";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface KeywordData {
  text: string;
  value: number;
}

interface ApiResponse {
  keywords: KeywordData[];
  totalArticles: number;
  dateRange: { from: string | null; to: string | null };
}

interface LayoutWord {
  text: string;
  size: number;
  value: number;
  color: string;
  category: string;
  x: number;
  y: number;
  rotate: number;
}

/* ------------------------------------------------------------------ */
/* Word Cloud Component                                                */
/* ------------------------------------------------------------------ */

function WordCloud({ words }: { words: KeywordData[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutWords, setLayoutWords] = useState<LayoutWord[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [tooltip, setTooltip] = useState<{
    word: LayoutWord;
    x: number;
    y: number;
  } | null>(null);

  // Observe container size for responsiveness
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          const height = Math.max(400, Math.min(width * 0.6, 600));
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Run d3-cloud layout
  useEffect(() => {
    if (words.length === 0) return;

    const { width, height } = dimensions;
    const maxCount = Math.max(...words.map((w) => w.value));
    const minCount = Math.min(...words.map((w) => w.value));

    // Scale font size: map count range to font size range
    const minFont = width < 500 ? 12 : 16;
    const maxFont = width < 500 ? 48 : 72;

    function fontSize(count: number) {
      if (maxCount === minCount) return (minFont + maxFont) / 2;
      const t = (count - minCount) / (maxCount - minCount);
      // Use sqrt scale for better visual distribution
      return minFont + Math.sqrt(t) * (maxFont - minFont);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layout = (cloud as any)()
      .size([width, height])
      .words(words.map((w) => ({ text: w.text, value: w.value })))
      .padding(4)
      .rotate(() => (Math.random() < 0.25 ? 90 : 0))
      .font("Inter, sans-serif")
      .fontWeight("bold")
      .fontSize((d: { value: number }) => fontSize(d.value))
      .random(() => 0.5) // deterministic seed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("end", (output: any[]) => {
        const result: LayoutWord[] = output.map((w) => ({
          text: w.text as string,
          size: w.size as number,
          value: w.value as number,
          color: getCategoryColor(w.text as string),
          category: getCategoryName(w.text as string),
          x: w.x as number,
          y: w.y as number,
          rotate: w.rotate as number,
        }));
        setLayoutWords(result);
      });

    layout.start();
  }, [words, dimensions]);

  const handleMouseEnter = useCallback(
    (word: LayoutWord, event: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltip({
        word,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleClick = useCallback((word: LayoutWord) => {
    console.log("Clicked keyword:", word.text, "| Count:", word.value, "| Category:", word.category);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="block mx-auto"
      >
        <g
          transform={`translate(${dimensions.width / 2}, ${dimensions.height / 2})`}
        >
          {layoutWords.map((word) => (
            <text
              key={word.text}
              textAnchor="middle"
              transform={`translate(${word.x}, ${word.y}) rotate(${word.rotate})`}
              style={{
                fontSize: `${word.size}px`,
                fontFamily: "Inter, sans-serif",
                fontWeight: "bold",
                fill: word.color,
                cursor: "pointer",
                transition: "opacity 0.15s ease",
              }}
              opacity={tooltip && tooltip.word.text !== word.text ? 0.4 : 1}
              onMouseEnter={(e) => handleMouseEnter(word, e)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(word)}
            >
              {word.text}
            </text>
          ))}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm"
          style={{
            left: tooltip.x,
            top: tooltip.y - 60,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-semibold" style={{ color: tooltip.word.color }}>
            {tooltip.word.text}
          </p>
          <p className="text-muted-foreground">
            {tooltip.word.value} article{tooltip.word.value !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {tooltip.word.category}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category Legend                                                      */
/* ------------------------------------------------------------------ */

function CategoryLegend() {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
      {Object.entries(KEYWORD_CATEGORIES).map(([category, data]) => (
        <div key={category} className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: data.color }}
          />
          <span className="text-sm text-muted-foreground">{category}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Explore Page                                                   */
/* ------------------------------------------------------------------ */

export default function ExplorePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/explore/keywords")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((d: ApiResponse) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Explore AI Topics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data
                ? `Discover trending topics across ${data.totalArticles} articles`
                : "Discover trending topics in AI news"}
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
              href="/dashboard"
              className="text-sm px-3 py-1.5 rounded-lg border border-border hover:border-accent hover:text-accent transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span>Loading topic data...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center py-32 gap-4">
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              {error}
            </div>
            <button
              type="button"
              onClick={fetchData}
              className="px-4 py-2 rounded-lg border border-border hover:border-accent hover:text-accent transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Word cloud + legend */}
        {data && !loading && !error && (
          <div className="space-y-6">
            {/* Date range info */}
            {data.dateRange.from && data.dateRange.to && (
              <p className="text-center text-sm text-muted-foreground">
                Covering articles from{" "}
                <span className="font-medium text-foreground">
                  {new Date(data.dateRange.from + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                </span>{" "}
                to{" "}
                <span className="font-medium text-foreground">
                  {new Date(data.dateRange.to + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                </span>
              </p>
            )}

            {/* Legend */}
            <CategoryLegend />

            {/* Word cloud container */}
            {data.keywords.length >= 5 ? (
              <div className="border border-border rounded-xl bg-muted/30 p-4 overflow-hidden">
                <WordCloud words={data.keywords} />
              </div>
            ) : (
              <div className="flex items-center justify-center py-32 text-muted-foreground">
                <p>
                  Not enough keyword data yet. Run the ingestion pipeline to
                  classify articles.
                </p>
              </div>
            )}

            {/* Keyword stats table */}
            {data.keywords.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">
                  All Keywords ({data.keywords.length})
                </h2>
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="border-b border-border bg-muted">
                          <th className="text-left px-4 py-2.5 font-medium">
                            Keyword
                          </th>
                          <th className="text-left px-4 py-2.5 font-medium">
                            Category
                          </th>
                          <th className="text-right px-4 py-2.5 font-medium">
                            Articles
                          </th>
                          <th className="text-right px-4 py-2.5 font-medium">
                            % of Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.keywords.map((kw) => {
                          const color = getCategoryColor(kw.text);
                          const category = getCategoryName(kw.text);
                          const pct =
                            data.totalArticles > 0
                              ? ((kw.value / data.totalArticles) * 100).toFixed(
                                  1
                                )
                              : "0";
                          return (
                            <tr
                              key={kw.text}
                              className="border-b border-border last:border-b-0 hover:bg-muted/50"
                            >
                              <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                                {kw.text}
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {category}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono">
                                {kw.value}
                              </td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">
                                {pct}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer nav */}
      <footer className="border-t border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-accent transition-colors">
            Home
          </Link>
          <span className="text-border">|</span>
          <Link
            href="/dashboard"
            className="hover:text-accent transition-colors"
          >
            Dashboard
          </Link>
          <span className="text-border">|</span>
          <span className="text-foreground font-medium">Explore</span>
        </div>
      </footer>
    </div>
  );
}
