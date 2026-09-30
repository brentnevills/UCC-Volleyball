import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Clock,
  TrendingUp,
  AlertTriangle,
  Users,
  Flame,
  Zap,
  Shield,
  Activity,
  CheckCircle2,
  X,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Target,
  Award,
  ArrowRightLeft,
  ChevronRight,
  Eye,
} from "lucide-react";

interface TimeoutStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCallOfficialTimeout?: (team: "ucc" | "opp") => void;
  onOpenSubModal?: () => void;
  ourTeamName: string;
  opponentName: string;
  score: { ucc: number; opp: number };
  setsWon: { ucc: number; opp: number };
  currentSetNum: number;
  serving: "ucc" | "opp";
  lineup: (string | null)[];
  roster: any[];
  stats: any[];
  activeMatch: any;
  activeSetId: string | null;
  teamStats: {
    uccSubs: number;
    oppSubs: number;
    uccTimeouts: number;
    oppTimeouts: number;
  };
  history?: any[];
}

export const TimeoutStatsModal: React.FC<TimeoutStatsModalProps> = ({
  isOpen,
  onClose,
  onCallOfficialTimeout,
  onOpenSubModal,
  ourTeamName = "UCC Lancers",
  opponentName = "Opponent",
  score = { ucc: 0, opp: 0 },
  setsWon = { ucc: 0, opp: 0 },
  currentSetNum = 1,
  serving = "ucc",
  lineup = [],
  roster = [],
  stats = [],
  activeMatch,
  activeSetId,
  teamStats = { uccSubs: 0, oppSubs: 0, uccTimeouts: 0, oppTimeouts: 0 },
  history = [],
}) => {
  // 60-second official timeout countdown timer
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Close attribution dialog state
  const [showCloseDialog, setShowCloseDialog] = useState<boolean>(false);

  // Play audio tones for 15s warning and 0s end
  const playChime = (type: "warning" | "buzzer" | "start") => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "start") {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === "warning") {
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);

        setTimeout(() => {
          try {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
            gain2.gain.setValueAtTime(0.25, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc2.start();
            osc2.stop(ctx.currentTime + 0.2);
          } catch {}
        }, 220);
      } else if (type === "buzzer") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(349.23, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      }
    } catch {}
  };

  // Reset timer on open
  useEffect(() => {
    if (isOpen) {
      setSecondsRemaining(60);
      setIsTimerRunning(true);
      setShowCloseDialog(false);
      playChime("start");
    }
  }, [isOpen]);

  // Countdown effect
  useEffect(() => {
    if (!isOpen || !isTimerRunning) return;

    if (secondsRemaining <= 0) {
      playChime("buzzer");
      setIsTimerRunning(false);
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev === 16) {
          playChime("warning");
        }
        if (prev <= 1) {
          playChime("buzzer");
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isTimerRunning, secondsRemaining]);

  // Keyboard navigation (Esc opens close dialog or closes)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (showCloseDialog) {
          setShowCloseDialog(false);
        } else {
          setShowCloseDialog(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showCloseDialog]);

  // Filter stats for current active set
  const currentSetStats = useMemo(() => {
    if (!activeSetId) return [];
    return stats.filter(
      (st) => st.setId === activeSetId || (st.matchId === activeMatch?.id && st.setNum === currentSetNum)
    );
  }, [stats, activeSetId, activeMatch, currentSetNum]);

  // Current Momentum & Last 5 Points
  const momentumAnalysis = useMemo(() => {
    const scoreDiff = score.ucc - score.opp;
    let recentRunTeam = "none";
    let runCount = 0;

    if (history && history.length >= 2) {
      const recentHistory = history.slice(-6);
      let uccGains = 0;
      let oppGains = 0;

      for (let i = 1; i < recentHistory.length; i++) {
        const prev = recentHistory[i - 1].score;
        const cur = recentHistory[i].score;
        if (cur.ucc > prev.ucc) uccGains++;
        if (cur.opp > prev.opp) oppGains++;
      }

      if (oppGains >= 3 && oppGains > uccGains) {
        recentRunTeam = "opp";
        runCount = oppGains;
      } else if (uccGains >= 3 && uccGains > oppGains) {
        recentRunTeam = "ucc";
        runCount = uccGains;
      }
    }

    return {
      scoreDiff,
      recentRunTeam,
      runCount,
      isOpponentRun: recentRunTeam === "opp" && runCount >= 3,
    };
  }, [score, history]);

  // Compute Core Volleyball Set Stats (100% Raw Metrics)
  const setMetrics = useMemo(() => {
    let kills = 0;
    let attackErrors = 0;
    let totalAttacks = 0;
    let aces = 0;
    let serveErrors = 0;
    let totalServes = 0;
    let passSum = 0;
    let passCount = 0;
    let perfectPasses = 0; // 3
    let goodPasses = 0; // 2
    let passErrors = 0; // 0/1
    let stuffBlocks = 0;
    let digs = 0;
    let assists = 0;

    const playerAttacksMap = new Map<string, { kills: number; errors: number; attacks: number }>();

    for (const st of currentSetStats) {
      const cat = (st.category || "").toLowerCase();
      const met = (st.metric || "").toLowerCase();
      const val = Number(st.value) || 1;
      const pId = String(st.playerId);

      if (cat === "attack") {
        totalAttacks += val;
        if (!playerAttacksMap.has(pId)) {
          playerAttacksMap.set(pId, { kills: 0, errors: 0, attacks: 0 });
        }
        const pAtt = playerAttacksMap.get(pId)!;
        pAtt.attacks += val;

        if (met.includes("kill")) {
          kills += val;
          pAtt.kills += val;
        } else if (met.includes("error")) {
          attackErrors += val;
          pAtt.errors += val;
        }
      } else if (cat === "serve") {
        totalServes += val;
        if (met.includes("ace")) {
          aces += val;
        } else if (met.includes("error")) {
          serveErrors += val;
        }
      } else if (cat.includes("pass") || cat.includes("receive")) {
        let scoreVal = 2;
        if (met === "3" || met.includes("perfect")) {
          scoreVal = 3;
          perfectPasses += val;
        } else if (met === "2" || met.includes("good")) {
          scoreVal = 2;
          goodPasses += val;
        } else if (met === "1" || met.includes("poor")) {
          scoreVal = 1;
          passErrors += val;
        } else if (met === "0" || met.includes("error")) {
          scoreVal = 0;
          passErrors += val;
        }
        passSum += scoreVal * val;
        passCount += val;
      } else if (cat === "block") {
        if (met.includes("kill") || met.includes("solo") || met.includes("point")) {
          stuffBlocks += val;
        }
      } else if (cat === "dig") {
        digs += val;
      } else if (cat === "set" || cat === "assist") {
        if (met.includes("assist")) {
          assists += val;
        }
      }
    }

    const killPct = totalAttacks > 0 ? (kills / totalAttacks) * 100 : 0;
    const hittingEff = totalAttacks > 0 ? (kills - attackErrors) / totalAttacks : 0;
    const acePct = totalServes > 0 ? (aces / totalServes) * 100 : 0;
    const serveErrorPct = totalServes > 0 ? (serveErrors / totalServes) * 100 : 0;
    const passAvg = passCount > 0 ? passSum / passCount : 0;
    const unforcedErrors = attackErrors + serveErrors;
    const earnedPoints = kills + aces + stuffBlocks;

    // Lineup / Player performances
    const courtPlayerStats = lineup.map((pId) => {
      const pObj = roster.find((p) => String(p.id) === String(pId));
      if (!pObj) return null;

      let pKills = 0;
      let pErrors = 0;
      let pAttacks = 0;
      let pAces = 0;
      let pServeErrors = 0;
      let pDigs = 0;
      let pBlocks = 0;
      let pPassCount = 0;
      let pPassSum = 0;

      currentSetStats
        .filter((st) => String(st.playerId) === String(pObj.id))
        .forEach((st) => {
          const cat = (st.category || "").toLowerCase();
          const met = (st.metric || "").toLowerCase();
          const val = Number(st.value) || 1;

          if (cat === "attack") {
            pAttacks += val;
            if (met.includes("kill")) pKills += val;
            if (met.includes("error")) pErrors += val;
          } else if (cat === "serve") {
            if (met.includes("ace")) pAces += val;
            if (met.includes("error")) pServeErrors += val;
          } else if (cat === "dig") {
            pDigs += val;
          } else if (cat === "block") {
            if (met.includes("kill") || met.includes("solo") || met.includes("point")) pBlocks += val;
          } else if (cat.includes("pass") || cat.includes("receive")) {
            let sc = 2;
            if (met === "3") sc = 3;
            else if (met === "2") sc = 2;
            else if (met === "1") sc = 1;
            else if (met === "0") sc = 0;
            pPassSum += sc * val;
            pPassCount += val;
          }
        });

      const eff = pAttacks > 0 ? (pKills - pErrors) / pAttacks : 0;
      const pAvg = pPassCount > 0 ? pPassSum / pPassCount : null;

      return {
        id: pObj.id,
        name: pObj.name,
        number: pObj.number || "",
        kills: pKills,
        errors: pErrors,
        attacks: pAttacks,
        efficiency: eff,
        aces: pAces,
        digs: pDigs,
        blocks: pBlocks,
        passAvg: pAvg,
        points: pKills + pAces + pBlocks,
      };
    }).filter(Boolean);

    return {
      kills,
      attackErrors,
      totalAttacks,
      killPct,
      hittingEff,
      aces,
      serveErrors,
      totalServes,
      acePct,
      serveErrorPct,
      passAvg,
      passCount,
      perfectPasses,
      goodPasses,
      passErrors,
      stuffBlocks,
      digs,
      assists,
      unforcedErrors,
      earnedPoints,
      courtPlayerStats,
    };
  }, [currentSetStats, roster, lineup]);

  if (!isOpen) return null;

  const handleRequestClose = () => {
    setShowCloseDialog(true);
  };

  const handleSelectTimeout = (callingTeam: "ucc" | "opp" | "none") => {
    if (callingTeam === "ucc" && onCallOfficialTimeout) {
      onCallOfficialTimeout("ucc");
    } else if (callingTeam === "opp" && onCallOfficialTimeout) {
      onCallOfficialTimeout("opp");
    }
    setShowCloseDialog(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh]">
        {/* HEADER: CLOCK, SCORE & LIVE SITUATION */}
        <div className="bg-slate-950 px-4 sm:px-6 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            {/* 60-Second Countdown Dial */}
            <div
              className={`h-12 w-12 rounded-2xl flex flex-col items-center justify-center font-black transition-colors border shadow-inner ${
                secondsRemaining <= 15
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse"
                  : "bg-amber-400/20 text-amber-300 border-amber-400/40"
              }`}
            >
              <span className="text-xl sm:text-2xl leading-none font-mono">
                {secondsRemaining}
              </span>
              <span className="text-[7px] uppercase tracking-wider font-extrabold text-slate-400">
                Sec
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  Timeout Stats & Huddle
                </span>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-500/30">
                  Set {currentSetNum}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="text-white font-black text-sm">
                  {ourTeamName} {score.ucc} - {score.opp} {opponentName}
                </span>
                <span>•</span>
                <span
                  className={`font-bold ${
                    momentumAnalysis.scoreDiff > 0
                      ? "text-emerald-400"
                      : momentumAnalysis.scoreDiff < 0
                      ? "text-rose-400"
                      : "text-slate-400"
                  }`}
                >
                  {momentumAnalysis.scoreDiff > 0
                    ? `+${momentumAnalysis.scoreDiff} Lead`
                    : momentumAnalysis.scoreDiff < 0
                    ? `${momentumAnalysis.scoreDiff} Deficit`
                    : "Tied"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Timer Controls & Timeout Selection */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isTimerRunning ? <Pause size={13} /> : <Play size={13} />}
              <span>{isTimerRunning ? "Pause" : "Resume"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSecondsRemaining(60);
                setIsTimerRunning(true);
              }}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>60s</span>
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs transition-colors cursor-pointer"
              title={soundEnabled ? "Mute Buzzer" : "Enable Buzzer"}
            >
              {soundEnabled ? <Volume2 size={14} className="text-amber-300" /> : <VolumeX size={14} className="text-slate-500" />}
            </button>

            <button
              type="button"
              onClick={handleRequestClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer ml-1"
              title="Close and Return to Court"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full bg-slate-800 h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${
              secondsRemaining <= 15 ? "bg-rose-500" : "bg-amber-400"
            }`}
            style={{ width: `${Math.max(0, Math.min(100, (secondsRemaining / 60) * 100))}%` }}
          />
        </div>

        {/* MODAL BODY (PURE STATS ONLY - NO COACHING NOTES) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* KEY 4 STAT TILES FOR QUICK 60-SEC HUDDLE */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* KILL % & EFFICIENCY */}
            <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                <span>Kill % / Eff</span>
                <Zap size={14} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-white flex items-baseline gap-1.5 tabular-nums">
                  <span>{setMetrics.killPct.toFixed(1)}%</span>
                  <span className="text-xs font-semibold text-blue-400">
                    eff {setMetrics.hittingEff.toFixed(3)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {setMetrics.kills} kills, {setMetrics.attackErrors} errs ({setMetrics.totalAttacks} att)
                </div>
              </div>
            </div>

            {/* PASSING RATING */}
            <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                <span>Passing Grade</span>
                <Shield size={14} className="text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-white flex items-baseline gap-1.5 tabular-nums">
                  <span>{setMetrics.passAvg.toFixed(2)}</span>
                  <span className="text-xs text-slate-400">/ 3.0</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {setMetrics.perfectPasses} (3s), {setMetrics.goodPasses} (2s), {setMetrics.passErrors} (0-1s)
                </div>
              </div>
            </div>

            {/* SERVING */}
            <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                <span>Serve Pressure</span>
                <Target size={14} className="text-amber-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-white flex items-baseline gap-1.5 tabular-nums">
                  <span className="text-amber-400">{setMetrics.aces} Aces</span>
                  <span className="text-xs text-rose-400">({setMetrics.serveErrors} errs)</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {setMetrics.totalServes} serves ({setMetrics.acePct.toFixed(0)}% ace rate)
                </div>
              </div>
            </div>

            {/* UNFORCED ERRORS */}
            <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                <span>Free Points Gifted</span>
                <AlertTriangle size={14} className="text-rose-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-rose-400 tabular-nums">
                  {setMetrics.unforcedErrors} pts
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {setMetrics.attackErrors} att errs + {setMetrics.serveErrors} srv errs
                </div>
              </div>
            </div>
          </div>

          {/* TWO COLUMN STAT SECTION: SET SKILL BREAKDOWN & COURT LINEUP STATS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SET SKILL BREAKDOWN TABLE */}
            <div className="bg-slate-800/50 border border-slate-700/80 p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-3 border-b border-slate-700/60 pb-2">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-indigo-400" />
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
                    Set {currentSetNum} Performance Totals
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-bold font-mono">
                  Earned: {setMetrics.earnedPoints} pts
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Attack Attempts</div>
                  <div className="text-base font-black text-white mt-0.5 tabular-nums">
                    {setMetrics.totalAttacks}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {setMetrics.kills} Kills · {setMetrics.attackErrors} Errors
                  </div>
                </div>

                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Serve Attempts</div>
                  <div className="text-base font-black text-white mt-0.5 tabular-nums">
                    {setMetrics.totalServes}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {setMetrics.aces} Aces · {setMetrics.serveErrors} Errors
                  </div>
                </div>

                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Stuff Blocks</div>
                  <div className="text-base font-black text-white mt-0.5 tabular-nums">
                    {setMetrics.stuffBlocks}
                  </div>
                  <div className="text-[10px] text-slate-400">Direct points at the net</div>
                </div>

                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Floor Digs</div>
                  <div className="text-base font-black text-white mt-0.5 tabular-nums">
                    {setMetrics.digs}
                  </div>
                  <div className="text-[10px] text-slate-400">Transition opportunities</div>
                </div>
              </div>

              {/* TIMEOUT STATUS ROW */}
              <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                <div className="text-slate-400">
                  <span className="font-bold text-slate-300">Timeouts Used:</span>{" "}
                  <span className="text-amber-400 font-black">{ourTeamName} {teamStats.uccTimeouts}/2</span> •{" "}
                  <span className="text-slate-300">{opponentName} {teamStats.oppTimeouts}/2</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  <span className="font-bold text-slate-300">Server:</span>{" "}
                  {serving === "ucc" ? ourTeamName : opponentName}
                </div>
              </div>
            </div>

            {/* COURT PLAYERS PERFORMANCE GRID */}
            <div className="bg-slate-800/50 border border-slate-700/80 p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-3 border-b border-slate-700/60 pb-2">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-emerald-400" />
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
                    On-Court Players (Set {currentSetNum})
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">Kills · Eff · Digs</span>
              </div>

              {setMetrics.courtPlayerStats.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs font-semibold">
                  No individual player stats recorded yet in this set.
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {setMetrics.courtPlayerStats.map((p) => {
                    if (!p) return null;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 bg-slate-800/90 rounded-xl border border-slate-700 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-300 font-black flex items-center justify-center text-[10px] shrink-0 border border-indigo-500/30">
                            #{p.number}
                          </span>
                          <span className="font-black text-white truncate max-w-[110px]">
                            {p.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 font-mono text-[11px]">
                          <span className="text-emerald-400 font-black">
                            {p.kills}K ({p.attacks}A)
                          </span>
                          <span
                            className={`font-black px-1.5 py-0.5 rounded text-[10px] ${
                              p.efficiency >= 0.3
                                ? "bg-emerald-500/20 text-emerald-300"
                                : p.efficiency >= 0.15
                                ? "bg-blue-500/20 text-blue-300"
                                : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            eff {p.efficiency.toFixed(2)}
                          </span>
                          <span className="text-slate-400">
                            {p.digs}D {p.blocks > 0 ? `· ${p.blocks}B` : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* QUICK SUB SHORTCUT */}
              {onOpenSubModal && (
                <div className="mt-3 pt-2 border-t border-slate-700/60 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSubModal();
                    }}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
                  >
                    <ArrowRightLeft size={12} />
                    <span>Lineup Substitutions</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-950 px-4 sm:px-6 py-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Press <kbd className="px-1 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px]">Esc</kbd> to close timeout
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-950/50 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Close Timeout & Resume Game</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* CLOSE ATTRIBUTION DIALOG (Prompt who called TO or if just looking at stats) */}
      {showCloseDialog && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Record Timeout</h3>
                <p className="text-xs text-slate-400">Select who called the timeout or continue without recording one</p>
              </div>
            </div>

            <div className="space-y-2.5 my-5">
              {/* Option 1: Lancers Called Timeout */}
              <button
                type="button"
                onClick={() => handleSelectTimeout("ucc")}
                className="w-full p-3.5 bg-blue-600 hover:bg-blue-500 rounded-2xl text-left flex items-center justify-between text-xs font-bold transition-all shadow-md group cursor-pointer border border-blue-400/30"
              >
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-blue-300 shrink-0"></span>
                  <div>
                    <div className="font-black text-sm text-white">{ourTeamName} Called Timeout</div>
                    <div className="text-[11px] text-blue-200">
                      Record official timeout ({teamStats.uccTimeouts + 1}/2 used)
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-blue-300 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>

              {/* Option 2: Opponent Called Timeout */}
              <button
                type="button"
                onClick={() => handleSelectTimeout("opp")}
                className="w-full p-3.5 bg-slate-800 hover:bg-slate-750 rounded-2xl text-left flex items-center justify-between text-xs font-bold transition-all border border-slate-700 group cursor-pointer hover:border-slate-600"
              >
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-rose-400 shrink-0"></span>
                  <div>
                    <div className="font-black text-sm text-white">{opponentName} Called Timeout</div>
                    <div className="text-[11px] text-slate-400">
                      Record opponent timeout ({teamStats.oppTimeouts + 1}/2 used)
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>

              {/* Option 3: Just Looking at Stats (No Official TO) */}
              <button
                type="button"
                onClick={() => handleSelectTimeout("none")}
                className="w-full p-3.5 bg-slate-800/50 hover:bg-slate-800 rounded-2xl text-left flex items-center justify-between text-xs font-bold transition-all border border-dashed border-slate-700 text-slate-300 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Eye size={18} className="text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold text-sm text-white">Just Looking at Stats</div>
                    <div className="text-[11px] text-slate-400">
                      No timeout called (keeps counts at {teamStats.uccTimeouts}/2 and {teamStats.oppTimeouts}/2)
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-500 shrink-0" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCloseDialog(false)}
              className="w-full py-2.5 text-center text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel / Keep Reviewing Stats
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
