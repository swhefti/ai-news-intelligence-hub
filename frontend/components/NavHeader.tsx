"use client";

import Link from "next/link";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface NavHeaderProps {
  currentPage?: "explore" | "chat" | "generate" | "sources";
  variant?: "full" | "home";
  hideSourcesLink?: boolean;
}

/* ------------------------------------------------------------------ */
/* NavHeader                                                           */
/* ------------------------------------------------------------------ */

const navLinkStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 500,
  padding: "0.3rem 0.6rem",
  color: "var(--muted-foreground)",
  textDecoration: "none",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const navLinkActiveStyle: React.CSSProperties = {
  ...navLinkStyle,
  color: "var(--copper)",
  fontWeight: 500,
};

export default function NavHeader({
  currentPage,
  variant = "full",
  hideSourcesLink = false,
}: NavHeaderProps) {
  return (
    <header style={{ padding: "1.25rem 1.5rem", marginBottom: 0 }}>
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link
          href="/"
          style={{
            fontFamily: "'Georgia', serif",
            fontSize: "1.1rem",
            fontStyle: "italic",
            letterSpacing: "-0.01em",
            textDecoration: "none",
            color: "var(--ink)",
          }}
        >
          The AI News Intelligence Review
        </Link>

        {/* Navigation — centered, all JetBrains Mono uppercase */}
        {variant === "full" && (
          <nav className="flex items-center" style={{ gap: "0.25rem" }}>
            {currentPage === "explore" ? (
              <span style={navLinkActiveStyle}>Explore</span>
            ) : (
              <Link href="/explore" style={navLinkStyle}>Explore</Link>
            )}
            {currentPage === "chat" ? (
              <span style={navLinkActiveStyle}>Chat</span>
            ) : (
              <Link href="/chat" style={navLinkStyle}>Chat</Link>
            )}
            {currentPage === "generate" ? (
              <span style={navLinkActiveStyle}>Generate</span>
            ) : (
              <Link href="/generate" style={navLinkStyle}>Generate</Link>
            )}
            {currentPage === "sources" ? (
              <span style={navLinkActiveStyle}>Sources</span>
            ) : (
              <Link href="/dashboard" style={navLinkStyle}>Sources</Link>
            )}
          </nav>
        )}

        {/* Sources link only (for non-full variants) */}
        {variant !== "full" && !hideSourcesLink && (
          <nav>
            <Link href="/dashboard" style={navLinkStyle}>Sources</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
