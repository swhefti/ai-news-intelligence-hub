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
/* Nav Link                                                            */
/* ------------------------------------------------------------------ */

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  if (active) {
    return (
      <span className="text-sm px-3 py-1.5 font-medium text-foreground">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="text-sm px-3 py-1.5 rounded-lg border border-border hover:border-accent hover:text-accent transition-colors"
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* NavHeader                                                           */
/* ------------------------------------------------------------------ */

export default function NavHeader({
  currentPage,
  variant = "full",
}: NavHeaderProps) {
  return (
    <header className="border-b border-border px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="font-editorial text-sm tracking-tight hover:opacity-70 transition-opacity">
          The AI News Intelligence Review
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1.5">
          {variant === "full" && (
            <>
              <NavLink href="/explore" active={currentPage === "explore"}>
                Explore
              </NavLink>
              <NavLink href="/chat" active={currentPage === "chat"}>
                Chat
              </NavLink>
              <NavLink href="/generate" active={currentPage === "generate"}>
                Generate
              </NavLink>
              <span className="mx-1.5 text-border">|</span>
            </>
          )}
          {currentPage === "sources" ? (
            <span className="text-sm px-2 py-1.5 font-medium text-foreground">
              Sources
            </span>
          ) : (
            <Link
              href="/dashboard"
              className="text-sm px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              Sources
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
