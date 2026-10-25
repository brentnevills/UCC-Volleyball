import React, { useState, useMemo } from "react";
import {
  X,
  Trophy,
  Calendar,
  Search,
  Filter,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Share2,
  Check,
  TrendingUp,
  Activity,
  Shield,
  Layers,
  ArrowUpDown,
  ExternalLink,
  Edit3,
  Award,
  Play,
  RotateCcw,
} from "lucide-react";

export interface SeasonHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: any[];
  sets: any[];
  stats?: any[];
  roster?: any[];
  ourTeamName: string;
  onSelectMatch: (match: any) => void;
  onEditSetScore?: (set: any, match: any) => void;
  onStartNewMatch?: () => void;
}

export const SeasonHistoryModal: React.FC<SeasonHistoryModalProps> = ({
  isOpen,
  onClose,
  matches = [],
  sets = [],
  stats = [],
  roster = [],
  ourTeamName,
  onSelectMatch,
  onEditSetScore,
  onStartNewMatch,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOutcome, setFilterOutcome] = useState<"all" | "wins" | "losses" | "tournaments" | "scrimmages">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "points">("newest");
  const [copiedMatchId, setCopiedMatchId] = useState<string | null>(null);
  const [copiedSeasonSummary, setCopiedSeasonSummary] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const effectiveOurName = ourTeamName || "Lancers";

  // Filter out practice sessions from official season game records
  const gameMatches = useMemo(() => {
    return (matches || []).filter((m) => m && m.type !== "Practice");
  }, [matches]);

  // Compute game summary details for each match
  const processedMatches = useMemo(() => {
    return gameMatches.map((match) => {
      const matchSets = (sets || [])
        .filter((s) => s.matchId === match.id)
        .sort((a, b) => (a.setNum || 0) - (b.setNum || 0));

      let uccSetsWon = 0;
      let oppSetsWon = 0;
      let uccTotalPoints = 0;
      let oppTotalPoints = 0;

      matchSets.forEach((s) => {
        const uScore = Number(s.scoreUcc) || 0;
        const oScore = Number(s.scoreOpp) || 0;
        uccTotalPoints += uScore;
        oppTotalPoints += oScore;

        if (uScore > oScore) {
          uccSetsWon++;
        } else if (oScore > uScore) {
          oppSetsWon++;
        }
      });

      // Prefer finalSetsWon if set on match record
      if (match.finalSetsWon && typeof match.finalSetsWon.ucc === "number") {
        uccSetsWon = match.finalSetsWon.ucc;
        oppSetsWon = match.finalSetsWon.opp;
      }

      const isLive = match.isLive === true;
      let outcome: "win" | "loss" | "tie" | "live" = "tie";

      if (isLive) {
        outcome = "live";
      } else if (uccSetsWon > oppSetsWon) {
        outcome = "win";
      } else if (oppSetsWon > uccSetsWon) {
        outcome = "loss";
      } else {
        outcome = "tie";
      }

      // Compute quick match stat leaders if stats exist
      const matchStats = (stats || []).filter((s) => s.matchId === match.id);
      let matchKills = 0;
      let matchAces = 0;
      let matchBlocks = 0;
      let matchDigs = 0;
      const playerKillCounts: Record<string, number> = {};

      matchStats.forEach((s) => {
        if (!s.isOpponent && !s.isOpp) {
          if (s.category === "Attack" && s.metric === "Kill") {
            matchKills++;
            if (s.playerId) {
              playerKillCounts[s.playerId] = (playerKillCounts[s.playerId] || 0) + 1;
            }
          } else if (s.category === "Serve" && (s.metric === "Ace" || s.isAce)) {
            matchAces++;
          } else if (s.category === "Block" && (s.metric === "Block" || s.metric === "Stuffed" || s.metric === "Stuff")) {
            matchBlocks += Number(s.value) || 1;
          } else if (s.category === "Dig" && s.metric === "Dig") {
            matchDigs++;
          }
        }
      });

      let topKillPlayer = "";
      let topKillCount = 0;
      Object.entries(playerKillCounts).forEach(([pId, count]) => {
        if (count > topKillCount) {
          topKillCount = count;
          const found = (roster || []).find((p) => p.id === pId);
          topKillPlayer = found ? (found.number ? `#${found.number} ${found.name}` : found.name) : "Player";
        }
      });

      const matchDateObj = match.date ? new Date(match.date) : null;
      const formattedDate = matchDateObj && !isNaN(matchDateObj.getTime())
        ? matchDateObj.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Date Unknown";

      return {
        ...match,
        matchSets,
        uccSetsWon,
        oppSetsWon,
        uccTotalPoints,
        oppTotalPoints,
        pointDifferential: uccTotalPoints - oppTotalPoints,
        outcome,
        isLive,
        formattedDate,
        dateTimestamp: matchDateObj ? matchDateObj.getTime() : 0,
        matchKills,
        matchAces,
        matchBlocks,
        matchDigs,
        topKillPlayer,
        topKillCount,
      };
    });
  }, [gameMatches, sets, stats, roster]);

  // Overall Season Aggregate Statistics
  const seasonStats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let liveGames = 0;
    let totalSetsWon = 0;
    let totalSetsLost = 0;
    let totalPointsScored = 0;
    let totalPointsAllowed = 0;

    // For streak calculation, sort by date ascending
    const sortedByDateAsc = [...processedMatches].sort((a, b) => a.dateTimestamp - b.dateTimestamp);
    let currentStreakType: "W" | "L" | null = null;
    let currentStreakCount = 0;

    sortedByDateAsc.forEach((m) => {
      if (m.isLive) {
        liveGames++;
        return;
      }
      totalSetsWon += m.uccSetsWon;
      totalSetsLost += m.oppSetsWon;
      totalPointsScored += m.uccTotalPoints;
      totalPointsAllowed += m.oppTotalPoints;

      if (m.outcome === "win") {
        wins++;
        if (currentStreakType === "W") {
          currentStreakCount++;
        } else {
          currentStreakType = "W";
          currentStreakCount = 1;
        }
      } else if (m.outcome === "loss") {
        losses++;
        if (currentStreakType === "L") {
          currentStreakCount++;
        } else {
          currentStreakType = "L";
          currentStreakCount = 1;
        }
      } else {
        ties++;
        currentStreakType = null;
        currentStreakCount = 0;
      }
    });

    const totalDecided = wins + losses;
    const winPercentage = totalDecided > 0 ? ((wins / totalDecided) * 100).toFixed(1) : "0.0";
    const totalSetsDecided = totalSetsWon + totalSetsLost;
    const setWinPercentage = totalSetsDecided > 0 ? ((totalSetsWon / totalSetsDecided) * 100).toFixed(1) : "0.0";
    const streakDisplay = currentStreakType && currentStreakCount > 0 ? `${currentStreakType}${currentStreakCount}` : "-";

    return {
      totalGames: processedMatches.length,
      wins,
      losses,
      ties,
      liveGames,
      winPercentage,
      totalSetsWon,
      totalSetsLost,
      setWinPercentage,
      totalPointsScored,
      totalPointsAllowed,
      pointDifferential: totalPointsScored - totalPointsAllowed,
      streak: streakDisplay,
    };
  }, [processedMatches]);

  // Filtered and sorted matches
  const filteredMatches = useMemo(() => {
    let result = processedMatches.filter((m) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const oppName = (m.opponent || "").toLowerCase();
        const title = (m.title || "").toLowerCase();
        const type = (m.type || "").toLowerCase();
        const dateStr = (m.formattedDate || "").toLowerCase();
        if (!oppName.includes(q) && !title.includes(q) && !type.includes(q) && !dateStr.includes(q)) {
          return false;
        }
      }

      // Outcome filter
      if (filterOutcome === "wins") return m.outcome === "win";
      if (filterOutcome === "losses") return m.outcome === "loss";
      if (filterOutcome === "tournaments") return m.type === "Tournament";
      if (filterOutcome === "scrimmages") return m.type === "Scrimmage";
      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortOrder === "newest") return b.dateTimestamp - a.dateTimestamp;
      if (sortOrder === "oldest") return a.dateTimestamp - b.dateTimestamp;
      if (sortOrder === "points") return b.pointDifferential - a.pointDifferential;
      return 0;
    });

    return result;
  }, [processedMatches, searchQuery, filterOutcome, sortOrder]);

  const copyMatchSummary = (match: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const setScores = match.matchSets
      .map((s: any) => `${s.scoreUcc}-${s.scoreOpp}`)
      .join(", ");
    const resultText =
      match.outcome === "win"
        ? `${effectiveOurName} def. ${match.opponent || "Opponent"} ${match.uccSetsWon}-${match.oppSetsWon}`
        : match.outcome === "loss"
        ? `${match.opponent || "Opponent"} def. ${effectiveOurName} ${match.oppSetsWon}-${match.uccSetsWon}`
        : `${effectiveOurName} vs ${match.opponent || "Opponent"} ${match.uccSetsWon}-${match.oppSetsWon}`;

    const textToCopy = `${resultText} (${setScores || "No set scores"}) - ${match.formattedDate}`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedMatchId(match.id);
      setTimeout(() => setCopiedMatchId(null), 2500);
    }
  };

  const copySeasonReport = () => {
    let text = `=== ${effectiveOurName.toUpperCase()} SEASON HISTORY & SCORES ===\n`;
    text += `Overall Record: ${seasonStats.wins}W - ${seasonStats.losses}L (${seasonStats.winPercentage}% Win Rate)\n`;
    text += `Sets: ${seasonStats.totalSetsWon} Won - ${seasonStats.totalSetsLost} Lost (${seasonStats.setWinPercentage}%)\n`;
    text += `Points: ${seasonStats.totalPointsScored} Scored - ${seasonStats.totalPointsAllowed} Allowed (${seasonStats.pointDifferential >= 0 ? "+" : ""}${seasonStats.pointDifferential})\n\n`;
    text += `GAME LOG:\n`;

    processedMatches.forEach((m, idx) => {
      const setsStr = m.matchSets.map((s: any) => `Set ${s.setNum}: ${s.scoreUcc}-${s.scoreOpp}`).join(" | ");
      const outcomeStr = m.outcome === "win" ? "WIN" : m.outcome === "loss" ? "LOSS" : "TIED";
      text += `${idx + 1}. [${outcomeStr} ${m.uccSetsWon}-${m.oppSetsWon}] vs ${m.opponent || "Opponent"} (${m.formattedDate}) - ${setsStr || "No sets"}\n`;
    });

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedSeasonSummary(true);
      setTimeout(() => setCopiedSeasonSummary(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-[#001b5e] to-slate-900 text-white p-4 sm:p-6 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-amber-400/20 text-amber-400 border border-amber-400/30 flex items-center justify-center shadow-inner shrink-0">
              <Trophy size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-black uppercase tracking-wider text-white">
                  Season History & Game Log
                </h2>
                <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider">
                  {seasonStats.wins}W - {seasonStats.losses}L
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-sm mt-0.5 font-medium">
                Comprehensive match results, set-by-set scores, and performance log
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copySeasonReport}
              className="hidden sm:flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border border-white/15"
              title="Copy complete season game log to clipboard"
            >
              {copiedSeasonSummary ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
              <span>{copiedSeasonSummary ? "Copied Log!" : "Share Log"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Season History"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Season Summary Statistics Card */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4 sm:p-5 border-b border-slate-700/80 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-4 text-center">
            {/* Match Record */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-center">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Match Record
              </span>
              <div className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
                {seasonStats.wins} - {seasonStats.losses}
                {seasonStats.ties > 0 && <span className="text-xs text-slate-400 ml-1">({seasonStats.ties}T)</span>}
              </div>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                {seasonStats.winPercentage}% Win Rate
              </span>
            </div>

            {/* Set Record */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-center">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Set Record
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
                {seasonStats.totalSetsWon} - {seasonStats.totalSetsLost}
              </div>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                {seasonStats.setWinPercentage}% Sets Won
              </span>
            </div>

            {/* Total Points */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-center">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Points
              </span>
              <div className="text-lg sm:text-xl font-black text-white mt-0.5">
                {seasonStats.totalPointsScored} : {seasonStats.totalPointsAllowed}
              </div>
              <span className={`text-[10px] font-bold mt-0.5 ${seasonStats.pointDifferential >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {seasonStats.pointDifferential >= 0 ? `+${seasonStats.pointDifferential}` : seasonStats.pointDifferential} Diff
              </span>
            </div>

            {/* Streak */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-center">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Streak
              </span>
              <div className={`text-xl sm:text-2xl font-black mt-0.5 ${seasonStats.streak.startsWith("W") ? "text-emerald-400" : seasonStats.streak.startsWith("L") ? "text-rose-400" : "text-slate-300"}`}>
                {seasonStats.streak}
              </div>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                Current Form
              </span>
            </div>

            {/* Matches Played */}
            <div className="col-span-2 sm:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-center">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Matches
              </span>
              <div className="text-xl sm:text-2xl font-black text-blue-400 mt-0.5">
                {seasonStats.totalGames}
              </div>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                Official Games
              </span>
            </div>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by opponent, tournament, or date..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-[#0033A0] focus:ring-1 focus:ring-[#0033A0] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Outcome Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <button
              type="button"
              onClick={() => setFilterOutcome("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                filterOutcome === "all"
                  ? "bg-[#0033A0] text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              All ({processedMatches.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterOutcome("wins")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                filterOutcome === "wins"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white text-emerald-700 border border-slate-200 hover:bg-emerald-50"
              }`}
            >
              Wins ({seasonStats.wins})
            </button>
            <button
              type="button"
              onClick={() => setFilterOutcome("losses")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                filterOutcome === "losses"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-white text-rose-700 border border-slate-200 hover:bg-rose-50"
              }`}
            >
              Losses ({seasonStats.losses})
            </button>
            <button
              type="button"
              onClick={() => setFilterOutcome("tournaments")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                filterOutcome === "tournaments"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-indigo-700 border border-slate-200 hover:bg-indigo-50"
              }`}
            >
              Tournaments
            </button>
          </div>

          {/* Sort order selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl self-end sm:self-auto shrink-0">
            <ArrowUpDown size={13} className="text-slate-400 shrink-0" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="points">Largest Margin</option>
            </select>
          </div>
        </div>

        {/* Match List Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3.5 bg-slate-100">
          {filteredMatches.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm max-w-md mx-auto my-6">
              <div className="h-16 w-16 bg-blue-50 text-[#0033A0] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <Trophy size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider mb-2">
                No Games Found
              </h3>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-6">
                {searchQuery || filterOutcome !== "all"
                  ? "No matches match your current search or filter criteria. Try clearing the filters."
                  : "No official matches recorded yet for this season. Start your first match from the main menu!"}
              </p>
              {searchQuery || filterOutcome !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterOutcome("all");
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              ) : onStartNewMatch ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartNewMatch();
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#0033A0] to-[#001b5e] hover:from-[#0044cc] hover:to-[#002277] text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Start New Match
                </button>
              ) : null}
            </div>
          ) : (
            filteredMatches.map((match, index) => {
              const isExpanded = expandedMatchId === match.id;
              const hasSetScores = match.matchSets.length > 0;

              return (
                <div
                  key={match.id || index}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Top Bar of Match Card */}
                  <div className="p-3.5 sm:p-5 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar size={13} className="text-[#0033A0]" />
                          {match.formattedDate}
                        </span>
                        {match.type && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {match.type === "Tournament" && match.title ? `Tournament: ${match.title}` : match.type}
                          </span>
                        )}
                        {match.format && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            ({match.format})
                          </span>
                        )}
                      </div>

                      {/* Result Pill Badge */}
                      <div>
                        {match.isLive ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/20 text-blue-700 border border-blue-400 animate-pulse">
                            <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                            Live In Progress
                          </span>
                        ) : match.outcome === "win" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                            <Check size={14} className="stroke-[3]" />
                            WIN ({match.uccSetsWon} - {match.oppSetsWon})
                          </span>
                        ) : match.outcome === "loss" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                            <X size={14} className="stroke-[3]" />
                            LOSS ({match.uccSetsWon} - {match.oppSetsWon})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                            TIED ({match.uccSetsWon} - {match.oppSetsWon})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Team Matchup & Big Score Display */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-1">
                      {/* Left: Team Names & Final Sets Score */}
                      <div className="md:col-span-7 flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-2xl p-3 sm:p-4">
                        {/* Our Team */}
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#0033A0]"></span>
                            <span className="font-black text-sm sm:text-base text-slate-900 truncate uppercase">
                              {effectiveOurName}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                            {match.uccTotalPoints} total pts
                          </div>
                        </div>

                        {/* Sets Score Box */}
                        <div className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-center shrink-0 shadow-sm flex items-center gap-2">
                          <span className={`text-xl sm:text-2xl font-black ${match.uccSetsWon > match.oppSetsWon ? "text-amber-400" : "text-white"}`}>
                            {match.uccSetsWon}
                          </span>
                          <span className="text-slate-500 font-bold text-sm">-</span>
                          <span className={`text-xl sm:text-2xl font-black ${match.oppSetsWon > match.uccSetsWon ? "text-amber-400" : "text-white"}`}>
                            {match.oppSetsWon}
                          </span>
                        </div>

                        {/* Opponent Team */}
                        <div className="flex-1 min-w-0 pl-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-black text-sm sm:text-base text-slate-900 truncate uppercase">
                              {match.opponent || "Opponent"}
                            </span>
                            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                            {match.oppTotalPoints} total pts
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Highlights & Actions */}
                      <div className="md:col-span-5 flex flex-col justify-between h-full gap-2.5">
                        {/* Quick Stats Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {match.matchKills > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-lg">
                              <strong>{match.matchKills}</strong> Kills
                            </span>
                          )}
                          {match.matchAces > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-lg">
                              <strong>{match.matchAces}</strong> Aces
                            </span>
                          )}
                          {match.matchBlocks > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg">
                              <strong>{match.matchBlocks}</strong> Blocks
                            </span>
                          )}
                          {match.topKillPlayer && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg truncate max-w-[200px]">
                              <Award size={10} className="text-amber-600 shrink-0" />
                              <span className="truncate">{match.topKillPlayer} ({match.topKillCount}K)</span>
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onSelectMatch(match);
                            }}
                            className="flex-1 bg-gradient-to-r from-[#0033A0] to-[#001b5e] hover:from-[#0044cc] hover:to-[#002277] text-white py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                            title="View detailed stats table for this match"
                          >
                            <BarChart3 size={14} />
                            <span>View Stats</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => copyMatchSummary(match, e)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                            title="Copy match summary & scores"
                          >
                            {copiedMatchId === match.id ? (
                              <Check size={14} className="text-emerald-600" />
                            ) : (
                              <Share2 size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Set-by-Set Score Capsules */}
                    {hasSetScores ? (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                          <span>Set Breakdown ({match.matchSets.length} Sets Played)</span>
                          <span className="font-semibold text-slate-500">
                            Diff: {match.pointDifferential >= 0 ? `+${match.pointDifferential}` : match.pointDifferential} pts
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                          {match.matchSets.map((s: any, sIdx: number) => {
                            const uScore = Number(s.scoreUcc) || 0;
                            const oScore = Number(s.scoreOpp) || 0;
                            const setWon = uScore > oScore;
                            const setTied = uScore === oScore;

                            return (
                              <div
                                key={s.id || sIdx}
                                className={`rounded-xl p-2 border flex items-center justify-between transition-colors ${
                                  setWon
                                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-950"
                                    : setTied
                                    ? "bg-slate-50 border-slate-200 text-slate-700"
                                    : "bg-rose-50/70 border-rose-200 text-rose-950"
                                }`}
                              >
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black uppercase tracking-wider opacity-75">
                                    Set {s.setNum || sIdx + 1}
                                  </span>
                                  <span className="text-sm font-black">
                                    {uScore} - {oScore}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <span
                                    className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                      setWon
                                        ? "bg-emerald-600 text-white"
                                        : setTied
                                        ? "bg-slate-300 text-slate-800"
                                        : "bg-rose-600 text-white"
                                    }`}
                                  >
                                    {setWon ? "W" : setTied ? "T" : "L"}
                                  </span>

                                  {onEditSetScore && (
                                    <button
                                      type="button"
                                      onClick={() => onEditSetScore(s, match)}
                                      className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded hover:bg-black/5"
                                      title="Edit Set Score"
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-400 italic">
                        No individual set scores recorded for this match.
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-white border-t border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-bold flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>
              Showing {filteredMatches.length} of {processedMatches.length} official match{processedMatches.length !== 1 ? "es" : ""}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={copySeasonReport}
              className="flex-1 sm:flex-initial bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {copiedSeasonSummary ? <Check size={14} className="text-emerald-600" /> : <Share2 size={14} />}
              <span>{copiedSeasonSummary ? "Copied All Scores!" : "Copy Season Report"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial bg-[#0033A0] hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-sm active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
