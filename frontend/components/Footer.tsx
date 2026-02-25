export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        padding: "2rem 1.5rem",
        textAlign: "center",
        color: "var(--muted-foreground)",
        fontSize: "0.8rem",
        lineHeight: 1.7,
        marginTop: "auto",
      }}
    >
      <p
        style={{
          fontFamily: "'Georgia', serif",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: "0.9rem",
          color: "var(--ink)",
          opacity: 0.7,
        }}
      >
        AI News Intelligence Hub
      </p>
      <p style={{ marginTop: "0.4rem" }}>
        A RAG-powered news intelligence system for AI industry insights.
      </p>
      <p>
        Built with Next.js, Supabase, pgvector, OpenAI &amp; Claude.
      </p>
      <p style={{ marginTop: "1rem", fontSize: "0.72rem" }}>
        &copy; 2026 Samuel Hefti &bull; Built as an AI Showcase &ndash; continuously growing.
      </p>
    </footer>
  );
}
