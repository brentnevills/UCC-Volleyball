import React, { useState } from "react";
import {
  X,
  Activity,
  Shield,
  Crosshair,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Info,
  Maximize2,
  Minimize2,
  Sparkles,
  BarChart3,
  Copy,
  Check,
} from "lucide-react";

export type StatCategoryType = "all" | "serve" | "attack" | "block" | "pass" | "dig";

export interface PlayerBreakdownStats {
  id: string;
  name: string;
  number?: string;
  isRetired?: boolean;
  // Passing
  passCount: number;
  passSum: number;
  pass3: number;
  pass2: number;
  pass1: number;
  pass0: number;
  // Attacking
  attCount: number;
  attCountFront: number;
  attCountBack: number;
  attKill: number;
  attErr: number;
  attErrNet: number;
  attErrOut: number;
  attErrStuffed: number;
  attBlk: number;
  // Blocking
  blkCount: number;
  blkStuff: number;
  blkLate: number;
  blkNet: number;
  blkUsed: number;
  // Serving
  srvCount: number;
  srvAce: number;
  srvErr: number;
  srvErrNet: number;
  srvErrWide: number;
  srvErrLong: number;
  srvErrFoot: number;
  srvErrOther: number;
  // Digs
  digCount: number;
  digErr: number;
}

interface StatBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: StatCategoryType;
  selectedPlayer: PlayerBreakdownStats | null;
  allPlayers?: PlayerBreakdownStats[];
  teamStats?: PlayerBreakdownStats;
  onSelectPlayer?: (player: PlayerBreakdownStats) => void;
  titleContext?: string;
}

export const StatBreakdownModal: React.FC<StatBreakdownModalProps> = ({
  isOpen,
  onClose,
  initialCategory = "all",
  selectedPlayer,
  allPlayers = [],
  teamStats,
  onSelectPlayer,
  titleContext,
}) => {
  const [activeCategory, setActiveCategory] =
    useState<StatCategoryType>(initialCategory);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync initial category when modal opens
  React.useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory, isOpen]);

  if (!isOpen || !selectedPlayer) return null;

  const isTeam =
    selectedPlayer.id === "TEAM_TOTALS" ||
    selectedPlayer.id === "SHOWN_PLAYERS" ||
    selectedPlayer.name === "TEAM TOTALS" ||
    selectedPlayer.name === "Team Totals" ||
    selectedPlayer.name.toLowerCase().includes("team") ||
    selectedPlayer.name.toLowerCase().includes("shown");

  // Calculations
  // Serving
  const totalServes =
    selectedPlayer.srvCount + selectedPlayer.srvAce + selectedPlayer.srvErr;
  const srvAcePct =
    totalServes > 0
      ? ((selectedPlayer.srvAce / totalServes) * 100).toFixed(1)
      : "0.0";
  const srvErrPct =
    totalServes > 0
      ? ((selectedPlayer.srvErr / totalServes) * 100).toFixed(1)
      : "0.0";
  const srvInRate =
    totalServes > 0
      ? (((totalServes - selectedPlayer.srvErr) / totalServes) * 100).toFixed(1)
      : "0.0";
  const srvPlusMinus = selectedPlayer.srvAce - selectedPlayer.srvErr;

  // Attack
  const totalSwings = selectedPlayer.attCount;
  const killPct =
    totalSwings > 0
      ? ((selectedPlayer.attKill / totalSwings) * 100).toFixed(1)
      : "0.0";
  const attErrPct =
    totalSwings > 0
      ? ((selectedPlayer.attErr / totalSwings) * 100).toFixed(1)
      : "0.0";
  const attEfficiency =
    totalSwings > 0
      ? (
          ((selectedPlayer.attKill - selectedPlayer.attErr) / totalSwings) *
          100
        ).toFixed(1)
      : "0.0";
  const frontPct =
    totalSwings > 0
      ? ((selectedPlayer.attCountFront / totalSwings) * 100).toFixed(0)
      : "0";
  const backPct =
    totalSwings > 0
      ? ((selectedPlayer.attCountBack / totalSwings) * 100).toFixed(0)
      : "0";

  // Block
  const totalBlockActions =
    selectedPlayer.blkStuff +
    selectedPlayer.blkCount +
    selectedPlayer.blkLate +
    selectedPlayer.blkNet +
    selectedPlayer.blkUsed;
  const totalFaults =
    selectedPlayer.blkLate + selectedPlayer.blkNet + selectedPlayer.blkUsed;

  // Passing
  const totalPasses = selectedPlayer.passCount;
  const passAvg =
    totalPasses > 0
      ? (selectedPlayer.passSum / totalPasses).toFixed(2)
      : "0.00";
  const inSystemPasses = selectedPlayer.pass3 + selectedPlayer.pass2;
  const inSystemPct =
    totalPasses > 0
      ? ((inSystemPasses / totalPasses) * 100).toFixed(1)
      : "0.0";
  const p3Pct =
    totalPasses > 0
      ? ((selectedPlayer.pass3 / totalPasses) * 100).toFixed(1)
      : "0.0";
  const p2Pct =
    totalPasses > 0
      ? ((selectedPlayer.pass2 / totalPasses) * 100).toFixed(1)
      : "0.0";
  const p1Pct =
    totalPasses > 0
      ? ((selectedPlayer.pass1 / totalPasses) * 100).toFixed(1)
      : "0.0";
  const p0Pct =
    totalPasses > 0
      ? ((selectedPlayer.pass0 / totalPasses) * 100).toFixed(1)
      : "0.0";

  // Digs
  const totalDigAttempts = selectedPlayer.digCount + selectedPlayer.digErr;
  const digSuccessPct =
    totalDigAttempts > 0
      ? ((selectedPlayer.digCount / totalDigAttempts) * 100).toFixed(1)
      : "0.0";

  // All-Around Impact
  const pointsWon =
    selectedPlayer.srvAce + selectedPlayer.attKill + selectedPlayer.blkStuff;
  const errorsGiven =
    selectedPlayer.srvErr +
    selectedPlayer.attErr +
    totalFaults +
    selectedPlayer.digErr +
    selectedPlayer.pass0;
  const netImpact = pointsWon - errorsGiven;
  const totalTouches =
    totalServes +
    totalSwings +
    totalBlockActions +
    totalPasses +
    totalDigAttempts;

  const triggerBrowserFullscreen = () => {
    try {
      const doc = document as any;
      const docElm = document.documentElement as any;
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
        if (docElm.requestFullscreen) docElm.requestFullscreen().catch(() => {});
        else if (docElm.webkitRequestFullscreen) docElm.webkitRequestFullscreen();
      }
    } catch (e) {}
    setIsMaximized(true);
  };

  const handleCopySummary = () => {
    const lines = [
      `📊 ${selectedPlayer.name} (#${selectedPlayer.number || "-"}) - Detailed Volleyball Stats`,
      `Context: ${titleContext || "Season / Match"}`,
      `⭐ Net Point Differential: ${netImpact > 0 ? `+${netImpact}` : netImpact} (Points Won: ${pointsWon} | Errors: ${errorsGiven})`,
      `🏐 Serves: ${totalServes} (Aces: ${selectedPlayer.srvAce}, In-Play: ${selectedPlayer.srvCount}, Errs: ${selectedPlayer.srvErr} [Net: ${selectedPlayer.srvErrNet}, Wide: ${selectedPlayer.srvErrWide}, Long: ${selectedPlayer.srvErrLong}, Foot: ${selectedPlayer.srvErrFoot}])`,
      `⚡ Attacks: ${totalSwings} swings (Kills: ${selectedPlayer.attKill} [${killPct}%], Errs: ${selectedPlayer.attErr} [${attEfficiency}% Eff.], Net: ${selectedPlayer.attErrNet}, Out: ${selectedPlayer.attErrOut}, Stuffed: ${selectedPlayer.attErrStuffed})`,
      `🛡️ Blocks: ${selectedPlayer.blkStuff} Stuffs, ${selectedPlayer.blkCount} Touches, ${totalFaults} Faults (Late: ${selectedPlayer.blkLate}, Net: ${selectedPlayer.blkNet}, Used: ${selectedPlayer.blkUsed})`,
      `📥 Passing: ${passAvg} Avg (${totalPasses} total | Perfect 3s: ${selectedPlayer.pass3}, Good 2s: ${selectedPlayer.pass2}, Poor 1s: ${selectedPlayer.pass1}, Error 0s: ${selectedPlayer.pass0})`,
      `🤾 Digs: ${selectedPlayer.digCount} Digs, ${selectedPlayer.digErr} Errs (${digSuccessPct}% Success)`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`fixed inset-0 bg-slate-950/85 z-[120] flex items-center justify-center backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto ${
        isMaximized ? "p-0" : "p-2 sm:p-4 md:p-6"
      }`}
    >
      <div
        className={`bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all duration-200 ${
          isMaximized
            ? "w-full h-full max-w-none max-h-none rounded-none"
            : "w-full max-w-3xl rounded-2xl sm:rounded-3xl max-h-[94vh] my-auto"
        }`}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-[#0033A0] p-4 sm:p-5 text-white shrink-0 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl font-black flex items-center justify-center text-base sm:text-xl shrink-0 shadow-inner ${
                  isTeam
                    ? "bg-amber-400 text-slate-950"
                    : "bg-white/10 text-white border border-white/20"
                }`}
              >
                {isTeam ? "★" : selectedPlayer.number || "#"}
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-black text-white tracking-wide truncate">
                    {selectedPlayer.name}
                  </h3>
                  {isTeam && (
                    <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider border border-amber-400/30">
                      Team Totals
                    </span>
                  )}
                </div>
                <p className="text-xs text-blue-200 font-medium truncate flex items-center gap-1.5 mt-0.5">
                  <span className="font-bold text-white">
                    Full In-Depth Stat Breakdown
                  </span>
                  {titleContext && (
                    <>
                      <span>•</span>
                      <span className="text-blue-100/90">{titleContext}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Copy Summary */}
              <button
                type="button"
                onClick={handleCopySummary}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Copy stat breakdown to clipboard"
              >
                {copied ? (
                  <Check size={15} className="text-emerald-400" />
                ) : (
                  <Copy size={15} />
                )}
                <span className="hidden sm:inline">
                  {copied ? "Copied!" : "Copy"}
                </span>
              </button>

              {/* Maximize / Fullscreen Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (!isMaximized) {
                    triggerBrowserFullscreen();
                  } else {
                    setIsMaximized(false);
                  }
                }}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                title={
                  isMaximized ? "Restore Window Size" : "Force Full Screen"
                }
              >
                {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-red-500/30 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
                title="Close breakdown"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Player Switcher if multiple players provided */}
          {allPlayers.length > 0 && onSelectPlayer && (
            <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 shrink-0">
                Switch:
              </span>
              {teamStats && (
                <button
                  type="button"
                  onClick={() => onSelectPlayer(teamStats)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wide shrink-0 transition-all ${
                    isTeam
                      ? "bg-amber-400 text-slate-950 shadow-sm"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  ★ TEAM TOTALS
                </button>
              )}
              {allPlayers
                .filter((p) => !p.isRetired)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPlayer(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                      selectedPlayer.id === p.id && !isTeam
                        ? "bg-white text-indigo-950 font-black shadow-sm"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    #{p.number || "-"} {p.name.split(" ")[0]}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Category Tabs */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`flex-1 min-w-[105px] py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeCategory === "all"
                ? "bg-[#0033A0] text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/80"
            }`}
          >
            <Sparkles
              size={14}
              className={
                activeCategory === "all" ? "text-amber-300" : "text-amber-500"
              }
            />
            <span>All-Around</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("serve")}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeCategory === "serve"
                ? "bg-[#0033A0] text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/80"
            }`}
          >
            <Flame
              size={14}
              className={
                activeCategory === "serve" ? "text-amber-300" : "text-purple-600"
              }
            />
            <span>Serving</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("attack")}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeCategory === "attack"
                ? "bg-[#0033A0] text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/80"
            }`}
          >
            <Crosshair
              size={14}
              className={
                activeCategory === "attack" ? "text-amber-300" : "text-red-500"
              }
            />
            <span>Attack</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("block")}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeCategory === "block"
                ? "bg-[#0033A0] text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/80"
            }`}
          >
            <Shield
              size={14}
              className={
                activeCategory === "block" ? "text-amber-300" : "text-emerald-600"
              }
            />
            <span>Block</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("pass")}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeCategory === "pass"
                ? "bg-[#0033A0] text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/80"
            }`}
          >
            <Activity
              size={14}
              className={
                activeCategory === "pass" ? "text-amber-300" : "text-blue-600"
              }
            />
            <span>Passing</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("dig")}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeCategory === "dig"
                ? "bg-[#0033A0] text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/80"
            }`}
          >
            <TrendingUp
              size={14}
              className={
                activeCategory === "dig" ? "text-amber-300" : "text-teal-600"
              }
            />
            <span>Digs</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* ===================== ALL-AROUND & IMPACT TAB ===================== */}
          {activeCategory === "all" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Primary Impact Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-3.5 text-center shadow-sm">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                    Points Won
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-emerald-700 my-0.5 block">
                    {pointsWon}
                  </span>
                  <span className="text-[10px] text-emerald-800 font-bold block">
                    {selectedPlayer.attKill}K • {selectedPlayer.srvAce}A •{" "}
                    {selectedPlayer.blkStuff}B
                  </span>
                </div>

                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-3.5 text-center shadow-sm">
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-700 block">
                    Terminal Errors
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-red-600 my-0.5 block">
                    {errorsGiven}
                  </span>
                  <span className="text-[10px] text-red-700 font-bold block">
                    Points conceded
                  </span>
                </div>

                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-3.5 text-center shadow-sm">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">
                    Net Scoring (+/-)
                  </span>
                  <span
                    className={`text-3xl sm:text-4xl font-black my-0.5 block ${
                      netImpact > 0
                        ? "text-emerald-600"
                        : netImpact < 0
                          ? "text-red-600"
                          : "text-slate-600"
                    }`}
                  >
                    {netImpact > 0 ? `+${netImpact}` : netImpact}
                  </span>
                  <span className="text-[10px] text-indigo-800 font-bold block">
                    Point Differential
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center shadow-sm">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Total Touches
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-slate-800 my-0.5 block">
                    {totalTouches}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block">
                    All Game Involvements
                  </span>
                </div>
              </div>

              {/* Discipline Quick Jump Matrix */}
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <BarChart3 size={16} className="text-blue-600" />
                    Complete Discipline Scorecard
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400">
                    Tap any card for deep breakdown
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Serving Card */}
                  <div
                    onClick={() => setActiveCategory("serve")}
                    className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 hover:bg-purple-100/60 cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black uppercase text-purple-900 flex items-center gap-1">
                        <Flame size={14} className="text-purple-600" /> Serving
                      </span>
                      <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                        {srvInRate}% In
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-800">
                      {totalServes} Serves • {selectedPlayer.srvAce} Aces •{" "}
                      {selectedPlayer.srvErr} Errs
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 mt-1 flex justify-between">
                      <span>
                        Misses: {selectedPlayer.srvErrNet} Net,{" "}
                        {selectedPlayer.srvErrWide} Wide,{" "}
                        {selectedPlayer.srvErrLong} Long
                      </span>
                      <span className="text-purple-700 font-bold">
                        Details →
                      </span>
                    </div>
                  </div>

                  {/* Attack Card */}
                  <div
                    onClick={() => setActiveCategory("attack")}
                    className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 hover:bg-red-100/60 cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black uppercase text-red-900 flex items-center gap-1">
                        <Crosshair size={14} className="text-red-500" /> Attack
                      </span>
                      <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                        {attEfficiency}% Eff.
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-800">
                      {totalSwings} Swings • {selectedPlayer.attKill} Kills (
                      {killPct}%)
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 mt-1 flex justify-between">
                      <span>
                        Errors: {selectedPlayer.attErr} (
                        {selectedPlayer.attErrNet} Net,{" "}
                        {selectedPlayer.attErrOut} Out)
                      </span>
                      <span className="text-red-700 font-bold">Details →</span>
                    </div>
                  </div>

                  {/* Block Card */}
                  <div
                    onClick={() => setActiveCategory("block")}
                    className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-100/60 cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black uppercase text-emerald-900 flex items-center gap-1">
                        <Shield size={14} className="text-emerald-600" />{" "}
                        Blocking
                      </span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        {selectedPlayer.blkStuff} Stuffs
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-800">
                      {selectedPlayer.blkCount} Touches • {totalFaults} Faults
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 mt-1 flex justify-between">
                      <span>
                        Faults: {selectedPlayer.blkLate} Late,{" "}
                        {selectedPlayer.blkNet} Net, {selectedPlayer.blkUsed}{" "}
                        Used
                      </span>
                      <span className="text-emerald-700 font-bold">
                        Details →
                      </span>
                    </div>
                  </div>

                  {/* Passing Card */}
                  <div
                    onClick={() => setActiveCategory("pass")}
                    className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-100/60 cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black uppercase text-blue-900 flex items-center gap-1">
                        <Activity size={14} className="text-blue-600" /> Passing
                        (0-3)
                      </span>
                      <span className="text-xs font-black text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                        {passAvg} Avg
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-800">
                      {totalPasses} Receives • {inSystemPct}% In-System
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 mt-1 flex justify-between">
                      <span>
                        3s: {selectedPlayer.pass3} | 2s: {selectedPlayer.pass2}{" "}
                        | 1s: {selectedPlayer.pass1} | 0s:{" "}
                        {selectedPlayer.pass0}
                      </span>
                      <span className="text-blue-700 font-bold">
                        Details →
                      </span>
                    </div>
                  </div>

                  {/* Defense Card */}
                  <div
                    onClick={() => setActiveCategory("dig")}
                    className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/40 hover:bg-teal-100/60 cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black uppercase text-teal-900 flex items-center gap-1">
                        <TrendingUp size={14} className="text-teal-600" />{" "}
                        Defense & Digs
                      </span>
                      <span className="text-xs font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-md">
                        {digSuccessPct}%
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-800">
                      {selectedPlayer.digCount} Digs • {selectedPlayer.digErr}{" "}
                      Errors
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 mt-1 flex justify-between">
                      <span>Total Chances: {totalDigAttempts}</span>
                      <span className="text-teal-700 font-bold">
                        Details →
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================== SERVING TAB ===================== */}
          {activeCategory === "serve" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Stat Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Total Serves
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-800">
                    {totalServes}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                    {selectedPlayer.srvCount} In-Play
                  </span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
                    Aces
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                    {selectedPlayer.srvAce}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-black block mt-0.5">
                    {srvAcePct}% Ace Rate
                  </span>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-600 block">
                    Errors (Misses)
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-red-600">
                    {selectedPlayer.srvErr}
                  </span>
                  <span className="text-[10px] text-red-500 font-black block mt-0.5">
                    {srvErrPct}% Error Rate
                  </span>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">
                    Serve +/-
                  </span>
                  <span
                    className={`text-2xl sm:text-3xl font-black ${
                      srvPlusMinus > 0
                        ? "text-emerald-600"
                        : srvPlusMinus < 0
                          ? "text-red-500"
                          : "text-slate-600"
                    }`}
                  >
                    {srvPlusMinus > 0 ? `+${srvPlusMinus}` : srvPlusMinus}
                  </span>
                  <span className="text-[10px] text-blue-700 font-bold block mt-0.5">
                    {srvInRate}% In-Court
                  </span>
                </div>
              </div>

              {/* SERVE ERROR BREAKDOWN SECTION (Net, Wide, Long/Out, Foot) */}
              <div className="bg-white border-2 border-red-100 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-red-100 pb-2">
                  <h4 className="text-xs sm:text-sm font-black text-red-900 uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-500" />
                    Serve Error Breakdown ({selectedPlayer.srvErr} Total)
                  </h4>
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                    Miss Details
                  </span>
                </div>

                {selectedPlayer.srvErr === 0 ? (
                  <div className="py-6 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 size={28} className="text-emerald-500" />
                    <span>
                      0 Serve Errors logged for this selection! Perfect
                      consistency.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* NET */}
                      <div className="bg-red-50/60 border border-red-200 rounded-xl p-3 flex flex-col items-center text-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-red-800">
                          🥅 Into Net
                        </span>
                        <span className="text-2xl font-black text-red-600 my-0.5">
                          {selectedPlayer.srvErrNet}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {selectedPlayer.srvErr > 0
                            ? (
                                (selectedPlayer.srvErrNet /
                                  selectedPlayer.srvErr) *
                                100
                              ).toFixed(0)
                            : 0}
                          % of errors
                        </span>
                      </div>

                      {/* WIDE */}
                      <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 flex flex-col items-center text-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                          ↔️ Wide
                        </span>
                        <span className="text-2xl font-black text-amber-600 my-0.5">
                          {selectedPlayer.srvErrWide}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {selectedPlayer.srvErr > 0
                            ? (
                                (selectedPlayer.srvErrWide /
                                  selectedPlayer.srvErr) *
                                100
                              ).toFixed(0)
                            : 0}
                          % of errors
                        </span>
                      </div>

                      {/* LONG / OUT */}
                      <div className="bg-orange-50/60 border border-orange-200 rounded-xl p-3 flex flex-col items-center text-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-orange-800">
                          ⬆️ Long / Out
                        </span>
                        <span className="text-2xl font-black text-orange-600 my-0.5">
                          {selectedPlayer.srvErrLong}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {selectedPlayer.srvErr > 0
                            ? (
                                (selectedPlayer.srvErrLong /
                                  selectedPlayer.srvErr) *
                                100
                              ).toFixed(0)
                            : 0}
                          % of errors
                        </span>
                      </div>

                      {/* FOOT FAULT / OTHER */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center text-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                          🦶 Foot / Other
                        </span>
                        <span className="text-2xl font-black text-slate-600 my-0.5">
                          {selectedPlayer.srvErrFoot +
                            selectedPlayer.srvErrOther}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {selectedPlayer.srvErr > 0
                            ? (
                                ((selectedPlayer.srvErrFoot +
                                  selectedPlayer.srvErrOther) /
                                  selectedPlayer.srvErr) *
                                100
                              ).toFixed(0)
                            : 0}
                          % of errors
                        </span>
                      </div>
                    </div>

                    {/* Visual Proportion Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 mb-1.5">
                        <span>Serve Outcome Distribution</span>
                        <span>{totalServes} Total</span>
                      </div>
                      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        {selectedPlayer.srvAce > 0 && (
                          <div
                            style={{
                              width: `${(selectedPlayer.srvAce / totalServes) * 100}%`,
                            }}
                            className="bg-emerald-500 h-full"
                            title={`Aces: ${selectedPlayer.srvAce}`}
                          />
                        )}
                        {selectedPlayer.srvCount > 0 && (
                          <div
                            style={{
                              width: `${(selectedPlayer.srvCount / totalServes) * 100}%`,
                            }}
                            className="bg-blue-500 h-full"
                            title={`In-Play: ${selectedPlayer.srvCount}`}
                          />
                        )}
                        {selectedPlayer.srvErrNet > 0 && (
                          <div
                            style={{
                              width: `${(selectedPlayer.srvErrNet / totalServes) * 100}%`,
                            }}
                            className="bg-red-500 h-full"
                            title={`Net Error: ${selectedPlayer.srvErrNet}`}
                          />
                        )}
                        {selectedPlayer.srvErrWide > 0 && (
                          <div
                            style={{
                              width: `${(selectedPlayer.srvErrWide / totalServes) * 100}%`,
                            }}
                            className="bg-amber-500 h-full"
                            title={`Wide Error: ${selectedPlayer.srvErrWide}`}
                          />
                        )}
                        {selectedPlayer.srvErrLong > 0 && (
                          <div
                            style={{
                              width: `${(selectedPlayer.srvErrLong / totalServes) * 100}%`,
                            }}
                            className="bg-orange-500 h-full"
                            title={`Long/Out: ${selectedPlayer.srvErrLong}`}
                          />
                        )}
                        {selectedPlayer.srvErrFoot +
                          selectedPlayer.srvErrOther >
                          0 && (
                          <div
                            style={{
                              width: `${
                                ((selectedPlayer.srvErrFoot +
                                  selectedPlayer.srvErrOther) /
                                  totalServes) *
                                100
                              }%`,
                            }}
                            className="bg-slate-400 h-full"
                            title={`Other Errors: ${selectedPlayer.srvErrFoot + selectedPlayer.srvErrOther}`}
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-bold text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />{" "}
                          Ace ({selectedPlayer.srvAce})
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />{" "}
                          In-Play ({selectedPlayer.srvCount})
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />{" "}
                          Net ({selectedPlayer.srvErrNet})
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />{" "}
                          Wide ({selectedPlayer.srvErrWide})
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />{" "}
                          Long ({selectedPlayer.srvErrLong})
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== ATTACK TAB ===================== */}
          {activeCategory === "attack" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Total Swings
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-800">
                    {totalSwings}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                    {selectedPlayer.attCountFront} Front /{" "}
                    {selectedPlayer.attCountBack} Back
                  </span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
                    Kills
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                    {selectedPlayer.attKill}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-black block mt-0.5">
                    {killPct}% Kill Rate
                  </span>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-600 block">
                    Attack Errors
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-red-600">
                    {selectedPlayer.attErr}
                  </span>
                  <span className="text-[10px] text-red-500 font-black block mt-0.5">
                    {attErrPct}% Error Rate
                  </span>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 block">
                    Efficiency
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-purple-700">
                    {attEfficiency}%
                  </span>
                  <span className="text-[10px] text-purple-600 font-bold block mt-0.5">
                    (K - E) / Swings
                  </span>
                </div>
              </div>

              {/* ATTACK ERROR & RESULT BREAKDOWN */}
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Crosshair size={16} className="text-red-500" />
                    Attack Error & Stoppage Breakdown
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* NET */}
                  <div className="bg-red-50/60 border border-red-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-800 block">
                      🥅 Net Hit
                    </span>
                    <span className="text-2xl font-black text-red-600 my-0.5 block">
                      {selectedPlayer.attErrNet}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      Error (Point Opp)
                    </span>
                  </div>

                  {/* OUT / WIDE */}
                  <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                      ↗️ Out / Wide
                    </span>
                    <span className="text-2xl font-black text-amber-600 my-0.5 block">
                      {selectedPlayer.attErrOut}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      Error (Point Opp)
                    </span>
                  </div>

                  {/* STUFFED */}
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block">
                      🛑 Stuffed Block
                    </span>
                    <span className="text-2xl font-black text-rose-600 my-0.5 block">
                      {selectedPlayer.attErrStuffed}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      Blocked for Point
                    </span>
                  </div>

                  {/* BLOCKED PLAY ON */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                      🔄 Blocked (Play On)
                    </span>
                    <span className="text-2xl font-black text-slate-700 my-0.5 block">
                      {selectedPlayer.attBlk}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      Touches / Re-sets
                    </span>
                  </div>
                </div>

                {/* ROW DISTRIBUTION */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>
                    Front Row Swings:{" "}
                    <strong>{selectedPlayer.attCountFront}</strong> ({frontPct}
                    %)
                  </span>
                  <span>
                    Back Row Swings:{" "}
                    <strong>{selectedPlayer.attCountBack}</strong> ({backPct}
                    %)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ===================== BLOCK TAB ===================== */}
          {activeCategory === "block" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
                    Stuff Blocks
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                    {selectedPlayer.blkStuff}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                    Points directly won
                  </span>
                </div>

                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 block">
                    Touches (Play On)
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-teal-700">
                    {selectedPlayer.blkCount}
                  </span>
                  <span className="text-[10px] text-teal-600 font-bold block mt-0.5">
                    Control / Slowed balls
                  </span>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-600 block">
                    Block Faults & Errors
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-red-600">
                    {totalFaults}
                  </span>
                  <span className="text-[10px] text-red-500 font-bold block mt-0.5">
                    Late, Net, or Used
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Total Involvements
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-800">
                    {totalBlockActions}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                    All Block Attempts
                  </span>
                </div>
              </div>

              {/* BLOCK FAULTS DETAILED BREAKDOWN (Late, Net, Used) */}
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Shield size={16} className="text-indigo-600" />
                    Block Faults Breakdown (Late, Net, Used)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* LATE */}
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                        ⏰ Late Block
                      </span>
                      <span className="text-2xl font-black text-amber-600">
                        {selectedPlayer.blkLate}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-2">
                      Arrived late closing the seam, creating open lanes or
                      toolable angles.
                    </p>
                  </div>

                  {/* NET VIOLATION */}
                  <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-red-900 flex items-center gap-1.5">
                        🥅 Net Violation
                      </span>
                      <span className="text-2xl font-black text-red-600">
                        {selectedPlayer.blkNet}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-2">
                      Touched net mesh, top tape, or crossed center line during
                      block jump.
                    </p>
                  </div>

                  {/* USED / TOOL */}
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        💥 Used / Tooled
                      </span>
                      <span className="text-2xl font-black text-slate-700">
                        {selectedPlayer.blkUsed}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-2">
                      Attacker wiped or tooled the ball off the blocker's hands
                      out of bounds.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================== PASSING TAB ===================== */}
          {activeCategory === "pass" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">
                    Pass Rating Avg
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-blue-800">
                    {passAvg}
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold block mt-0.5">
                    Scale: 0.00 - 3.00
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Total Passes
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-800">
                    {totalPasses}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                    Serve Receives
                  </span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
                    In-System (3s & 2s)
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                    {inSystemPasses}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-black block mt-0.5">
                    {inSystemPct}% In-System
                  </span>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-600 block">
                    Pass Errors (0s)
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-red-600">
                    {selectedPlayer.pass0}
                  </span>
                  <span className="text-[10px] text-red-500 font-black block mt-0.5">
                    {p0Pct}% Error / Ace Allowed
                  </span>
                </div>
              </div>

              {/* 3-2-1-0 RATING BREAKDOWN */}
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Activity size={16} className="text-blue-600" />
                    Passing Rating Distribution (0 to 3)
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Rating 3 */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-black text-emerald-800 uppercase">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">
                        3
                      </span>
                      <span>Perfect</span>
                    </div>
                    <span className="text-2xl font-black text-emerald-700 my-1 block">
                      {selectedPlayer.pass3}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold">
                      {p3Pct}% of passes
                    </span>
                  </div>

                  {/* Rating 2 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-black text-blue-800 uppercase">
                      <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                        2
                      </span>
                      <span>Good</span>
                    </div>
                    <span className="text-2xl font-black text-blue-700 my-1 block">
                      {selectedPlayer.pass2}
                    </span>
                    <span className="text-[10px] text-blue-600 font-bold">
                      {p2Pct}% of passes
                    </span>
                  </div>

                  {/* Rating 1 */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-black text-amber-800 uppercase">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">
                        1
                      </span>
                      <span>Poor</span>
                    </div>
                    <span className="text-2xl font-black text-amber-700 my-1 block">
                      {selectedPlayer.pass1}
                    </span>
                    <span className="text-[10px] text-amber-600 font-bold">
                      {p1Pct}% of passes
                    </span>
                  </div>

                  {/* Rating 0 */}
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-black text-red-800 uppercase">
                      <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs">
                        0
                      </span>
                      <span>Error</span>
                    </div>
                    <span className="text-2xl font-black text-red-600 my-1 block">
                      {selectedPlayer.pass0}
                    </span>
                    <span className="text-[10px] text-red-500 font-bold">
                      {p0Pct}% of passes
                    </span>
                  </div>
                </div>

                {/* Rating Bar */}
                {totalPasses > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                      {selectedPlayer.pass3 > 0 && (
                        <div
                          style={{
                            width: `${(selectedPlayer.pass3 / totalPasses) * 100}%`,
                          }}
                          className="bg-emerald-500 h-full"
                          title={`3s: ${selectedPlayer.pass3}`}
                        />
                      )}
                      {selectedPlayer.pass2 > 0 && (
                        <div
                          style={{
                            width: `${(selectedPlayer.pass2 / totalPasses) * 100}%`,
                          }}
                          className="bg-blue-500 h-full"
                          title={`2s: ${selectedPlayer.pass2}`}
                        />
                      )}
                      {selectedPlayer.pass1 > 0 && (
                        <div
                          style={{
                            width: `${(selectedPlayer.pass1 / totalPasses) * 100}%`,
                          }}
                          className="bg-amber-500 h-full"
                          title={`1s: ${selectedPlayer.pass1}`}
                        />
                      )}
                      {selectedPlayer.pass0 > 0 && (
                        <div
                          style={{
                            width: `${(selectedPlayer.pass0 / totalPasses) * 100}%`,
                          }}
                          className="bg-red-500 h-full"
                          title={`0s: ${selectedPlayer.pass0}`}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== DIGS / DEFENSE TAB ===================== */}
          {activeCategory === "dig" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">
                    Successful Digs
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-blue-800">
                    {selectedPlayer.digCount}
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold block mt-0.5">
                    Ball kept alive
                  </span>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-600 block">
                    Dig Errors
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-red-600">
                    {selectedPlayer.digErr}
                  </span>
                  <span className="text-[10px] text-red-500 font-bold block mt-0.5">
                    Shanked / unplayable
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Total Attempts
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-800">
                    {totalDigAttempts}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                    Defensive Actions
                  </span>
                </div>

                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 block">
                    Dig Success %
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-teal-700">
                    {digSuccessPct}%
                  </span>
                  <span className="text-[10px] text-teal-600 font-bold block mt-0.5">
                    Conversion Rate
                  </span>
                </div>
              </div>

              {/* DIG DETAILS */}
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <TrendingUp size={16} className="text-teal-600" />
                  Defense Performance
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-blue-900 uppercase tracking-wider block">
                        Control Digs
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Targeted or playable touch
                      </span>
                    </div>
                    <span className="text-2xl font-black text-blue-700">
                      {selectedPlayer.digCount}
                    </span>
                  </div>

                  <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-red-900 uppercase tracking-wider block">
                        Dig Errors
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Direct point to opponent
                      </span>
                    </div>
                    <span className="text-2xl font-black text-red-600">
                      {selectedPlayer.digErr}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Info size={14} className="text-indigo-600 shrink-0" />
            <span className="hidden sm:inline">
              Tap any column in the stats table to directly jump into that
              category's breakdown.
            </span>
            <span className="sm:hidden">
              Tap tabs above to view other skills.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!isMaximized) triggerBrowserFullscreen();
                else setIsMaximized(false);
              }}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
            >
              {isMaximized ? "Windowed" : "Full Screen"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
