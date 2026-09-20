import React, { useState, useMemo } from "react";
import {
  X,
  Search,
  Users,
  Shield,
  FileText,
  Calendar,
  Trophy,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Printer,
  Sparkles,
  Award,
} from "lucide-react";

export interface OpponentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: any[];
  sets: any[];
  stats: any[];
  opponents: Record<string, any>;
  effectiveTeamName?: string;
  initialOpponent?: string;
  onSaveOpponentNote?: (oppName: string, playerId: string, note: string) => void;
}

export const OpponentReportModal: React.FC<OpponentReportModalProps> = ({
  isOpen,
  onClose,
  matches,
  sets,
  stats,
  opponents,
  effectiveTeamName = "Lancers",
  initialOpponent = "",
  onSaveOpponentNote,
}) => {
  // Collect all unique opponent names from matches and opponents map
  const opponentList = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      if (m.opponent && m.opponent.trim().toLowerCase() !== "practice") {
        set.add(m.opponent.trim());
      }
    });
    Object.keys(opponents || {}).forEach((k) => {
      const opp = opponents[k];
      const name = opp?.teamName || k;
      if (name && name.trim().toLowerCase() !== "practice") {
        set.add(name.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [matches, opponents]);

  const [selectedOpponent, setSelectedOpponent] = useState<string>(() => {
    if (initialOpponent && opponentList.includes(initialOpponent)) {
      return initialOpponent;
    }
    return opponentList[0] || "";
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "lineups" | "players" | "stats">("overview");
  const [copied, setCopied] = useState(false);
  const [editingNotePlayerId, setEditingNotePlayerId] = useState<string | null>(null);
  const [playerNoteDraft, setPlayerNoteDraft] = useState("");

  // Update selected opponent if initialOpponent changes
  React.useEffect(() => {
    if (initialOpponent && opponentList.includes(initialOpponent)) {
      setSelectedOpponent(initialOpponent);
    } else if (!selectedOpponent && opponentList.length > 0) {
      setSelectedOpponent(opponentList[0]);
    }
  }, [initialOpponent, opponentList]);

  // Compute Opponent Dossier for selectedOpponent
  const dossier = useMemo(() => {
    if (!selectedOpponent) return null;

    const oppNameNorm = selectedOpponent.toLowerCase();
    const safeKey = selectedOpponent.replace(/\//g, "-");
    const oppRecord = opponents?.[safeKey] || opponents?.[selectedOpponent] || {};
    const notesMap = oppRecord.notes || {};

    // Matches against this opponent
    const oppMatches = matches.filter(
      (m) => m.opponent && m.opponent.trim().toLowerCase() === oppNameNorm
    );
    const oppMatchIds = new Set(oppMatches.map((m) => m.id));

    // Sets against this opponent
    const oppSets = sets
      .filter((s) => oppMatchIds.has(s.matchId))
      .sort((a, b) => {
        const mA = oppMatches.find((m) => m.id === a.matchId);
        const mB = oppMatches.find((m) => m.id === b.matchId);
        const tA = mA?.date ? new Date(mA.date).getTime() : 0;
        const tB = mB?.date ? new Date(mB.date).getTime() : 0;
        if (tA !== tB) return tB - tA; // newest match first
        return a.setNum - b.setNum;
      });

    // Match Record & Sets Record
    let matchesWon = 0;
    let matchesLost = 0;
    let setsWon = 0;
    let setsLost = 0;

    oppMatches.forEach((m) => {
      const matchSets = oppSets.filter((s) => s.matchId === m.id);
      let sWon = 0;
      let sLost = 0;
      matchSets.forEach((s) => {
        if (s.scoreUcc > s.scoreOpp) {
          setsWon++;
          sWon++;
        } else if (s.scoreOpp > s.scoreUcc) {
          setsLost++;
          sLost++;
        }
      });
      if (sWon > sLost) matchesWon++;
      else if (sLost > sWon) matchesLost++;
    });

    // Collect all starting lineups
    interface LineupRecord {
      matchId: string;
      matchTitle: string;
      matchDate: string;
      setNum: number;
      scoreUcc: number;
      scoreOpp: number;
      lineup: string[]; // pos 1 to 6
    }

    const startingLineups: LineupRecord[] = [];
    const knownPlayerNumbers = new Set<string>();
    const playerFrequency: Record<string, number> = {};
    const playerPositionsMap: Record<string, Set<string>> = {};

    oppSets.forEach((s) => {
      const match = oppMatches.find((m) => m.id === s.matchId);
      const lineup = (s.oppLineup || []).slice(0, 6);
      if (lineup.length > 0 && lineup.some((p: string) => Boolean(p))) {
        startingLineups.push({
          matchId: s.matchId,
          matchTitle: match?.title || (match?.type === "Tournament" ? "Tournament" : "Regular Match"),
          matchDate: match?.date || "",
          setNum: s.setNum,
          scoreUcc: s.scoreUcc,
          scoreOpp: s.scoreOpp,
          lineup,
        });

        lineup.forEach((pNum: string, idx: number) => {
          if (!pNum) return;
          knownPlayerNumbers.add(pNum);
          playerFrequency[pNum] = (playerFrequency[pNum] || 0) + 1;
          if (!playerPositionsMap[pNum]) playerPositionsMap[pNum] = new Set();
          const courtPos = idx + 1;
          const posLabel = [1, 5, 6].includes(courtPos) ? "Back Row" : "Front Row";
          playerPositionsMap[pNum].add(`Pos ${courtPos} (${posLabel})`);
        });
      }
    });

    // Also include setter and libero from oppRecord
    if (oppRecord.setterId) knownPlayerNumbers.add(oppRecord.setterId);
    if (oppRecord.liberoId) knownPlayerNumbers.add(oppRecord.liberoId);
    if (oppRecord.defaultLineup && Array.isArray(oppRecord.defaultLineup)) {
      oppRecord.defaultLineup.forEach((p: string) => {
        if (p) knownPlayerNumbers.add(p);
      });
    }

    // Stats against this opponent
    const oppSetIds = new Set(oppSets.map((s) => s.id));
    const oppStats = stats.filter((st) => oppSetIds.has(st.setId));

    // Calculate aggregated stats
    let oppAcesScored = 0;
    let oppServeMissNet = 0;
    let oppServeMissWide = 0;
    let oppServeMissLong = 0;
    let oppKills = 0;
    let oppAttackErrors = 0;
    let oppBlocksAgainstUs = 0;
    let ourPassCount = 0;
    let ourPassSum = 0;

    oppStats.forEach((st) => {
      if (st.isOpp) {
        if (st.category === "Serve") {
          if (st.metric === "Ace") oppAcesScored++;
          if (st.metric === "Miss - Net" || st.metric === "Net") oppServeMissNet++;
          if (st.metric === "Miss - Wide" || st.metric === "Wide") oppServeMissWide++;
          if (st.metric === "Miss - Long" || st.metric === "Long") oppServeMissLong++;
        }
        if (st.category === "Attack") {
          if (st.metric === "Kill") oppKills++;
          if (st.metric === "Error" || st.metric === "Out" || st.metric === "Net") oppAttackErrors++;
        }
        if (st.category === "Block" && (st.metric === "Kill" || st.metric === "Stuff")) {
          oppBlocksAgainstUs++;
        }
      } else {
        // Our team passing against their serve
        if (st.category === "Pass") {
          const val = typeof st.value === "number" ? st.value : parseInt(st.metric, 10);
          if (!isNaN(val)) {
            ourPassCount++;
            ourPassSum += val;
          }
        }
      }
    });

    const ourAvgPassRating = ourPassCount > 0 ? (ourPassSum / ourPassCount).toFixed(2) : "-";

    // Sorted roster of players
    const rosterList = Array.from(knownPlayerNumbers).map((pNum) => {
      const isSetter = oppRecord.setterId === pNum;
      const isLibero = oppRecord.liberoId === pNum;
      const note = notesMap[pNum] || "";
      const timesStarted = playerFrequency[pNum] || 0;
      const positions = Array.from(playerPositionsMap[pNum] || []);
      return {
        number: pNum,
        isSetter,
        isLibero,
        note,
        timesStarted,
        positions,
      };
    }).sort((a, b) => {
      const numA = parseInt(a.number.replace(/\D/g, ""), 10);
      const numB = parseInt(b.number.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.number.localeCompare(b.number);
    });

    return {
      opponentName: selectedOpponent,
      record: {
        matchesPlayed: oppMatches.length,
        matchesWon,
        matchesLost,
        setsWon,
        setsLost,
        winPct: oppMatches.length > 0 ? Math.round((matchesWon / oppMatches.length) * 100) : 0,
      },
      setterId: oppRecord.setterId || null,
      liberoId: oppRecord.liberoId || null,
      oppMatches,
      oppSets,
      startingLineups,
      rosterList,
      notesMap,
      statsBreakdown: {
        oppAcesScored,
        oppServeMissNet,
        oppServeMissWide,
        oppServeMissLong,
        totalServeErrors: oppServeMissNet + oppServeMissWide + oppServeMissLong,
        oppKills,
        oppAttackErrors,
        oppBlocksAgainstUs,
        ourAvgPassRating,
      },
    };
  }, [selectedOpponent, matches, sets, stats, opponents]);

  if (!isOpen) return null;

  const handleCopyReport = () => {
    if (!dossier) return;
    const lines = [
      `================================================`,
      `SCOUTING REPORT: ${dossier.opponentName.toUpperCase()}`,
      `Generated by ${effectiveTeamName} Volleyball Analytics`,
      `================================================`,
      `HEAD-TO-HEAD RECORD: ${dossier.record.matchesWon}W - ${dossier.record.matchesLost}L (Sets: ${dossier.record.setsWon}W - ${dossier.record.setsLost}L)`,
      `Key Personnel: Setter: #${dossier.setterId || "Unknown"} | Libero: #${dossier.liberoId || "Unknown"}`,
      ``,
      `--- SCOUTED PLAYERS & NOTES ---`,
    ];

    dossier.rosterList.forEach((p) => {
      const roles = [];
      if (p.isSetter) roles.push("SETTER");
      if (p.isLibero) roles.push("LIBERO");
      const roleStr = roles.length > 0 ? ` [${roles.join(", ")}]` : "";
      lines.push(`#${p.number}${roleStr} - Started ${p.timesStarted} sets`);
      if (p.positions.length > 0) {
        lines.push(`  Positions: ${p.positions.join(", ")}`);
      }
      if (p.note) {
        lines.push(`  Notes: "${p.note}"`);
      }
    });

    lines.push(``);
    lines.push(`--- OPPONENT SERVE & ATTACK TENDENCIES ---`);
    lines.push(`Aces Conceded: ${dossier.statsBreakdown.oppAcesScored}`);
    lines.push(`Serve Errors Forced: ${dossier.statsBreakdown.totalServeErrors} (Net: ${dossier.statsBreakdown.oppServeMissNet}, Wide: ${dossier.statsBreakdown.oppServeMissWide}, Long: ${dossier.statsBreakdown.oppServeMissLong})`);
    lines.push(`Opponent Kills Allowed: ${dossier.statsBreakdown.oppKills}`);
    lines.push(`Opponent Attack Errors: ${dossier.statsBreakdown.oppAttackErrors}`);
    lines.push(`Our Team Serve Receive Avg vs Them: ${dossier.statsBreakdown.ourAvgPassRating}`);

    lines.push(``);
    lines.push(`--- STARTING ROTATIONS LOG ---`);
    dossier.startingLineups.forEach((l) => {
      const d = l.matchDate ? new Date(l.matchDate).toLocaleDateString() : "";
      lines.push(`Set ${l.setNum} (${d} - ${l.matchTitle}): Pos 1:#${l.lineup[0]} | Pos 2:#${l.lineup[1]} | Pos 3:#${l.lineup[2]} | Pos 4:#${l.lineup[3]} | Pos 5:#${l.lineup[4]} | Pos 6:#${l.lineup[5]} (Score: ${effectiveTeamName} ${l.scoreUcc} - ${l.scoreOpp} Opp)`);
    });

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveNote = (pNum: string) => {
    if (onSaveOpponentNote && selectedOpponent) {
      onSaveOpponentNote(selectedOpponent, pNum, playerNoteDraft);
    }
    setEditingNotePlayerId(null);
  };

  const filteredOpponents = opponentList.filter((name) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[160] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden text-slate-100">
        {/* TOP BAR */}
        <div className="bg-slate-850 p-3 sm:p-5 border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg">
              <Shield size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-black text-white tracking-wide uppercase">
                  Opponent Scouting Reports
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  Dossier
                </span>
              </div>
              <p className="text-xs font-medium text-slate-400 hidden sm:block">
                View starting lineups, court positions, player tendencies, scouting notes, and head-to-head stats
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {dossier && (
              <button
                type="button"
                onClick={handleCopyReport}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy Report"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* OPPONENT SELECTOR BAR */}
        <div className="bg-slate-800/80 p-3 border-b border-slate-700/60 flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
            Opponent:
          </span>
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <select
              value={selectedOpponent}
              onChange={(e) => setSelectedOpponent(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-xl px-3 py-2 font-black text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              {opponentList.map((opp) => (
                <option key={opp} value={opp} className="bg-slate-900 text-white">
                  {opp}
                </option>
              ))}
            </select>
          </div>

          {/* TAB BUTTONS */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700 ml-auto">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "overview"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("lineups")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "lineups"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Starting Lineups ({dossier?.startingLineups.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("players")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "players"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Players & Notes ({dossier?.rosterList.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("stats")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "stats"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Stats Breakdown
            </button>
          </div>
        </div>

        {/* MAIN BODY AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {!dossier ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <Shield size={48} className="text-slate-600 mb-3" />
              <h3 className="text-lg font-black text-slate-300">No Opponent Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Select an opponent from the top dropdown or record a game to generate a comprehensive dossier.
              </p>
            </div>
          ) : (
            <>
              {/* HEADER SUMMARY CARD */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-850 p-4 sm:p-5 rounded-2xl border border-slate-700 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wide">
                      {dossier.opponentName}
                    </h3>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-500/20 text-blue-400 border border-blue-500/40">
                      {dossier.record.matchesPlayed} Match{dossier.record.matchesPlayed !== 1 ? "es" : ""} Played
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-bold text-slate-400">
                    <span>
                      Primary Setter:{" "}
                      <strong className="text-green-400">
                        {dossier.setterId ? `#${dossier.setterId}` : "Not Identified"}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Libero:{" "}
                      <strong className="text-amber-400">
                        {dossier.liberoId ? `#${dossier.liberoId}` : "Not Identified"}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Known Players:{" "}
                      <strong className="text-slate-200">{dossier.rosterList.length}</strong>
                    </span>
                  </div>
                </div>

                {/* RECORD BADGES */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="bg-slate-900/80 border border-slate-700 px-4 py-2.5 rounded-xl text-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                      Matches
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-white">
                      <span className="text-green-400">{dossier.record.matchesWon}</span> -{" "}
                      <span className="text-red-400">{dossier.record.matchesLost}</span>
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-700 px-4 py-2.5 rounded-xl text-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                      Sets Won/Lost
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-white">
                      <span className="text-green-400">{dossier.record.setsWon}</span> -{" "}
                      <span className="text-red-400">{dossier.record.setsLost}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* TAB CONTENT */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Quick Stat Highlights */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl text-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Opponent Kills
                      </span>
                      <span className="text-2xl font-black text-rose-400 my-1 block">
                        {dossier.statsBreakdown.oppKills}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">Allowed by us</span>
                    </div>

                    <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl text-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Opponent Aces
                      </span>
                      <span className="text-2xl font-black text-amber-400 my-1 block">
                        {dossier.statsBreakdown.oppAcesScored}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">Aces scored on us</span>
                    </div>

                    <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl text-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Opp Serve Errors
                      </span>
                      <span className="text-2xl font-black text-green-400 my-1 block">
                        {dossier.statsBreakdown.totalServeErrors}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">Free points for us</span>
                    </div>

                    <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl text-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Our Passing Avg
                      </span>
                      <span className="text-2xl font-black text-blue-400 my-1 block">
                        {dossier.statsBreakdown.ourAvgPassRating}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">Against their serve</span>
                    </div>
                  </div>

                  {/* Most Recent Starting Lineup */}
                  {dossier.startingLineups.length > 0 && (
                    <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-2xl">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                          <Users size={16} className="text-blue-400" />
                          Most Recent Starting Rotation
                        </h4>
                        <span className="text-xs font-bold text-slate-400">
                          Set {dossier.startingLineups[0].setNum} • {dossier.startingLineups[0].matchTitle}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                        {dossier.startingLineups[0].lineup.map((pNum, idx) => {
                          const courtPos = idx + 1;
                          const isBackRow = [1, 5, 6].includes(courtPos);
                          const isSetter = pNum === dossier.setterId;
                          const isLibero = pNum === dossier.liberoId;
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center ${
                                isSetter
                                  ? "bg-green-950/40 border-green-600/60 text-green-200"
                                  : isLibero
                                  ? "bg-amber-950/40 border-amber-600/60 text-amber-200"
                                  : "bg-slate-900 border-slate-700 text-slate-200"
                              }`}
                            >
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                Pos {courtPos} ({isBackRow ? "Back" : "Front"})
                              </span>
                              <span className="text-2xl font-black">
                                #{pNum || "?"}
                              </span>
                              <span className="text-[10px] font-bold mt-1 text-slate-400">
                                {isSetter ? "SETTER" : isLibero ? "LIBERO" : idx === 0 ? "Serving First" : "Attacker"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Key Players with Notes */}
                  <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-2xl">
                    <h4 className="text-sm font-black uppercase tracking-wider text-slate-200 mb-3 flex items-center gap-2">
                      <FileText size={16} className="text-amber-400" />
                      Key Scouting Notes
                    </h4>
                    {dossier.rosterList.filter((p) => Boolean(p.note.trim())).length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        No scouting notes recorded yet. Go to the "Players & Notes" tab to add player observations!
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {dossier.rosterList
                          .filter((p) => Boolean(p.note.trim()))
                          .map((p) => (
                            <div
                              key={p.number}
                              className="bg-slate-900/90 border border-slate-700/80 p-3 rounded-xl"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 font-black text-xs">
                                    #{p.number}
                                  </span>
                                  {p.isSetter && (
                                    <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[9px] font-black uppercase">
                                      Setter
                                    </span>
                                  )}
                                  {p.isLibero && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase">
                                      Libero
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-slate-300 font-medium whitespace-pre-wrap">
                                "{p.note}"
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* LINEUPS TAB */}
              {activeTab === "lineups" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black uppercase tracking-wider text-slate-200">
                      All Recorded Starting Rotations Against {dossier.opponentName}
                    </h4>
                    <span className="text-xs text-slate-400 font-bold">
                      {dossier.startingLineups.length} Rotations Tracked
                    </span>
                  </div>

                  {dossier.startingLineups.length === 0 ? (
                    <div className="bg-slate-800/40 border border-slate-700/60 p-8 rounded-2xl text-center text-slate-400">
                      <p className="text-sm font-bold">No starting rotations recorded yet for this opponent.</p>
                      <p className="text-xs text-slate-500 mt-1">
                        When you start a match or set against {dossier.opponentName}, the starting 6 will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dossier.startingLineups.map((l, index) => {
                        const dateStr = l.matchDate ? new Date(l.matchDate).toLocaleDateString() : "";
                        const won = l.scoreUcc > l.scoreOpp;
                        return (
                          <div
                            key={index}
                            className="bg-slate-850 border border-slate-700/80 rounded-2xl p-4 shadow-sm hover:border-slate-600 transition-all"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-700/60">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm text-white">
                                  Set {l.setNum}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {dateStr && `(${dateStr})`} • {l.matchTitle}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400">Final:</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-black ${
                                    won ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                  }`}
                                >
                                  {effectiveTeamName} {l.scoreUcc} - {l.scoreOpp} {dossier.opponentName}
                                </span>
                              </div>
                            </div>

                            {/* Court Positions Display */}
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                              {l.lineup.map((pNum, pIdx) => {
                                const courtPos = pIdx + 1;
                                const isBackRow = [1, 5, 6].includes(courtPos);
                                const isSetter = pNum === dossier.setterId;
                                const isLibero = pNum === dossier.liberoId;
                                return (
                                  <div
                                    key={pIdx}
                                    className={`p-2.5 rounded-xl border text-center ${
                                      isSetter
                                        ? "bg-green-950/40 border-green-600/50"
                                        : isLibero
                                        ? "bg-amber-950/40 border-amber-600/50"
                                        : "bg-slate-900/90 border-slate-750"
                                    }`}
                                  >
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                      Pos {courtPos}
                                    </div>
                                    <div className="text-xl font-black text-white my-0.5">
                                      #{pNum}
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-500">
                                      {isSetter ? "Setter" : isLibero ? "Libero" : isBackRow ? "Back Row" : "Front Row"}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* PLAYERS & NOTES TAB */}
              {activeTab === "players" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black uppercase tracking-wider text-slate-200">
                      Known Players on {dossier.opponentName}
                    </h4>
                    <span className="text-xs text-slate-400 font-bold">
                      {dossier.rosterList.length} Players Tracked
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dossier.rosterList.map((p) => {
                      const isEditing = editingNotePlayerId === p.number;
                      return (
                        <div
                          key={p.number}
                          className="bg-slate-850 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-300 font-black text-base flex items-center justify-center">
                                  #{p.number}
                                </span>
                                <div>
                                  <span className="text-sm font-black text-white block">
                                    Player #{p.number}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400 block">
                                    Started in {p.timesStarted} set{p.timesStarted !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                {p.isSetter && (
                                  <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-black uppercase border border-green-500/30">
                                    Setter
                                  </span>
                                )}
                                {p.isLibero && (
                                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase border border-amber-500/30">
                                    Libero
                                  </span>
                                )}
                              </div>
                            </div>

                            {p.positions.length > 0 && (
                              <div className="mb-3">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                  Positions Seen:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {p.positions.map((pos, pIdx) => (
                                    <span
                                      key={pIdx}
                                      className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700"
                                    >
                                      {pos}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* NOTE SECTION */}
                            <div className="mt-2 bg-slate-900 p-3 rounded-xl border border-slate-750">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  Scouting Note
                                </span>
                                {!isEditing && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingNotePlayerId(p.number);
                                      setPlayerNoteDraft(p.note || "");
                                    }}
                                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider"
                                  >
                                    {p.note ? "Edit" : "+ Add Note"}
                                  </button>
                                )}
                              </div>

                              {isEditing ? (
                                <div className="space-y-2 mt-1">
                                  <textarea
                                    value={playerNoteDraft}
                                    onChange={(e) => setPlayerNoteDraft(e.target.value)}
                                    placeholder="e.g., Heavy cross-court hitter, tips on 3rd contact, weak passer on short serves..."
                                    className="w-full h-16 p-2 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingNotePlayerId(null)}
                                      className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-white"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveNote(p.number)}
                                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-black uppercase"
                                    >
                                      Save Note
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-300 font-medium italic">
                                  {p.note ? `"${p.note}"` : "No scouting notes yet."}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STATS BREAKDOWN TAB */}
              {activeTab === "stats" && (
                <div className="space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-200">
                    Detailed Stats Against {dossier.opponentName}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Opponent Serving Tendencies */}
                    <div className="bg-slate-850 border border-slate-700/80 rounded-2xl p-4">
                      <h5 className="text-xs font-black uppercase tracking-wider text-blue-400 mb-3">
                        Opponent Serve & Errors
                      </h5>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1.5 border-b border-slate-750">
                          <span className="text-slate-400">Aces Scored by Them</span>
                          <span className="font-black text-rose-400">{dossier.statsBreakdown.oppAcesScored}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-750">
                          <span className="text-slate-400">Total Serve Errors Given</span>
                          <span className="font-black text-green-400">{dossier.statsBreakdown.totalServeErrors}</span>
                        </div>
                        <div className="flex justify-between py-1 pl-3 text-slate-500">
                          <span>- Miss into Net</span>
                          <span className="font-bold text-slate-300">{dossier.statsBreakdown.oppServeMissNet}</span>
                        </div>
                        <div className="flex justify-between py-1 pl-3 text-slate-500">
                          <span>- Miss Wide</span>
                          <span className="font-bold text-slate-300">{dossier.statsBreakdown.oppServeMissWide}</span>
                        </div>
                        <div className="flex justify-between py-1 pl-3 text-slate-500">
                          <span>- Miss Long</span>
                          <span className="font-bold text-slate-300">{dossier.statsBreakdown.oppServeMissLong}</span>
                        </div>
                        <div className="flex justify-between py-1.5 pt-2 border-t border-slate-700">
                          <span className="text-slate-300 font-bold">Our Serve Receive Rating vs Them</span>
                          <span className="font-black text-blue-400">{dossier.statsBreakdown.ourAvgPassRating} / 3.00</span>
                        </div>
                      </div>
                    </div>

                    {/* Opponent Attack & Block */}
                    <div className="bg-slate-850 border border-slate-700/80 rounded-2xl p-4">
                      <h5 className="text-xs font-black uppercase tracking-wider text-rose-400 mb-3">
                        Opponent Attack & Defense
                      </h5>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1.5 border-b border-slate-750">
                          <span className="text-slate-400">Opponent Kills Allowed</span>
                          <span className="font-black text-rose-400">{dossier.statsBreakdown.oppKills}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-750">
                          <span className="text-slate-400">Opponent Attack Errors Forced</span>
                          <span className="font-black text-green-400">{dossier.statsBreakdown.oppAttackErrors}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-750">
                          <span className="text-slate-400">Times Our Hitters Were Blocked</span>
                          <span className="font-black text-amber-400">{dossier.statsBreakdown.oppBlocksAgainstUs}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="bg-slate-850 p-3 sm:p-4 border-t border-slate-700/80 flex items-center justify-between shrink-0">
          <span className="text-xs font-medium text-slate-400">
            {dossier ? `Displaying data for ${dossier.opponentName}` : "Select an opponent"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
