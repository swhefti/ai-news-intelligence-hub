"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Brief {
  id: string;
  brief_date: string;
  rank: number;
  title: string;
  body: string;
  image_url: string | null;
  image_prompt?: string;
  source_article_ids: string[];
  source_titles: string[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Derive a small set of unique source names from the cluster's titles. */
function sourceNames(brief: Brief): string[] {
  // source_titles are article titles; show how many sources backed the story.
  const count = brief.source_titles?.length || 0;
  if (count === 0) return [];
  return [`${count} ${count === 1 ? "source" : "sources"}`];
}

/* ------------------------------------------------------------------ */
/* Source pills                                                        */
/* ------------------------------------------------------------------ */

function SourceTags({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.75rem" }}>
      {labels.map((label, i) => (
        <span
          key={i}
          className="mono-label"
          style={{
            fontSize: "0.68rem",
            padding: "0.15rem 0.5rem",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            background: "white",
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function MainStory({ brief }: { brief: Brief }) {
  return (
    <div
      className="bp-card"
      style={{
        padding: "1.5rem",
        display: "flex",
        flexWrap: "wrap",
        gap: "1.5rem",
        alignItems: "flex-start",
      }}
    >
      <div style={{ flex: "1 1 18rem", minWidth: "min(100%, 18rem)" }}>
        <h3
          style={{
            fontSize: "1.6rem",
            fontFamily: "'Georgia', serif",
            fontWeight: 700,
            lineHeight: 1.25,
            color: "var(--ink)",
            marginBottom: "0.6rem",
          }}
        >
          {brief.title}
        </h3>
        <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "var(--muted-foreground)" }}>
          {brief.body}
        </p>
        <SourceTags labels={sourceNames(brief)} />
      </div>
      {brief.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brief.image_url}
          alt={brief.title}
          width={300}
          height={300}
          style={{
            width: "300px",
            maxWidth: "100%",
            aspectRatio: "1 / 1",
            objectFit: "cover",
            borderRadius: "8px",
            border: "1px solid var(--border)",
          }}
        />
      )}
    </div>
  );
}

function SubStory({ brief }: { brief: Brief }) {
  return (
    <div className="bp-card" style={{ padding: "1.25rem", display: "flex", gap: "1rem" }}>
      {brief.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brief.image_url}
          alt={brief.title}
          width={120}
          height={120}
          style={{
            width: "120px",
            height: "120px",
            flexShrink: 0,
            objectFit: "cover",
            borderRadius: "8px",
            border: "1px solid var(--border)",
          }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <h3
          style={{
            fontSize: "1.05rem",
            fontFamily: "'Georgia', serif",
            fontWeight: 600,
            lineHeight: 1.3,
            color: "var(--ink)",
            marginBottom: "0.4rem",
          }}
        >
          {brief.title}
        </h3>
        <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "var(--muted-foreground)" }}>
          {brief.body}
        </p>
        <SourceTags labels={sourceNames(brief)} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function Skeleton() {
  const shimmer: React.CSSProperties = {
    background: "var(--border)",
    borderRadius: "6px",
    opacity: 0.5,
  };
  return (
    <div aria-hidden style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="bp-card" style={{ padding: "1.5rem", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 18rem" }}>
          <div style={{ ...shimmer, height: "1.8rem", width: "80%", marginBottom: "0.8rem" }} />
          <div style={{ ...shimmer, height: "0.9rem", width: "100%", marginBottom: "0.4rem" }} />
          <div style={{ ...shimmer, height: "0.9rem", width: "90%" }} />
        </div>
        <div style={{ ...shimmer, width: "300px", maxWidth: "100%", aspectRatio: "1 / 1" }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bp-card" style={{ padding: "1.25rem", display: "flex", gap: "1rem" }}>
            <div style={{ ...shimmer, width: "120px", height: "120px", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ ...shimmer, height: "1.1rem", width: "85%", marginBottom: "0.5rem" }} />
              <div style={{ ...shimmer, height: "0.8rem", width: "100%", marginBottom: "0.3rem" }} />
              <div style={{ ...shimmer, height: "0.8rem", width: "70%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section header                                                      */
/* ------------------------------------------------------------------ */

function Header({ date }: { date?: string }) {
  return (
    <h2
      className="mono-label"
      style={{
        fontSize: "0.7rem",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--muted-foreground)",
        marginBottom: "1.25rem",
      }}
    >
      Daily Brief{date ? ` — ${formatDate(date)}` : ""}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function DailyBrief() {
  const [briefs, setBriefs] = useState<Brief[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/daily-brief")
      .then((res) => {
        if (!res.ok) throw new Error("request failed");
        return res.json();
      })
      .then((data) => setBriefs(Array.isArray(data) ? data : []))
      .catch(() => setError(true));
  }, []);

  // Error — stay subtle, never break the page.
  if (error) {
    return (
      <section style={{ maxWidth: "48rem", width: "100%", marginTop: "3rem" }}>
        <Header />
        <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>
          The daily brief is unavailable right now.
        </p>
      </section>
    );
  }

  // Loading.
  if (briefs === null) {
    return (
      <section style={{ maxWidth: "48rem", width: "100%", marginTop: "3rem" }}>
        <Header />
        <Skeleton />
      </section>
    );
  }

  // Empty (no brief generated yet for today) — render nothing.
  if (briefs.length === 0) return null;

  const main = briefs.find((b) => b.rank === 1) || briefs[0];
  const subs = briefs.filter((b) => b.id !== main.id).slice(0, 2);

  return (
    <section style={{ maxWidth: "48rem", width: "100%", marginTop: "3rem" }}>
      <Header date={main.brief_date} />
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <MainStory brief={main} />
        {subs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subs.map((b) => (
              <SubStory key={b.id} brief={b} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
