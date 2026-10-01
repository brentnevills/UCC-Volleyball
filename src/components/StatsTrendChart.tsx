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
  ArrowDownRight,
  Info,
  Trophy,
  Flame,
  Activity,
  CheckCircle2,
  Trash2,
} from "lucide-react";

export interface StatsTrendChartProps {
  stats: any[];
  matches: any[];
  sets: any[];
  roster: any[];
  currentMatchId?: string | null;
  currentSetId?: string | null;
  teamName?: string;
  onDeleteMatch?: (matchId: string) => void;
}

export type TimelineScope = "single_match" | "tournament_league" | "all_season";
export type Granularity = "by_rally" | "by_set" | "by_game";
export type MetricKey = "killPct" | "hittingEff" | "acePct" | "serveErrorPct" | "passAvg" | "sideoutPct";

interface MetricConfig {
  key: MetricKey;
  label: string;
  shortLabel: string;
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
    shortLabel: "Kill%",
    color: "bg-emerald-500",
    stroke: "#10b981",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    unit: "%",
    description: "Percentage of attack attempts resulting in immediate kills.",
  },
  {
    key: "hittingEff",
    label: "Swing Efficiency",
    shortLabel: "Swing Eff",
    color: "bg-blue-500",
    stroke: "#3b82f6",
    format: (v) => v.toFixed(3),
    unit: "eff",
    description: "(Kills - Attack Errors) / Total Swings (efficiency rating).",
  },
  {
    key: "acePct",
    label: "Ace %",
    shortLabel: "Ace%",
    color: "bg-amber-500",
    stroke: "#f59e0b",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    unit: "%",
    description: "Aces divided by total service attempts.",
  },
  {
    key: "serveErrorPct",
    label: "Serve Error %",
    shortLabel: "Srv Err%",
    color: "bg-rose-500",
    stroke: "#f43f5e",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    unit: "%",
    description: "Service errors per total serves. Target is <10%.",
  },
  {
    key: "passAvg",
    label: "Passing Rating (0-3)",
    shortLabel: "Pass 0-3",
    color: "bg-purple-500",
    stroke: "#a855f7",
    format: (v) => v.toFixed(2),
    unit: "pts",
    description: "Serve receive passing grade on standard 0-3 point scale.",
  },
  {
    key: "sideoutPct",
    label: "Point Conversion %",
    shortLabel: "Sideout%",
    color: "bg-indigo-500",
    stroke: "#6366f1",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    unit: "%",
    description: "Points directly won from team serves and offensive touches.",
  },
];

export const isAttackKillMetric = (met: string): boolean => {
  const m = (met || "").toLowerCase();
  return m.includes("kill");
};

export const isAttackErrorMetric = (met: string): boolean => {
  const m = (met || "").toLowerCase();
  return (
    m.includes("error") ||
    m.includes("err") ||
    m.includes("out") ||
    m.includes("net") ||
    m.includes("stuff") ||
    m.includes("antenna") ||
    m.includes("fault") ||
    m.includes("miss")
  );
};

interface RallyPoint {
  rallyNum: number;
  setNum: number;
  matchId: string;
  matchOpponent: string;
  scoringTeam: "ucc" | "opp";
  scoreUcc: number;
  scoreOpp: number;
  pointDiff: number;
  eventDescription: string;
  eventType: "kill" | "ace" | "block" | "error" | "point" | "neutral";
  playerName?: string;
  playerNumber?: string | number;
  runningKillPct: number;
  runningHittingEff: number;
  runningAcePct: number;
  runningServeErrorPct: number;
  runningPassAvg: number;
  runningSideoutPct: number;
  runningEarnedPoints: number;
  runningUnforcedErrors: number;
  runningKills: number;
  runningAttacks: number;
  runningAces: number;
  runningServes: number;
  isRunLead?: boolean;
  runCount?: number;
}

interface TournamentLeagueGroup {
  id: string;
  title: string;
  type: "Tournament" | "League Day" | "Event";
  dateFormatted: string;
  matchIds: string[];
  matchesCount: number;
  setsCount: number;
  record: { wins: number; losses: number };
  pointsScored: number;
  pointsAllowed: number;
}

export const StatsTrendChart: React.FC<StatsTrendChartProps> = ({
  stats = [],
  matches = [],
  sets = [],
  roster = [],
  currentMatchId = null,
  currentSetId = null,
  teamName = "UCC Lancers",
  onDeleteMatch,
}) => {
  // Scopes: Single Match, League Day / Tournament, All Season
  const [scope, setScope] = useState<TimelineScope>("single_match");
  
  // Granularities: By Rally / Point ("by_rally"), By Set ("by_set"), By Game / Match ("by_game")
  const [granularity, setGranularity] = useState<Granularity>("by_rally");

  // Chart Presentation Mode: "metrics" (rates) | "running_score" (dual point-by-point curves) | "momentum" (differential)
  const [chartMode, setChartMode] = useState<"running_score" | "momentum" | "metrics">("metrics");

  // Selected Match ID (for single match scope)
  const [selectedMatchId, setSelectedMatchId] = useState<string>(() => {
    if (currentMatchId) return currentMatchId;
    if (matches && matches.length > 0) return matches[matches.length - 1].id;
    return "";
  });

  // Selected Set Filter (for single match rally scope: "all" or specific set ID)
  const [selectedSetFilter, setSelectedSetFilter] = useState<string>(() => {
    if (currentSetId) return currentSetId;
    return "all";
  });

  // Selected Player ID ("team" or playerId)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("team");

  // Active Metric Keys for Rates Trend
  const [activeMetricKeys, setActiveMetricKeys] = useState<MetricKey[]>(["killPct", "hittingEff"]);

  // Hovered Rally Tooltip State
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);
  const [hoveredDiscretePoint, setHoveredDiscretePoint] = useState<any | null>(null);

  // Group Matches into League Days and Tournaments
  const tournamentGroups = useMemo<TournamentLeagueGroup[]>(() => {
    if (!matches || matches.length === 0) return [];

    const groupsMap = new Map<string, {
      title: string;
      type: "Tournament" | "League Day" | "Event";
      dateFormatted: string;
      matches: any[];
    }>();

    // Grouping strategy:
    // 1. If match has a tournament title or type === 'Tournament', group by title/type
    // 2. Otherwise group by Date (YYYY-MM-DD) as a "League Day"
    matches.forEach((m) => {
      const rawDate = m.date || m.createdAt || "";
      const dateStr = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : "Undated";
      const prettyDate = rawDate
        ? new Date(rawDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
        : "Recent";

      let key = "";
      let title = "";
      let type: "Tournament" | "League Day" | "Event" = "League Day";

      if (m.type === "Tournament" || (m.title && m.title.trim() !== "" && m.title.toLowerCase() !== "open drill")) {
        const tTitle = (m.title && m.title.trim()) || "Volleyball Tournament";
        key = `tourney_${tTitle.toLowerCase().replace(/\s+/g, "_")}`;
        title = tTitle;
        type = "Tournament";
      } else {
        key = `league_${dateStr}`;
        title = `League Day · ${prettyDate}`;
        type = "League Day";
      }

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          title,
          type,
          dateFormatted: prettyDate,
          matches: [],
        });
      }
      groupsMap.get(key)!.matches.push(m);
    });

    const result: TournamentLeagueGroup[] = [];
    groupsMap.forEach((val, id) => {
      let wins = 0;
      let losses = 0;
      let pointsScored = 0;
      let pointsAllowed = 0;
      let setsCount = 0;

      val.matches.forEach((m) => {
        const matchSets = sets.filter((s) => s.matchId === m.id);
        setsCount += matchSets.length;
        let matchSetsWonUcc = 0;
        let matchSetsWonOpp = 0;

        matchSets.forEach((s) => {
          const sU = Number(s.scoreUcc) || 0;
          const sO = Number(s.scoreOpp) || 0;
          pointsScored += sU;
          pointsAllowed += sO;
          if (sU > sO) matchSetsWonUcc++;
          else if (sO > sU) matchSetsWonOpp++;
        });

        if (matchSetsWonUcc > matchSetsWonOpp) wins++;
        else if (matchSetsWonOpp > matchSetsWonUcc) losses++;
      });

      result.push({
        id,
        title: val.title,
        type: val.type,
        dateFormatted: val.dateFormatted,
        matchIds: val.matches.map((m) => m.id),
        matchesCount: val.matches.length,
        setsCount,
        record: { wins, losses },
        pointsScored,
        pointsAllowed,
      });
    });

    return result.sort((a, b) => b.matchesCount - a.matchesCount);
  }, [matches, sets]);

  // Selected Tournament / League Day ID
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    if (tournamentGroups.length > 0) return tournamentGroups[0].id;
    return "";
  });

  const activeGroup = useMemo(() => {
    return tournamentGroups.find((g) => g.id === selectedGroupId) || tournamentGroups[0] || null;
  }, [tournamentGroups, selectedGroupId]);

  // Target Match for Single Match view
  const targetMatch = useMemo(() => {
    if (selectedMatchId) {
      const found = matches.find((m) => m.id === selectedMatchId);
      if (found) return found;
    }
    return matches[matches.length - 1] || null;
  }, [matches, selectedMatchId]);

  // Available Sets for the Target Match
  const targetMatchSets = useMemo(() => {
    if (!targetMatch) return [];
    return sets
      .filter((s) => s.matchId === targetMatch.id)
      .sort((a, b) => (a.setNum || 0) - (b.setNum || 0));
  }, [sets, targetMatch]);

  // Roster Lookup Map
  const playerMap = useMemo(() => {
    const map = new Map<string, { name: string; number: string | number }>();
    roster.forEach((p) => {
      map.set(String(p.id), { name: p.name || `Player ${p.number || ""}`, number: p.number || "" });
    });
    return map;
  }, [roster]);

  // Helper: Reconstruct Rally-by-Rally Points for a Set with Cumulative Metrics
  const buildSetRallies = (setObj: any, matchOpponentName: string): RallyPoint[] => {
    let setStats = stats.filter(
      (st) => st.setId === setObj.id || (st.matchId === setObj.matchId && st.setNum === setObj.setNum)
    );
    if (selectedPlayerId !== "team") {
      setStats = setStats.filter((st) => String(st.playerId) === String(selectedPlayerId));
    } else {
      // Team level view must strictly track our team's performance, excluding opponent logged events
      setStats = setStats.filter((st) => !st.isOpponent);
    }
    const targetUcc = Number(setObj.scoreUcc) || 0;
    const targetOpp = Number(setObj.scoreOpp) || 0;

    // Check if recorded pointHistory exists
    if (setObj.pointHistory && Array.isArray(setObj.pointHistory) && setObj.pointHistory.length > 0) {
      let cumulativeAttacks = 0;
      let cumulativeKills = 0;
      let cumulativeAttackErrors = 0;
      let cumulativeServes = 0;
      let cumulativeAces = 0;
      let cumulativeServeErrors = 0;
      let cumulativePassSum = 0;
      let cumulativePassCount = 0;
      let cumulativeStuffBlocks = 0;
      let cumulativeDigs = 0;

      const sortedSetStats = [...setStats].sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tA - tB;
      });
      let statCursor = 0;

      return setObj.pointHistory.map((pt: any, idx: number) => {
        const u = Number(pt.scoreUcc) || 0;
        const o = Number(pt.scoreOpp) || 0;
        const scoringTeam = (pt.team === "ucc" ? "ucc" : "opp") as "ucc" | "opp";

        const ptTime = pt.timestamp ? new Date(pt.timestamp).getTime() : 0;

        // Absorb all stats logged up to this point's timestamp
        while (statCursor < sortedSetStats.length) {
          const st = sortedSetStats[statCursor];
          const stTime = st.timestamp ? new Date(st.timestamp).getTime() : 0;
          if (ptTime > 0 && stTime > 0 && stTime > ptTime + 2500) {
            break;
          }
          statCursor++;

          const cat = (st.category || "").toLowerCase();
          const met = (st.metric || "").toLowerCase();
          const val = Number(st.value) || 1;

          if (cat === "attack" || cat.includes("att")) {
            cumulativeAttacks += val;
            if (isAttackKillMetric(met)) {
              cumulativeKills += val;
            } else if (isAttackErrorMetric(met)) {
              cumulativeAttackErrors += val;
            }
          } else if (cat === "serve") {
            cumulativeServes += val;
            if (met.includes("ace")) cumulativeAces += val;
            else if (met.includes("error")) cumulativeServeErrors += val;
          } else if (cat.includes("pass") || cat.includes("receive")) {
            let sc = 2;
            if (met === "3" || met.includes("perfect")) sc = 3;
            else if (met === "2" || met.includes("good")) sc = 2;
            else if (met === "1" || met.includes("poor")) sc = 1;
            else if (met === "0" || met.includes("error")) sc = 0;
            cumulativePassSum += sc * val;
            cumulativePassCount += val;
          } else if (cat === "block") {
            if (met.includes("kill") || met.includes("solo") || met.includes("point")) {
              cumulativeStuffBlocks += val;
            }
          } else if (cat === "dig") {
            cumulativeDigs += val;
          }
        }

        // Try to match a stat logged near this point for description
        const nearbyStat = sortedSetStats.find((st) => {
          if (!st.timestamp || !ptTime) return false;
          const stTime = new Date(st.timestamp).getTime();
          return Math.abs(stTime - ptTime) < 3000;
        });

        let eventType: "kill" | "ace" | "block" | "error" | "point" | "neutral" = "point";
        let eventDescription = scoringTeam === "ucc" ? `${teamName} Point` : `${matchOpponentName} Point`;
        let pName = "";
        let pNum: string | number = "";

        if (nearbyStat) {
          const cat = (nearbyStat.category || "").toLowerCase();
          const met = (nearbyStat.metric || "").toLowerCase();
          const pInfo = playerMap.get(String(nearbyStat.playerId));
          if (pInfo) {
            pName = pInfo.name;
            pNum = pInfo.number;
          }

          if (cat === "attack" || cat.includes("att")) {
            if (isAttackKillMetric(met)) {
              eventType = "kill";
              eventDescription = `Kill by #${pNum} ${pName}`;
            } else if (isAttackErrorMetric(met)) {
              eventType = "error";
              eventDescription = `Attack Error (${nearbyStat.metric || "Err"}) by #${pNum} ${pName}`;
            }
          } else if (cat === "serve" && met.includes("ace")) {
            eventType = "ace";
            eventDescription = `Service Ace by #${pNum} ${pName}`;
          } else if (cat === "serve" && met.includes("error")) {
            eventType = "error";
            eventDescription = `Service Error by #${pNum} ${pName}`;
          } else if (cat === "block" && (met.includes("kill") || met.includes("solo") || met.includes("point"))) {
            eventType = "block";
            eventDescription = `Block Kill by #${pNum} ${pName}`;
          }
        }

        const runKillPct = cumulativeAttacks > 0 ? cumulativeKills / cumulativeAttacks : 0;
        const runEff = cumulativeAttacks > 0 ? (cumulativeKills - cumulativeAttackErrors) / cumulativeAttacks : 0;
        const runAcePct = cumulativeServes > 0 ? cumulativeAces / cumulativeServes : 0;
        const runServeErrorPct = cumulativeServes > 0 ? cumulativeServeErrors / cumulativeServes : 0;
        const runPassAvg = cumulativePassCount > 0 ? cumulativePassSum / cumulativePassCount : 0;
        const runSideoutPct = u + o > 0 ? u / (u + o) : 0;
        const runEarnedPoints = cumulativeKills + cumulativeAces + cumulativeStuffBlocks;
        const runUnforcedErrors = cumulativeAttackErrors + cumulativeServeErrors;

        return {
          rallyNum: idx + 1,
          setNum: setObj.setNum || 1,
          matchId: setObj.matchId,
          matchOpponent: matchOpponentName,
          scoringTeam,
          scoreUcc: u,
          scoreOpp: o,
          pointDiff: u - o,
          eventDescription,
          eventType,
          playerName: pName,
          playerNumber: pNum,
          runningKillPct: runKillPct,
          runningHittingEff: runEff,
          runningAcePct: runAcePct,
          runningServeErrorPct: runServeErrorPct,
          runningPassAvg: runPassAvg,
          runningSideoutPct: runSideoutPct,
          runningEarnedPoints: runEarnedPoints,
          runningUnforcedErrors: runUnforcedErrors,
          runningKills: cumulativeKills,
          runningAttacks: cumulativeAttacks,
          runningAttackErrors: cumulativeAttackErrors,
          runningAces: cumulativeAces,
          runningServes: cumulativeServes,
        };
      });
    }

    // Synthesize point sequence from setStats and known final score
    const sortedStats = [...setStats].sort((a, b) => {
      const tA = new Date(a.timestamp || 0).getTime();
      const tB = new Date(b.timestamp || 0).getTime();
      return tA - tB;
    });

    const rallyList: RallyPoint[] = [];
    let curUcc = 0;
    let curOpp = 0;
    let cumulativeAttacks = 0;
    let cumulativeKills = 0;
    let cumulativeAttackErrors = 0;
    let cumulativeServes = 0;
    let cumulativeAces = 0;
    let cumulativeServeErrors = 0;
    let cumulativePassSum = 0;
    let cumulativePassCount = 0;
    let cumulativeStuffBlocks = 0;
    let cumulativeDigs = 0;

    // First, process stats that trigger points
    sortedStats.forEach((st) => {
      const cat = (st.category || "").toLowerCase();
      const met = (st.metric || "").toLowerCase();
      const val = Number(st.value) || 1;
      const pInfo = playerMap.get(String(st.playerId));
      const pName = pInfo?.name || "";
      const pNum = pInfo?.number || "";

      let pointAwardedTo: "ucc" | "opp" | null = null;
      let eventType: "kill" | "ace" | "block" | "error" | "point" | "neutral" = "neutral";
      let desc = "";

      if (cat === "attack" || cat.includes("att")) {
        cumulativeAttacks += val;
        if (isAttackKillMetric(met)) {
          cumulativeKills += val;
          pointAwardedTo = "ucc";
          eventType = "kill";
          desc = `Kill by #${pNum} ${pName}`;
        } else if (isAttackErrorMetric(met)) {
          cumulativeAttackErrors += val;
          pointAwardedTo = "opp";
          eventType = "error";
          desc = `Attack Error (${st.metric || "Err"}) by #${pNum} ${pName}`;
        }
      } else if (cat === "serve") {
        cumulativeServes += val;
        if (met.includes("ace")) {
          cumulativeAces += val;
          pointAwardedTo = "ucc";
          eventType = "ace";
          desc = `Service Ace by #${pNum} ${pName}`;
        } else if (met.includes("error")) {
          cumulativeServeErrors += val;
          pointAwardedTo = "opp";
          eventType = "error";
          desc = `Service Error by #${pNum} ${pName}`;
        }
      } else if (cat === "block") {
        if (met.includes("kill") || met.includes("solo") || met.includes("point")) {
          cumulativeStuffBlocks += val;
          pointAwardedTo = "ucc";
          eventType = "block";
          desc = `Block Kill by #${pNum} ${pName}`;
        }
      } else if (cat.includes("pass") || cat.includes("receive")) {
        let sc = 2;
        if (met === "3" || met.includes("perfect")) sc = 3;
        else if (met === "2" || met.includes("good")) sc = 2;
        else if (met === "1" || met.includes("poor")) sc = 1;
        else if (met === "0" || met.includes("error")) sc = 0;
        cumulativePassSum += sc * val;
        cumulativePassCount += val;
      } else if (cat === "dig") {
        cumulativeDigs += val;
      }

      if (pointAwardedTo) {
        if (pointAwardedTo === "ucc" && curUcc < targetUcc) curUcc++;
        else if (pointAwardedTo === "opp" && curOpp < targetOpp) curOpp++;
        else if (curUcc < targetUcc || curOpp < targetOpp) {
          if (curUcc < targetUcc) curUcc++;
          else curOpp++;
        }

        const runKillPct = cumulativeAttacks > 0 ? cumulativeKills / cumulativeAttacks : 0;
        const runEff = cumulativeAttacks > 0 ? (cumulativeKills - cumulativeAttackErrors) / cumulativeAttacks : 0;
        const runAcePct = cumulativeServes > 0 ? cumulativeAces / cumulativeServes : 0;
        const runServeErrorPct = cumulativeServes > 0 ? cumulativeServeErrors / cumulativeServes : 0;
        const runPassAvg = cumulativePassCount > 0 ? cumulativePassSum / cumulativePassCount : 0;
        const runSideoutPct = curUcc + curOpp > 0 ? curUcc / (curUcc + curOpp) : 0;
        const runEarnedPoints = cumulativeKills + cumulativeAces + cumulativeStuffBlocks;
        const runUnforcedErrors = cumulativeAttackErrors + cumulativeServeErrors;

        rallyList.push({
          rallyNum: rallyList.length + 1,
          setNum: setObj.setNum || 1,
          matchId: setObj.matchId,
          matchOpponent: matchOpponentName,
          scoringTeam: pointAwardedTo,
          scoreUcc: curUcc,
          scoreOpp: curOpp,
          pointDiff: curUcc - curOpp,
          eventDescription: desc,
          eventType,
          playerName: pName,
          playerNumber: pNum,
          runningKillPct: runKillPct,
          runningHittingEff: runEff,
          runningAcePct: runAcePct,
          runningServeErrorPct: runServeErrorPct,
          runningPassAvg: runPassAvg,
          runningSideoutPct: runSideoutPct,
          runningEarnedPoints: runEarnedPoints,
          runningUnforcedErrors: runUnforcedErrors,
          runningKills: cumulativeKills,
          runningAttacks: cumulativeAttacks,
          runningAttackErrors: cumulativeAttackErrors,
          runningAces: cumulativeAces,
          runningServes: cumulativeServes,
        });
      }
    });

    // Fill in remaining points to reach final target score smoothly
    while (curUcc < targetUcc || curOpp < targetOpp) {
      let giveUcc = false;
      if (curUcc < targetUcc && curOpp < targetOpp) {
        giveUcc = Math.random() > 0.45;
      } else if (curUcc < targetUcc) {
        giveUcc = true;
      } else {
        giveUcc = false;
      }

      if (giveUcc) curUcc++;
      else curOpp++;

      const scoringTeam = giveUcc ? "ucc" : "opp";
      const desc = giveUcc ? `${teamName} Point (Rally)` : `${matchOpponentName} Point (Rally)`;

      const runKillPct = cumulativeAttacks > 0 ? cumulativeKills / cumulativeAttacks : 0;
      const runEff = cumulativeAttacks > 0 ? (cumulativeKills - cumulativeAttackErrors) / cumulativeAttacks : 0;
      const runAcePct = cumulativeServes > 0 ? cumulativeAces / cumulativeServes : 0.08;
      const runServeErrorPct = cumulativeServes > 0 ? cumulativeServeErrors / cumulativeServes : 0.06;
      const runPassAvg = cumulativePassCount > 0 ? cumulativePassSum / cumulativePassCount : 2.15;
      const runSideoutPct = curUcc + curOpp > 0 ? curUcc / (curUcc + curOpp) : 0.55;
      const runEarnedPoints = cumulativeKills + cumulativeAces + cumulativeStuffBlocks;
      const runUnforcedErrors = cumulativeAttackErrors + cumulativeServeErrors;

      rallyList.push({
        rallyNum: rallyList.length + 1,
        setNum: setObj.setNum || 1,
        matchId: setObj.matchId,
        matchOpponent: matchOpponentName,
        scoringTeam,
        scoreUcc: curUcc,
        scoreOpp: curOpp,
        pointDiff: curUcc - curOpp,
        eventDescription: desc,
        eventType: "point",
        runningKillPct: runKillPct,
        runningHittingEff: runEff,
        runningAcePct: runAcePct,
        runningServeErrorPct: runServeErrorPct,
        runningPassAvg: runPassAvg,
        runningSideoutPct: runSideoutPct,
        runningEarnedPoints: runEarnedPoints,
        runningUnforcedErrors: runUnforcedErrors,
        runningKills: cumulativeKills,
        runningAttacks: cumulativeAttacks,
        runningAttackErrors: cumulativeAttackErrors,
        runningAces: cumulativeAces,
        runningServes: cumulativeServes,
      });
    }

    return rallyList;
  };

  // Compute Full Rally Progression Dataset
  const rallyProgressionData = useMemo<RallyPoint[]>(() => {
    if (scope === "single_match") {
      if (!targetMatch) return [];
      const oppName = targetMatch.opponent || "Opponent";
      let activeSets = targetMatchSets;
      if (selectedSetFilter !== "all") {
        activeSets = targetMatchSets.filter((s) => s.id === selectedSetFilter);
      }

      let allRallies: RallyPoint[] = [];
      activeSets.forEach((s) => {
        const setRallies = buildSetRallies(s, oppName);
        allRallies = [...allRallies, ...setRallies];
      });

      // Recalculate continuous rally numbers across all sets if viewing all
      return allRallies.map((r, i) => ({ ...r, rallyNum: i + 1 }));
    }

    if (scope === "tournament_league") {
      if (!activeGroup) return [];
      const targetMatches = matches.filter((m) => activeGroup.matchIds.includes(m.id));
      let allRallies: RallyPoint[] = [];

      targetMatches.forEach((m) => {
        const mSets = sets.filter((s) => s.matchId === m.id).sort((a, b) => (a.setNum || 0) - (b.setNum || 0));
        mSets.forEach((s) => {
          const sRallies = buildSetRallies(s, m.opponent || "Opponent");
          allRallies = [...allRallies, ...sRallies];
        });
      });

      return allRallies.map((r, i) => ({ ...r, rallyNum: i + 1 }));
    }

    // All Season By Rally
    let seasonRallies: RallyPoint[] = [];
    matches.forEach((m) => {
      const mSets = sets.filter((s) => s.matchId === m.id).sort((a, b) => (a.setNum || 0) - (b.setNum || 0));
      mSets.forEach((s) => {
        const sRallies = buildSetRallies(s, m.opponent || "Opponent");
        seasonRallies = [...seasonRallies, ...sRallies];
      });
    });

    return seasonRallies.map((r, i) => ({ ...r, rallyNum: i + 1 }));
  }, [scope, targetMatch, targetMatchSets, selectedSetFilter, activeGroup, matches, sets, stats, playerMap, teamName]);

  // Detect Scoring Runs in Rally Data
  const scoringRuns = useMemo(() => {
    if (rallyProgressionData.length < 3) return [];
    const runs: { startIdx: number; endIdx: number; team: "ucc" | "opp"; length: number }[] = [];
    let currentTeam = rallyProgressionData[0]?.scoringTeam;
    let currentRunLength = 1;
    let runStart = 0;

    for (let i = 1; i < rallyProgressionData.length; i++) {
      if (rallyProgressionData[i].scoringTeam === currentTeam) {
        currentRunLength++;
      } else {
        if (currentRunLength >= 3) {
          runs.push({
            startIdx: runStart,
            endIdx: i - 1,
            team: currentTeam,
            length: currentRunLength,
          });
        }
        currentTeam = rallyProgressionData[i].scoringTeam;
        currentRunLength = 1;
        runStart = i;
      }
    }
    if (currentRunLength >= 3) {
      runs.push({
        startIdx: runStart,
        endIdx: rallyProgressionData.length - 1,
        team: currentTeam,
        length: currentRunLength,
      });
    }
    return runs;
  }, [rallyProgressionData]);

  // Compute Discrete Game-by-Game or Set-by-Set Data Series
  const discretePoints = useMemo(() => {
    if (granularity === "by_game") {
      // Game by Game in Tournament or Season
      let targetMatches = matches;
      if (scope === "tournament_league" && activeGroup) {
        targetMatches = matches.filter((m) => activeGroup.matchIds.includes(m.id));
      }

      return targetMatches.map((m, idx) => {
        const matchSets = sets.filter((s) => s.matchId === m.id);
        let sUcc = 0;
        let sOpp = 0;
        let setsWonU = 0;
        let setsWonO = 0;
        matchSets.forEach((s) => {
          const u = Number(s.scoreUcc) || 0;
          const o = Number(s.scoreOpp) || 0;
          sUcc += u;
          sOpp += o;
          if (u > o) setsWonU++;
          else if (o > u) setsWonO++;
        });

        const mStats = stats.filter((st) => st.matchId === m.id);
        let filteredStats = mStats;
        if (selectedPlayerId !== "team") {
          filteredStats = filteredStats.filter((st) => String(st.playerId) === String(selectedPlayerId));
        }

        return {
          id: m.id,
          label: m.opponent ? `vs ${m.opponent}` : `Game ${idx + 1}`,
          subLabel: `${setsWonU}-${setsWonO} (${sUcc}-${sOpp})`,
          stats: filteredStats,
          scoreUcc: sUcc,
          scoreOpp: sOpp,
          diff: sUcc - sOpp,
        };
      });
    }

    if (granularity === "by_set") {
      // Set by Set in Single Match or Tournament
      let targetSets: any[] = [];
      if (scope === "single_match") {
        targetSets = targetMatchSets;
      } else if (scope === "tournament_league" && activeGroup) {
        const tMatchIds = activeGroup.matchIds;
        targetSets = sets.filter((s) => tMatchIds.includes(s.matchId)).sort((a, b) => (a.setNum || 0) - (b.setNum || 0));
      } else {
        targetSets = sets;
      }

      return targetSets.map((s, idx) => {
        const parentMatch = matches.find((m) => m.id === s.matchId);
        const oppName = parentMatch?.opponent || "Opp";
        const u = Number(s.scoreUcc) || 0;
        const o = Number(s.scoreOpp) || 0;

        let filteredStats = stats.filter((st) => st.setId === s.id || (st.matchId === s.matchId && st.setNum === s.setNum));
        if (selectedPlayerId !== "team") {
          filteredStats = filteredStats.filter((st) => String(st.playerId) === String(selectedPlayerId));
        } else {
          filteredStats = filteredStats.filter((st) => !st.isOpponent);
        }

        return {
          id: s.id,
          label: scope === "single_match" ? `Set ${s.setNum || idx + 1}` : `S${s.setNum || idx + 1} vs ${oppName}`,
          subLabel: `${u}-${o}`,
          stats: filteredStats,
          scoreUcc: u,
          scoreOpp: o,
          diff: u - o,
        };
      });
    }

    if (granularity === "by_rally") {
      return rallyProgressionData.map((r, idx) => ({
        id: `rally-${r.matchId}-${r.setNum}-${r.rallyNum}-${idx}`,
        label: `P${r.rallyNum}`,
        subLabel: `${r.scoreUcc}-${r.scoreOpp}`,
        stats: [],
        scoreUcc: r.scoreUcc,
        scoreOpp: r.scoreOpp,
        diff: r.pointDiff,
        eventDescription: r.eventDescription,
        precomputedMetrics: {
          killPct: r.runningKillPct,
          hittingEff: r.runningHittingEff,
          acePct: r.runningAcePct,
          serveErrorPct: r.runningServeErrorPct,
          passAvg: r.runningPassAvg,
          sideoutPct: r.runningSideoutPct,
        },
        raw: {
          kills: r.runningKills || 0,
          attackErrors: r.runningAttackErrors || 0,
          totalAttacks: r.runningAttacks || 0,
          aces: r.runningAces || 0,
          totalServes: r.runningServes || 0,
        },
        counts: {
          kills: r.runningKills,
          attacks: r.runningAttacks,
          aces: r.runningAces,
          serves: r.runningServes,
          pointsScored: r.scoreUcc,
          pointsAllowed: r.scoreOpp,
        },
      }));
    }

    return [];
  }, [granularity, scope, matches, sets, stats, activeGroup, targetMatchSets, selectedPlayerId, rallyProgressionData]);

  // Compute Metrics for Discrete Series
  const discreteSeriesData = useMemo(() => {
    return discretePoints.map((pt: any) => {
      if (pt.precomputedMetrics) {
        return {
          ...pt,
          values: pt.precomputedMetrics,
          raw: pt.raw || {
            kills: pt.counts?.kills || 0,
            attackErrors: 0,
            totalAttacks: pt.counts?.attacks || 0,
            aces: pt.counts?.aces || 0,
            totalServes: pt.counts?.serves || 0,
          },
          counts: pt.counts || {
            kills: 0,
            attacks: 0,
            aces: 0,
            serves: 0,
            pointsScored: pt.scoreUcc,
            pointsAllowed: pt.scoreOpp,
          },
        };
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

      for (const st of pt.stats) {
        const cat = (st.category || "").toLowerCase();
        const met = (st.metric || "").toLowerCase();
        const val = Number(st.value) || 1;

        if (cat === "attack" || cat.includes("att")) {
          totalAttacks += val;
          if (isAttackKillMetric(met)) {
            kills += val;
            pointsScored += val;
          } else if (isAttackErrorMetric(met)) {
            attackErrors += val;
          }
        } else if (cat === "serve") {
          totalServes += val;
          if (met.includes("ace")) {
            aces += val;
            pointsScored += val;
          } else if (met.includes("error")) {
            serveErrors += val;
          }
        } else if (cat.includes("pass") || cat.includes("receive")) {
          let score = 2;
          if (met === "3" || met === "perfect") score = 3;
          else if (met === "2" || met === "good") score = 2;
          else if (met === "1" || met === "poor") score = 1;
          else if (met === "0" || met === "error") score = 0;
          passSum += score * val;
          passCount += val;
        } else if (cat === "block") {
          if (met.includes("kill") || met.includes("solo") || met.includes("point")) {
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
        id: pt.id,
        label: pt.label,
        subLabel: pt.subLabel,
        scoreUcc: pt.scoreUcc,
        scoreOpp: pt.scoreOpp,
        diff: pt.diff,
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
  }, [discretePoints]);

  const toggleMetric = (key: MetricKey) => {
    setActiveMetricKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  // Dimensions for Chart
  const svgWidth = 900;
  const svgHeight = 340;
  const padding = { top: 35, right: 35, bottom: 45, left: 45 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Max / Min bounds for Rally Point Differential Chart
  const { maxDiff, minDiff, maxScore } = useMemo(() => {
    if (rallyProgressionData.length === 0) return { maxDiff: 5, minDiff: -5, maxScore: 25 };
    let mD = 3;
    let minD = -3;
    let mS = 25;
    rallyProgressionData.forEach((r) => {
      if (r.pointDiff > mD) mD = r.pointDiff;
      if (r.pointDiff < minD) minD = r.pointDiff;
      if (r.scoreUcc > mS) mS = r.scoreUcc;
      if (r.scoreOpp > mS) mS = r.scoreOpp;
    });
    return {
      maxDiff: Math.max(mD + 2, 4),
      minDiff: Math.min(minD - 2, -4),
      maxScore: mS + 2,
    };
  }, [rallyProgressionData]);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6 mb-8 transition-all">
      {/* HEADER & SCOPE SELECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <TrendingUp size={18} />
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Performance Progression & Momentum
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 uppercase tracking-wider">
              {granularity === "by_rally" ? "Rally-by-Rally" : granularity === "by_set" ? "Set-by-Set" : "Game-by-Game"}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Track point progression, lead changes, scoring runs, and attack metrics across games, sets, and tournaments.
          </p>
        </div>

        {/* PRIMARY SCOPE CONTROLS (Single Match vs League Day / Tournament vs Season) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setScope("single_match");
                setGranularity("by_rally");
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                scope === "single_match"
                  ? "bg-white text-indigo-700 shadow-sm font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Zap size={14} />
              <span>Single Match</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setScope("tournament_league");
                setGranularity("by_game");
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                scope === "tournament_league"
                  ? "bg-white text-indigo-700 shadow-sm font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Trophy size={14} />
              <span>League Day / Tourney</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setScope("all_season");
                setGranularity("by_game");
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                scope === "all_season"
                  ? "bg-white text-indigo-700 shadow-sm font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar size={14} />
              <span>Full Season</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECONDARY FILTER BAR: GRANULARITY & TOURNAMENT/MATCH SELECTORS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-3 border-b border-slate-100 bg-slate-50/50 -mx-4 sm:-mx-6 px-4 sm:px-6">
        {/* Granularity Switcher */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Activity size={12} />
            Progression:
          </span>
          <div className="bg-white border border-slate-200 p-0.5 rounded-lg flex items-center text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => setGranularity("by_rally")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                granularity === "by_rally"
                  ? "bg-indigo-600 text-white font-black shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Zap size={13} />
              <span>Point by Point</span>
            </button>
            <button
              type="button"
              onClick={() => setGranularity("by_set")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                granularity === "by_set"
                  ? "bg-indigo-600 text-white font-black shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers size={13} />
              <span>Set by Set</span>
            </button>
            {scope !== "single_match" && (
              <button
                type="button"
                onClick={() => setGranularity("by_game")}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  granularity === "by_game"
                    ? "bg-indigo-600 text-white font-black shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BarChart3 size={13} />
                <span>Game by Game</span>
              </button>
            )}
          </div>

          {/* Mode Switcher for Point by Point */}
          {granularity === "by_rally" ? (
            <div className="flex items-center gap-1 ml-2 border-l border-slate-200 pl-2">
              <button
                type="button"
                onClick={() => setChartMode("running_score")}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  chartMode === "running_score" ? "bg-slate-900 text-white font-black shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Dual Score Lines
              </button>
              <button
                type="button"
                onClick={() => setChartMode("momentum")}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  chartMode === "momentum" ? "bg-slate-900 text-white font-black shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Lead Margin (+/-)
              </button>
              <button
                type="button"
                onClick={() => setChartMode("metrics")}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  chartMode === "metrics" ? "bg-slate-900 text-white font-black shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Stats Evolution
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 ml-2 border-l border-slate-200 pl-2">
              <button
                type="button"
                onClick={() => setChartMode("momentum")}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  chartMode === "momentum" ? "bg-slate-900 text-white font-black shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Point Diff
              </button>
              <button
                type="button"
                onClick={() => setChartMode("metrics")}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  chartMode === "metrics" ? "bg-slate-900 text-white font-black shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Stats Evolution
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Context Selector: Tournament or Match */}
        <div className="flex flex-wrap items-center gap-2">
          {scope === "tournament_league" && tournamentGroups.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Trophy size={14} className="text-amber-500 shrink-0" />
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              >
                {tournamentGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} ({g.matchesCount} Games, {g.setsCount} Sets · {g.record.wins}W-{g.record.losses}L)
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === "single_match" && matches.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedMatchId}
                onChange={(e) => {
                  setSelectedMatchId(e.target.value);
                  setSelectedSetFilter("all");
                }}
                className="bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              >
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.opponent ? `vs ${m.opponent}` : m.title || "Match"} {m.date ? `(${new Date(m.date).toLocaleDateString()})` : ""}
                  </option>
                ))}
              </select>

              {targetMatch && onDeleteMatch && (
                <button
                  type="button"
                  onClick={() => onDeleteMatch(targetMatch.id)}
                  className="px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  title={`Delete game vs ${targetMatch.opponent}`}
                >
                  <Trash2 size={13} className="text-rose-600" />
                  <span className="hidden sm:inline">Delete Game</span>
                </button>
              )}
            </div>
          )}

          {/* Set Selector when in single match rally mode */}
          {scope === "single_match" && granularity === "by_rally" && targetMatchSets.length > 1 && (
            <select
              value={selectedSetFilter}
              onChange={(e) => setSelectedSetFilter(e.target.value)}
              className="bg-white border border-slate-200 text-indigo-700 text-xs rounded-xl px-2 py-1.5 font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            >
              <option value="all">Continuous Match Flow</option>
              {targetMatchSets.map((s) => (
                <option key={s.id} value={s.id}>
                  Set {s.setNum || 1} ({s.scoreUcc || 0}-{s.scoreOpp || 0})
                </option>
              ))}
            </select>
          )}

          {/* Player Filter */}
          <select
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          >
            <option value="team">Team Combined</option>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TOURNAMENT / LEAGUE SUMMARY BAR (if active) */}
      {scope === "tournament_league" && activeGroup && (
        <div className="my-4 p-3 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-amber-50/50 rounded-xl border border-indigo-100/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900 text-sm">{activeGroup.title}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600 font-bold">{activeGroup.dateFormatted}</span>
            <span className="text-slate-400">·</span>
            <span className="font-black text-indigo-700">{activeGroup.record.wins} Wins - {activeGroup.record.losses} Losses</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600">
            <span><strong>{activeGroup.matchesCount}</strong> Games</span>
            <span><strong>{activeGroup.setsCount}</strong> Sets</span>
            <span>Total Points: <strong>{activeGroup.pointsScored}</strong> - <strong>{activeGroup.pointsAllowed}</strong> ({activeGroup.pointsScored - activeGroup.pointsAllowed >= 0 ? "+" : ""}{activeGroup.pointsScored - activeGroup.pointsAllowed})</span>
          </div>
        </div>
      )}

      {/* METRIC PILLS (When chartMode is "metrics") */}
      {chartMode === "metrics" && (
        <div className="flex flex-wrap items-center gap-2 py-3">
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
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
      )}

      {/* MAIN CHART CONTAINER */}
      <div className="mt-4 relative">
        {/* CASE 0: POINT-BY-POINT DUAL SCORE LINES (Both teams rising 0 to 25) */}
        {granularity === "by_rally" && chartMode === "running_score" && (
          <div>
            {rallyProgressionData.length < 2 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No rally points recorded yet for this selection. Start a set or match to see live point-by-point progression!
              </div>
            ) : (
              <div className="relative">
                {/* Score Header & Legend */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 mb-2 text-xs border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 font-black text-slate-800">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-2xs"></span>
                      <span>{teamName}</span>
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-xs font-mono font-black">
                        {rallyProgressionData[rallyProgressionData.length - 1]?.scoreUcc || 0} pts
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 font-black text-slate-800">
                      <span className="w-3 h-3 rounded-full bg-rose-500 inline-block shadow-2xs"></span>
                      <span>{rallyProgressionData[0]?.matchOpponent || "Opponent"}</span>
                      <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md text-xs font-mono font-black">
                        {rallyProgressionData[rallyProgressionData.length - 1]?.scoreOpp || 0} pts
                      </span>
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold hidden sm:block">
                    Hover points to view rally events and scoring transitions
                  </div>
                </div>

                {/* SVG Dual Score Lines Chart */}
                <div className="w-full overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-auto min-w-[650px] overflow-visible select-none"
                  >
                    {/* Horizontal Score Grid Lines */}
                    {[0, 5, 10, 15, 20, 25].filter((v) => v <= maxScore).map((scoreVal) => {
                      const y = padding.top + ((maxScore - scoreVal) / maxScore) * graphHeight;
                      return (
                        <g key={scoreVal}>
                          <line
                            x1={padding.left}
                            y1={y}
                            x2={svgWidth - padding.right}
                            y2={y}
                            stroke="#f1f5f9"
                            strokeWidth="1.5"
                            strokeDasharray={scoreVal === 0 ? "none" : "3 3"}
                          />
                          <text
                            x={padding.left - 8}
                            y={y + 3}
                            fill="#94a3b8"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="end"
                          >
                            {scoreVal}
                          </text>
                        </g>
                      );
                    })}

                    {/* Set Benchmark Line (25 pts) */}
                    {maxScore >= 25 && (() => {
                      const y25 = padding.top + ((maxScore - 25) / maxScore) * graphHeight;
                      return (
                        <g>
                          <line
                            x1={padding.left}
                            y1={y25}
                            x2={svgWidth - padding.right}
                            y2={y25}
                            stroke="#cbd5e1"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                          <text
                            x={svgWidth - padding.right + 6}
                            y={y25 + 3}
                            fill="#94a3b8"
                            fontSize="9"
                            fontWeight="bold"
                          >
                            Set Point (25)
                          </text>
                        </g>
                      );
                    })()}

                    {/* UCC Score Line (Emerald) */}
                    {(() => {
                      const points = rallyProgressionData.map((pt, idx) => {
                        const x = padding.left + (idx / (rallyProgressionData.length - 1)) * graphWidth;
                        const y = padding.top + ((maxScore - pt.scoreUcc) / maxScore) * graphHeight;
                        return { x, y, pt, idx };
                      });
                      const pathStr = points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
                      return (
                        <g>
                          <path
                            d={pathStr}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {points.map((p, idx) => {
                            const didScore = p.pt.scoringTeam === "ucc";
                            return (
                              <g
                                key={`ucc_${idx}`}
                                onMouseEnter={() => setHoveredPoint(p.pt)}
                                onMouseLeave={() => setHoveredPoint(null)}
                                className="cursor-pointer"
                              >
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={didScore ? 4.5 : 2}
                                  fill={didScore ? "#10b981" : "#ffffff"}
                                  stroke="#10b981"
                                  strokeWidth="2"
                                  className="hover:scale-150 transition-transform"
                                />
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}

                    {/* Opponent Score Line (Rose) */}
                    {(() => {
                      const points = rallyProgressionData.map((pt, idx) => {
                        const x = padding.left + (idx / (rallyProgressionData.length - 1)) * graphWidth;
                        const y = padding.top + ((maxScore - pt.scoreOpp) / maxScore) * graphHeight;
                        return { x, y, pt, idx };
                      });
                      const pathStr = points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
                      return (
                        <g>
                          <path
                            d={pathStr}
                            fill="none"
                            stroke="#f43f5e"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="5 3"
                          />
                          {points.map((p, idx) => {
                            const didScore = p.pt.scoringTeam === "opp";
                            return (
                              <g
                                key={`opp_${idx}`}
                                onMouseEnter={() => setHoveredPoint(p.pt)}
                                onMouseLeave={() => setHoveredPoint(null)}
                                className="cursor-pointer"
                              >
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={didScore ? 4 : 2}
                                  fill={didScore ? "#f43f5e" : "#ffffff"}
                                  stroke="#f43f5e"
                                  strokeWidth="2"
                                  className="hover:scale-150 transition-transform"
                                />
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}

                    {/* X Axis Labels */}
                    {rallyProgressionData.map((pt, idx) => {
                      const totalPts = rallyProgressionData.length;
                      const step = Math.max(1, Math.floor(totalPts / 8));
                      if (idx % step !== 0 && idx !== totalPts - 1) return null;

                      const x = padding.left + (idx / (totalPts - 1)) * graphWidth;
                      return (
                        <g key={idx}>
                          <line
                            x1={x}
                            y1={svgHeight - padding.bottom}
                            x2={x}
                            y2={svgHeight - padding.bottom + 5}
                            stroke="#cbd5e1"
                            strokeWidth="1"
                          />
                          <text
                            x={x}
                            y={svgHeight - padding.bottom + 18}
                            fill="#475569"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            Pt {pt.rallyNum}
                          </text>
                          <text
                            x={x}
                            y={svgHeight - padding.bottom + 30}
                            fill="#94a3b8"
                            fontSize="9"
                            textAnchor="middle"
                          >
                            {pt.scoreUcc}-{pt.scoreOpp}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Hover Tooltip Popup */}
                {hoveredPoint && (
                  <div className="absolute top-2 right-4 bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-xs backdrop-blur-sm border border-slate-700 pointer-events-none z-20 min-w-[220px]">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5 mb-1.5">
                      <span className="font-black text-amber-400">Point #{hoveredPoint.rallyNum}</span>
                      <span className="text-[10px] text-slate-300">Set {hoveredPoint.setNum}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-black mb-1">
                      <span className="text-emerald-400">{teamName}: {hoveredPoint.scoreUcc}</span>
                      <span className="text-slate-400">vs</span>
                      <span className="text-rose-400">{hoveredPoint.matchOpponent}: {hoveredPoint.scoreOpp}</span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-200 mb-1">
                      {hoveredPoint.scoringTeam === "ucc" ? `Point to ${teamName}` : `Point to ${hoveredPoint.matchOpponent}`}
                    </div>
                    {hoveredPoint.eventDescription && (
                      <div className="text-[10px] text-amber-300/90 font-mono mb-2 bg-slate-800/80 px-2 py-1 rounded">
                        {hoveredPoint.eventDescription}
                      </div>
                    )}

                    {/* Point-by-Point Key Stat Metrics Log */}
                    <div className="border-t border-slate-800 pt-1.5 mt-1 space-y-1 text-[10px]">
                      <div className="text-[9px] font-black uppercase text-amber-400/90 tracking-wider">
                        Evolved Metrics at Pt #{hoveredPoint.rallyNum}:
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Kill %:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {(hoveredPoint.runningKillPct * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Hitting Eff:</span>
                          <span className="font-mono font-bold text-blue-400">
                            {hoveredPoint.runningHittingEff.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Passing:</span>
                          <span className="font-mono font-bold text-purple-400">
                            {hoveredPoint.runningPassAvg > 0 ? `${hoveredPoint.runningPassAvg.toFixed(2)}/3` : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Ace %:</span>
                          <span className="font-mono font-bold text-amber-400">
                            {(hoveredPoint.runningAcePct * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Srv Err%:</span>
                          <span className="font-mono font-bold text-rose-400">
                            {(hoveredPoint.runningServeErrorPct * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Sideout%:</span>
                          <span className="font-mono font-bold text-indigo-400">
                            {(hoveredPoint.runningSideoutPct * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CASE 1: RALLY-BY-RALLY PROGRESSION (MOMENTUM CURVE) */}
        {granularity === "by_rally" && chartMode === "momentum" && (
          <div>
            {rallyProgressionData.length < 2 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No rally points recorded yet for this selection. Start a set to watch live point-by-point momentum!
              </div>
            ) : (
              <div className="relative">
                {/* Scoring Runs Highlight Bar */}
                {scoringRuns.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 text-xs">
                    <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1 shrink-0">
                      <Flame size={12} className="text-amber-500" />
                      Key Runs:
                    </span>
                    {scoringRuns.slice(0, 6).map((run, rIdx) => (
                      <span
                        key={rIdx}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap border ${
                          run.team === "ucc"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}
                      >
                        {run.team === "ucc" ? teamName : "Opp"} {run.length}-0 Run (Rally {run.startIdx + 1}-{run.endIdx + 1})
                      </span>
                    ))}
                  </div>
                )}

                {/* SVG Point Differential & Lead Curve */}
                <div className="w-full overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-auto min-w-[650px] overflow-visible select-none"
                  >
                    {/* Background Gradients */}
                    <defs>
                      <linearGradient id="uccLeadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="oppLeadGradient" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Zero Line (Even Score) */}
                    {(() => {
                      const zeroY = padding.top + (maxDiff / (maxDiff - minDiff)) * graphHeight;
                      return (
                        <g>
                          <line
                            x1={padding.left}
                            y1={zeroY}
                            x2={svgWidth - padding.right}
                            y2={zeroY}
                            stroke="#94a3b8"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={padding.left - 8}
                            y={zeroY + 4}
                            fill="#64748b"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="end"
                          >
                            Tied (0)
                          </text>
                        </g>
                      );
                    })()}

                    {/* Horizontal Lead Grid Guides */}
                    {[maxDiff, Math.round(maxDiff / 2), Math.round(minDiff / 2), minDiff].map((diffVal, i) => {
                      if (diffVal === 0) return null;
                      const y = padding.top + ((maxDiff - diffVal) / (maxDiff - minDiff)) * graphHeight;
                      return (
                        <g key={i}>
                          <line
                            x1={padding.left}
                            y1={y}
                            x2={svgWidth - padding.right}
                            y2={y}
                            stroke="#f1f5f9"
                            strokeWidth="1"
                          />
                          <text
                            x={padding.left - 8}
                            y={y + 3}
                            fill={diffVal > 0 ? "#10b981" : "#f43f5e"}
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="end"
                          >
                            {diffVal > 0 ? `+${diffVal}` : diffVal}
                          </text>
                        </g>
                      );
                    })}

                    {/* Area under curve for UCC Lead */}
                    {(() => {
                      const zeroY = padding.top + (maxDiff / (maxDiff - minDiff)) * graphHeight;
                      const points = rallyProgressionData.map((pt, idx) => {
                        const x = padding.left + (idx / (rallyProgressionData.length - 1)) * graphWidth;
                        const y = padding.top + ((maxDiff - pt.pointDiff) / (maxDiff - minDiff)) * graphHeight;
                        return { x, y };
                      });

                      const pathStr = points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
                      const areaStr = `${pathStr} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`;

                      return (
                        <path
                          d={areaStr}
                          fill="url(#uccLeadGradient)"
                          className="opacity-70 pointer-events-none"
                        />
                      );
                    })()}

                    {/* Main Momentum Line */}
                    {(() => {
                      const points = rallyProgressionData.map((pt, idx) => {
                        const x = padding.left + (idx / (rallyProgressionData.length - 1)) * graphWidth;
                        const y = padding.top + ((maxDiff - pt.pointDiff) / (maxDiff - minDiff)) * graphHeight;
                        return { x, y, pt, idx };
                      });

                      const pathStr = points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");

                      return (
                        <g>
                          <path
                            d={pathStr}
                            fill="none"
                            stroke="#4f46e5"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* Individual Rally Dots */}
                          {points.map((p, idx) => {
                            const isUcc = p.pt.scoringTeam === "ucc";
                            const isKey = p.pt.eventType === "kill" || p.pt.eventType === "ace" || p.pt.eventType === "block";
                            return (
                              <g
                                key={idx}
                                onMouseEnter={() => setHoveredPoint(p.pt)}
                                onMouseLeave={() => setHoveredPoint(null)}
                                className="cursor-pointer"
                              >
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={isKey ? 5 : 3}
                                  fill={isUcc ? "#10b981" : "#f43f5e"}
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                  className="transition-transform hover:scale-150"
                                />
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}

                    {/* X Axis Labels */}
                    {rallyProgressionData.map((pt, idx) => {
                      const totalPts = rallyProgressionData.length;
                      // Display ~8-10 evenly spaced x-axis labels
                      const step = Math.max(1, Math.floor(totalPts / 8));
                      if (idx % step !== 0 && idx !== totalPts - 1) return null;

                      const x = padding.left + (idx / (totalPts - 1)) * graphWidth;
                      return (
                        <g key={idx}>
                          <line
                            x1={x}
                            y1={svgHeight - padding.bottom}
                            x2={x}
                            y2={svgHeight - padding.bottom + 5}
                            stroke="#cbd5e1"
                            strokeWidth="1"
                          />
                          <text
                            x={x}
                            y={svgHeight - padding.bottom + 18}
                            fill="#475569"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            Rally {pt.rallyNum}
                          </text>
                          <text
                            x={x}
                            y={svgHeight - padding.bottom + 30}
                            fill="#94a3b8"
                            fontSize="9"
                            textAnchor="middle"
                          >
                            {pt.scoreUcc}-{pt.scoreOpp}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Hover Tooltip Popup */}
                {hoveredPoint && (
                  <div className="absolute top-2 right-4 bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-xs backdrop-blur-sm border border-slate-700 pointer-events-none z-20 min-w-[220px]">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5 mb-1.5">
                      <span className="font-black text-amber-400">Rally #{hoveredPoint.rallyNum}</span>
                      <span className="text-[10px] text-slate-300">Set {hoveredPoint.setNum}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-black mb-1">
                      <span className="text-emerald-400">{teamName}: {hoveredPoint.scoreUcc}</span>
                      <span className="text-slate-400">vs</span>
                      <span className="text-rose-400">{hoveredPoint.matchOpponent}: {hoveredPoint.scoreOpp}</span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-200 mb-1">
                      {hoveredPoint.scoringTeam === "ucc" ? `Point ${teamName}` : `Point ${hoveredPoint.matchOpponent}`}
                    </div>
                    {hoveredPoint.eventDescription && (
                      <div className="text-[10px] text-amber-300/90 font-mono mb-2 bg-slate-800/80 px-2 py-1 rounded">
                        {hoveredPoint.eventDescription}
                      </div>
                    )}

                    {/* Point-by-Point Key Stat Metrics Log */}
                    <div className="border-t border-slate-800 pt-1.5 mt-1 space-y-1 text-[10px]">
                      <div className="text-[9px] font-black uppercase text-amber-400/90 tracking-wider">
                        Evolved Metrics at Rally #{hoveredPoint.rallyNum}:
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Kill %:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {(hoveredPoint.runningKillPct * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Hitting Eff:</span>
                          <span className="font-mono font-bold text-blue-400">
                            {hoveredPoint.runningHittingEff.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Passing:</span>
                          <span className="font-mono font-bold text-purple-400">
                            {hoveredPoint.runningPassAvg > 0 ? `${hoveredPoint.runningPassAvg.toFixed(2)}/3` : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Ace %:</span>
                          <span className="font-mono font-bold text-amber-400">
                            {(hoveredPoint.runningAcePct * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Srv Err%:</span>
                          <span className="font-mono font-bold text-rose-400">
                            {(hoveredPoint.runningServeErrorPct * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Sideout%:</span>
                          <span className="font-mono font-bold text-indigo-400">
                            {(hoveredPoint.runningSideoutPct * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CASE 2: DISCRETE SERIES CHART (BY SET OR BY GAME OR METRICS RATE) */}
        {(granularity !== "by_rally" || chartMode === "metrics") && (
          <div>
            {discreteSeriesData.length === 0 && rallyProgressionData.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No comparative data available for this selection. Record stats or complete games to see trends.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto min-w-[650px] overflow-visible select-none"
                >
                  {/* Grid Lines (-25% to 100%) */}
                  {[-0.25, 0, 0.25, 0.5, 0.75, 1.0].map((tick) => {
                    const norm = (tick - (-0.25)) / 1.25;
                    const y = padding.top + graphHeight * (1 - norm);
                    const isZeroLine = Math.abs(tick) < 0.001;
                    return (
                      <g key={tick}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={svgWidth - padding.right}
                          y2={y}
                          stroke={isZeroLine ? "#94a3b8" : "#f1f5f9"}
                          strokeWidth={isZeroLine ? "1.5" : "1"}
                          strokeDasharray={isZeroLine ? "none" : "4 4"}
                        />
                        <text
                          x={padding.left - 8}
                          y={y + 3}
                          fill={isZeroLine ? "#334155" : "#94a3b8"}
                          fontSize="9"
                          fontWeight={isZeroLine ? "black" : "bold"}
                          textAnchor="end"
                        >
                          {(tick * 100).toFixed(0)}%
                        </text>
                      </g>
                    );
                  })}

                  {/* Render Data Series */}
                  {activeMetricKeys.map((metricKey) => {
                    const metricConf = METRICS.find((m) => m.key === metricKey);
                    if (!metricConf) return null;

                    const dataItems = discreteSeriesData.length > 0 ? discreteSeriesData : [];
                    if (dataItems.length === 0) return null;

                    const points = dataItems.map((d, idx) => {
                      const x =
                        padding.left +
                        (dataItems.length > 1
                          ? (idx / (dataItems.length - 1)) * graphWidth
                          : graphWidth / 2);
                      const rawVal = d.values[metricKey] || 0;
                      const scaledVal = metricKey === "passAvg" ? rawVal / 3 : rawVal;
                      const normVal = Math.max(-0.25, Math.min(1.0, scaledVal));
                      const normRatio = (normVal - (-0.25)) / 1.25;
                      const y = padding.top + graphHeight * (1 - normRatio);
                      return { x, y, rawVal, label: d.label };
                    });

                    const pathStr = points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");

                    return (
                      <g key={metricKey}>
                        <path
                          d={pathStr}
                          fill="none"
                          stroke={metricConf.stroke}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {points.map((p, pIdx) => {
                          const isHovered =
                            hoveredDiscretePoint?.pointId === dataItems[pIdx]?.id &&
                            hoveredDiscretePoint?.metricKey === metricKey;
                          const showText = dataItems.length <= 14 || isHovered;
                          return (
                            <g
                              key={pIdx}
                              onMouseEnter={() =>
                                setHoveredDiscretePoint({
                                  pointId: dataItems[pIdx]?.id,
                                  label: dataItems[pIdx]?.label,
                                  subLabel: dataItems[pIdx]?.subLabel,
                                  metricKey,
                                  metricLabel: metricConf.label,
                                  formatVal: metricConf.format(p.rawVal),
                                  rawVal: p.rawVal,
                                  eventDescription: dataItems[pIdx]?.eventDescription,
                                  allValues: dataItems[pIdx]?.values,
                                  counts: dataItems[pIdx]?.counts,
                                  raw: dataItems[pIdx]?.raw,
                                })
                              }
                              onMouseLeave={() => setHoveredDiscretePoint(null)}
                              className="cursor-pointer"
                            >
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={isHovered ? 7 : dataItems.length > 25 ? 3.5 : 5}
                                fill={isHovered ? metricConf.stroke : "#ffffff"}
                                stroke={metricConf.stroke}
                                strokeWidth={isHovered ? 3 : 2}
                                className="transition-all"
                              />
                              {showText && (
                                <text
                                  x={p.x}
                                  y={p.y - (isHovered ? 12 : 8)}
                                  fill={isHovered ? metricConf.stroke : "#1e293b"}
                                  fontSize={isHovered ? "11" : "9"}
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  {metricConf.format(p.rawVal)}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* X Axis Labels */}
                  {discreteSeriesData.map((d, idx) => {
                    const totalDiscrete = discreteSeriesData.length;
                    const step = totalDiscrete > 25 ? Math.ceil(totalDiscrete / 10) : totalDiscrete > 14 ? 2 : 1;
                    if (idx !== 0 && idx !== totalDiscrete - 1 && idx % step !== 0) return null;

                    const x =
                      padding.left +
                      (totalDiscrete > 1
                        ? (idx / (totalDiscrete - 1)) * graphWidth
                        : graphWidth / 2);
                    return (
                      <g key={idx}>
                        <text
                          x={x}
                          y={svgHeight - padding.bottom + 18}
                          fill="#334155"
                          fontSize="10"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {d.label}
                        </text>
                        <text
                          x={x}
                          y={svgHeight - padding.bottom + 30}
                          fill="#94a3b8"
                          fontSize="8"
                          fontWeight="600"
                          textAnchor="middle"
                        >
                          {d.subLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Discrete Metric Hover Tooltip */}
                {hoveredDiscretePoint && (
                  <div className="absolute top-2 right-4 bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-xs backdrop-blur-sm border border-slate-700 pointer-events-none z-20 min-w-[220px]">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5 mb-1.5">
                      <span className="font-black text-amber-400">{hoveredDiscretePoint.label}</span>
                      <span className="text-[10px] text-slate-300">{hoveredDiscretePoint.subLabel}</span>
                    </div>
                    <div className="text-[11px] font-bold text-white mb-1">
                      <span className="text-slate-300">{hoveredDiscretePoint.metricLabel}: </span>
                      <span className="font-black text-amber-300 font-mono">{hoveredDiscretePoint.formatVal}</span>
                    </div>
                    {hoveredDiscretePoint.eventDescription && (
                      <div className="text-[10px] text-slate-300 bg-slate-800/80 px-2 py-1 rounded font-mono mb-2">
                        {hoveredDiscretePoint.eventDescription}
                      </div>
                    )}
                    {hoveredDiscretePoint.allValues && (
                      <div className="border-t border-slate-800 pt-1.5 space-y-0.5 text-[9px] text-slate-400">
                        {METRICS.filter((m) => m.key !== hoveredDiscretePoint.metricKey).map((m) => (
                          <div key={m.key} className="flex justify-between">
                            <span>{m.shortLabel}:</span>
                            <span className="text-slate-200 font-mono font-bold">
                              {m.format(hoveredDiscretePoint.allValues[m.key] || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {hoveredDiscretePoint.raw && hoveredDiscretePoint.raw.totalAttacks > 0 && (
                      <div className="border-t border-slate-800 pt-1 mt-1 text-[9px] text-slate-300 font-mono flex items-center justify-between">
                        <span className="text-slate-400">Attacks:</span>
                        <span>{hoveredDiscretePoint.raw.totalAttacks} (K:{hoveredDiscretePoint.raw.kills} E:{hoveredDiscretePoint.raw.attackErrors})</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-100">
        {METRICS.map((m) => {
          const values = discreteSeriesData.map((d) => d.values[m.key] || 0);
          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          const isSelected = activeMetricKeys.includes(m.key);

          return (
            <div
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? "bg-slate-50 border-slate-300 shadow-xs ring-1 ring-slate-400"
                  : "bg-white border-slate-100 hover:border-slate-200 opacity-80"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                <span className="truncate">{m.label}</span>
                <span className={`w-2 h-2 rounded-full ${m.color}`}></span>
              </div>
              <div className="text-lg font-black text-slate-900 tabular-nums">{m.format(avg)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{m.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
