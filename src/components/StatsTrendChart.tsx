import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Percent,
  Zap,
  Target,
  Shield,
  ArrowUpRight,
  Info,
} from "lucide-react";

interface StatsTrendChartProps {
  stats: any[];
  matches: any[];
  sets: any[];
  roster: any[];
  currentMatchId?: string | null;
}

type MetricKey = "killPct" | "hittingEff" | "acePct" | "serveErrorPct" | "passAvg" | "sideoutPct";

interface MetricConfig {
  key: MetricKey;
  label: string;
  color: string;
  stroke: string;
  format: (v: number) => string;
  unit: string;
  description: string;
}

const METRICS: MetricConfig[] = [
  {
    key: "killPct",
    label: "Kill %",
    color: "bg-emerald-500",
    stroke: "#10b981",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    unit: "%",
    description: "Percentage of attack attempts that resulted in immediate kills.",
  },
  {
    key: "hittingEff",
    label: "Hitting Efficiency",
    color: "bg-blue-500",
    stroke: "#3b82f6",
    format: (v) => v.toFixed(3),
    unit: "eff",
    description: "(Kills - Attack Errors) / Total Attacks. Pro benchmark is >.250.",
  },
  {
    key: "acePct",
    label: "Ace %",
    color: "bg-amber-500",
    stroke: "#f59e0b",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    unit: "%",
    description: "Aces divided by total service attempts.",
  },
  {
    key: "serveErrorPct",
    label: "Serve Error %",
    color: "bg-rose-500",
    stroke: "#f43f5e",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    unit: "%",
    description: "Service errors per total serves. Target is <10%.",
  },
  {
    key: "passAvg",
    label: "Passing Rating (0-3)",
    color: "bg-purple-500",
    stroke: "#a855f7",
    format: (v) => v.toFixed(2),
    unit: "pts",
    description: "Serve receive passing grade on a standard 0-3 point volleyball scale.",
  },
  {
    key: "sideoutPct",
    label: "Point Conversion %",
    color: "bg-indigo-500",
    stroke: "#6366f1",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    unit: "%",
    description: "Points directly won from our serves and offensive touches.",
  },
];

export const StatsTrendChart: React.FC<StatsTrendChartProps> = ({
  stats = [],
  matches = [],
  sets = [],
  roster = [],
  currentMatchId = null,
}) => {
  const [timelineScope, setTimelineScope] = useState<"match_sets" | "all_matches">("match_sets");
  const [selectedMatchId, setSelectedMatchId] = useState<string>(() => {
    if (currentMatchId) return currentMatchId;
    if (matches && matches.length > 0) return matches[matches.length - 1].id;
    return "all";
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("team");
  const [activeMetricKeys, setActiveMetricKeys] = useState<MetricKey[]>(["killPct", "hittingEff"]);

  // Calculate timeline data slices
  const timelinePoints = useMemo(() => {
    if (timelineScope === "match_sets") {
      // Find the target match
      const targetMatch = matches.find((m) => m.id === selectedMatchId) || matches[matches.length - 1];
      if (!targetMatch) return [];

      const matchSets = sets
        .filter((s) => s.matchId === targetMatch.id)
        .sort((a, b) => (a.setNum || 0) - (b.setNum || 0));

      if (matchSets.length === 0) {
        // Fallback: group stats by setId or dummy set 1
        return [
          {
            label: "Set 1",
            subLabel: targetMatch.opponent || "Match",
            stats: stats.filter((s) => s.matchId === targetMatch.id),
          },
        ];
      }

      return matchSets.map((s) => ({
        label: `Set ${s.setNum || 1}`,
        subLabel: `${s.scoreUcc || 0}-${s.scoreOpp || 0}`,
        stats: stats.filter((st) => st.setId === s.id || (st.matchId === targetMatch.id && st.setNum === s.setNum)),
      }));
    } else {
      // Match by match across the tournament / season
      const sortedMatches = [...matches].sort((a, b) => {
        const tA = new Date(a.date || a.createdAt || 0).getTime();
        const tB = new Date(b.date || b.createdAt || 0).getTime();
        return tA - tB;
      });

      return sortedMatches.map((m, idx) => ({
        label: m.opponent ? `vs ${m.opponent}` : `M${idx + 1}`,
        subLabel: m.type || "Match",
        stats: stats.filter((st) => st.matchId === m.id),
      }));
    }
  }, [timelineScope, selectedMatchId, matches, sets, stats]);

  // Compute metrics for each point
  const seriesData = useMemo(() => {
    return timelinePoints.map((point) => {
      let filtered = point.stats;
      if (selectedPlayerId !== "team") {
        filtered = filtered.filter((s) => String(s.playerId) === String(selectedPlayerId));
      }

      let kills = 0;
      let attackErrors = 0;
      let totalAttacks = 0;
      let aces = 0;
      let serveErrors = 0;
      let totalServes = 0;
      let passSum = 0;
      let passCount = 0;
      let pointsScored = 0;

      for (const st of filtered) {
        const cat = (st.category || "").toLowerCase();
        const met = (st.metric || "").toLowerCase();
        const val = Number(st.value) || 1;

        if (cat === "attack") {
          totalAttacks += val;
          if (met === "kill" || met === "kills") {
            kills += val;
            pointsScored += val;
          } else if (met === "error" || met === "errors") {
            attackErrors += val;
          }
        } else if (cat === "serve") {
          totalServes += val;
          if (met === "ace" || met === "aces") {
            aces += val;
            pointsScored += val;
          } else if (met === "error" || met === "errors") {
            serveErrors += val;
          }
        } else if (cat === "pass" || cat === "passing" || cat === "receive") {
          let score = 2; // Default positive
          if (met === "3" || met === "perfect") score = 3;
          else if (met === "2" || met === "good") score = 2;
          else if (met === "1" || met === "poor") score = 1;
          else if (met === "0" || met === "error") score = 0;
          passSum += score * val;
          passCount += val;
        } else if (cat === "block") {
          if (met === "kill" || met === "solo" || met === "point") {
            pointsScored += val;
          }
        }
      }

      const killPct = totalAttacks > 0 ? kills / totalAttacks : 0;
      const hittingEff = totalAttacks > 0 ? (kills - attackErrors) / totalAttacks : 0;
      const acePct = totalServes > 0 ? aces / totalServes : 0;
      const serveErrorPct = totalServes > 0 ? serveErrors / totalServes : 0;
      const passAvg = passCount > 0 ? passSum / passCount : 2.0;
      const sideoutPct = totalAttacks + totalServes > 0 ? pointsScored / (totalAttacks + totalServes) : 0;

      return {
        label: point.label,
        subLabel: point.subLabel,
        totalStatsCount: filtered.length,
        values: {
          killPct,
          hittingEff,
          acePct,
          serveErrorPct,
          passAvg,
          sideoutPct,
        },
        raw: {
          kills,
          attackErrors,
          totalAttacks,
          aces,
          serveErrors,
          totalServes,
          passCount,
        },
      };
    });
  }, [timelinePoints, selectedPlayerId]);

  const toggleMetric = (key: MetricKey) => {
    setActiveMetricKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((k) => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  // Dimensions for responsive SVG chart
  const width = 800;
  const height = 300;
  const padding = { top: 30, right: 40, bottom: 40, left: 50 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6 mb-8">
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp size={22} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-wider uppercase flex items-center gap-2">
              <span>Stats Evolution & Momentum</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                Game & Tournament Trend
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Track how serving, kill %, attack efficiency, and passing evolve point-by-point or match-by-match.
            </p>
          </div>
        </div>

        {/* SCOPE TOGGLES */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold">
            <button
              type="button"
              onClick={() => setTimelineScope("match_sets")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                timelineScope === "match_sets"
                  ? "bg-white text-indigo-700 shadow-sm font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers size={14} />
              <span>Set by Set</span>
            </button>
            <button
              type="button"
              onClick={() => setTimelineScope("all_matches")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                timelineScope === "all_matches"
                  ? "bg-white text-indigo-700 shadow-sm font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar size={14} />
              <span>Match by Match</span>
            </button>
          </div>

          {timelineScope === "match_sets" && matches.length > 0 && (
            <select
              value={selectedMatchId}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.opponent ? `vs ${m.opponent}` : m.title || "Match"} {m.date ? `(${m.date})` : ""}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="team">Entire Team (Aggregate)</option>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* METRIC PILLS SELECTOR */}
      <div className="flex flex-wrap items-center gap-2 py-4">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
          <Percent size={13} />
          Metrics:
        </span>
        {METRICS.map((m) => {
          const isActive = activeMetricKeys.includes(m.key);
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => toggleMetric(m.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                isActive
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${m.color}`}></span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* SVG MOMENTUM CHART */}
      {seriesData.length < 1 ? (
        <div className="py-16 text-center text-slate-400 text-sm font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          No recorded stat events available for this selection yet. Start a game to see real-time trends!
        </div>
      ) : (
        <div className="relative">
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto min-w-[550px] overflow-visible"
            >
              {/* Background Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((tick) => {
                const y = padding.top + graphHeight * (1 - tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeWidth="1.5"
                      strokeDasharray={tick === 0 ? "none" : "4 4"}
                    />
                    <text
                      x={padding.left - 10}
                      y={y + 4}
                      fill="#94a3b8"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      {(tick * 100).toFixed(0)}%
                    </text>
                  </g>
                );
              })}

              {/* Data Series Paths */}
              {activeMetricKeys.map((metricKey) => {
                const metricConf = METRICS.find((m) => m.key === metricKey);
                if (!metricConf) return null;

                const points = seriesData.map((d, idx) => {
                  const x =
                    padding.left +
                    (seriesData.length > 1
                      ? (idx / (seriesData.length - 1)) * graphWidth
                      : graphWidth / 2);
                  const rawVal = d.values[metricKey] || 0;
                  // Clamp between -0.2 and 1.0 for rendering
                  const normalizedVal = Math.max(0, Math.min(1, rawVal));
                  const y = padding.top + graphHeight * (1 - normalizedVal);
                  return { x, y, rawVal, label: d.label };
                });

                const pathString = points.reduce((acc, p, idx) => {
                  return `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`;
                }, "");

                return (
                  <g key={metricKey}>
                    <path
                      d={pathString}
                      fill="none"
                      stroke={metricConf.stroke}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {points.map((p, pIdx) => (
                      <g key={pIdx}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="5.5"
                          fill="#ffffff"
                          stroke={metricConf.stroke}
                          strokeWidth="3"
                          className="hover:scale-125 transition-transform"
                        />
                        <text
                          x={p.x}
                          y={p.y - 10}
                          fill="#1e293b"
                          fontSize="10"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {metricConf.format(p.rawVal)}
                        </text>
                      </g>
                    ))}
                  </g>
                );
              })}

              {/* X Axis Labels */}
              {seriesData.map((d, idx) => {
                const x =
                  padding.left +
                  (seriesData.length > 1
                    ? (idx / (seriesData.length - 1)) * graphWidth
                    : graphWidth / 2);
                return (
                  <g key={idx}>
                    <text
                      x={x}
                      y={height - padding.bottom + 18}
                      fill="#334155"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {d.label}
                    </text>
                    <text
                      x={x}
                      y={height - padding.bottom + 32}
                      fill="#94a3b8"
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {d.subLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* SUMMARY STAT CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
            {METRICS.map((m) => {
              const values = seriesData.map((d) => d.values[m.key] || 0);
              const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
              const isSelected = activeMetricKeys.includes(m.key);

              return (
                <div
                  key={m.key}
                  onClick={() => toggleMetric(m.key)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-50 border-slate-300 shadow-sm ring-1 ring-slate-400"
                      : "bg-white border-slate-100 hover:border-slate-200 opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                    <span className="truncate">{m.label}</span>
                    <span className={`w-2 h-2 rounded-full ${m.color}`}></span>
                  </div>
                  <div className="text-lg font-black text-slate-900">{m.format(avg)}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">{m.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
