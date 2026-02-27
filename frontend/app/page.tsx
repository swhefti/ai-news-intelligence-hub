"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import NavHeader from "@/components/NavHeader";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Headline {
  title: string;
  url: string;
}

interface DailySummary {
  id: string;
  date: string;
  title?: string;
  summary: string;
  headlines: Headline[];
  trending_keywords: string[];
  article_count: number;
}

/* ------------------------------------------------------------------ */
/* SVG Icons                                                           */
/* ------------------------------------------------------------------ */

function CompassIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function ChatBubbleIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SparklesIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Feature Card                                                        */
/* ------------------------------------------------------------------ */

function FeatureCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bp-card group"
      style={{ display: "block", textDecoration: "none", transition: "transform 0.15s ease, box-shadow 0.15s ease", cursor: "pointer" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translate(-2px, -2px)"; e.currentTarget.style.boxShadow = "6px 6px 0px var(--copper)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "4px 4px 0px var(--copper)"; }}
    >
      <div style={{ color: "var(--copper)", marginBottom: "0.75rem", display: "flex", justifyContent: "center" }}>
        {icon}
      </div>
      <h2 style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: "'Georgia', serif", marginBottom: "0.3rem", textAlign: "center" }}>
        {title}
      </h2>
      <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", lineHeight: 1.6, textAlign: "center" }}>
        {description}
      </p>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(dateString: string): string {
  const date = new Date(dateString + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isToday(dateString: string): boolean {
  return dateString === new Date().toISOString().split("T")[0];
}

/* ------------------------------------------------------------------ */
/* Daily Summary Section                                               */
/* ------------------------------------------------------------------ */

function DailySummarySection({
  selected,
  allSummaries,
  onSelect,
}: {
  selected: DailySummary;
  allSummaries: DailySummary[];
  onSelect: (s: DailySummary) => void;
}) {
  return (
    <section style={{ maxWidth: "48rem", width: "100%", marginTop: "3rem" }}>
      {/* Section title + date tabs */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h2 style={{
            fontSize: "0.7rem",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--muted-foreground)",
          }}>
            Daily Summary
          </h2>
          <p style={{
            fontSize: "0.95rem",
            fontFamily: "'Georgia', serif",
            fontStyle: "italic",
            color: "var(--ink)",
            marginTop: "0.2rem",
          }}>
            {formatDate(selected.date)}
            {isToday(selected.date) && (
              <span className="mono-label" style={{ fontSize: "0.65rem", marginLeft: "0.5rem", color: "var(--copper)" }}>
                Today
              </span>
            )}
          </p>
        </div>

        {/* Date picker tabs */}
        {allSummaries.length > 1 && (
          <div style={{ display: "flex", gap: "0.25rem" }}>
            {allSummaries.map((s) => (
              <button
                key={s.id}
                type="button"
                className="toggle-btn"
                style={selected.id === s.id ? {
                  background: "white",
                  color: "var(--ink)",
                  fontWeight: 700,
                  boxShadow: "1px 1px 0px var(--copper)",
                  fontSize: "0.72rem",
                  padding: "0.25rem 0.5rem",
                } : {
                  fontSize: "0.72rem",
                  padding: "0.25rem 0.5rem",
                }}
                onClick={() => onSelect(s)}
              >
                {formatShortDate(s.date)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary card */}
      <div className="bp-card" style={{ padding: "1.5rem" }}>
        {/* Title */}
        {selected.title && (
          <h3 style={{
            fontSize: "1.15rem",
            fontFamily: "'Georgia', serif",
            fontWeight: 700,
            fontStyle: "italic",
            color: "var(--ink)",
            marginBottom: "0.75rem",
          }}>
            {selected.title}
          </h3>
        )}

        {/* Summary text — split into paragraphs by topic */}
        <div style={{
          borderLeft: "3px solid var(--copper)",
          paddingLeft: "1rem",
        }}>
          {selected.summary.split(/\n\n+/).map((paragraph, i) => (
            <p key={i} style={{
              fontSize: "0.95rem",
              lineHeight: 1.8,
              color: "var(--ink)",
              marginBottom: i < selected.summary.split(/\n\n+/).length - 1 ? "0.75rem" : 0,
            }}>
              {paragraph}
            </p>
          ))}
        </div>

        {/* Article count */}
        <p className="mono-label" style={{ fontSize: "0.7rem", marginTop: "1rem" }}>
          Based on {selected.article_count} articles
        </p>

        {/* Headlines */}
        {selected.headlines && selected.headlines.length > 0 && (
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
            <h3 style={{
              fontSize: "0.65rem",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--muted-foreground)",
              marginBottom: "0.6rem",
            }}>
              Top Headlines
            </h3>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {selected.headlines.slice(0, 3).map((h, i) => (
                <li key={i}>
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--ink)",
                      textDecoration: "none",
                      fontWeight: 600,
                      transition: "color 0.15s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--copper)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink)"; }}
                  >
                    {h.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Trending keywords */}
        {selected.trending_keywords && selected.trending_keywords.length > 0 && (
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
            <h3 style={{
              fontSize: "0.65rem",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--muted-foreground)",
              marginBottom: "0.6rem",
            }}>
              Trending Topics
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {selected.trending_keywords.map((kw, i) => (
                <span
                  key={i}
                  className="mono-label"
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.2rem 0.55rem",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    background: "white",
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Home Page                                                           */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const [articleCount, setArticleCount] = useState<number | null>(null);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<DailySummary | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setArticleCount(data.articleCount))
      .catch(() => {});

    fetch("/api/summaries?limit=7")
      .then((res) => res.json())
      .then((data) => {
        const items = data.summaries || [];
        // Parse JSONB fields if they come as strings
        const parsed = items.map((s: DailySummary) => ({
          ...s,
          headlines: typeof s.headlines === "string" ? JSON.parse(s.headlines) : (s.headlines || []),
          trending_keywords: typeof s.trending_keywords === "string" ? JSON.parse(s.trending_keywords) : (s.trending_keywords || []),
        }));
        setSummaries(parsed);
        if (parsed.length > 0) setSelectedSummary(parsed[0]);
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavHeader variant="full" />

      <main className="flex-1 flex flex-col items-center px-6" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        {/* Hero image */}
        <Image
          src="/ai-news-hero.png"
          alt="AI News Intelligence Hub"
          width={685}
          height={203}
          priority
          style={{ marginBottom: "0px" }}
        />

        {/* Title */}
        <h1 style={{
          fontFamily: "'Georgia', serif",
          fontSize: "clamp(2.5rem, 6vw, 4rem)",
          fontWeight: 400,
          fontStyle: "italic",
          textAlign: "center",
          letterSpacing: "-0.02em",
          color: "var(--ink)",
          lineHeight: 1.2,
        }}>
          The AI News Intelligence Hub
          <span
            style={{
              fontSize: "0.9rem",
              fontFamily: "'JetBrains Mono', monospace",
              fontStyle: "normal",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--copper)",
              border: "1.5px solid var(--copper)",
              borderRadius: "4px",
              padding: "0.1rem 0.4rem",
              marginLeft: "0.5rem",
              verticalAlign: "super",
            }}
          >
            Beta
          </span>
        </h1>

        {/* Subtitle */}
        <p style={{
          marginTop: "1.5rem",
          maxWidth: "52rem",
          textAlign: "center",
          color: "var(--muted-foreground)",
          fontSize: "1.15rem",
          lineHeight: 1.7,
        }}>
          A retrieval-augmented record of the global AI landscape. Daily 100+
          sources are ingested to provide a searchable, high-fidelity archive
          of research, blogs, and industry shifts.
        </p>

        {/* Article count */}
        {articleCount !== null && (
          <Link
            href="/dashboard"
            className="mono-label"
            style={{
              marginTop: "1rem",
              fontSize: "0.8rem",
              textDecoration: "none",
              transition: "opacity 0.15s ease",
              display: "inline-block",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            Currently {articleCount.toLocaleString()} articles indexed
          </Link>
        )}

        {/* Daily summary */}
        {selectedSummary && (
          <DailySummarySection
            selected={selectedSummary}
            allSummaries={summaries}
            onSelect={setSelectedSummary}
          />
        )}

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6" style={{ marginTop: "3rem", maxWidth: "48rem", width: "100%" }}>
          <FeatureCard
            href="/explore"
            icon={<CompassIcon />}
            title="Explore"
            description="Discover trending AI topics through an interactive word cloud"
          />
          <FeatureCard
            href="/chat"
            icon={<ChatBubbleIcon />}
            title="Chat"
            description="Ask questions about the latest AI developments"
          />
          <FeatureCard
            href="/generate"
            icon={<SparklesIcon />}
            title="Generate"
            description="Create AI-powered briefings with keyword filters"
          />
        </div>
      </main>
    </div>
  );
}
