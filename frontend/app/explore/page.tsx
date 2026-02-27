"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import cloud from "d3-cloud";
import NavHeader from "@/components/NavHeader";
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
  id: string;
  title: string;
  url: string;
  source_name: string;
  published_at: string;
}

interface ArticlesResponse {
  keyword: string;
  articles: ArticleItem[];
}

interface ArticleDetail {
  id: string;
  title: string;
  summary: string | null;
  content: string | null;
  source_name: string;
  published_at: string;
  url: string;
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
/* SVG Icon helpers                                                     */
/* ------------------------------------------------------------------ */

function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 1l12 12M13 1L1 13" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
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

  useEffect(() => {
    if (words.length === 0) return;

    const { width, height } = dimensions;
    const maxCount = Math.max(...words.map((w) => w.value));
    const minCount = Math.min(...words.map((w) => w.value));

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
        <g transform={`translate(${dimensions.width / 2}, ${dimensions.height / 2})`}>
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

      {tooltip && (
        <div
          className="modal-content"
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y - 60,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 10,
            padding: "0.5rem 0.75rem",
            fontSize: "0.875rem",
          }}
        >
          <p style={{ fontWeight: 700, color: tooltip.word.color, margin: 0 }}>
            {tooltip.word.text}
          </p>
          <p className="mono-label" style={{ margin: 0, fontSize: "0.75rem" }}>
            {tooltip.word.value} article{tooltip.word.value !== 1 ? "s" : ""}
          </p>
          <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--muted-foreground)" }}>
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
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: data.color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{category}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Time Slider                                                         */
/* ------------------------------------------------------------------ */

function TimeSlider({
  displayValue,
  committedValue,
  onDrag,
  onCommit,
}: {
  displayValue: number;
  committedValue: number;
  onDrag: (days: number) => void;
  onCommit: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4" style={{ maxWidth: "28rem", margin: "0 auto" }}>
      <span style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", whiteSpace: "nowrap", textAlign: "right" }}>
        Sources from the last{" "}
        <span className="mono-label">
          {displayValue} day{displayValue !== 1 ? "s" : ""}
        </span>
      </span>
      <input
        type="range"
        min={1}
        max={14}
        step={1}
        value={displayValue}
        onChange={(e) => onDrag(parseInt(e.target.value, 10))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        style={{ width: "100%" }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Info Modal (top 12 keywords)                                        */
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
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ width: "100%", maxWidth: "28rem", margin: "0 1rem", overflow: "hidden" }}>
        <div className="flex items-center justify-between" style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, fontStyle: "italic" }}>Top Keywords</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div style={{ padding: "0.75rem 1.25rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.5rem 0" }}>Keyword</th>
                <th style={{ textAlign: "right", padding: "0.5rem 0" }}>Articles</th>
                <th style={{ textAlign: "right", padding: "0.5rem 0" }}>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {top12.map((kw) => {
                const color = getCategoryColor(kw.text);
                const pct = totalArticles > 0 ? ((kw.value / totalArticles) * 100).toFixed(1) : "0";
                return (
                  <tr key={kw.text} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 0", fontWeight: 700 }}>
                      <span className="flex items-center gap-2">
                        <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                        {kw.text}
                      </span>
                    </td>
                    <td className="mono-label" style={{ padding: "0.5rem 0", textAlign: "right", fontSize: "0.8rem" }}>{kw.value}</td>
                    <td style={{ padding: "0.5rem 0", textAlign: "right", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>{pct}%</td>
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
/* Article Detail Modal                                                */
/* ------------------------------------------------------------------ */

function ArticleModal({
  articleId,
  onClose,
}: {
  articleId: string;
  onClose: () => void;
}) {
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/explore/article?id=${encodeURIComponent(articleId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((d: ArticleDetail) => setArticle(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [articleId]);

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ width: "100%", maxWidth: "700px", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            {loading && (
              <div style={{ height: "1.25rem", width: "12rem", background: "var(--muted)", borderRadius: "4px" }} />
            )}
            {!loading && article && (
              <>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, lineHeight: 1.3 }}>
                  {article.title}
                </h3>
                <div className="flex items-center gap-3 mono-label" style={{ marginTop: "0.4rem", fontSize: "0.7rem" }}>
                  <span>{article.source_name}</span>
                  {article.published_at && (
                    <>
                      <span>&middot;</span>
                      <span>
                        {new Date(article.published_at).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
            {!loading && error && (
              <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                Could not load article.
              </p>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} style={{ flexShrink: 0, marginTop: "0.125rem" }}>
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "1.25rem 1.5rem" }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ height: "0.75rem", width: "100%", background: "var(--muted)", borderRadius: "4px" }} />
              <div style={{ height: "0.75rem", width: "83%", background: "var(--muted)", borderRadius: "4px" }} />
              <div style={{ height: "0.75rem", width: "67%", background: "var(--muted)", borderRadius: "4px" }} />
            </div>
          )}

          {!loading && article && (
            <div style={{ fontFamily: "'Georgia', serif", fontSize: "0.95rem", lineHeight: 1.7 }}>
              {article.summary && (
                <p style={{ color: "var(--muted-foreground)", fontStyle: "italic", lineHeight: 1.6, marginBottom: "1.25rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)" }}>
                  {article.summary}
                </p>
              )}

              {article.content ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {article.content.split(/\n\n+/).map((para, i) => (
                    <p key={i} style={{ margin: 0 }}>{para}</p>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                  Full content not available.{" "}
                  <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                    Read on source
                  </a>
                </p>
              )}

              {article.content && (
                <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "0.875rem", color: "var(--copper)", textDecoration: "underline" }}
                  >
                    Read original article &rarr;
                  </a>
                </div>
              )}
            </div>
          )}
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
  onViewArticle,
}: {
  keyword: string;
  days: number;
  onClear: () => void;
  onViewArticle: (id: string) => void;
}) {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/explore/articles?keyword=${encodeURIComponent(keyword)}&days=${days}`)
      .then((res) => res.json())
      .then((d: ArticlesResponse) => setArticles(d.articles ?? []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [keyword, days]);

  return (
    <section className="bp-card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="flex items-center justify-between" style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", background: "rgba(13, 43, 43, 0.03)" }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 700, fontStyle: "italic" }}>
          Articles about{" "}
          <span style={{ color: getCategoryColor(keyword) }}>{keyword}</span>
        </h3>
        <button type="button" className="btn-secondary" style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }} onClick={onClear}>
          Clear selection
        </button>
      </div>

      <div style={{ maxHeight: "360px", overflowY: "auto" }}>
        {loading && (
          <div className="flex items-center justify-center" style={{ padding: "2rem", color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
            <div className="spinner" style={{ width: "0.875rem", height: "0.875rem", marginRight: "0.5rem" }} />
            Loading articles...
          </div>
        )}

        {!loading && articles.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
            No articles found for this keyword in the selected time range.
          </div>
        )}

        {!loading && articles.map((article, i) => (
          <div
            key={`${article.url}-${i}`}
            className="flex items-center gap-3 group"
            style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", transition: "background 0.15s ease", cursor: "default" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.875rem", fontWeight: 700, textDecoration: "none", color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              >
                {article.title}
              </a>
              <div className="flex items-center gap-3 mono-label" style={{ marginTop: "0.25rem", fontSize: "0.7rem" }}>
                <span>{article.source_name}</span>
                {article.published_at && (
                  <>
                    <span>&middot;</span>
                    <span>
                      {new Date(article.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              className="icon-btn"
              onClick={() => onViewArticle(article.id)}
              title="View article"
              style={{ flexShrink: 0, opacity: 0.4, transition: "opacity 0.15s ease" }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "1"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "0.4"; }}
            >
              <FileTextIcon />
            </button>
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

  const [sliderValue, setSliderValue] = useState(3);
  const [committedDays, setCommittedDays] = useState(3);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [viewArticleId, setViewArticleId] = useState<string | null>(null);

  const fetchData = useCallback((d: number) => {
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
  }, []);

  useEffect(() => {
    fetchData(committedDays);
  }, [committedDays, fetchData]);

  const handleSliderDrag = useCallback((val: number) => {
    setSliderValue(val);
  }, []);

  const handleSliderCommit = useCallback(() => {
    setCommittedDays(sliderValue);
    setSelectedKeyword(null);
  }, [sliderValue]);

  const handleWordClick = useCallback((keyword: string) => {
    setSelectedKeyword((prev) => (prev === keyword ? null : keyword));
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavHeader currentPage="explore" />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center" style={{ padding: "8rem 0" }}>
            <div className="flex items-center gap-3" style={{ color: "var(--muted-foreground)" }}>
              <div className="spinner" style={{ width: "1rem", height: "1rem" }} />
              <span>Loading topic data...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-4" style={{ padding: "8rem 0" }}>
            <div className="error-box">{error}</div>
            <button type="button" className="btn-secondary" onClick={() => fetchData(committedDays)}>
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {data && !loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Word cloud */}
            {data.keywords.length >= 5 ? (
              <div className="relative">
                <WordCloud words={data.keywords} onWordClick={handleWordClick} />

                <span
                  className="mono-label"
                  style={{
                    position: "absolute",
                    bottom: "0.5rem",
                    left: "0.5rem",
                    fontSize: "0.75rem",
                    color: "var(--muted-foreground)",
                    background: "var(--paper)",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                  }}
                >
                  {data.totalArticles} articles
                </span>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowInfoModal(true)}
                  title="View top keywords"
                  style={{
                    position: "absolute",
                    bottom: "0.5rem",
                    right: "0.5rem",
                    width: "1.75rem",
                    height: "1.75rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border)",
                    borderRadius: "50%",
                    background: "var(--paper)",
                  }}
                >
                  <InfoIcon />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center" style={{ padding: "8rem 0", color: "var(--muted-foreground)" }}>
                <p>Not enough keyword data yet. Run the ingestion pipeline to classify articles.</p>
              </div>
            )}

            <TimeSlider
              displayValue={sliderValue}
              committedValue={committedDays}
              onDrag={handleSliderDrag}
              onCommit={handleSliderCommit}
            />

            <CategoryLegend />

            {selectedKeyword && (
              <ArticleList
                keyword={selectedKeyword}
                days={committedDays}
                onClear={() => setSelectedKeyword(null)}
                onViewArticle={(id) => setViewArticleId(id)}
              />
            )}
          </div>
        )}
      </main>


      {showInfoModal && data && (
        <InfoModal
          keywords={data.keywords}
          totalArticles={data.totalArticles}
          onClose={() => setShowInfoModal(false)}
        />
      )}

      {viewArticleId && (
        <ArticleModal
          articleId={viewArticleId}
          onClose={() => setViewArticleId(null)}
        />
      )}
    </div>
  );
}
