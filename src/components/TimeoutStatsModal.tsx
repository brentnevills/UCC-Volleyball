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
  Sparkles,
  Target,
  Award,
  ArrowRightLeft,
  ChevronRight,
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
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === "warning") {
        // Double beep for 15s warning
        osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
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
        // Court horn / buzzer
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(349.23, ctx.currentTime); // F4
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
  }, [isOpen, isTimerRunning, secondsRemaining, soundEnabled]);

  // Filter current set stats
  const currentSetStats = useMemo(() => {
    if (!activeMatch) return [];
    return stats.filter((s) => {
      const matchMatches = String(s.matchId) === String(activeMatch.id);
      if (!matchMatches) return false;
      if (activeSetId && s.setId) {
        return String(s.setId) === String(activeSetId);
      }
      return Number(s.setNum) === Number(currentSetNum);
    });
  }, [stats, activeMatch, activeSetId, currentSetNum]);

  // Analyze recent momentum and scoring runs from history snapshots
  const momentumAnalysis = useMemo(() => {
    if (!history || history.length === 0) {
      return {
        runDescription: "Beginning of Set",
        isOpponentRun: false,
        isUccRun: false,
        runPoints: 0,
        recentScores: [],
      };
    }

    // Look back at the last up to 8 snapshots in this set
    const recentStates = history
      .filter((h) => Number(h.currentSetNum) === Number(currentSetNum))
      .slice(-8);

    if (recentStates.length < 2) {
      return {
        runDescription: "Rally in progress",
        isOpponentRun: false,
        isUccRun: false,
        runPoints: 0,
        recentScores: [],
      };
    }

    let oppConsecutive = 0;
    let uccConsecutive = 0;

    // Check from most recent backwards
    for (let i = recentStates.length - 1; i >= 1; i--) {
      const curr = recentStates[i].score;
      const prev = recentStates[i - 1].score;
      const oppGained = (curr.opp || 0) - (prev.opp || 0);
      const uccGained = (curr.ucc || 0) - (prev.ucc || 0);

      if (oppGained > 0 && uccGained === 0) {
        if (uccConsecutive === 0) oppConsecutive += oppGained;
      } else if (uccGained > 0 && oppGained === 0) {
        if (oppConsecutive === 0) uccConsecutive += uccGained;
      }
    }

    if (oppConsecutive >= 2) {
      return {
        runDescription: `${opponentName} on a ${oppConsecutive}-0 Run`,
        isOpponentRun: true,
        isUccRun: false,
        runPoints: oppConsecutive,
      };
    } else if (uccConsecutive >= 2) {
      return {
        runDescription: `${ourTeamName} on a ${uccConsecutive}-0 Run`,
        isOpponentRun: false,
        isUccRun: true,
        runPoints: uccConsecutive,
      };
    }

    return {
      runDescription: "Back-and-forth sideout play",
      isOpponentRun: false,
      isUccRun: false,
      runPoints: 0,
    };
  }, [history, currentSetNum, opponentName, ourTeamName]);

  // Calculate Key Set-to-Date Metrics
  const setMetrics = useMemo(() => {
    let kills = 0;
    let attackErrors = 0;
    let totalAttacks = 0;

    let aces = 0;
    let serveErrors = 0;
    let totalServes = 0;

    let passSum = 0;
    let passCount = 0;
    let perfectPasses = 0;
    let passErrors = 0;

    let stuffBlocks = 0;
    let digs = 0;

    const playerKillsMap: Record<string, { kills: number; errors: number; attacks: number }> = {};

    for (const st of currentSetStats) {
      const cat = (st.category || "").toLowerCase();
      const met = (st.metric || "").toLowerCase();
      const val = Number(st.value) || 1;
      const pId = String(st.playerId);

      // Track individual attacker metrics
      if (!st.isOpponent && pId && pId !== "opp" && pId !== "team") {
        if (!playerKillsMap[pId]) {
          playerKillsMap[pId] = { kills: 0, errors: 0, attacks: 0 };
        }
      }

      if (cat === "attack") {
        totalAttacks += val;
        if (!st.isOpponent && playerKillsMap[pId]) {
          playerKillsMap[pId].attacks += val;
        }

        if (met === "kill" || met === "kills") {
          kills += val;
          if (!st.isOpponent && playerKillsMap[pId]) {
            playerKillsMap[pId].kills += val;
          }
        } else if (met === "error" || met === "errors") {
          attackErrors += val;
          if (!st.isOpponent && playerKillsMap[pId]) {
            playerKillsMap[pId].errors += val;
          }
        }
      } else if (cat === "serve") {
        totalServes += val;
        if (met === "ace" || met === "aces") {
          aces += val;
        } else if (met === "error" || met === "errors") {
          serveErrors += val;
        }
      } else if (cat === "pass" || cat === "passing" || cat === "receive") {
        let scoreVal = 2;
        if (met === "3" || met === "perfect") {
          scoreVal = 3;
          perfectPasses += val;
        } else if (met === "2" || met === "good") {
          scoreVal = 2;
        } else if (met === "1" || met === "poor") {
          scoreVal = 1;
        } else if (met === "0" || met === "error") {
          scoreVal = 0;
          passErrors += val;
        }
        passSum += scoreVal * val;
        passCount += val;
      } else if (cat === "block") {
        if (met === "kill" || met === "solo" || met === "point") {
          stuffBlocks += val;
        }
      } else if (cat === "dig") {
        digs += val;
      }
    }

    const killPct = totalAttacks > 0 ? (kills / totalAttacks) * 100 : 0;
    const hittingEff = totalAttacks > 0 ? (kills - attackErrors) / totalAttacks : 0;
    const passAvg = passCount > 0 ? passSum / passCount : 2.0;
    const acePct = totalServes > 0 ? (aces / totalServes) * 100 : 0;
    const serveErrorPct = totalServes > 0 ? (serveErrors / totalServes) * 100 : 0;
    const unforcedErrors = attackErrors + serveErrors + passErrors;

    // Sort hot attackers
    const topAttackers = Object.entries(playerKillsMap)
      .map(([id, data]) => {
        const playerObj = roster.find((p) => String(p.id) === String(id));
        const eff = data.attacks > 0 ? (data.kills - data.errors) / data.attacks : 0;
        return {
          id,
          name: playerObj ? playerObj.name : `Player #${id}`,
          number: playerObj?.number || "",
          kills: data.kills,
          attacks: data.attacks,
          errors: data.errors,
          efficiency: eff,
        };
      })
      .filter((p) => p.attacks > 0)
      .sort((a, b) => b.kills - a.kills || b.efficiency - a.efficiency)
      .slice(0, 3);

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
      passErrors,
      stuffBlocks,
      digs,
      unforcedErrors,
      topAttackers,
    };
  }, [currentSetStats, roster]);

  // Actionable Coaching Recommendations
  const coachingInsights = useMemo(() => {
    const list: { type: "urgent" | "positive" | "info"; text: string }[] = [];

    if (momentumAnalysis.isOpponentRun) {
      list.push({
        type: "urgent",
        text: `Stop the bleeding: Focus on high-percentage first-ball sideout. Deep pass to 10-foot line and run high-hands ball.`,
      });
    }

    if (setMetrics.passAvg < 1.9 && setMetrics.passCount >= 3) {
      list.push({
        type: "urgent",
        text: `Serve receive passing is currently at ${setMetrics.passAvg.toFixed(2)}/3.0. Shift into 3-person receive seam and call ball early.`,
      });
    } else if (setMetrics.passAvg >= 2.3 && setMetrics.passCount >= 3) {
      list.push({
        type: "positive",
        text: `Passing is dialed in (${setMetrics.passAvg.toFixed(2)}/3.0). Release middle hitters on quick 1s and slide attacks.`,
      });
    }

    if (setMetrics.hittingEff < 0.15 && setMetrics.totalAttacks >= 5) {
      list.push({
        type: "urgent",
        text: `Attack efficiency is ${setMetrics.hittingEff.toFixed(3)}. Use the opponent block: wipe off high hands or roll deep to corners instead of forcing into the tape.`,
      });
    } else if (setMetrics.hittingEff >= 0.3) {
      list.push({
        type: "positive",
        text: `Offense is clicking at .${Math.round(setMetrics.hittingEff * 1000)} hitting efficiency. Keep tempo fast!`,
      });
    }

    if (setMetrics.topAttackers.length > 0) {
      const hotHand = setMetrics.topAttackers[0];
      if (hotHand.kills >= 3 && hotHand.efficiency >= 0.25) {
        list.push({
          type: "positive",
          text: `Hot Hand: Feed #${hotHand.number} ${hotHand.name} (${hotHand.kills} kills, .${Math.round(hotHand.efficiency * 1000)} eff) in crunch-time transition.`,
        });
      }
    }

    if (setMetrics.serveErrorPct > 20 && setMetrics.totalServes >= 5) {
      list.push({
        type: "urgent",
        text: `Serve error rate is high (${setMetrics.serveErrorPct.toFixed(0)}%). Target seams with float serves rather than high-risk jump spins.`,
      });
    }

    if (list.length === 0) {
      list.push({
        type: "info",
        text: `Establish tempo, win the transition dig battle, and communicate on out-of-system coverage.`,
      });
    }

    return list;
  }, [momentumAnalysis, setMetrics]);

  if (!isOpen) return null;

  // Active players on court right now
  const onCourtPlayers = lineup.map((pId, idx) => {
    const pos = idx + 1;
    const playerObj = roster.find((p) => String(p.id) === String(pId));
    return {
      pos,
      name: playerObj ? playerObj.name : "Vacant",
      number: playerObj ? playerObj.number : "-",
      isFrontRow: [4, 3, 2].includes(pos),
    };
  });

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden text-white flex flex-col my-auto max-h-[96vh]">
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-[#001b5e] via-blue-900 to-indigo-950 px-4 sm:px-6 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-400 text-slate-950 rounded-2xl shadow-md">
              <Clock size={20} className="font-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-wider uppercase text-white">
                  Timeout Key Stats
                </h2>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  60s Huddle Mode
                </span>
              </div>
              <p className="text-xs text-blue-200">
                Set {currentSetNum} • {ourTeamName} ({score.ucc}) vs {opponentName} ({score.opp})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition-colors ${
                soundEnabled
                  ? "bg-white/10 hover:bg-white/20 text-amber-300 border-white/20"
                  : "bg-white/5 hover:bg-white/10 text-slate-400 border-white/10"
              }`}
              title={soundEnabled ? "Mute Whistle & Buzzer" : "Enable Sound"}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 60-SECOND HUDDLE TIMER BAR */}
        <div className="bg-slate-950/70 px-4 sm:px-6 py-3 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span
                className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${
                  secondsRemaining <= 15 ? "text-rose-400 animate-pulse" : "text-amber-400"
                }`}
              >
                {secondsRemaining}s
              </span>
            </div>
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                Official TO Clock
              </div>
              <div className="text-xs font-bold text-slate-200">
                {secondsRemaining > 15
                  ? "Huddle in progress"
                  : secondsRemaining > 0
                  ? "⚠️ 15s Warning - Break the Huddle!"
                  : "Horn Sounded - Return to Court"}
              </div>
            </div>
          </div>

          {/* Quick Timer Controls & Timeout Loggers */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
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
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={13} />
              <span>Reset 60s</span>
            </button>
            <button
              type="button"
              onClick={() => setSecondsRemaining((s) => s + 15)}
              className="px-2 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors"
            >
              +15s
            </button>

            {onCallOfficialTimeout && (
              <div className="flex items-center gap-1.5 border-l border-white/20 pl-2 ml-1">
                <button
                  type="button"
                  onClick={() => {
                    onCallOfficialTimeout("ucc");
                    setSecondsRemaining(60);
                    setIsTimerRunning(true);
                    playChime("start");
                  }}
                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
                  title="Record Lancers Timeout"
                >
                  +1 TO Lancers ({teamStats.uccTimeouts}/2)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCallOfficialTimeout("opp");
                    setSecondsRemaining(60);
                    setIsTimerRunning(true);
                    playChime("start");
                  }}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                  title="Record Opponent Timeout"
                >
                  +1 Opp TO ({teamStats.oppTimeouts}/2)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full bg-slate-800 h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${
              secondsRemaining <= 15 ? "bg-rose-500" : "bg-amber-400"
            }`}
            style={{ width: `${(secondsRemaining / 60) * 100}%` }}
          ></div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* MOMENTUM & RUN BANNER */}
          <div
            className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 ${
              momentumAnalysis.isOpponentRun
                ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
                : momentumAnalysis.isUccRun
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                : "bg-indigo-950/40 border-indigo-500/30 text-indigo-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  momentumAnalysis.isOpponentRun
                    ? "bg-rose-500/20 text-rose-400"
                    : momentumAnalysis.isUccRun
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-indigo-500/20 text-indigo-400"
                }`}
              >
                {momentumAnalysis.isOpponentRun ? (
                  <AlertTriangle size={20} />
                ) : momentumAnalysis.isUccRun ? (
                  <Flame size={20} />
                ) : (
                  <TrendingUp size={20} />
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase font-black tracking-widest opacity-80">
                  Momentum Flow
                </div>
                <div className="text-sm sm:text-base font-black text-white">
                  {momentumAnalysis.runDescription}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Timeouts Used</div>
              <div className="text-xs font-black text-white">
                {ourTeamName}: <span className="text-amber-400">{teamStats.uccTimeouts}/2</span> • {opponentName}:{" "}
                <span className="text-slate-300">{teamStats.oppTimeouts}/2</span>
              </div>
            </div>
          </div>

          {/* KEY 4 STAT TILES FOR QUICK 60-SEC HUDDLE */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* KILL % & EFFICIENCY */}
            <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                <span>Kill % / Eff</span>
                <Zap size={14} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-black text-white flex items-baseline gap-1.5">
                  <span>{setMetrics.killPct.toFixed(1)}%</span>
                  <span className="text-xs font-semibold text-blue-400">
                    eff {setMetrics.hittingEff.toFixed(3)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {setMetrics.kills} kills, {setMetrics.attackErrors} errs on {setMetrics.totalAttacks} att
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
                <div className="text-2xl font-black text-white flex items-baseline gap-1.5">
                  <span>{setMetrics.passAvg.toFixed(2)}</span>
                  <span className="text-xs text-slate-400">/ 3.0</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {setMetrics.perfectPasses} perfect, {setMetrics.passErrors} errors ({setMetrics.passCount} total)
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
                <div className="text-2xl font-black text-white flex items-baseline gap-1.5">
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
                <div className="text-2xl font-black text-rose-400">
                  {setMetrics.unforcedErrors} pts
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {setMetrics.attackErrors} att errs + {setMetrics.serveErrors} srv errs
                </div>
              </div>
            </div>
          </div>

          {/* TWO COLUMN SECTION: COACHING TAKEAWAYS & HOT HANDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* COACHING TAKEAWAYS */}
            <div className="bg-slate-800/50 border border-slate-700/80 p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-amber-400" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
                  Coaching Huddle Bullets
                </h3>
              </div>
              <div className="space-y-2.5">
                {coachingInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                      insight.type === "urgent"
                        ? "bg-rose-900/20 border-rose-500/30 text-rose-200"
                        : insight.type === "positive"
                        ? "bg-emerald-900/20 border-emerald-500/30 text-emerald-200"
                        : "bg-slate-800 border-slate-700 text-slate-300"
                    }`}
                  >
                    <span className="font-bold text-xs shrink-0 mt-0.5">•</span>
                    <span>{insight.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* HOT HANDS / TOP ATTACKERS THIS SET */}
            <div className="bg-slate-800/50 border border-slate-700/80 p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-indigo-400" />
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
                    Hot Hands This Set
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">Kills / Eff</span>
              </div>

              {setMetrics.topAttackers.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs font-semibold">
                  No attack stats logged for this set yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {setMetrics.topAttackers.map((att, idx) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2.5 bg-slate-800/90 rounded-xl border border-slate-700 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-300 font-black flex items-center justify-center text-[10px] shrink-0 border border-indigo-500/30">
                          #{att.number || idx + 1}
                        </span>
                        <span className="font-black text-white truncate max-w-[120px]">
                          {att.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 font-black">
                          {att.kills} Kills
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          ({att.attacks} att)
                        </span>
                        <span
                          className={`font-black text-[11px] px-1.5 py-0.5 rounded ${
                            att.efficiency >= 0.3
                              ? "bg-emerald-500/20 text-emerald-300"
                              : att.efficiency >= 0.15
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-slate-700 text-slate-400"
                          }`}
                        >
                          .{Math.round(Math.max(0, att.efficiency) * 1000)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* QUICK ROTATION & SUB SHORTCUT */}
              <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                <div className="text-[11px] text-slate-400">
                  <span className="font-bold text-slate-300">Server:</span>{" "}
                  {serving === "ucc" ? ourTeamName : opponentName}
                </div>
                {onOpenSubModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSubModal();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
                  >
                    <ArrowRightLeft size={13} />
                    <span>Quick Sub</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-950 px-4 sm:px-6 py-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Tip: Press <kbd className="px-1 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px]">Esc</kbd> to return to court
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-950/50 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Back to Game Court</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
