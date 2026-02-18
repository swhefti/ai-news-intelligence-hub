"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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

// Color palette for sources — enough for 21 sources
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
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-medium">{item.name}</p>
      <p className="text-muted-foreground">
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
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-sm max-h-64 overflow-y-auto">
      <p className="font-medium mb-1">{label}</p>
      {nonZero.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground truncate">
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
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span>Loading dashboard...</span>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
            {error ?? "Failed to load dashboard data"}
          </div>
        </main>
      </div>
    );
  }

  // Build color map for consistent colors
  const sourceColorMap = new Map<string, string>();
  data.sources.forEach((s, i) => {
    sourceColorMap.set(s.source_name, COLORS[i % COLORS.length]);
  });

  // Pie chart data
  const pieData = data.sources.map((s) => ({
    name: s.source_name,
    value: s.article_count,
  }));

  // Source names for stacked bar chart
  const sourceNames = data.sources.map((s) => s.source_name);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-8">
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
          <h2 className="text-lg font-semibold mb-3">Source Health</h2>
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 py-2.5 font-medium">Source</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-right px-4 py-2.5 font-medium">
                    Articles (Chunks)
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium">
                    Last Article
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((source) => {
                  const isHealthy = source.article_count > 0;
                  return (
                    <tr
                      key={source.source_name}
                      className={`border-b border-border last:border-b-0 ${
                        !isHealthy
                          ? "bg-red-50 dark:bg-red-950/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: sourceColorMap.get(
                              source.source_name
                            ),
                          }}
                        />
                        {source.source_name}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              isHealthy ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                          <span
                            className={`text-xs ${
                              isHealthy
                                ? "text-green-700 dark:text-green-400"
                                : "text-red-700 dark:text-red-400"
                            }`}
                          >
                            {isHealthy ? "Active" : "Needs attention"}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {source.article_count}{" "}
                        <span className="text-muted-foreground">
                          ({source.chunk_count})
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {source.last_article
                          ? new Date(source.last_article).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
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
          {/* Pie chart */}
          <section>
            <h2 className="text-lg font-semibold mb-3">
              Source Distribution
            </h2>
            <div className="border border-border rounded-lg p-4 h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="70%"
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS[i % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: "12px", maxHeight: 350, overflow: "auto" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Daily bar chart */}
          <section>
            <h2 className="text-lg font-semibold mb-3">
              Daily Ingestion (Last 14 Days)
            </h2>
            <div className="border border-border rounded-lg p-4 h-[400px]">
              {data.daily.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data in the last 14 days
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d: string) => {
                        const date = new Date(d + "T00:00:00");
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      }}
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<BarTooltip />} />
                    {sourceNames.map((name, i) => (
                      <Bar
                        key={name}
                        dataKey={name}
                        stackId="a"
                        fill={COLORS[i % COLORS.length]}
                      />
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

function Header() {
  return (
    <header className="border-b border-border px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Source Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor your AI news knowledge base
          </p>
        </div>
        <Link
          href="/"
          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:border-accent hover:text-accent transition-colors"
        >
          &larr; Back to Chat
        </Link>
      </div>
    </header>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="border border-border rounded-lg p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    ai_company:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    tech_news:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    research:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    community:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        styles[category] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {category.replace("_", " ")}
    </span>
  );
}
