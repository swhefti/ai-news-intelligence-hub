"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import NavHeader from "@/components/NavHeader";

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
/* Home Page                                                           */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const [articleCount, setArticleCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setArticleCount(data.articleCount))
      .catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavHeader variant="full" />

      <main className="flex-1 flex flex-col items-center justify-center px-6" style={{ marginTop: "-4rem" }}>
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
            Currently {articleCount.toLocaleString()} articles indexed →
          </Link>
        )}

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6" style={{ marginTop: "3.5rem", maxWidth: "48rem", width: "100%" }}>
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
