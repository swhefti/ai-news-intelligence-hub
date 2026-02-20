"use client";

import Link from "next/link";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface NavHeaderProps {
  currentPage?: "explore" | "chat" | "generate" | "sources";
  variant?: "full" | "home";
}

/* ------------------------------------------------------------------ */
/* NavHeader                                                           */
/* ------------------------------------------------------------------ */

export default function NavHeader({
  currentPage,
  variant = "full",
}: NavHeaderProps) {
  return (
    <header style={{ padding: "1.25rem 1.5rem", marginBottom: 0 }}>
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link
          href="/"
          style={{
            fontFamily: "'Georgia', serif",
            fontSize: "0.9rem",
            fontStyle: "italic",
            letterSpacing: "-0.01em",
            textDecoration: "none",
            color: "var(--ink)",
          }}
        >
          The AI News Intelligence Review
        </Link>

        {/* Navigation */}
        <nav className="flex items-center" style={{ gap: "0.5rem" }}>
          {variant === "full" && (
            <>
              {currentPage === "explore" ? (
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontFamily: "'Georgia', serif",
                    fontStyle: "italic",
                    fontWeight: 700,
                    padding: "0.35rem 0.7rem",
                    color: "var(--ink)",
                    borderBottom: "2px solid var(--copper)",
                  }}
                >
                  Explore
                </span>
              ) : (
                <Link
                  href="/explore"
                  style={{
                    fontSize: "0.85rem",
                    fontFamily: "'Georgia', serif",
                    fontStyle: "italic",
                    padding: "0.35rem 0.7rem",
                    color: "var(--muted-foreground)",
                    textDecoration: "none",
                  }}
                >
                  Explore
                </Link>
              )}
              {currentPage === "chat" ? (
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontFamily: "'Georgia', serif",
                    fontStyle: "italic",
                    fontWeight: 700,
                    padding: "0.35rem 0.7rem",
                    color: "var(--ink)",
                    borderBottom: "2px solid var(--copper)",
                  }}
                >
                  Chat
                </span>
              ) : (
                <Link
                  href="/chat"
                  style={{
                    fontSize: "0.85rem",
                    fontFamily: "'Georgia', serif",
                    fontStyle: "italic",
                    padding: "0.35rem 0.7rem",
                    color: "var(--muted-foreground)",
                    textDecoration: "none",
                  }}
                >
                  Chat
                </Link>
              )}
              {currentPage === "generate" ? (
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontFamily: "'Georgia', serif",
                    fontStyle: "italic",
                    fontWeight: 700,
                    padding: "0.35rem 0.7rem",
                    color: "var(--ink)",
                    borderBottom: "2px solid var(--copper)",
                  }}
                >
                  Generate
                </span>
              ) : (
                <Link
                  href="/generate"
                  style={{
                    fontSize: "0.85rem",
                    fontFamily: "'Georgia', serif",
                    fontStyle: "italic",
                    padding: "0.35rem 0.7rem",
                    color: "var(--muted-foreground)",
                    textDecoration: "none",
                  }}
                >
                  Generate
                </Link>
              )}
              <span
                style={{
                  margin: "0 0.25rem",
                  color: "var(--border)",
                  userSelect: "none",
                }}
              >
                |
              </span>
            </>
          )}
          {currentPage === "sources" ? (
            <span
              style={{
                fontSize: "0.8rem",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 500,
                padding: "0.3rem 0.6rem",
                color: "var(--copper)",
                textTransform: "uppercase" as const,
                letterSpacing: "0.05em",
              }}
            >
              Sources
            </span>
          ) : (
            <Link
              href="/dashboard"
              style={{
                fontSize: "0.8rem",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 500,
                padding: "0.3rem 0.6rem",
                color: "var(--muted-foreground)",
                textDecoration: "none",
                textTransform: "uppercase" as const,
                letterSpacing: "0.05em",
              }}
            >
              Sources
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
