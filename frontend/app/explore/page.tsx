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

interface KeywordsResponse {
  keywords: KeywordData[];
  totalArticles: number;
  days: number;
}

interface ArticleItem {
  title: string;
  url: string;
  source_name: string;
  published_at: string;
}

interface ArticlesResponse {
  keyword: string;
  articles: ArticleItem[];
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

function WordCloud({
  words,
  onWordClick,
}: {
  words: KeywordData[];
  onWordClick: (keyword: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutWords, setLayoutWords] = useState<LayoutWord[]>([]);
  const [dimensions, setDimensions] = useState({ width: 680, height: 425 });
  const [tooltip, setTooltip] = useState<{
    word: LayoutWord;
    x: number;
    y: number;
  } | null>(null);

  // Observe container size for responsiveness — reduced by 15%
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: rawWidth } = entry.contentRect;
        if (rawWidth > 0) {
          const width = Math.round(rawWidth * 0.85);
          const height = Math.max(340, Math.min(width * 0.6, 510));
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

    // Increased contrast: smaller min, larger max, power 0.7 scale
    const minFont = width < 500 ? 10 : 12;
    const maxFont = width < 500 ? 56 : 80;

    function fontSize(count: number) {
      if (maxCount === minCount) return (minFont + maxFont) / 2;
      const t = (count - minCount) / (maxCount - minCount);
      return minFont + Math.pow(t, 0.7) * (maxFont - minFont);
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
      .random(() => 0.5)
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

  return (
    <div ref={containerRef} className="relative w-full flex justify-center">
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="block"
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
              onClick={() => onWordClick(word.text)}
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
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: data.color }}
          />
          <span className="text-xs text-muted-foreground">{category}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Time Slider                                                         */
/* ------------------------------------------------------------------ */

function TimeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 max-w-sm mx-auto">
      <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[80px] text-right">
        Last{" "}
        <span className="font-medium text-foreground">
          {value} day{value !== 1 ? "s" : ""}
        </span>
      </span>
      <input
        type="range"
        min={1}
        max={14}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
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
  );
}

/* ------------------------------------------------------------------ */
/* Info Modal                                                          */
/* ------------------------------------------------------------------ */

function InfoModal({
  keywords,
  totalArticles,
  onClose,
}: {
  keywords: KeywordData[];
  totalArticles: number;
  onClose: () => void;
}) {
  const top12 = keywords.slice(0, 12);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold">Top Keywords</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Modal body */}
        <div className="px-5 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-2 font-medium">Keyword</th>
                <th className="text-right py-2 font-medium">Articles</th>
                <th className="text-right py-2 font-medium">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {top12.map((kw) => {
                const color = getCategoryColor(kw.text);
                const pct =
                  totalArticles > 0
                    ? ((kw.value / totalArticles) * 100).toFixed(1)
                    : "0";
                return (
                  <tr
                    key={kw.text}
                    className="border-t border-border/50"
                  >
                    <td className="py-2 font-medium">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        {kw.text}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono">{kw.value}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Article List                                                        */
/* ------------------------------------------------------------------ */

function ArticleList({
  keyword,
  days,
  onClear,
}: {
  keyword: string;
  days: number;
  onClear: () => void;
}) {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/explore/articles?keyword=${encodeURIComponent(keyword)}&days=${days}`
    )
      .then((res) => res.json())
      .then((d: ArticlesResponse) => setArticles(d.articles ?? []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [keyword, days]);

  return (
    <section className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
        <h3 className="text-sm font-semibold">
          Articles about{" "}
          <span style={{ color: getCategoryColor(keyword) }}>{keyword}</span>
        </h3>
        <button
          type="button"
          onClick={onClear}
          className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          Clear selection
        </button>
      </div>

      {/* Body */}
      <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
        {loading && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <div className="h-3.5 w-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin mr-2" />
            Loading articles...
          </div>
        )}

        {!loading && articles.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No articles found for this keyword in the selected time range.
          </div>
        )}

        {!loading &&
          articles.map((article, i) => (
            <div key={`${article.url}-${i}`} className="px-4 py-3 hover:bg-muted/30 transition-colors">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:text-accent transition-colors line-clamp-2"
              >
                {article.title}
              </a>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{article.source_name}</span>
                {article.published_at && (
                  <>
                    <span>&middot;</span>
                    <span>
                      {new Date(article.published_at).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" }
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Main Explore Page                                                   */
/* ------------------------------------------------------------------ */

export default function ExplorePage() {
  const [data, setData] = useState<KeywordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(14);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  const fetchData = useCallback(
    (d: number) => {
      setLoading(true);
      setError(null);
      fetch(`/api/explore/keywords?days=${d}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((resp: KeywordsResponse) => setData(resp))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  const handleDaysChange = useCallback((newDays: number) => {
    setDays(newDays);
    setSelectedKeyword(null);
  }, []);

  const handleWordClick = useCallback((keyword: string) => {
    setSelectedKeyword((prev) => (prev === keyword ? null : keyword));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Explore AI Topics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Discover what&apos;s trending in AI
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
        {error && !loading && (
          <div className="flex flex-col items-center py-32 gap-4">
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              {error}
            </div>
            <button
              type="button"
              onClick={() => fetchData(days)}
              className="px-4 py-2 rounded-lg border border-border hover:border-accent hover:text-accent transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {data && !loading && !error && (
          <div className="space-y-6">
            {/* Word cloud — no border, transparent bg */}
            {data.keywords.length >= 5 ? (
              <div className="relative">
                <WordCloud
                  words={data.keywords}
                  onWordClick={handleWordClick}
                />

                {/* Info icon — bottom-left */}
                <button
                  type="button"
                  onClick={() => setShowInfoModal(true)}
                  className="absolute bottom-2 left-2 w-7 h-7 flex items-center justify-center rounded-full border border-border bg-background/80 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  title="View top keywords"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center py-32 text-muted-foreground">
                <p>
                  Not enough keyword data yet. Run the ingestion pipeline to
                  classify articles.
                </p>
              </div>
            )}

            {/* Time slider */}
            <TimeSlider value={days} onChange={handleDaysChange} />

            {/* Legend */}
            <CategoryLegend />

            {/* Article list — shown on keyword click */}
            {selectedKeyword && (
              <ArticleList
                keyword={selectedKeyword}
                days={days}
                onClear={() => setSelectedKeyword(null)}
              />
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

      {/* Info modal */}
      {showInfoModal && data && (
        <InfoModal
          keywords={data.keywords}
          totalArticles={data.totalArticles}
          onClose={() => setShowInfoModal(false)}
        />
      )}
    </div>
  );
}
