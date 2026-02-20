"use client";

import { useState, useEffect } from "react";
import NavHeader from "@/components/NavHeader";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// Color palette for sources
const COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ea580c", "#9333ea",
  "#0891b2", "#ca8a04", "#e11d48", "#4f46e5", "#059669",
  "#d97706", "#7c3aed", "#0d9488", "#c026d3", "#65a30d",
  "#f59e0b", "#6366f1", "#14b8a6", "#f43f5e", "#8b5cf6",
  "#84cc16",
];

interface SourceStats {
  source_name: string;
  source_category: string;
  article_count: number;
  chunk_count: number;
  last_article: string | null;
}

interface DashboardData {
  totalArticles: number;
  totalChunks: number;
  lastIngestion: string | null;
  sources: SourceStats[];
  daily: Record<string, string | number>[];
}

// Custom tooltip for pie chart
function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { percent: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="modal-content" style={{ padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}>
      <p style={{ fontWeight: 700, margin: 0 }}>{item.name}</p>
      <p className="mono-label" style={{ margin: 0, fontSize: "0.75rem" }}>
        {item.value} articles ({(item.payload.percent * 100).toFixed(1)}%)
      </p>
    </div>
  );
}

// Custom tooltip for bar chart
function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const nonZero = payload.filter((p) => p.value > 0);
  if (nonZero.length === 0) return null;
  return (
    <div className="modal-content" style={{ padding: "0.5rem 0.75rem", fontSize: "0.875rem", maxHeight: "16rem", overflowY: "auto" }}>
      <p style={{ fontWeight: 700, margin: "0 0 0.25rem 0" }}>{label}</p>
      {nonZero.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: entry.color, flexShrink: 0 }} />
          <span className="mono-label" style={{ fontSize: "0.7rem" }}>
            {entry.name}: {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <NavHeader currentPage="sources" />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3" style={{ color: "var(--muted-foreground)" }}>
            <div className="spinner" style={{ width: "1rem", height: "1rem" }} />
            <span>Loading sources...</span>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <NavHeader currentPage="sources" />
        <main className="flex-1 flex items-center justify-center">
          <div className="error-box">{error ?? "Failed to load data"}</div>
        </main>
      </div>
    );
  }

  const sourceColorMap = new Map<string, string>();
  data.sources.forEach((s, i) => {
    sourceColorMap.set(s.source_name, COLORS[i % COLORS.length]);
  });

  const pieData = data.sources.map((s) => ({
    name: s.source_name,
    value: s.article_count,
  }));

  const sourceNames = data.sources.map((s) => s.source_name);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavHeader currentPage="sources" />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard label="Total Articles" value={data.totalArticles} />
          <SummaryCard label="Total Chunks" value={data.totalChunks} />
          <SummaryCard
            label="Last Ingestion"
            value={
              data.lastIngestion
                ? new Date(data.lastIngestion).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Never"
            }
          />
        </div>

        {/* Source Health Table */}
        <section>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, fontStyle: "italic", marginBottom: "0.75rem" }}>Source Health</h2>
          <div className="bp-card" style={{ padding: 0, overflow: "hidden", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--ink)", background: "rgba(13, 43, 43, 0.03)" }}>
                  <th style={{ textAlign: "left", padding: "0.65rem 1rem" }}>Source</th>
                  <th style={{ textAlign: "left", padding: "0.65rem 1rem" }}>Status</th>
                  <th style={{ textAlign: "right", padding: "0.65rem 1rem" }}>Articles (Chunks)</th>
                  <th style={{ textAlign: "left", padding: "0.65rem 1rem" }}>Last Article</th>
                  <th style={{ textAlign: "left", padding: "0.65rem 1rem" }}>Category</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((source) => {
                  const isHealthy = source.article_count > 0;
                  return (
                    <tr
                      key={source.source_name}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: !isHealthy ? "rgba(139, 37, 0, 0.04)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "0.65rem 1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: sourceColorMap.get(source.source_name), flexShrink: 0 }} />
                        {source.source_name}
                      </td>
                      <td style={{ padding: "0.65rem 1rem" }}>
                        <span className="flex items-center gap-1.5">
                          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: isHealthy ? "#16a34a" : "#8B2500" }} />
                          <span style={{ fontSize: "0.75rem", color: isHealthy ? "#16a34a" : "#8B2500" }}>
                            {isHealthy ? "Active" : "Needs attention"}
                          </span>
                        </span>
                      </td>
                      <td className="mono-label" style={{ padding: "0.65rem 1rem", textAlign: "right", fontSize: "0.8rem" }}>
                        {source.article_count}{" "}
                        <span style={{ color: "var(--muted-foreground)" }}>({source.chunk_count})</span>
                      </td>
                      <td className="mono-label" style={{ padding: "0.65rem 1rem", fontSize: "0.75rem" }}>
                        {source.last_article ? new Date(source.last_article).toLocaleDateString() : "\u2014"}
                      </td>
                      <td style={{ padding: "0.65rem 1rem" }}>
                        <CategoryBadge category={source.source_category} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, fontStyle: "italic", marginBottom: "0.75rem" }}>Source Distribution</h2>
            <div className="bp-card" style={{ height: "400px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius="40%" outerRadius="70%" paddingAngle={2} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: "12px", maxHeight: 350, overflow: "auto" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, fontStyle: "italic", marginBottom: "0.75rem" }}>Daily Ingestion (Last 14 Days)</h2>
            <div className="bp-card" style={{ height: "400px" }}>
              {data.daily.length === 0 ? (
                <div className="flex items-center justify-center h-full" style={{ color: "var(--muted-foreground)" }}>
                  No data in the last 14 days
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: "var(--copper)" }}
                      tickFormatter={(d: string) => {
                        const date = new Date(d + "T00:00:00");
                        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      }}
                    />
                    <YAxis tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: "var(--copper)" }} allowDecimals={false} />
                    <Tooltip content={<BarTooltip />} />
                    {sourceNames.map((name, i) => (
                      <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i % COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bp-card">
      <p style={{ fontSize: "0.7rem", fontFamily: "'Inter', sans-serif", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>
        {label}
      </p>
      <p className="mono-label" style={{ fontSize: "1.5rem", fontWeight: 500, marginTop: "0.25rem" }}>
        {value}
      </p>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="chip-btn" style={{ cursor: "default" }}>
      {category.replace("_", " ")}
    </span>
  );
}
