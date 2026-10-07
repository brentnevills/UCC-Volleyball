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
  ThumbsUp,
  ThumbsDown,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import {
  calculatePassingIndex,
  calculateAdjustedPassQuality,
  calculateFrontRowSetDistribution,
} from "../utils/volleyballStats";

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

export interface PasserRankInfo {
  id: string;
  name: string;
  number: string;
  attempts: number;
  sum: number;
  average: number;
  balancedScore: number;
  passingIndex: number;
  count3: number;
  count2: number;
  count1: number;
  count0: number; // overbumps & errs
  countAced: number; // times aced on serve receive
  inSystemPct: number;
  outOfSystemPct: number;
}

export interface HitterRankInfo {
  id: string;
  name: string;
  number: string;
  kills: number;
  unforcedErrors: number;
  blockedAttacks: number;
  totalAttacks: number;
  frontAttacks: number;
  backAttacks: number;
  teamFrontAttacksWhileInFront?: number;
  frontSetDistPct: number;
  killPct: number;
  efficiency: number;
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

  // Scope toggle: "set" (current active set) or "match" (entire match totals)
  const [viewScope, setViewScope] = useState<"set" | "match">("set");

  // Detailed table tab selection: "passers" | "attackers" | "court"
  const [activeDetailTab, setActiveDetailTab] = useState<"passers" | "attackers" | "court">("passers");

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
      setViewScope("set");
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

  // Filter stats for either Current Set or Full Match
  const scopedStats = useMemo(() => {
    if (viewScope === "set") {
      if (!activeSetId) {
        return (stats || []).filter(
          (st) =>
            !st.isOpp &&
            (st.matchId === activeMatch?.id && Number(st.setNum) === Number(currentSetNum))
        );
      }
      return (stats || []).filter(
        (st) =>
          !st.isOpp &&
          (st.setId === activeSetId ||
            (st.matchId === activeMatch?.id && Number(st.setNum) === Number(currentSetNum)))
      );
    }
    // Full match
    return (stats || []).filter(
      (st) => !st.isOpp && (!activeMatch || st.matchId === activeMatch?.id)
    );
  }, [stats, viewScope, activeSetId, activeMatch, currentSetNum]);

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

  // Master Volleyball Metric Computation
  // NOTE: Per coach instruction:
  // 1. Blocked attacks are NOT counted in error stats.
  // 2. Passing 0 can be an overbump (not necessarily an ace).
  // 3. Passing Index combines both Quantity & Quality.
  // 4. Aced stat is tracked separately.
  const computedMetrics = useMemo(() => {
    let kills = 0;
    let unforcedAttackErrors = 0;
    let blockedAttacks = 0;
    let totalAttacks = 0;
    let totalFrontAttacks = 0;
    let totalBackAttacks = 0;

    let aces = 0;
    let serveErrors = 0;
    let totalServes = 0;

    let passSum = 0;
    let passCount = 0;
    let count3 = 0; // Perfect (3) - In-System
    let count2 = 0; // Good (2) - In-System
    let count1 = 0; // Poor (1) - Out of System
    let count0 = 0; // Overbump / 0-score pass - Out of System
    let teamAcedCount = 0; // Times aced on serve receive

    let stuffBlocks = 0;
    let digs = 0;
    let assists = 0;

    // Player level trackers
    const playerPassingMap = new Map<
      string,
      {
        id: string;
        name: string;
        number: string;
        sum: number;
        attempts: number;
        c3: number;
        c2: number;
        c1: number;
        c0: number;
        cAced: number;
      }
    >();

    const playerAttackMap = new Map<
      string,
      {
        id: string;
        name: string;
        number: string;
        kills: number;
        unforcedErrors: number;
        blockedAttacks: number;
        totalAttacks: number;
        frontAttacks: number;
        backAttacks: number;
      }
    >();

    const playerServeMap = new Map<
      string,
      {
        id: string;
        name: string;
        number: string;
        aces: number;
        errors: number;
        total: number;
      }
    >();

    // Helper to get or create player records
    const getPlayerInfo = (pId: string) => {
      const pObj = roster.find((p) => String(p.id) === String(pId));
      return {
        id: pId,
        name: pObj?.name || `Player #${pId}`,
        number: String(pObj?.number ?? pId),
      };
    };

    for (const st of scopedStats) {
      if (st.isOpp) continue; // Only our team

      const cat = (st.category || "").toLowerCase();
      const met = (st.metric || "").toLowerCase();
      const val = Number(st.value) || 1;
      const pId = String(st.playerId || "");
      if (!pId) continue;

      const pInfo = getPlayerInfo(pId);

      // 1. ATTACK STATS (Dont count blocked attacks in error stats)
      if (
        cat === "attack" ||
        (cat === "error" && (met.includes("att") || met.includes("hit")))
      ) {
        if (!playerAttackMap.has(pId)) {
          playerAttackMap.set(pId, {
            ...pInfo,
            kills: 0,
            unforcedErrors: 0,
            blockedAttacks: 0,
            totalAttacks: 0,
            frontAttacks: 0,
            backAttacks: 0,
          });
        }
        const pAtt = playerAttackMap.get(pId)!;

        const isKill = met.includes("kill");
        const isBlocked =
          met.includes("blocked") || met.includes("stuff") || met.includes("stuffed");
        const isUnforcedErr =
          !isBlocked &&
          (met.includes("out") ||
            met.includes("net") ||
            met.includes("error") ||
            met.includes("err") ||
            met.includes("fault") ||
            met.includes("miss") ||
            met.includes("antenna"));

        const isSwing =
          isKill ||
          isBlocked ||
          isUnforcedErr ||
          met.includes("swing") ||
          met.includes("play") ||
          met.includes("covered") ||
          met.includes("attempt") ||
          [
            "swing",
            "swing front",
            "swing back",
            "blocked",
            "stuffed",
            "out",
            "net",
            "kill",
          ].includes(met);

        if (isSwing) {
          totalAttacks += val;
          pAtt.totalAttacks += val;
          const isFront = st.row === "Front" || met.includes("front") || (!st.row && st.row !== "Back");
          if (isFront) {
            totalFrontAttacks += val;
            pAtt.frontAttacks = (pAtt.frontAttacks || 0) + val;
          } else {
            totalBackAttacks += val;
            pAtt.backAttacks = (pAtt.backAttacks || 0) + val;
          }
        }

        if (isKill) {
          kills += val;
          pAtt.kills += val;
        } else if (isBlocked) {
          // Tracked separately, NOT counted as an unforced attack error
          blockedAttacks += val;
          pAtt.blockedAttacks += val;
        } else if (isUnforcedErr) {
          unforcedAttackErrors += val;
          pAtt.unforcedErrors += val;
        }
      }

      // 2. SERVING STATS (Serve +/- & Aces)
      else if (cat === "serve") {
        if (!playerServeMap.has(pId)) {
          playerServeMap.set(pId, {
            ...pInfo,
            aces: 0,
            errors: 0,
            total: 0,
          });
        }
        const pSrv = playerServeMap.get(pId)!;

        const isAce = met.includes("ace");
        const isErr =
          met.includes("error") ||
          met.includes("err") ||
          met.includes("miss") ||
          met.includes("net") ||
          met.includes("out");
        const isAttempt =
          isAce || isErr || met.includes("attempt") || met.includes("in") || met.includes("play");

        if (isAttempt) {
          totalServes += val;
          pSrv.total += val;
        }
        if (isAce) {
          aces += val;
          pSrv.aces += val;
        }
        if (isErr) {
          serveErrors += val;
          pSrv.errors += val;
        }
      }

      // 3. PASSING / SERVE RECEIVE STATS
      else if (cat.includes("pass") || cat.includes("receive")) {
        if (!playerPassingMap.has(pId)) {
          playerPassingMap.set(pId, {
            ...pInfo,
            sum: 0,
            attempts: 0,
            c3: 0,
            c2: 0,
            c1: 0,
            c0: 0,
            cAced: 0,
          });
        }
        const pPass = playerPassingMap.get(pId)!;

        const isAcedEvent =
          met.includes("aced") || met === "aced" || Boolean((st as any).isAced);

        if (isAcedEvent) {
          teamAcedCount += val;
          pPass.cAced += val;
        }

        let scoreVal: number | null = null;
        if (
          st.value !== undefined &&
          st.value !== null &&
          !isNaN(Number(st.value)) &&
          (met === "rating" || met === "" || met === "pass")
        ) {
          scoreVal = Math.min(3, Math.max(0, Number(st.value)));
        } else if (met === "3" || met.includes("perfect")) {
          scoreVal = 3;
        } else if (met === "2" || met.includes("good")) {
          scoreVal = 2;
        } else if (met === "1" || met.includes("poor")) {
          scoreVal = 1;
        } else if (
          met === "0" ||
          met.includes("error") ||
          met.includes("aced") ||
          met.includes("shank") ||
          met.includes("overbump")
        ) {
          scoreVal = 0;
        } else if (st.value !== undefined && !isNaN(Number(st.value))) {
          scoreVal = Math.min(3, Math.max(0, Number(st.value)));
        }

        if (scoreVal !== null) {
          passSum += scoreVal * val;
          passCount += val;
          pPass.attempts += val;
          pPass.sum += scoreVal * val;

          if (scoreVal === 3) {
            count3 += val;
            pPass.c3 += val;
          } else if (scoreVal === 2) {
            count2 += val;
            pPass.c2 += val;
          } else if (scoreVal === 1) {
            count1 += val;
            pPass.c1 += val;
          } else if (scoreVal === 0) {
            count0 += val;
            pPass.c0 += val;
          }
        }
      }

      // 4. BLOCK STATS
      else if (cat === "block") {
        if (
          met.includes("kill") ||
          met.includes("solo") ||
          met.includes("point") ||
          met.includes("stuff")
        ) {
          stuffBlocks += val;
        }
      }

      // 5. DIGS & ASSISTS
      else if (cat === "dig") {
        digs += val;
      } else if (cat === "set" || cat === "assist") {
        if (met.includes("assist")) {
          assists += val;
        }
      }
    }

    // Attack calculations (Dont count blocked attacks in error stats)
    const killPct = totalAttacks > 0 ? (kills / totalAttacks) * 100 : 0;
    const hittingEff = totalAttacks > 0 ? (kills - unforcedAttackErrors) / totalAttacks : 0;

    // Serving calculations
    const servePlusMinus = aces - serveErrors;
    const acePct = totalServes > 0 ? (aces / totalServes) * 100 : 0;
    const serveErrorPct = totalServes > 0 ? (serveErrors / totalServes) * 100 : 0;

    // Passing calculations
    const passAvg = passCount > 0 ? passSum / passCount : 0;
    const inSystemPassPct = passCount > 0 ? ((count3 + count2) / passCount) * 100 : 0;
    const teamPassingIndex = calculatePassingIndex(passSum, passCount);

    const unforcedErrors = unforcedAttackErrors + serveErrors;
    const earnedPoints = kills + aces + stuffBlocks;

    // PASSING INDEX & RANKING (COMBINING QUANTITY & QUALITY)
    const rankedPassers: PasserRankInfo[] = Array.from(playerPassingMap.values())
      .filter((p) => p.attempts > 0)
      .map((p) => {
        const rawAvg = p.sum / p.attempts;
        const balancedScore = calculateAdjustedPassQuality(p.sum, p.attempts);
        const passIndex = calculatePassingIndex(p.sum, p.attempts);
        const inSys = p.attempts > 0 ? ((p.c3 + p.c2) / p.attempts) * 100 : 0;
        const outSys = p.attempts > 0 ? ((p.c1 + p.c0) / p.attempts) * 100 : 0;
        return {
          id: p.id,
          name: p.name,
          number: p.number,
          attempts: p.attempts,
          sum: p.sum,
          average: rawAvg,
          balancedScore,
          passingIndex: passIndex,
          count3: p.c3,
          count2: p.c2,
          count1: p.c1,
          count0: p.c0,
          countAced: p.cAced,
          inSystemPct: inSys,
          outOfSystemPct: outSys,
        };
      })
      .sort((a, b) => b.passingIndex - a.passingIndex);

    const bestPasser: PasserRankInfo | null = rankedPassers.length > 0 ? rankedPassers[0] : null;

    // Lowest passer: lowest passing index among all players with receive attempts
    const worstPasser: PasserRankInfo | null =
      rankedPassers.length > 1
        ? rankedPassers[rankedPassers.length - 1]
        : rankedPassers.length === 1
        ? rankedPassers[0]
        : null;

    // Ranked Hitters list
    const frDistMap = calculateFrontRowSetDistribution(stats, undefined, roster);
    const rankedHitters: HitterRankInfo[] = Array.from(playerAttackMap.values())
      .filter((p) => p.totalAttacks > 0)
      .map((p) => {
        const kPct = p.totalAttacks > 0 ? (p.kills / p.totalAttacks) * 100 : 0;
        const eff =
          p.totalAttacks > 0 ? (p.kills - p.unforcedErrors) / p.totalAttacks : 0;
        const frInfo = frDistMap.get(String(p.id));
        const teamFrontWhileInFront = frInfo ? frInfo.teamFrontSwingsWhileInFront : (p.frontAttacks || 0);
        const frSetDistPct = frInfo ? frInfo.frontRowSetDistPct : 0;
        return {
          id: p.id,
          name: p.name,
          number: p.number,
          kills: p.kills,
          unforcedErrors: p.unforcedErrors,
          blockedAttacks: p.blockedAttacks,
          totalAttacks: p.totalAttacks,
          frontAttacks: p.frontAttacks || 0,
          backAttacks: p.backAttacks || 0,
          teamFrontAttacksWhileInFront: teamFrontWhileInFront,
          frontSetDistPct: frSetDistPct,
          killPct: kPct,
          efficiency: eff,
        };
      })
      .sort((a, b) => {
        if (b.kills !== a.kills) return b.kills - a.kills;
        return b.efficiency - a.efficiency;
      });

    // Current Court Player Individual Breakdown
    const courtPlayerStats = lineup.map((pId, courtIdx) => {
      const pObj = roster.find((p) => String(p.id) === String(pId));
      if (!pObj) return null;

      const pAtt = playerAttackMap.get(String(pObj.id));
      const pPass = playerPassingMap.get(String(pObj.id));
      const pSrv = playerServeMap.get(String(pObj.id));

      const pKills = pAtt?.kills || 0;
      const pUnforcedErr = pAtt?.unforcedErrors || 0;
      const pBlocked = pAtt?.blockedAttacks || 0;
      const pAttacks = pAtt?.totalAttacks || 0;
      const pEff = pAttacks > 0 ? (pKills - pUnforcedErr) / pAttacks : 0;

      const pPassCount = pPass?.attempts || 0;
      const pPassAvg = pPassCount > 0 ? pPass.sum / pPassCount : null;
      const pPassIndex = pPassCount > 0 ? calculatePassingIndex(pPass!.sum, pPassCount) : null;
      const pAcedCount = pPass?.cAced || 0;

      const pAces = pSrv?.aces || 0;
      const pSrvErr = pSrv?.errors || 0;
      const pSrvPlusMinus = pAces - pSrvErr;

      return {
        id: pObj.id,
        name: pObj.name,
        number: pObj.number || "?",
        posIndex: courtIdx + 1,
        kills: pKills,
        unforcedErrors: pUnforcedErr,
        blockedAttacks: pBlocked,
        attacks: pAttacks,
        efficiency: pEff,
        aces: pAces,
        serveErrors: pSrvErr,
        servePlusMinus: pSrvPlusMinus,
        passAvg: pPassAvg,
        passAttempts: pPassCount,
        passIndex: pPassIndex,
        acedCount: pAcedCount,
        points: pKills + pAces,
      };
    }).filter(Boolean);

    return {
      kills,
      unforcedAttackErrors,
      blockedAttacks,
      totalAttacks,
      killPct,
      hittingEff,

      aces,
      serveErrors,
      totalServes,
      servePlusMinus,
      acePct,
      serveErrorPct,

      passAvg,
      passCount,
      count3,
      count2,
      count1,
      count0,
      teamAcedCount,
      inSystemPassPct,
      teamPassingIndex,

      stuffBlocks,
      digs,
      assists,
      unforcedErrors,
      earnedPoints,

      rankedPassers,
      bestPasser,
      worstPasser,
      rankedHitters,
      courtPlayerStats,
    };
  }, [scopedStats, roster, lineup]);

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

  const formatEff = (eff: number) => {
    const formatted = eff.toFixed(3);
    if (eff > 0) return `+${formatted}`;
    return formatted;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh]">
        {/* HEADER: CLOCK, SCORE & LIVE SITUATION */}
        <div className="bg-slate-950 px-4 sm:px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
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
                  Timeout Stats
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
              {soundEnabled ? (
                <Volume2 size={14} className="text-amber-300" />
              ) : (
                <VolumeX size={14} className="text-slate-500" />
              )}
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

        {/* SCOPE SELECTOR (SET X vs FULL MATCH) */}
        <div className="bg-slate-900/90 px-4 sm:px-6 py-2.5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
              Data Scope:
            </span>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewScope("set")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewScope === "set"
                    ? "bg-indigo-600 text-white shadow-xs font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Set {currentSetNum} (Active)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewScope("match")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewScope === "match"
                    ? "bg-indigo-600 text-white shadow-xs font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers size={13} />
                <span>Entire Match</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div>
              <span className="font-bold text-slate-300">Timeouts:</span>{" "}
              <span className="text-amber-400 font-black">
                {ourTeamName} {teamStats.uccTimeouts}/2
              </span>{" "}
              •{" "}
              <span className="text-slate-400">
                {opponentName} {teamStats.oppTimeouts}/2
              </span>
            </div>
            {onOpenSubModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSubModal();
                }}
                className="hidden sm:flex px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold uppercase tracking-wider items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowRightLeft size={12} />
                <span>Lineup Subs</span>
              </button>
            )}
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* 4 CORE HERO TILES */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. SERVE +/- & ACES */}
            <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl flex flex-col justify-between shadow-md relative overflow-hidden group">
              <div className="flex items-center justify-between text-slate-300 text-xs font-bold mb-2">
                <span className="uppercase tracking-wider text-[11px] text-slate-400">Serving</span>
                <div className="flex items-center gap-1 bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black border border-amber-400/30">
                  <Target size={12} />
                  <span>Serve +/-</span>
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-2.5">
                  <span
                    className={`text-3xl font-black font-mono tracking-tight ${
                      computedMetrics.servePlusMinus > 0
                        ? "text-emerald-400"
                        : computedMetrics.servePlusMinus < 0
                        ? "text-rose-400"
                        : "text-slate-200"
                    }`}
                  >
                    {computedMetrics.servePlusMinus > 0
                      ? `+${computedMetrics.servePlusMinus}`
                      : computedMetrics.servePlusMinus}
                  </span>
                  <span className="text-sm font-bold text-amber-300">
                    {computedMetrics.aces} {computedMetrics.aces === 1 ? "Ace" : "Aces"}
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 mt-2 space-y-0.5">
                  <div className="flex justify-between font-medium">
                    <span>Serve Errors:</span>
                    <span className="font-bold text-rose-300">{computedMetrics.serveErrors} errs</span>
                  </div>
                  <div className="flex justify-between font-medium text-slate-400 text-[10px]">
                    <span>Total Serves:</span>
                    <span>
                      {computedMetrics.totalServes} ({computedMetrics.acePct.toFixed(0)}% ace rate)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. TEAM PASSING GRADE, INDEX & RECEPTIONS */}
            <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl flex flex-col justify-between shadow-md">
              <div className="flex items-center justify-between text-slate-300 text-xs font-bold mb-2">
                <span className="uppercase tracking-wider text-[11px] text-slate-400">Passing</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md text-[10px] font-black border border-purple-500/30"
                    title="Passing Index (0-100)"
                  >
                    Index: {computedMetrics.teamPassingIndex}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-700">
                    0-3 Scale
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black font-mono text-white tracking-tight">
                    {computedMetrics.passAvg.toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">/ 3.00</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-xs font-bold text-indigo-300 bg-indigo-900/40 px-2 py-0.5 rounded border border-indigo-700/50">
                      {computedMetrics.inSystemPassPct.toFixed(0)}% In-Sys
                    </span>
                    {computedMetrics.teamAcedCount > 0 && (
                      <span className="text-xs font-black text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-600/40">
                        {computedMetrics.teamAcedCount} Aced
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 mt-2 space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>{computedMetrics.passCount} Receptions</span>
                    <span>Aced: {computedMetrics.teamAcedCount}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-bold">
                    <div className="bg-emerald-950/60 border border-emerald-600/40 rounded p-1 text-emerald-300">
                      <div>3s: {computedMetrics.count3}</div>
                      <div className="text-[8px] text-emerald-400 font-semibold">In-System</div>
                    </div>
                    <div className="bg-teal-950/60 border border-teal-600/40 rounded p-1 text-teal-300">
                      <div>2s: {computedMetrics.count2}</div>
                      <div className="text-[8px] text-teal-400 font-semibold">In-System</div>
                    </div>
                    <div className="bg-amber-950/60 border border-amber-600/40 rounded p-1 text-amber-300">
                      <div>1s: {computedMetrics.count1}</div>
                      <div className="text-[8px] text-amber-400 font-semibold">Out-of-Sys</div>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-600/40 rounded p-1 text-slate-300">
                      <div>0s: {computedMetrics.count0}</div>
                      <div className="text-[8px] text-slate-400 font-semibold">Out-of-Sys</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. BEST PASSER & LOWEST PASSER */}
            <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl flex flex-col justify-between shadow-md">
              <div className="flex items-center justify-between text-slate-300 text-xs font-bold mb-2">
                <span className="uppercase tracking-wider text-[11px] text-slate-400">Passers</span>
                <div className="flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black border border-amber-500/30">
                  <Award size={12} />
                  <span>Passing Index</span>
                </div>
              </div>

              <div className="space-y-2">
                {/* Best Passer */}
                <div className="bg-slate-900/80 border border-emerald-500/40 rounded-xl p-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-emerald-400 mb-0.5">
                    <span className="flex items-center gap-1">
                      <ThumbsUp size={11} />
                      <span>Best Passer</span>
                    </span>
                    {computedMetrics.bestPasser && (
                      <span className="text-[9px] text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded font-mono font-black">
                        Index: {computedMetrics.bestPasser.passingIndex}
                      </span>
                    )}
                  </div>
                  {computedMetrics.bestPasser ? (
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-black text-white truncate max-w-[120px]">
                        #{computedMetrics.bestPasser.number} {computedMetrics.bestPasser.name}
                      </span>
                      <span className="font-bold text-slate-200">
                        <strong className="text-emerald-300 font-mono text-sm">
                          {computedMetrics.bestPasser.average.toFixed(2)}
                        </strong>{" "}
                        <span className="text-[10px] text-slate-400">
                          ({computedMetrics.bestPasser.attempts} passes)
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">No pass attempts yet</div>
                  )}
                </div>

                {/* Lowest Passer */}
                <div className="bg-slate-900/80 border border-rose-500/40 rounded-xl p-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-rose-400 mb-0.5">
                    <span className="flex items-center gap-1">
                      <ThumbsDown size={11} />
                      <span>Lowest Passer</span>
                    </span>
                    {computedMetrics.worstPasser && (
                      <span className="text-[9px] text-rose-300 bg-rose-950/80 px-1.5 py-0.2 rounded font-mono font-black">
                        Index: {computedMetrics.worstPasser.passingIndex}
                      </span>
                    )}
                  </div>
                  {computedMetrics.worstPasser &&
                  (computedMetrics.rankedPassers.length > 1 ||
                    computedMetrics.worstPasser.average < 2.0) ? (
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-black text-white truncate max-w-[120px]">
                        #{computedMetrics.worstPasser.number} {computedMetrics.worstPasser.name}
                      </span>
                      <span className="font-bold text-slate-200">
                        <strong className="text-rose-300 font-mono text-sm">
                          {computedMetrics.worstPasser.average.toFixed(2)}
                        </strong>{" "}
                        <span className="text-[10px] text-slate-400">
                          ({computedMetrics.worstPasser.attempts} passes
                          {computedMetrics.worstPasser.countAced > 0
                            ? `, ${computedMetrics.worstPasser.countAced} aced`
                            : ""}
                          )
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">
                      {computedMetrics.rankedPassers.length === 1
                        ? "Only 1 passer active so far"
                        : "No pass errors"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. KILL % & KILL EFFICIENCY */}
            <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl flex flex-col justify-between shadow-md">
              <div className="flex items-center justify-between text-slate-300 text-xs font-bold mb-2">
                <span className="uppercase tracking-wider text-[11px] text-slate-400">Attacking</span>
                <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-black border border-emerald-500/30">
                  <Flame size={12} />
                  <span>Kill % & Eff</span>
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black font-mono text-white tracking-tight">
                    {computedMetrics.killPct.toFixed(1)}%
                  </span>
                  <span
                    className={`text-sm font-black font-mono px-2 py-0.5 rounded ${
                      computedMetrics.hittingEff >= 0.3
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                        : computedMetrics.hittingEff >= 0.15
                        ? "bg-blue-950/80 text-blue-300 border border-blue-500/40"
                        : computedMetrics.hittingEff >= 0
                        ? "bg-slate-700 text-slate-300"
                        : "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                    }`}
                  >
                    eff {formatEff(computedMetrics.hittingEff)}
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 mt-2 space-y-0.5">
                  <div className="flex justify-between font-bold text-white">
                    <span>{computedMetrics.kills} Kills</span>
                    <span className="text-slate-400 font-normal">
                      from {computedMetrics.totalAttacks} total swings
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>
                      Unforced Errs:{" "}
                      <strong className="text-rose-400 font-bold">
                        {computedMetrics.unforcedAttackErrors}
                      </strong>{" "}
                      (out/net)
                    </span>
                    <span>
                      Blocked:{" "}
                      <strong className="text-amber-400 font-bold">
                        {computedMetrics.blockedAttacks}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DETAILED LEADERBOARD & COURT STATUS SECTION */}
          <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl overflow-hidden">
            {/* TABS */}
            <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDetailTab("passers")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeDetailTab === "passers"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Shield size={13} />
                  <span>Passers Board ({computedMetrics.rankedPassers.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDetailTab("attackers")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeDetailTab === "attackers"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Flame size={13} />
                  <span>Hitters Board ({computedMetrics.rankedHitters.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDetailTab("court")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeDetailTab === "court"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Users size={13} />
                  <span>On Court ({computedMetrics.courtPlayerStats.length})</span>
                </button>
              </div>

              <div className="text-[10px] text-slate-400 font-semibold hidden md:block">
                {activeDetailTab === "passers" && "Ranked by Passing Index"}
                {activeDetailTab === "attackers" && "Ranked by Kills and Kill Efficiency"}
                {activeDetailTab === "court" && "Active rotation positions"}
              </div>
            </div>

            {/* TAB CONTENT */}
            <div className="p-3 sm:p-4">
              {/* TAB 1: PASSERS BOARD */}
              {activeDetailTab === "passers" && (
                <div className="space-y-2">
                  {computedMetrics.rankedPassers.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs italic">
                      No serve receive or passing repetitions recorded yet in this scope.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-slate-700/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <th className="pb-2">Passer</th>
                            <th className="pb-2 text-center">Attempts</th>
                            <th className="pb-2 text-center">Avg (0-3)</th>
                            <th className="pb-2 text-center" title="Passing Index (0-100) combining volume workload and 0-3 quality">
                              Pass Index
                            </th>
                            <th className="pb-2 text-center">3s / 2s / 1s / 0s</th>
                            <th className="pb-2 text-center text-rose-400">Aced</th>
                            <th className="pb-2 text-right" title="In-System (3s & 2s) vs Out-of-System (1s & 0s)">In-Sys / Out%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {computedMetrics.rankedPassers.map((p, idx) => {
                            const isTop = idx === 0;
                            const isBottom =
                              idx === computedMetrics.rankedPassers.length - 1 &&
                              computedMetrics.rankedPassers.length > 1;

                            return (
                              <tr key={p.id} className="hover:bg-slate-800/40">
                                <td className="py-2.5 font-bold flex items-center gap-2">
                                  <span className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 text-indigo-300 font-black flex items-center justify-center text-[10px] shrink-0 font-mono">
                                    #{p.number}
                                  </span>
                                  <div className="flex flex-col">
                                    <span className="text-white font-black truncate max-w-[130px]">
                                      {p.name}
                                    </span>
                                    {isTop && (
                                      <span className="text-[9px] font-black text-emerald-400 uppercase">
                                        ★ Best Passer
                                      </span>
                                    )}
                                    {isBottom && p.average < 2.0 && (
                                      <span className="text-[9px] font-black text-rose-400 uppercase">
                                        ⚠ Struggling
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 text-center font-mono font-bold text-slate-200">
                                  {p.attempts}
                                </td>
                                <td className="py-2.5 text-center font-mono font-black text-sm">
                                  <span
                                    className={`${
                                      p.average >= 2.3
                                        ? "text-emerald-400"
                                        : p.average >= 1.8
                                        ? "text-blue-300"
                                        : "text-rose-400"
                                    }`}
                                  >
                                    {p.average.toFixed(2)}
                                  </span>
                                </td>
                                <td className="py-2.5 text-center font-mono font-black text-sm">
                                  <span
                                    className={`px-2 py-0.5 rounded-lg border ${
                                      p.passingIndex >= 85
                                        ? "bg-purple-950/80 text-purple-300 border-purple-500/50"
                                        : p.passingIndex >= 70
                                        ? "bg-indigo-950/80 text-indigo-300 border-indigo-500/50"
                                        : p.passingIndex >= 55
                                        ? "bg-slate-800 text-slate-300 border-slate-600"
                                        : "bg-rose-950/80 text-rose-300 border-rose-500/50"
                                    }`}
                                  >
                                    {p.passingIndex}
                                  </span>
                                </td>
                                <td className="py-2.5 text-center font-mono text-[11px] text-slate-300">
                                  <span className="text-emerald-300 font-bold">{p.count3}</span> /{" "}
                                  <span className="text-teal-300 font-bold">{p.count2}</span> /{" "}
                                  <span className="text-amber-300 font-bold">{p.count1}</span> /{" "}
                                  <span className="text-slate-400 font-bold">{p.count0}</span>
                                </td>
                                <td className="py-2.5 text-center font-mono font-black text-sm">
                                  <span
                                    className={`${
                                      p.countAced > 0 ? "text-rose-400 font-bold" : "text-slate-500"
                                    }`}
                                  >
                                    {p.countAced}
                                  </span>
                                </td>
                                <td className="py-2.5 text-right font-mono font-bold text-slate-200">
                                  <span className="text-emerald-400">{p.inSystemPct.toFixed(0)}%</span>
                                  <span className="text-[10px] text-slate-400 font-normal ml-1">
                                    ({p.outOfSystemPct.toFixed(0)}% out)
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ATTACKERS & EFFICIENCY */}
              {activeDetailTab === "attackers" && (
                <div className="space-y-2">
                  {computedMetrics.rankedHitters.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs italic">
                      No attack attempts logged yet in this scope.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-slate-700/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <th className="pb-2">Hitter</th>
                            <th className="pb-2 text-center">Swings</th>
                            <th className="pb-2 text-center" title="Front Row Set Distribution: When in front row, % of sets directed to this hitter (not of total FR sets)">
                              FR Set %
                            </th>
                            <th className="pb-2 text-center">Kills</th>
                            <th className="pb-2 text-center">Kill %</th>
                            <th className="pb-2 text-center">Unforced Errs</th>
                            <th className="pb-2 text-center">Blocked</th>
                            <th className="pb-2 text-right">Kill Efficiency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {computedMetrics.rankedHitters.map((h) => (
                            <tr key={h.id} className="hover:bg-slate-800/40">
                              <td className="py-2.5 font-bold flex items-center gap-2">
                                <span className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 text-amber-300 font-black flex items-center justify-center text-[10px] shrink-0 font-mono">
                                  #{h.number}
                                </span>
                                <span className="text-white font-black truncate max-w-[140px]">
                                  {h.name}
                                </span>
                              </td>
                              <td className="py-2.5 text-center font-mono font-bold text-slate-300">
                                {h.totalAttacks}
                              </td>
                              <td
                                className="py-2.5 text-center font-mono font-bold text-indigo-300"
                                title={`When in front row: ${h.frontAttacks} of ${h.teamFrontAttacksWhileInFront || h.frontAttacks} sets directed to ${h.name} (${h.frontSetDistPct.toFixed(0)}%)`}
                              >
                                {h.frontSetDistPct.toFixed(0)}%{" "}
                                <span className="text-[9px] text-slate-400 font-normal">
                                  ({h.frontAttacks}/{h.teamFrontAttacksWhileInFront || h.frontAttacks})
                                </span>
                              </td>
                              <td className="py-2.5 text-center font-mono font-black text-emerald-400 text-sm">
                                {h.kills}
                              </td>
                              <td className="py-2.5 text-center font-mono font-bold text-slate-200">
                                {h.killPct.toFixed(1)}%
                              </td>
                              <td className="py-2.5 text-center font-mono font-bold text-rose-400">
                                {h.unforcedErrors}
                              </td>
                              <td className="py-2.5 text-center font-mono font-bold text-amber-400">
                                {h.blockedAttacks}
                              </td>
                              <td className="py-2.5 text-right font-mono font-black text-sm">
                                <span
                                  className={`px-1.5 py-0.5 rounded ${
                                    h.efficiency >= 0.3
                                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                                      : h.efficiency >= 0.15
                                      ? "bg-blue-950/80 text-blue-300 border border-blue-500/40"
                                      : h.efficiency >= 0
                                      ? "text-slate-300"
                                      : "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                                  }`}
                                >
                                  {formatEff(h.efficiency)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ON COURT PLAYERS */}
              {activeDetailTab === "court" && (
                <div className="space-y-2">
                  {computedMetrics.courtPlayerStats.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs italic">
                      No court players currently assigned in lineup.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {computedMetrics.courtPlayerStats.map((p) => {
                        if (!p) return null;
                        return (
                          <div
                            key={p.id}
                            className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 flex flex-col justify-between space-y-2 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="h-7 w-7 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-xs font-mono">
                                  #{p.number}
                                </span>
                                <div className="flex flex-col">
                                  <span className="font-black text-white text-xs truncate max-w-[110px]">
                                    {p.name}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                                    Pos {p.posIndex}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-xs font-black font-mono text-emerald-400">
                                  {p.kills}K ({formatEff(p.efficiency)})
                                </div>
                                <div className="text-[9px] text-slate-400">
                                  {p.attacks} swings • {p.unforcedErrors} err
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-slate-800 text-center font-mono text-[10px]">
                              <div className="bg-slate-950/60 rounded p-1">
                                <span className="text-slate-400 block text-[8px] uppercase">
                                  Pass Avg
                                </span>
                                <span className="font-bold text-purple-300">
                                  {p.passAvg !== null ? p.passAvg.toFixed(2) : "-"}
                                </span>
                              </div>
                              <div className="bg-slate-950/60 rounded p-1">
                                <span className="text-slate-400 block text-[8px] uppercase">
                                  Pass Idx
                                </span>
                                <span className="font-bold text-indigo-300">
                                  {p.passIndex !== null ? p.passIndex : "-"}
                                </span>
                              </div>
                              <div className="bg-slate-950/60 rounded p-1">
                                <span className="text-slate-400 block text-[8px] uppercase">
                                  Aced
                                </span>
                                <span
                                  className={`font-bold ${
                                    p.acedCount > 0 ? "text-rose-400" : "text-slate-400"
                                  }`}
                                >
                                  {p.acedCount}
                                </span>
                              </div>
                              <div className="bg-slate-950/60 rounded p-1">
                                <span className="text-slate-400 block text-[8px] uppercase">
                                  Srv +/-
                                </span>
                                <span
                                  className={`font-bold ${
                                    p.servePlusMinus > 0
                                      ? "text-emerald-400"
                                      : p.servePlusMinus < 0
                                      ? "text-rose-400"
                                      : "text-slate-300"
                                  }`}
                                >
                                  {p.servePlusMinus > 0
                                    ? `+${p.servePlusMinus}`
                                    : p.servePlusMinus}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-950 px-4 sm:px-6 py-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Press <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px] font-mono">Esc</kbd> to close timeout
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-950/50 cursor-pointer flex items-center justify-center gap-2 active:scale-95"
          >
            <span>Return to Court</span>
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
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Record Timeout Event
                </h3>
                <p className="text-xs text-slate-400">
                  Select who called the timeout or continue without recording one
                </p>
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
                <ChevronRight
                  size={16}
                  className="text-blue-300 group-hover:translate-x-1 transition-transform shrink-0"
                />
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
                <ChevronRight
                  size={16}
                  className="text-slate-400 group-hover:translate-x-1 transition-transform shrink-0"
                />
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
                    <div className="font-bold text-sm text-white">Just Reviewing Stats</div>
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
