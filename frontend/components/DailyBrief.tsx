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
  source_names: string[];
  source_urls: string[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Shared width of the Daily Brief content column (matches the homepage tiles).
const CONTENT_MAX_WIDTH = "60rem";

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function isTodayUTC(dateString: string): boolean {
  return dateString === new Date().toISOString().split("T")[0];
}

/* ------------------------------------------------------------------ */
/* Sources — clickable count that expands to the contributing headlines */
/* ------------------------------------------------------------------ */

function Sources({ brief }: { brief: Brief }) {
  const [open, setOpen] = useState(false);
  const titles = brief.source_titles || [];
  const names = brief.source_names || [];
  const urls = brief.source_urls || [];
  if (titles.length === 0) return null;

  const items = titles.map((title, i) => ({
    title,
    name: names[i] || "",
    url: urls[i] || "",
  }));

  return (
    <div style={{ marginTop: "0.75rem", clear: "both" }}>
      <span
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="mono-label"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          fontSize: "0.68rem",
          padding: "0.15rem 0.5rem",
          border: "1px solid var(--border)",
          borderRadius: "4px",
          background: "white",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {titles.length} {titles.length === 1 ? "source" : "sources"}
        <span
          aria-hidden
          style={{
            fontSize: "0.6rem",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        >
          ▾
        </span>
      </span>

      {open && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0.5rem 0 0",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {items.map((item, i) => (
            <li
              key={i}
              style={{
                paddingLeft: "0.6rem",
                borderLeft: "2px solid var(--copper)",
              }}
            >
              {/* Outlet name (or article title if no outlet) — links to the article */}
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--ink)",
                    textDecoration: "none",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--copper)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink)"; }}
                >
                  {item.name || item.title}
                </a>
              ) : (
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>
                  {item.name || item.title}
                </span>
              )}
              {/* Article headline as secondary context when we have a distinct outlet name */}
              {item.name && item.title && item.name !== item.title && (
                <div style={{ fontSize: "0.72rem", lineHeight: 1.4, color: "var(--muted-foreground)", marginTop: "0.1rem" }}>
                  {item.title}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
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
        <Sources brief={brief} />
      </div>
      {brief.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brief.image_url}
          alt={brief.title}
          width={340}
          height={340}
          style={{
            width: "340px",
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
  // Float the image so the title/body wrap to its right and then continue
  // underneath it — filling the space rather than leaving a gap below it.
  return (
    <div className="bp-card" style={{ padding: "1.25rem" }}>
      {brief.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brief.image_url}
          alt={brief.title}
          width={160}
          height={160}
          style={{
            float: "left",
            width: "160px",
            height: "160px",
            marginRight: "1.25rem",
            marginBottom: "0.5rem",
            objectFit: "cover",
            borderRadius: "8px",
            border: "1px solid var(--border)",
          }}
        />
      )}
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
      <Sources brief={brief} />
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
        <div style={{ ...shimmer, width: "340px", maxWidth: "100%", aspectRatio: "1 / 1" }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bp-card" style={{ padding: "1.25rem", display: "flex", gap: "1rem" }}>
            <div style={{ ...shimmer, width: "160px", height: "160px", flexShrink: 0 }} />
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

function SectionLabel() {
  return (
    <h2
      className="mono-label"
      style={{
        fontSize: "0.7rem",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--muted-foreground)",
        marginBottom: "1.5rem",
      }}
    >
      Daily Brief
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/* Edition — one day's brief (main story + two sub-stories)            */
/* ------------------------------------------------------------------ */

function Edition({ items, isLatest }: { items: Brief[]; isLatest: boolean }) {
  const main = items.find((b) => b.rank === 1) || items[0];
  const subs = items.filter((b) => b.id !== main.id).slice(0, 2);

  return (
    <div
      style={{
        marginTop: isLatest ? 0 : "2.5rem",
        paddingTop: isLatest ? 0 : "2rem",
        borderTop: isLatest ? "none" : "1px solid var(--border)",
      }}
    >
      {/* Edition date */}
      <p
        style={{
          fontFamily: "'Georgia', serif",
          fontStyle: "italic",
          fontSize: "1rem",
          color: "var(--ink)",
          marginBottom: "1rem",
        }}
      >
        {formatDate(main.brief_date)}
        {isLatest && isTodayUTC(main.brief_date) && (
          <span
            className="mono-label"
            style={{ fontSize: "0.65rem", marginLeft: "0.5rem", color: "var(--copper)" }}
          >
            Today
          </span>
        )}
      </p>

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
    </div>
  );
}

/** Group briefs into editions by date (newest first). */
function groupByDate(briefs: Brief[]): { date: string; items: Brief[] }[] {
  const editions: { date: string; items: Brief[] }[] = [];
  for (const b of briefs) {
    let edition = editions.find((e) => e.date === b.brief_date);
    if (!edition) {
      edition = { date: b.brief_date, items: [] };
      editions.push(edition);
    }
    edition.items.push(b);
  }
  editions.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  return editions;
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
      <section style={{ maxWidth: CONTENT_MAX_WIDTH, width: "100%", marginTop: "3rem" }}>
        <SectionLabel />
        <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>
          The daily brief is unavailable right now.
        </p>
      </section>
    );
  }

  // Loading.
  if (briefs === null) {
    return (
      <section style={{ maxWidth: CONTENT_MAX_WIDTH, width: "100%", marginTop: "3rem" }}>
        <SectionLabel />
        <Skeleton />
      </section>
    );
  }

  // Empty (no briefs generated yet) — render nothing.
  if (briefs.length === 0) return null;

  const editions = groupByDate(briefs);

  return (
    <section style={{ maxWidth: CONTENT_MAX_WIDTH, width: "100%", marginTop: "3rem" }}>
      <SectionLabel />
      {editions.map((edition, idx) => (
        <Edition key={edition.date} items={edition.items} isLatest={idx === 0} />
      ))}
    </section>
  );
}
