import React, { useState, useMemo } from "react";
import {
  X,
  Download,
  BarChart3,
  Search,
  Filter,
  Activity,
  Database,
  Edit3,
} from "lucide-react";
import { StatBreakdownModal, StatCategoryType, PlayerBreakdownStats } from "./StatBreakdownModal";

interface PracticeStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: Array<{ id: string; name: string; number?: string; isRetired?: boolean }>;
  stats: Array<any>;
  activeSetId: string | null;
  activeMatch: any;
  onOpenDatabase: () => void;
  onOpenCorrection: () => void;
}

export const PracticeStatsModal: React.FC<PracticeStatsModalProps> = ({
  isOpen,
  onClose,
  roster,
  stats,
  activeSetId,
  activeMatch,
  onOpenDatabase,
  onOpenCorrection,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pass" | "attack" | "serve" | "defense">("all");
  const [scope, setScope] = useState<"day" | "current_set">("day");
  const [breakdownModal, setBreakdownModal] = useState<{
    isOpen: boolean;
    player: PlayerBreakdownStats | null;
    category: StatCategoryType;
    titleContext?: string;
  }>({
    isOpen: false,
    player: null,
    category: "serve",
    titleContext: "",
  });

  const practiceStats = useMemo(() => {
    const playerMap: { [id: string]: any } = {};

    roster.forEach((p) => {
      if (!p.isRetired) {
        playerMap[p.id] = {
          id: p.id,
          name: p.name,
          number: p.number || "-",
          passCount: 0,
          passSum: 0,
          pass3: 0,
          pass2: 0,
          pass1: 0,
          pass0: 0,
          p3: 0,
          p2: 0,
          p1: 0,
          p0: 0,
          attCount: 0,
          attCountFront: 0,
          attCountBack: 0,
          attFront: 0,
          attBack: 0,
          attKill: 0,
          attErr: 0,
          attErrNet: 0,
          attErrOut: 0,
          attErrStuffed: 0,
          attBlk: 0,
          srvCount: 0,
          srvAce: 0,
          srvErr: 0,
          srvErrNet: 0,
          srvErrWide: 0,
          srvErrLong: 0,
          srvErrFoot: 0,
          srvErrOther: 0,
          digCount: 0,
          digErr: 0,
          blkCount: 0,
          blkStuff: 0,
          blkTouch: 0,
          blkFault: 0,
          blkLate: 0,
          blkNet: 0,
          blkUsed: 0,
        };
      }
    });

    // Filter stats according to selected scope
    let sessionStats = stats;
    if (scope === "current_set" && activeSetId) {
      sessionStats = stats.filter((s) => s.setId === activeSetId);
    } else if (activeMatch) {
      const matchDateStr = activeMatch.date ? new Date(activeMatch.date).toLocaleDateString() : null;
      // Filter stats for matches on the same day or matching this matchId
      sessionStats = stats.filter((s) => {
        if (s.matchId === activeMatch.id) return true;
        // If s.timestamp is available, check date
        if (s.timestamp && matchDateStr) {
          return new Date(s.timestamp).toLocaleDateString() === matchDateStr;
        }
        return false;
      });
    }

    sessionStats.forEach((s) => {
      if (s.isOpponent) return;
      const p = playerMap[s.playerId];
      if (!p) return;

      if (s.category === "Pass") {
        p.passCount += 1;
        p.passSum += Number(s.value || 0);
        if (s.value === 3) {
          p.p3 += 1;
          p.pass3 += 1;
        } else if (s.value === 2) {
          p.p2 += 1;
          p.pass2 += 1;
        } else if (s.value === 1) {
          p.p1 += 1;
          p.pass1 += 1;
        } else if (s.value === 0) {
          p.p0 += 1;
          p.pass0 += 1;
        }
      } else if (s.category === "Attack") {
        if (
          [
            "Swing",
            "Swing Front",
            "Swing Back",
            "Blocked",
            "Stuffed",
            "Out",
            "Net",
            "Out/Net",
            "Kill",
          ].includes(s.metric)
        ) {
          p.attCount += 1;
          if (s.row === "Front" || s.metric === "Swing Front") {
            p.attFront += 1;
            p.attCountFront += 1;
          } else if (s.row === "Back" || s.metric === "Swing Back") {
            p.attBack += 1;
            p.attCountBack += 1;
          } else {
            p.attFront += 1;
            p.attCountFront += 1;
          }
        }
        if (s.metric === "Kill") p.attKill += 1;
        if (["Out", "Net", "Out/Net", "Stuffed"].includes(s.metric)) {
          p.attErr += 1;
          if (s.metric === "Net") p.attErrNet += 1;
          else if (s.metric === "Stuffed") p.attErrStuffed += 1;
          else p.attErrOut += 1;
        }
        if (s.metric === "Blocked" || s.metric === "Stuffed") p.attBlk += 1;
      } else if (s.category === "Serve") {
        if (s.metric === "Attempt") p.srvCount += 1;
        if (s.metric === "Ace") p.srvAce += 1;
        if (s.metric?.includes("Miss") || s.metric === "Error") {
          p.srvErr += 1;
          const m = s.metric.toLowerCase();
          if (m.includes("net")) p.srvErrNet += 1;
          else if (m.includes("wide")) p.srvErrWide += 1;
          else if (m.includes("long") || m.includes("out") || m.includes("deep")) p.srvErrLong += 1;
          else if (m.includes("foot")) p.srvErrFoot += 1;
          else p.srvErrOther += 1;
        }
      } else if (s.category === "Dig") {
        if (s.metric === "Dig") p.digCount += 1;
        if (s.metric === "Error") p.digErr += 1;
      } else if (s.category === "Block") {
        if (s.metric === "Play On" || s.metric === "Touch") {
          p.blkTouch += Number(s.value || 1);
          p.blkCount += Number(s.value || 1);
        } else if (s.metric === "Block" || s.metric === "Stuff" || s.metric === "Stuffed") {
          p.blkStuff += Number(s.value || 1);
        } else if (["Late", "Net Viol", "Used"].includes(s.metric)) {
          p.blkFault += Number(s.value || 1);
          if (s.metric === "Late") p.blkLate += Number(s.value || 1);
          else if (s.metric === "Net Viol") p.blkNet += Number(s.value || 1);
          else if (s.metric === "Used") p.blkUsed += Number(s.value || 1);
        }
      }
    });

    const list = Object.values(playerMap);

    const totals = {
      id: "TEAM_TOTALS",
      name: "TEAM TOTAL",
      number: "★",
      passCount: 0,
      passSum: 0,
      p3: 0,
      p2: 0,
      p1: 0,
      p0: 0,
      pass3: 0,
      pass2: 0,
      pass1: 0,
      pass0: 0,
      attCount: 0,
      attCountFront: 0,
      attCountBack: 0,
      attKill: 0,
      attErr: 0,
      attErrNet: 0,
      attErrOut: 0,
      attErrStuffed: 0,
      attBlk: 0,
      attFront: 0,
      attBack: 0,
      srvCount: 0,
      srvAce: 0,
      srvErr: 0,
      srvErrNet: 0,
      srvErrWide: 0,
      srvErrLong: 0,
      srvErrFoot: 0,
      srvErrOther: 0,
      digCount: 0,
      digErr: 0,
      blkStuff: 0,
      blkTouch: 0,
      blkCount: 0,
      blkFault: 0,
      blkLate: 0,
      blkNet: 0,
      blkUsed: 0,
    };

    list.forEach((p) => {
      totals.passCount += p.passCount;
      totals.passSum += p.passSum;
      totals.p3 += p.p3;
      totals.p2 += p.p2;
      totals.p1 += p.p1;
      totals.p0 += p.p0;
      totals.pass3 += p.pass3;
      totals.pass2 += p.pass2;
      totals.pass1 += p.pass1;
      totals.pass0 += p.pass0;
      totals.attCount += p.attCount;
      totals.attCountFront += p.attCountFront;
      totals.attCountBack += p.attCountBack;
      totals.attKill += p.attKill;
      totals.attErr += p.attErr;
      totals.attErrNet += p.attErrNet;
      totals.attErrOut += p.attErrOut;
      totals.attErrStuffed += p.attErrStuffed;
      totals.attBlk += p.attBlk;
      totals.attFront += p.attFront;
      totals.attBack += p.attBack;
      totals.srvCount += p.srvCount;
      totals.srvAce += p.srvAce;
      totals.srvErr += p.srvErr;
      totals.srvErrNet += p.srvErrNet;
      totals.srvErrWide += p.srvErrWide;
      totals.srvErrLong += p.srvErrLong;
      totals.srvErrFoot += p.srvErrFoot;
      totals.srvErrOther += p.srvErrOther;
      totals.digCount += p.digCount;
      totals.digErr += p.digErr;
      totals.blkStuff += p.blkStuff;
      totals.blkTouch += p.blkTouch;
      totals.blkCount += p.blkCount;
      totals.blkFault += p.blkFault;
      totals.blkLate += p.blkLate;
      totals.blkNet += p.blkNet;
      totals.blkUsed += p.blkUsed;
    });

    return { players: list, totals };
  }, [stats, roster, activeSetId]);

  if (!isOpen) return null;

  const filteredPlayers = practiceStats.players.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.number.includes(searchQuery)
  );

  const exportPracticeCSV = () => {
    const dateStr = activeMatch?.date
      ? new Date(activeMatch.date).toLocaleDateString()
      : new Date().toLocaleDateString();
    let csv = `PRACTICE SESSION STATS - ${dateStr}\nNumber,Name,Pass Avg,Total Passes,3s,2s,1s,0s (Errors),Total Swings/Att,Front Swings,Back Swings,Kills,Kill %,Att Errors,Att Blocked,Hitting Eff,Total Serves,Aces,Serve Errors,In Play,Serve +/-,Digs,Dig Errors,Block Stuffs,Block Touches,Block Faults\n`;

    practiceStats.players.forEach((p) => {
      const passAvg = p.passCount > 0 ? (p.passSum / p.passCount).toFixed(2) : "0.00";
      const killPct = p.attCount > 0 ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%" : "0.0%";
      const hitEff = p.attCount > 0 ? ((p.attKill - p.attErr) / p.attCount).toFixed(3) : ".000";
      const srvTot = p.srvCount + p.srvAce + p.srvErr;
      const srvPlusMinus = p.srvAce - p.srvErr;
      csv += `"${p.number}","${p.name}",${passAvg},${p.passCount},${p.p3},${p.p2},${p.p1},${p.p0},${p.attCount},${p.attFront},${p.attBack},${p.attKill},${killPct},${p.attErr},${p.attBlk},${hitEff},${srvTot},${p.srvAce},${p.srvErr},${p.srvCount},${srvPlusMinus},${p.digCount},${p.digErr},${p.blkStuff},${p.blkTouch},${p.blkFault}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `practice_stats_${dateStr.replace(/\//g, "-")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totals = practiceStats.totals;
  const totPassAvg = totals && totals.passCount > 0 ? (totals.passSum / totals.passCount).toFixed(2) : "0.00";
  const totKillPct = totals && totals.attCount > 0 ? ((totals.attKill / totals.attCount) * 100).toFixed(1) + "%" : "0.0%";
  const totHitEff = totals && totals.attCount > 0 ? ((totals.attKill - totals.attErr) / totals.attCount).toFixed(3) : ".000";
  const totSrvTot = totals ? totals.srvCount + totals.srvAce + totals.srvErr : 0;
  const totSrvPlusMinus = totals ? totals.srvAce - totals.srvErr : 0;

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-6 overflow-hidden">
      <div className="bg-white w-full max-w-7xl h-[94vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-[#0033A0] to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Activity className="text-amber-400" size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-black uppercase tracking-wider flex items-center gap-2">
                Practice Session Stats
              </h2>
              <p className="text-xs sm:text-sm text-blue-200 font-bold">
                {activeMatch?.date ? new Date(activeMatch.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Active Session"} • Live Tracker
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={exportPracticeCSV}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              title="Export Practice CSV"
            >
              <Download size={16} />
              <span className="hidden md:inline">Export CSV</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenCorrection();
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              title="Stat Event Log & Corrections"
            >
              <Edit3 size={16} />
              <span className="hidden md:inline">Correction Log</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenDatabase();
              }}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 border border-amber-300"
              title="View in Full Stats Database"
            >
              <Activity size={16} className="text-slate-950" />
              <span>VIEW STATS</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors shrink-0"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* SCOPE SELECTION (TODAY'S TOTAL VS CURRENT DRILL) */}
        <div className="bg-slate-800/95 px-4 py-2 border-b border-slate-700 flex items-center justify-between text-xs font-bold text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 uppercase tracking-widest text-[10px] hidden sm:inline">Scope:</span>
            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => setScope("day")}
                className={`px-3 py-1 rounded-md transition-all font-black text-xs ${
                  scope === "day"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Today's Practice (All Drills)
              </button>
              <button
                onClick={() => setScope("current_set")}
                className={`px-3 py-1 rounded-md transition-all font-black text-xs ${
                  scope === "current_set"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Current Drill Only
              </button>
            </div>
          </div>
          <span className="text-[11px] text-slate-400">
            {scope === "day" ? "All drills today combined" : "Active drill set only"}
          </span>
        </div>

        {/* SUMMARY STAT CARDS */}
        {totals && (
          <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 shrink-0 grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
            <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Serving</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-black text-slate-800">{totals.srvAce}A / {totals.srvErr}E</span>
                <span className={`text-xs font-bold ${totSrvPlusMinus >= 0 ? "text-purple-700" : "text-red-500"}`}>
                  {totSrvPlusMinus >= 0 ? `+${totSrvPlusMinus}` : totSrvPlusMinus}
                </span>
              </div>
            </div>

            <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Attacking</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-black text-slate-800">{totals.attKill}K / {totals.attCount}</span>
                <span className="text-xs font-bold text-green-700">{totKillPct}</span>
              </div>
            </div>

            <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Digs</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-black text-slate-800">{totals.digCount}</span>
                <span className="text-xs font-bold text-red-500">{totals.digErr} errors</span>
              </div>
            </div>

            <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Blocks</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-black text-slate-800">{totals.blkStuff} Stuff</span>
                <span className="text-xs font-bold text-slate-500">{totals.blkTouch} touch</span>
              </div>
            </div>

            <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1 flex flex-col">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Passing</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl sm:text-2xl font-black text-slate-800">{totPassAvg}</span>
                <span className="text-xs font-bold text-slate-500">{totals.passCount} passes</span>
              </div>
            </div>
          </div>
        )}

        {/* CONTROLS / FILTER BAR */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 w-full sm:w-72">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search player or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "all" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Stats
            </button>
            <button
              onClick={() => setActiveTab("serve")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "serve" ? "bg-white text-purple-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Serving
            </button>
            <button
              onClick={() => setActiveTab("attack")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "attack" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Attacking
            </button>
            <button
              onClick={() => setActiveTab("defense")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "defense" ? "bg-white text-amber-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Digs & Blocks
            </button>
            <button
              onClick={() => setActiveTab("pass")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "pass" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Passing
            </button>
          </div>
        </div>

        {/* DETAILED STATS TABLE */}
        <div className="flex-1 overflow-auto bg-slate-50 min-h-0">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead className="bg-slate-800 text-white uppercase text-[10px] sm:text-xs font-black tracking-wider sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="p-3 sticky left-0 bg-slate-800 z-30 min-w-[140px] shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                  Player
                </th>

                {(activeTab === "all" || activeTab === "serve") && (
                  <>
                    <th className="p-3 text-center bg-purple-900/60 border-l border-white/10">Serves (Tot)</th>
                    <th className="p-3 text-center bg-purple-900/60 border-l border-white/10">Aces</th>
                    <th className="p-3 text-center bg-purple-900/40 border-l border-white/10">Errors</th>
                    <th className="p-3 text-center bg-purple-900/40 border-l border-white/10">In Play</th>
                    <th className="p-3 text-center bg-purple-900/40 border-l border-white/10">+/-</th>
                  </>
                )}

                {(activeTab === "all" || activeTab === "attack") && (
                  <>
                    <th className="p-3 text-center bg-green-900/60 border-l border-white/10">Att (Swings)</th>
                    <th className="p-3 text-center bg-green-900/60 border-l border-white/10">Kills</th>
                    <th className="p-3 text-center bg-green-900/60 border-l border-white/10">Kill %</th>
                    <th className="p-3 text-center bg-green-900/40 border-l border-white/10">Errors</th>
                    <th className="p-3 text-center bg-green-900/40 border-l border-white/10">Blocked</th>
                    <th className="p-3 text-center bg-green-900/40 border-l border-white/10">Hit Eff</th>
                  </>
                )}

                {(activeTab === "all" || activeTab === "defense") && (
                  <>
                    <th className="p-3 text-center bg-amber-900/60 border-l border-white/10">Digs (Tot)</th>
                    <th className="p-3 text-center bg-amber-900/40 border-l border-white/10">Dig Err</th>
                    <th className="p-3 text-center bg-teal-900/60 border-l border-white/10">Stuffs</th>
                    <th className="p-3 text-center bg-teal-900/40 border-l border-white/10">Touches</th>
                    <th className="p-3 text-center bg-teal-900/40 border-l border-white/10">Faults</th>
                  </>
                )}

                {(activeTab === "all" || activeTab === "pass") && (
                  <>
                    <th className="p-3 text-center bg-blue-900/60 border-l border-white/10">Pass Avg</th>
                    <th className="p-3 text-center bg-blue-900/60 border-l border-white/10">Passes (Tot)</th>
                    <th className="p-3 text-center bg-blue-900/40 border-l border-white/10">3 / 2 / 1 / 0</th>
                  </>
                )}
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-200 font-medium">
              {filteredPlayers.map((p, idx) => {
                const passAvg = p.passCount > 0 ? (p.passSum / p.passCount).toFixed(2) : "-";
                const killPct = p.attCount > 0 ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%" : "0.0%";
                const hitEff = p.attCount > 0 ? ((p.attKill - p.attErr) / p.attCount).toFixed(3) : ".000";
                const srvTot = p.srvCount + p.srvAce + p.srvErr;
                const srvPlusMinus = p.srvAce - p.srvErr;

                return (
                  <tr key={p.id} className="hover:bg-blue-50/50 bg-white transition-colors">
                    <td className="p-3 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] flex items-center space-x-2.5">
                      <span className="w-7 h-7 rounded-full bg-blue-100 text-[#0033A0] font-black flex items-center justify-center text-xs shrink-0">
                        {p.number}
                      </span>
                      <span className="font-bold text-slate-800 truncate">{p.name}</span>
                    </td>

                    {(activeTab === "all" || activeTab === "serve") && (
                      <>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "serve", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 font-bold text-slate-800 cursor-pointer hover:bg-purple-100/60 transition-colors"
                          title="Click to view detailed Serve breakdown (Net, Wide, Long, Foot Fault)"
                        >
                          {srvTot}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "serve", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 font-black text-purple-600 text-sm sm:text-base cursor-pointer hover:bg-purple-100/60 transition-colors"
                          title="Click to view detailed Serve breakdown"
                        >
                          {p.srvAce}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "serve", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 text-red-500 font-bold cursor-pointer hover:bg-red-50 transition-colors"
                          title="Click to view error breakdown (Net, Wide, Long, Foot Fault)"
                        >
                          {p.srvErr}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "serve", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 text-slate-600 cursor-pointer hover:bg-purple-50 transition-colors"
                        >
                          {p.srvCount}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "serve", titleContext: "Practice Stats" })}
                          className={`p-3 text-center border-l border-slate-200 font-black cursor-pointer hover:bg-purple-50 transition-colors ${
                          srvPlusMinus > 0 ? "text-purple-700" : srvPlusMinus < 0 ? "text-red-500" : "text-slate-500"
                        }`}>
                          {srvPlusMinus > 0 ? `+${srvPlusMinus}` : srvPlusMinus}
                        </td>
                      </>
                    )}

                    {(activeTab === "all" || activeTab === "attack") && (
                      <>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "attack", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 font-black text-slate-800 cursor-pointer hover:bg-green-100/60 transition-colors"
                          title="Click to view Attack breakdown (Kills, Net, Out, Stuffed, Front/Back)"
                        >
                          {p.attCount}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "attack", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 font-black text-green-600 text-sm sm:text-base cursor-pointer hover:bg-green-100/60 transition-colors"
                        >
                          {p.attKill}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "attack", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 font-bold text-green-700 cursor-pointer hover:bg-green-50 transition-colors"
                        >
                          {killPct}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "attack", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 text-red-500 font-bold cursor-pointer hover:bg-red-50 transition-colors"
                          title="Click to view Attack errors (Net, Out, Stuffed)"
                        >
                          {p.attErr}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "attack", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 text-slate-600 cursor-pointer hover:bg-amber-50 transition-colors"
                        >
                          {p.attBlk}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "attack", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 font-mono font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                          {hitEff}
                        </td>
                      </>
                    )}

                    {(activeTab === "all" || activeTab === "defense") && (
                      <>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "dig", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 font-black text-amber-700 cursor-pointer hover:bg-amber-100/60 transition-colors"
                          title="Click to view Dig breakdown"
                        >
                          {p.digCount}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "dig", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 text-red-500 font-bold cursor-pointer hover:bg-red-50 transition-colors"
                        >
                          {p.digErr}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "block", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 font-black text-teal-700 cursor-pointer hover:bg-teal-100/60 transition-colors"
                          title="Click to view Block breakdown (Stuffs, Late, Net Viol, Used)"
                        >
                          {p.blkStuff}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "block", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 text-slate-600 cursor-pointer hover:bg-teal-50 transition-colors"
                        >
                          {p.blkTouch}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "block", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 text-slate-500 cursor-pointer hover:bg-red-50 transition-colors"
                          title="Click to view Block Faults (Late, Net, Used)"
                        >
                          {p.blkFault}
                        </td>
                      </>
                    )}

                    {(activeTab === "all" || activeTab === "pass") && (
                      <>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "pass", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 font-black text-blue-700 text-sm sm:text-base cursor-pointer hover:bg-blue-100/60 transition-colors"
                          title="Click to view Passing breakdown (3s, 2s, 1s, 0s)"
                        >
                          {passAvg}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "pass", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 font-bold text-slate-700 cursor-pointer hover:bg-blue-50 transition-colors"
                        >
                          {p.passCount}
                        </td>
                        <td
                          onClick={() => setBreakdownModal({ isOpen: true, player: p, category: "pass", titleContext: "Practice Stats" })}
                          className="p-3 text-center border-l border-slate-200 text-slate-500 font-mono text-xs cursor-pointer hover:bg-blue-50 transition-colors"
                          title="Click to view 3/2/1/0 breakdown"
                        >
                          <span className="text-emerald-600 font-bold">{p.p3}</span> /{" "}
                          <span className="text-blue-600 font-bold">{p.p2}</span> /{" "}
                          <span className="text-amber-600 font-bold">{p.p1}</span> /{" "}
                          <span className="text-red-500 font-bold">{p.p0}</span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}

              {/* TOTALS ROW */}
              {totals && (
                <tr className="bg-indigo-50/90 font-black text-slate-900 border-t-2 border-indigo-200 sticky bottom-0 z-20 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
                  <td className="p-3 sticky left-0 bg-indigo-50/95 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.1)] uppercase tracking-wider text-indigo-900">
                    TEAM TOTAL
                  </td>

                  {(activeTab === "all" || activeTab === "serve") && (
                    <>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "serve", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                        title="Click to view Team Serve breakdown"
                      >
                        {totSrvTot}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "serve", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 text-purple-800 text-sm sm:text-base cursor-pointer hover:bg-indigo-100 transition-colors"
                      >
                        {totals.srvAce}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "serve", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 text-red-600 cursor-pointer hover:bg-red-100 transition-colors"
                        title="Click to view Team Serve error breakdown"
                      >
                        {totals.srvErr}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "serve", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                      >
                        {totals.srvCount}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "serve", titleContext: "Practice Team Totals" })}
                        className={`p-3 text-center border-l border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors ${
                        totSrvPlusMinus > 0 ? "text-purple-800" : totSrvPlusMinus < 0 ? "text-red-600" : ""
                      }`}>
                        {totSrvPlusMinus > 0 ? `+${totSrvPlusMinus}` : totSrvPlusMinus}
                      </td>
                    </>
                  )}

                  {(activeTab === "all" || activeTab === "attack") && (
                    <>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "attack", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                        title="Click to view Team Attack breakdown"
                      >
                        {totals.attCount}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "attack", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 text-green-700 text-sm sm:text-base cursor-pointer hover:bg-indigo-100 transition-colors"
                      >
                        {totals.attKill}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "attack", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 text-green-800 cursor-pointer hover:bg-indigo-100 transition-colors"
                      >
                        {totKillPct}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "attack", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 text-red-600 cursor-pointer hover:bg-red-100 transition-colors"
                        title="Click to view Team Attack error breakdown"
                      >
                        {totals.attErr}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "attack", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                      >
                        {totals.attBlk}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "attack", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 font-mono cursor-pointer hover:bg-indigo-100 transition-colors"
                      >
                        {totHitEff}
                      </td>
                    </>
                  )}

                  {(activeTab === "all" || activeTab === "defense") && (
                    <>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "dig", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 text-amber-800 cursor-pointer hover:bg-indigo-100 transition-colors"
                        title="Click to view Team Dig breakdown"
                      >
                        {totals.digCount}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "dig", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 text-red-600 cursor-pointer hover:bg-red-100 transition-colors"
                      >
                        {totals.digErr}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "block", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 text-teal-800 cursor-pointer hover:bg-indigo-100 transition-colors"
                        title="Click to view Team Block breakdown"
                      >
                        {totals.blkStuff}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "block", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                      >
                        {totals.blkTouch}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "block", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                      >
                        {totals.blkFault}
                      </td>
                    </>
                  )}

                  {(activeTab === "all" || activeTab === "pass") && (
                    <>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "pass", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 text-blue-900 text-sm sm:text-base cursor-pointer hover:bg-indigo-100 transition-colors"
                        title="Click to view Team Passing breakdown"
                      >
                        {totPassAvg}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "pass", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                      >
                        {totals.passCount}
                      </td>
                      <td
                        onClick={() => setBreakdownModal({ isOpen: true, player: totals, category: "pass", titleContext: "Practice Team Totals" })}
                        className="p-3 text-center border-l border-indigo-200 font-mono text-xs cursor-pointer hover:bg-indigo-100 transition-colors"
                        title="Click to view Team 3/2/1/0 breakdown"
                      >
                        {totals.p3} / {totals.p2} / {totals.p1} / {totals.p0}
                      </td>
                    </>
                  )}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-100 p-3 sm:p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-500">
            Showing stats for {filteredPlayers.length} active players in this session.
          </span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-black px-6 py-2 rounded-xl text-xs sm:text-sm uppercase tracking-wider transition-colors active:scale-95"
          >
            Back to Drills
          </button>
        </div>

      </div>

      {/* STAT BREAKDOWN MODAL */}
      <StatBreakdownModal
        isOpen={breakdownModal.isOpen}
        onClose={() => setBreakdownModal((prev) => ({ ...prev, isOpen: false }))}
        selectedPlayer={breakdownModal.player}
        initialCategory={breakdownModal.category}
        titleContext={breakdownModal.titleContext}
      />
    </div>
  );
};
