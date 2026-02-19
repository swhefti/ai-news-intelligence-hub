"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavHeader from "@/components/NavHeader";

/* ------------------------------------------------------------------ */
/* SVG Icons                                                           */
/* ------------------------------------------------------------------ */

function CompassIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function ChatBubbleIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SparklesIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
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
      className="group p-6 rounded-xl border border-border hover:border-accent/50 hover:shadow-sm transition-all"
    >
      <div className="text-muted-foreground group-hover:text-accent transition-colors mb-3">
        {icon}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
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
    <div className="min-h-screen flex flex-col">
      <NavHeader variant="home" />

      <main className="flex-1 flex flex-col items-center justify-center px-6 -mt-16">
        {/* Title */}
        <h1 className="font-editorial text-4xl md:text-5xl font-light text-center tracking-tight">
          The AI News Intelligence Review
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-2xl text-center text-muted-foreground text-base leading-relaxed">
          A retrieval-augmented record of the global AI landscape. We ingest
          200+ sources daily to provide a searchable, high-fidelity archive of
          research, blogs, and industry shifts.
        </p>

        {/* Article count */}
        {articleCount !== null && (
          <p className="mt-4 text-sm text-muted-foreground/70">
            Currently {articleCount.toLocaleString()} articles indexed
          </p>
        )}

        {/* Feature cards */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
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
