import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  Flame,
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
  ChevronDown,
  ChevronUp,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Sparkles,
  Ban,
  Sun,
  Moon,
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
  sets?: any[];
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

export interface TrendShiftItem {
  id: string;
  category: "attack" | "pass" | "serve" | "block" | "momentum";
  title: string;
  direction: "positive" | "negative";
  targetName: string;
  targetNumber?: string;
  targetRole?: string;
  playerId?: string;
  metricLabel: string;
  recentValue: number;
  recentDisplay: string;
  priorValue: number;
  priorDisplay: string;
  deltaDisplay: string;
  deltaPercent?: number;
  impactScore: number;
  impactLevel: "Critical" | "High" | "Moderate";
  summary: string;
  coachingTip?: string;
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
  sets = [],
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

  // Toggle to expand all detected trend shifts in last 10 points
  const [showAllTrends, setShowAllTrends] = useState<boolean>(false);

  // Bright / High-Contrast Mode for gym lighting (default true per coach request)
  const [isBrightMode, setIsBrightMode] = useState<boolean>(true);

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

  // Filter stats for either Current Set or Full Match (Our Team)
  const scopedStats = useMemo(() => {
    return (stats || []).filter((st) => {
      if (st.isOpp || st.isOpponent) return false;
      if (activeMatch?.id && st.matchId && st.matchId !== activeMatch.id) return false;
      if (viewScope === "set") {
        if (activeSetId) {
          if (st.setId) return st.setId === activeSetId;
          if (st.setNum !== undefined && st.setNum !== null) {
            return Number(st.setNum) === Number(currentSetNum);
          }
          return true;
        }
        if (st.setNum !== undefined && st.setNum !== null) {
          return Number(st.setNum) === Number(currentSetNum);
        }
        return true;
      }
      return true;
    });
  }, [stats, viewScope, activeSetId, activeMatch?.id, currentSetNum]);

  // Opponent stats in the same scope (used for opponent aces, opponent blocks, etc.)
  const scopedOppStats = useMemo(() => {
    return (stats || []).filter((st) => {
      if (!st.isOpp && !st.isOpponent) return false;
      if (activeMatch?.id && st.matchId && st.matchId !== activeMatch.id) return false;
      if (viewScope === "set") {
        if (activeSetId) {
          if (st.setId) return st.setId === activeSetId;
          if (st.setNum !== undefined && st.setNum !== null) {
            return Number(st.setNum) === Number(currentSetNum);
          }
          return true;
        }
        if (st.setNum !== undefined && st.setNum !== null) {
          return Number(st.setNum) === Number(currentSetNum);
        }
        return true;
      }
      return true;
    });
  }, [stats, viewScope, activeSetId, activeMatch?.id, currentSetNum]);

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
          teamAcedCount += 1;
          pPass.cAced += 1;
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

    // Factor in any opponent serve aces logged in this scope to guarantee accurate times aced count
    const oppAcesInScope = (stats || []).filter((st) => {
      const isOppStat = Boolean(st.isOpp || st.isOpponent);
      if (!isOppStat) return false;
      const cat = (st.category || "").toLowerCase();
      const met = (st.metric || "").toLowerCase();
      if (cat !== "serve" || !met.includes("ace")) return false;
      if (viewScope === "set") {
        return activeSetId
          ? (st.setId === activeSetId || (st.matchId === activeMatch?.id && Number(st.setNum) === Number(currentSetNum)))
          : (st.matchId === activeMatch?.id && Number(st.setNum) === Number(currentSetNum));
      }
      return !activeMatch || st.matchId === activeMatch?.id;
    }).length;
    teamAcedCount = Math.max(teamAcedCount, oppAcesInScope);

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

  // -------------------------------------------------------------
  // LAST 10 POINTS TREND ANALYSIS
  // Determines the recent 10-point window and compares against prior baseline.
  // Evaluates several parameters:
  // - Player Getting Blocked More than before
  // - Player Kill % Increased or Slumped
  // - Player Attack Unforced Errors
  // - Player Passing Quality Locked In or Breakdown
  // - Player / Team Aced on Serve Receive
  // - Player / Team Service Aces & Serve Errors
  // - Team Stuff Blocks
  // - Team Scoring Run Momentum
  // - Team Swings Blocked
  // Selects the TWO biggest trend changes with most impact (1 Positive, 1 Negative).
  // -------------------------------------------------------------
  const tenPointTrends = useMemo(() => {
    const totalPointsPlayed = score.ucc + score.opp;

    // 1. Locate current set and its point history
    const currentSet = (sets || []).find(
      (s) =>
        (activeSetId && s.id === activeSetId) ||
        (s.matchId === activeMatch?.id && Number(s.setNum) === Number(currentSetNum)) ||
        Number(s.setNum) === Number(currentSetNum)
    );
    const pointHistory: any[] = currentSet?.pointHistory || [];

    // 2. Identify the last 10 points window
    let recentWindowSize = 10;
    let recentStartTime = 0;
    let recentUccPoints = 0;
    let recentOppPoints = 0;

    if (pointHistory.length > 0) {
      recentWindowSize = Math.min(10, pointHistory.length);
      const recentPts = pointHistory.slice(-recentWindowSize);
      recentUccPoints = recentPts.filter((pt) => pt.team === "ucc").length;
      recentOppPoints = recentPts.filter((pt) => pt.team !== "ucc").length;

      if (pointHistory.length > recentWindowSize) {
        const prePt = pointHistory[pointHistory.length - recentWindowSize - 1];
        if (prePt?.timestamp) {
          recentStartTime = new Date(prePt.timestamp).getTime();
        } else if (recentPts[0]?.timestamp) {
          recentStartTime = new Date(recentPts[0].timestamp).getTime() - 15000;
        }
      } else {
        recentStartTime = 0; // entire set so far
      }
    } else {
      // Fallback using score / history snapshots
      recentWindowSize = Math.min(10, Math.max(1, totalPointsPlayed));
      if (history && history.length >= 2) {
        const snap = history.find(
          (h) => (h.score?.ucc || 0) + (h.score?.opp || 0) <= Math.max(0, totalPointsPlayed - 10)
        );
        if (snap?.score) {
          recentUccPoints = Math.max(0, score.ucc - snap.score.ucc);
          recentOppPoints = Math.max(0, score.opp - snap.score.opp);
        } else {
          recentUccPoints = Math.round((score.ucc / Math.max(1, totalPointsPlayed)) * recentWindowSize);
          recentOppPoints = recentWindowSize - recentUccPoints;
        }
      } else {
        recentUccPoints = Math.round((score.ucc / Math.max(1, totalPointsPlayed)) * recentWindowSize);
        recentOppPoints = recentWindowSize - recentUccPoints;
      }
    }

    // 3. Partition stats into Recent (Last 10 points) vs Prior Baseline
    let recentStats: any[] = [];
    let priorStats: any[] = [];
    let recentOppStats: any[] = [];
    let priorOppStats: any[] = [];

    const sortedStats = [...scopedStats].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });
    const sortedOppStats = [...scopedOppStats].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });

    if (recentStartTime > 0) {
      recentStats = sortedStats.filter((st) => {
        const t = st.timestamp ? new Date(st.timestamp).getTime() : 0;
        return t >= recentStartTime;
      });
      priorStats = sortedStats.filter((st) => {
        const t = st.timestamp ? new Date(st.timestamp).getTime() : 0;
        return t < recentStartTime;
      });
      recentOppStats = sortedOppStats.filter((st) => {
        const t = st.timestamp ? new Date(st.timestamp).getTime() : 0;
        return t >= recentStartTime;
      });
      priorOppStats = sortedOppStats.filter((st) => {
        const t = st.timestamp ? new Date(st.timestamp).getTime() : 0;
        return t < recentStartTime;
      });
    }

    // Safety fallback: guarantee recentStats and priorStats have meaningful slices whenever stats exist
    if (recentStats.length === 0 && sortedStats.length > 0) {
      const splitIdx = Math.max(0, sortedStats.length - Math.min(12, Math.max(2, Math.round(sortedStats.length * 0.45))));
      priorStats = sortedStats.slice(0, splitIdx);
      recentStats = sortedStats.slice(splitIdx);

      const oppSplit = Math.max(0, sortedOppStats.length - Math.min(12, Math.max(2, Math.round(sortedOppStats.length * 0.45))));
      priorOppStats = sortedOppStats.slice(0, oppSplit);
      recentOppStats = sortedOppStats.slice(oppSplit);
    } else if (recentStartTime === 0 && sortedStats.length >= 4) {
      const splitIdx = Math.floor(sortedStats.length / 2);
      priorStats = sortedStats.slice(0, splitIdx);
      recentStats = sortedStats.slice(splitIdx);

      const oppSplit = Math.floor(sortedOppStats.length / 2);
      priorOppStats = sortedOppStats.slice(0, oppSplit);
      recentOppStats = sortedOppStats.slice(oppSplit);
    }

    // Helper: summarize stats for a given slice
    interface SliceSummary {
      att: number;
      kills: number;
      blocked: number;
      unforcedErrs: number;
      passes: number;
      passSum: number;
      pass0: number;
      aced: number;
      serves: number;
      aces: number;
      serveErrs: number;
      blocks: number;
    }

    const summarizePlayerSlice = (slice: any[], pId: string): SliceSummary => {
      let att = 0, kills = 0, blocked = 0, unforcedErrs = 0;
      let passes = 0, passSum = 0, pass0 = 0, aced = 0;
      let serves = 0, aces = 0, serveErrs = 0, blocks = 0;

      for (const st of slice) {
        if (String(st.playerId) !== String(pId)) continue;
        const cat = (st.category || "").toLowerCase();
        const met = (st.metric || "").toLowerCase();
        const val = Number(st.value) || 1;

        if (cat === "attack" || (cat === "error" && (met.includes("att") || met.includes("hit")))) {
          const isKill = met.includes("kill");
          const isBlk = met.includes("blocked") || met.includes("stuff") || met.includes("stuffed");
          const isUnf =
            !isBlk &&
            (met.includes("out") ||
              met.includes("net") ||
              met.includes("error") ||
              met.includes("err") ||
              met.includes("antenna") ||
              met.includes("fault"));
          const isSwing = isKill || isBlk || isUnf || met.includes("swing") || met.includes("play");
          if (isSwing) {
            att += val;
            if (isKill) kills += val;
            if (isBlk) blocked += val;
            if (isUnf) unforcedErrs += val;
          }
        } else if (cat.includes("pass") || cat.includes("receive")) {
          const isAced = met.includes("aced") || met === "aced" || Boolean((st as any).isAced);
          if (isAced) aced += val;
          let sc: number | null = null;
          if (st.value !== undefined && !isNaN(Number(st.value))) {
            sc = Math.min(3, Math.max(0, Number(st.value)));
          } else if (met === "3" || met.includes("perfect")) sc = 3;
          else if (met === "2" || met.includes("good")) sc = 2;
          else if (met === "1" || met.includes("poor")) sc = 1;
          else if (met === "0" || met.includes("error") || isAced || met.includes("shank")) sc = 0;
          if (sc !== null) {
            passes += val;
            passSum += sc * val;
            if (sc === 0) pass0 += val;
          }
        } else if (cat === "serve") {
          serves += val;
          if (met.includes("ace")) aces += val;
          else if (met.includes("error") || met.includes("err")) serveErrs += val;
        } else if (cat === "block") {
          if (met.includes("kill") || met.includes("solo") || met.includes("point") || met.includes("stuff")) {
            blocks += val;
          }
        }
      }

      return { att, kills, blocked, unforcedErrs, passes, passSum, pass0, aced, serves, aces, serveErrs, blocks };
    };

    const summarizeTeamSlice = (slice: any[]): SliceSummary => {
      let att = 0, kills = 0, blocked = 0, unforcedErrs = 0;
      let passes = 0, passSum = 0, pass0 = 0, aced = 0;
      let serves = 0, aces = 0, serveErrs = 0, blocks = 0;

      for (const st of slice) {
        if (st.isOpp || st.isOpponent) continue;
        const cat = (st.category || "").toLowerCase();
        const met = (st.metric || "").toLowerCase();
        const val = Number(st.value) || 1;

        if (cat === "attack" || (cat === "error" && (met.includes("att") || met.includes("hit")))) {
          const isKill = met.includes("kill");
          const isBlk = met.includes("blocked") || met.includes("stuff") || met.includes("stuffed");
          const isUnf =
            !isBlk &&
            (met.includes("out") ||
              met.includes("net") ||
              met.includes("error") ||
              met.includes("err") ||
              met.includes("antenna") ||
              met.includes("fault"));
          const isSwing = isKill || isBlk || isUnf || met.includes("swing") || met.includes("play");
          if (isSwing) {
            att += val;
            if (isKill) kills += val;
            if (isBlk) blocked += val;
            if (isUnf) unforcedErrs += val;
          }
        } else if (cat.includes("pass") || cat.includes("receive")) {
          const isAced = met.includes("aced") || met === "aced" || Boolean((st as any).isAced);
          if (isAced) aced += val;
          let sc: number | null = null;
          if (st.value !== undefined && !isNaN(Number(st.value))) {
            sc = Math.min(3, Math.max(0, Number(st.value)));
          } else if (met === "3" || met.includes("perfect")) sc = 3;
          else if (met === "2" || met.includes("good")) sc = 2;
          else if (met === "1" || met.includes("poor")) sc = 1;
          else if (met === "0" || met.includes("error") || isAced || met.includes("shank")) sc = 0;
          if (sc !== null) {
            passes += val;
            passSum += sc * val;
            if (sc === 0) pass0 += val;
          }
        } else if (cat === "serve") {
          serves += val;
          if (met.includes("ace")) aces += val;
          else if (met.includes("error") || met.includes("err")) serveErrs += val;
        } else if (cat === "block") {
          if (met.includes("kill") || met.includes("solo") || met.includes("point") || met.includes("stuff")) {
            blocks += val;
          }
        }
      }

      return { att, kills, blocked, unforcedErrs, passes, passSum, pass0, aced, serves, aces, serveErrs, blocks };
    };

    const oppAcesInRecent = recentOppStats.filter((st) => {
      const cat = (st.category || "").toLowerCase();
      const met = (st.metric || "").toLowerCase();
      return cat === "serve" && met.includes("ace");
    }).length;
    const oppAcesInPrior = priorOppStats.filter((st) => {
      const cat = (st.category || "").toLowerCase();
      const met = (st.metric || "").toLowerCase();
      return cat === "serve" && met.includes("ace");
    }).length;

    const teamRecent = summarizeTeamSlice(recentStats);
    teamRecent.aced = Math.max(teamRecent.aced, oppAcesInRecent);
    const teamPrior = summarizeTeamSlice(priorStats);
    teamPrior.aced = Math.max(teamPrior.aced, oppAcesInPrior);

    // 4. Generate Candidate Trend Shifts Across All Parameters
    const candidates: TrendShiftItem[] = [];

    // Evaluate each player on roster
    for (const p of roster) {
      const pId = String(p.id);
      const pName = p.name || `Player #${p.number || pId}`;
      const pNum = String(p.number ?? "");
      const pRole = p.position || "";

      const r = summarizePlayerSlice(recentStats, pId);
      const pr = summarizePlayerSlice(priorStats, pId);

      // PARAMETER 1: PLAYER GETTING BLOCKED MORE THAN BEFORE (Negative)
      if (r.blocked >= 1) {
        const rBlockedRate = r.att > 0 ? (r.blocked / r.att) * 100 : 0;
        const prBlockedRate = pr.att > 0 ? (pr.blocked / pr.att) * 100 : 0;
        const rateDiff = rBlockedRate - prBlockedRate;
        const impact = r.blocked * 32 + Math.max(0, rateDiff) * 0.45;

        candidates.push({
          id: `player_blocked_${pId}`,
          category: "attack",
          direction: "negative",
          title: "Attacks Stuffed by Block",
          targetName: pName,
          targetNumber: pNum,
          targetRole: pRole,
          playerId: pId,
          metricLabel: "Attacks Blocked",
          recentValue: r.blocked,
          recentDisplay: `${r.blocked} blocked (${r.blocked}/${r.att} swings, ${rBlockedRate.toFixed(0)}%)`,
          priorValue: pr.blocked,
          priorDisplay: pr.att > 0 ? `${pr.blocked} blocked (${prBlockedRate.toFixed(0)}%)` : "0 blocked earlier",
          deltaDisplay: `+${r.blocked} Blocked (${rateDiff > 0 ? `+${rateDiff.toFixed(0)}%` : "Surge"})`,
          impactScore: Math.round(impact),
          impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
          summary: `${pName} has been blocked ${r.blocked} time${r.blocked > 1 ? "s" : ""} on ${r.att} swings (${rBlockedRate.toFixed(0)}%) in the last 10 points${pr.att > 0 ? ` vs ${prBlockedRate.toFixed(0)}% prior` : ""}.`,
          coachingTip: "Opponent block is keying on this hitter; speed up the set tempo, push ball wider, or tell hitter to tool off hands and tip into deep corners.",
        });
      }

      // PARAMETER 2: PLAYER KILL % HAS INCREASED (Positive)
      if (r.att >= 1 && r.kills >= 1) {
        const rKillPct = (r.kills / r.att) * 100;
        const prKillPct = pr.att > 0 ? (pr.kills / pr.att) * 100 : 0;
        const diffPct = rKillPct - prKillPct;
        if (diffPct >= 10 || rKillPct >= 45 || (r.att === 1 && r.kills === 1)) {
          const impact = r.kills * 22 + Math.max(0, diffPct) * 0.55;
          candidates.push({
            id: `player_kill_surge_${pId}`,
            category: "attack",
            direction: "positive",
            title: "Kill % Surge",
            targetName: pName,
            targetNumber: pNum,
            targetRole: pRole,
            playerId: pId,
            metricLabel: "Kill %",
            recentValue: rKillPct,
            recentDisplay: `${rKillPct.toFixed(0)}% (${r.kills}/${r.att} kills)`,
            priorValue: prKillPct,
            priorDisplay: pr.att > 0 ? `${prKillPct.toFixed(0)}% earlier` : "Baseline",
            deltaDisplay: `+${diffPct.toFixed(0)}% Kill Rate`,
            impactScore: Math.round(impact),
            impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
            summary: `${pName} kill rate surged to ${rKillPct.toFixed(0)}% (${r.kills}/${r.att}) over the last 10 points, up ${diffPct > 0 ? `+${diffPct.toFixed(0)}%` : ""} from earlier.`,
            coachingTip: "Hot hand in terminal attack; keep feeding them in both in-system rhythm and transition opportunities.",
          });
        }
      }

      // PARAMETER 3: PLAYER KILL % SLUMP (Negative)
      if (r.att >= 2 && r.kills === 0 && (pr.att >= 2 && (pr.kills / pr.att) >= 0.25)) {
        const prKillPct = (pr.kills / pr.att) * 100;
        const impact = r.att * 18 + prKillPct * 0.4;
        candidates.push({
          id: `player_kill_slump_${pId}`,
          category: "attack",
          direction: "negative",
          title: "Kill Production Stalled",
          targetName: pName,
          targetNumber: pNum,
          targetRole: pRole,
          playerId: pId,
          metricLabel: "Kill %",
          recentValue: 0,
          recentDisplay: `0% (0/${r.att} kills)`,
          priorValue: prKillPct,
          priorDisplay: `${prKillPct.toFixed(0)}% earlier`,
          deltaDisplay: `-${prKillPct.toFixed(0)}% Kill Rate`,
          impactScore: Math.round(impact),
          impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
          summary: `${pName} is 0-for-${r.att} (0% kills) over the last 10 points after converting at ${prKillPct.toFixed(0)}% earlier.`,
          coachingTip: "Offensive production has dipped; vary set location or run combination plays to open up single-block looks.",
        });
      }

      // PARAMETER 4: PLAYER ATTACK UNFORCED ERRORS (Negative)
      if (r.unforcedErrs >= 1) {
        const impact = r.unforcedErrs * 28 + (r.att > 0 ? (r.unforcedErrs / r.att) * 20 : 0);
        candidates.push({
          id: `player_att_err_${pId}`,
          category: "attack",
          direction: "negative",
          title: "Attack Unforced Errors",
          targetName: pName,
          targetNumber: pNum,
          targetRole: pRole,
          playerId: pId,
          metricLabel: "Unforced Errors",
          recentValue: r.unforcedErrs,
          recentDisplay: `${r.unforcedErrs} hitting errors (${r.att} swings)`,
          priorValue: pr.unforcedErrs,
          priorDisplay: `${pr.unforcedErrs} earlier`,
          deltaDisplay: `+${r.unforcedErrs} Errs (Out/Net)`,
          impactScore: Math.round(impact),
          impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
          summary: `${pName} committed ${r.unforcedErrs} unforced attack error${r.unforcedErrs > 1 ? "s" : ""} (out or net) in the last 10 points.`,
          coachingTip: "Conceding free points; instruct hitter to roll deep or recycle off block hands when out of system rather than forcing low-percentage winners.",
        });
      }

      // PARAMETER 5: PLAYER PASSING PLATFORM LOCKED IN (Positive)
      if (r.passes >= 1) {
        const rPassAvg = r.passSum / r.passes;
        const prPassAvg = pr.passes > 0 ? pr.passSum / pr.passes : 1.8;
        const diffAvg = rPassAvg - prPassAvg;
        if (diffAvg >= 0.25 || rPassAvg >= 2.3 || (r.passes === 1 && rPassAvg === 3)) {
          const impact = r.passes * 14 + Math.max(0, diffAvg) * 35;
          candidates.push({
            id: `player_pass_surge_${pId}`,
            category: "pass",
            direction: "positive",
            title: "Pass Platform Locked In",
            targetName: pName,
            targetNumber: pNum,
            targetRole: pRole,
            playerId: pId,
            metricLabel: "Pass Avg (0-3)",
            recentValue: rPassAvg,
            recentDisplay: `${rPassAvg.toFixed(2)} / 3.00 (${r.passes} passes)`,
            priorValue: prPassAvg,
            priorDisplay: `${prPassAvg.toFixed(2)} earlier`,
            deltaDisplay: `+${diffAvg.toFixed(2)} Pass Grade`,
            impactScore: Math.round(impact),
            impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
            summary: `${pName} passing average rose to ${rPassAvg.toFixed(2)} on ${r.passes} receptions over the last 10 points (prior: ${prPassAvg.toFixed(2)}).`,
            coachingTip: "Clean ball control is giving the setter perfect tempo; keep running fast middle attacks.",
          });
        }
      }

      // PARAMETER 6: PLAYER TARGETED & ACED ON RECEIVE (Negative)
      if (r.aced >= 1) {
        const impact = r.aced * 36;
        candidates.push({
          id: `player_aced_${pId}`,
          category: "pass",
          direction: "negative",
          title: "Targeted on Serve Receive",
          targetName: pName,
          targetNumber: pNum,
          targetRole: pRole,
          playerId: pId,
          metricLabel: "Times Aced",
          recentValue: r.aced,
          recentDisplay: `Aced ${r.aced} time${r.aced > 1 ? "s" : ""} (${r.passes} passes)`,
          priorValue: pr.aced,
          priorDisplay: `${pr.aced} aced earlier`,
          deltaDisplay: `+${r.aced} Aces Against`,
          impactScore: Math.round(impact),
          impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
          summary: `${pName} has been aced ${r.aced} time${r.aced > 1 ? "s" : ""} in the last 10 points as opponent targets their seam.`,
          coachingTip: "Opponent server is zoning in on this receiver; pinch libero over to protect seam or have passer drop back half a step.",
        });
      }

      // PARAMETER 7: PLAYER SERVICE ACES (Positive)
      if (r.aces >= 1) {
        const impact = r.aces * 28;
        candidates.push({
          id: `player_aces_${pId}`,
          category: "serve",
          direction: "positive",
          title: "Service Aces Pressure",
          targetName: pName,
          targetNumber: pNum,
          targetRole: pRole,
          playerId: pId,
          metricLabel: "Service Aces",
          recentValue: r.aces,
          recentDisplay: `${r.aces} ace${r.aces > 1 ? "s" : ""} (${r.serves} serves)`,
          priorValue: pr.aces,
          priorDisplay: `${pr.aces} earlier`,
          deltaDisplay: `+${r.aces} Service Aces`,
          impactScore: Math.round(impact),
          impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
          summary: `${pName} scored ${r.aces} ace${r.aces > 1 ? "s" : ""} from the service line in the last 10 points.`,
          coachingTip: "Serve is causing severe reception breakdowns; keep serving aggressive seam targets.",
        });
      }

      // PARAMETER 8: PLAYER SERVE ERRORS (Negative)
      if (r.serveErrs >= 1) {
        const impact = r.serveErrs * 24;
        candidates.push({
          id: `player_srv_err_${pId}`,
          category: "serve",
          direction: "negative",
          title: "Service Miss (Free Sideout)",
          targetName: pName,
          targetNumber: pNum,
          targetRole: pRole,
          playerId: pId,
          metricLabel: "Serve Errors",
          recentValue: r.serveErrs,
          recentDisplay: `${r.serveErrs} error${r.serveErrs > 1 ? "s" : ""} (${r.serves} serves)`,
          priorValue: pr.serveErrs,
          priorDisplay: `${pr.serveErrs} earlier`,
          deltaDisplay: `+${r.serveErrs} Serve Errors`,
          impactScore: Math.round(impact),
          impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
          summary: `${pName} missed ${r.serveErrs} serve${r.serveErrs > 1 ? "s" : ""} in the last 10 points, conceding immediate free sideouts.`,
          coachingTip: "Dial back service aggression to 85%; focus on high-percentage ball placement to zone 1 or 5 to force a rally.",
        });
      }
    }

    // TEAM-LEVEL PARAMETERS
    // 9. TEAM STUFF BLOCKS (Positive)
    if (teamRecent.blocks >= 1) {
      const impact = teamRecent.blocks * 25;
      candidates.push({
        id: "team_blocks",
        category: "block",
        direction: "positive",
        title: "Block Wall Established",
        targetName: `${ourTeamName} Defense`,
        metricLabel: "Stuff Blocks",
        recentValue: teamRecent.blocks,
        recentDisplay: `${teamRecent.blocks} stuff block${teamRecent.blocks > 1 ? "s" : ""}`,
        priorValue: teamPrior.blocks,
        priorDisplay: `${teamPrior.blocks} earlier`,
        deltaDisplay: `+${teamRecent.blocks} Blocks`,
        impactScore: Math.round(impact),
        impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
        summary: `${ourTeamName} shut down opponent attacks with ${teamRecent.blocks} stuff block${teamRecent.blocks > 1 ? "s" : ""} in the last 10 points.`,
        coachingTip: "Blockers are setting the pin correctly and pressing over; keep maintaining strong discipline on outside hitters.",
      });
    }

    // 10. TEAM SCORING MOMENTUM (Positive / Negative)
    if (recentUccPoints >= 6) {
      const diff = recentUccPoints - recentOppPoints;
      const impact = diff * 16;
      candidates.push({
        id: "team_momentum_pos",
        category: "momentum",
        direction: "positive",
        title: `Scoring Run (${recentUccPoints}-${recentOppPoints})`,
        targetName: `${ourTeamName} Momentum`,
        metricLabel: "Points Won",
        recentValue: recentUccPoints,
        recentDisplay: `${recentUccPoints} of 10 points won`,
        priorValue: 0,
        priorDisplay: "Prior rallies",
        deltaDisplay: `+${diff} Point Margin`,
        impactScore: Math.round(impact),
        impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
        summary: `${ourTeamName} is on a ${recentUccPoints}-${recentOppPoints} scoring surge over the last 10 points.`,
        coachingTip: "Strong rhythm and court energy; maintain aggressive communication out of the timeout.",
      });
    } else if (recentOppPoints >= 6) {
      const diff = recentOppPoints - recentUccPoints;
      const impact = diff * 18;
      candidates.push({
        id: "team_momentum_neg",
        category: "momentum",
        direction: "negative",
        title: `Opponent Run (${recentOppPoints}-${recentUccPoints})`,
        targetName: "Match Momentum",
        metricLabel: "Points Conceded",
        recentValue: recentOppPoints,
        recentDisplay: `${recentOppPoints} of 10 conceded`,
        priorValue: 0,
        priorDisplay: "Prior rallies",
        deltaDisplay: `-${diff} Point Margin`,
        impactScore: Math.round(impact),
        impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
        summary: `${opponentName} has seized momentum winning ${recentOppPoints} of the last 10 points (${recentOppPoints}-${recentUccPoints} run).`,
        coachingTip: "Reset focus; run our primary designed sideout play off first contact to stop the run immediately.",
      });
    }

    // 11. TEAM-WIDE ATTACKS BLOCKED (Negative)
    if (teamRecent.blocked >= 2) {
      const impact = teamRecent.blocked * 28;
      candidates.push({
        id: "team_blocked",
        category: "attack",
        direction: "negative",
        title: "Team Swings Blocked",
        targetName: `${ourTeamName} Offense`,
        metricLabel: "Attacks Blocked",
        recentValue: teamRecent.blocked,
        recentDisplay: `${teamRecent.blocked} attacks blocked`,
        priorValue: teamPrior.blocked,
        priorDisplay: `${teamPrior.blocked} earlier`,
        deltaDisplay: `+${teamRecent.blocked} Stuffed`,
        impactScore: Math.round(impact),
        impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
        summary: `Opponent block has stuffed ${teamRecent.blocked} team attacks in the last 10 points.`,
        coachingTip: "Setter needs to deliver balls 2-3 feet off the net to allow hitters room to see the block and wipe high hands.",
      });
    }

    // 12. TEAM-WIDE ACES SURRENDERED (Negative)
    if (teamRecent.aced >= 2) {
      const impact = teamRecent.aced * 36;
      candidates.push({
        id: "team_aced",
        category: "pass",
        direction: "negative",
        title: "Multiple Aces Conceded",
        targetName: `${ourTeamName} Serve Receive`,
        metricLabel: "Times Aced",
        recentValue: teamRecent.aced,
        recentDisplay: `${teamRecent.aced} aces surrendered`,
        priorValue: teamPrior.aced,
        priorDisplay: `${teamPrior.aced} earlier`,
        deltaDisplay: `+${teamRecent.aced} Aces Against`,
        impactScore: Math.round(impact),
        impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
        summary: `${ourTeamName} surrendered ${teamRecent.aced} service aces in the last 10 points under heavy serve pressure.`,
        coachingTip: "Shift to a 4-passer shell or pinch the libero; passers must call seams early on contact.",
      });
    }

    // 13. TEAM-WIDE KILL % SURGE (Positive)
    if (teamRecent.att >= 3) {
      const rKillPct = (teamRecent.kills / teamRecent.att) * 100;
      const prKillPct = teamPrior.att > 0 ? (teamPrior.kills / teamPrior.att) * 100 : 0;
      const diffPct = rKillPct - prKillPct;
      if (diffPct >= 10 || rKillPct >= 45) {
        const impact = teamRecent.kills * 20 + Math.max(0, diffPct) * 0.5;
        candidates.push({
          id: "team_kill_surge",
          category: "attack",
          direction: "positive",
          title: "Team Kill % Surge",
          targetName: `${ourTeamName} Offense`,
          metricLabel: "Team Kill %",
          recentValue: rKillPct,
          recentDisplay: `${rKillPct.toFixed(0)}% (${teamRecent.kills}/${teamRecent.att} kills)`,
          priorValue: prKillPct,
          priorDisplay: `${prKillPct.toFixed(0)}% earlier`,
          deltaDisplay: `+${diffPct.toFixed(0)}% Kill Rate`,
          impactScore: Math.round(impact),
          impactLevel: impact >= 50 ? "Critical" : impact >= 30 ? "High" : "Moderate",
          summary: `Team terminal attack improved to ${rKillPct.toFixed(0)}% (${teamRecent.kills}/${teamRecent.att}) over the last 10 points.`,
          coachingTip: "Offensive distribution is clicking; continue spreading sets to keep opponent middle off-balance.",
        });
      }
    }

    // Sort into positive and negative by impact score
    const positiveTrends = candidates
      .filter((c) => c.direction === "positive")
      .sort((a, b) => b.impactScore - a.impactScore);

    const negativeTrends = candidates
      .filter((c) => c.direction === "negative")
      .sort((a, b) => b.impactScore - a.impactScore);

    // Fallbacks if zero candidates meet criteria
    const fallbackPositive: TrendShiftItem = {
      id: "fallback_pos",
      category: "momentum",
      direction: "positive",
      title: "Clean Platform Stability",
      targetName: `${ourTeamName} Fundamentals`,
      metricLabel: "Error Control",
      recentValue: 0,
      recentDisplay: "Steady Execution",
      priorValue: 0,
      priorDisplay: "Baseline",
      deltaDisplay: "Clean Ball Control",
      impactScore: 25,
      impactLevel: "Moderate",
      summary: `${ourTeamName} is maintaining solid foundational play and avoiding consecutive mistakes in recent rallies.`,
      coachingTip: "Stay aggressive with first-tempo swings and keep targeting opponent passing seams.",
    };

    const fallbackNegative: TrendShiftItem = {
      id: "fallback_neg",
      category: "momentum",
      direction: "negative",
      title: "Zero Critical Breakdowns",
      targetName: `${ourTeamName} Execution`,
      metricLabel: "Breakdown Control",
      recentValue: 0,
      recentDisplay: "No Major Slumps",
      priorValue: 0,
      priorDisplay: "Baseline",
      deltaDisplay: "0 Critical Breakdowns",
      impactScore: 20,
      impactLevel: "Moderate",
      summary: `No severe negative trend shifts detected in the last 10 points — strong defensive consistency and minimal unforced errors.`,
      coachingTip: "Maintain court communication and keep service pressure high to prevent opponent runs.",
    };

    const topPositive = positiveTrends[0] || fallbackPositive;
    const topNegative = negativeTrends[0] || fallbackNegative;

    return {
      windowSize: recentWindowSize,
      totalPointsPlayed,
      recentUccPoints,
      recentOppPoints,
      topPositive,
      topNegative,
      allCandidates: candidates.sort((a, b) => b.impactScore - a.impactScore),
      hasSubstantialData: totalPointsPlayed >= 6,
    };
  }, [scopedStats, scopedOppStats, stats, roster, sets, activeSetId, activeMatch, currentSetNum, score, history, viewScope, ourTeamName, opponentName]);

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
    <div className={`fixed inset-0 z-[9999] backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200 ${
      isBrightMode ? "bg-slate-900/60" : "bg-slate-950/85"
    }`}>
      <div className={`rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh] transition-colors ${
        isBrightMode
          ? "bg-slate-50 border-2 border-indigo-200/90 text-slate-900"
          : "bg-slate-900 border border-slate-700/80 text-white"
      }`}>
        {/* HEADER: CLOCK, SCORE & LIVE SITUATION */}
        <div className={`px-4 sm:px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 transition-colors ${
          isBrightMode
            ? "bg-white border-slate-200 text-slate-900 shadow-xs"
            : "bg-slate-950 border-slate-800 text-white"
        }`}>
          <div className="flex items-center gap-3">
            {/* 60-Second Countdown Dial */}
            <div
              className={`h-12 w-12 rounded-2xl flex flex-col items-center justify-center font-black transition-colors border shadow-sm ${
                secondsRemaining <= 15
                  ? isBrightMode
                    ? "bg-rose-500 text-white border-rose-600 animate-pulse"
                    : "bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse"
                  : isBrightMode
                  ? "bg-amber-400 text-slate-950 border-amber-500 shadow-md"
                  : "bg-amber-400/20 text-amber-300 border-amber-400/40"
              }`}
            >
              <span className="text-xl sm:text-2xl leading-none font-mono">
                {secondsRemaining}
              </span>
              <span className={`text-[7px] uppercase tracking-wider font-extrabold ${isBrightMode ? "text-slate-900" : "text-slate-400"}`}>
                Sec
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs sm:text-sm font-black uppercase tracking-wider ${isBrightMode ? "text-slate-950" : "text-white"}`}>
                  Timeout Stats
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${isBrightMode ? "bg-blue-100 text-blue-900 border-blue-200 font-black" : "bg-indigo-500/30 text-indigo-300 border-indigo-500/30"}`}>
                  Set {currentSetNum}
                </span>
              </div>
              <div className={`flex items-center gap-2 text-xs mt-0.5 ${isBrightMode ? "text-slate-600" : "text-slate-400"}`}>
                <span className={`font-black text-sm ${isBrightMode ? "text-slate-950" : "text-white"}`}>
                  {ourTeamName} {score.ucc} - {score.opp} {opponentName}
                </span>
                <span>•</span>
                <span
                  className={`font-bold ${
                    momentumAnalysis.scoreDiff > 0
                      ? isBrightMode ? "text-emerald-700 font-black" : "text-emerald-400"
                      : momentumAnalysis.scoreDiff < 0
                      ? isBrightMode ? "text-rose-700 font-black" : "text-rose-400"
                      : isBrightMode ? "text-slate-600 font-bold" : "text-slate-400"
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

          {/* Quick Timer Controls, Theme Toggle & Timeout Selection */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Bright / Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsBrightMode(!isBrightMode)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 border ${
                isBrightMode
                  ? "bg-amber-400 text-slate-950 border-amber-500 font-black shadow-sm"
                  : "bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700"
              }`}
              title={isBrightMode ? "Switch to Dark Mode" : "Switch to Bright Mode"}
            >
              {isBrightMode ? <Sun size={13} className="text-slate-950" /> : <Moon size={13} />}
              <span>{isBrightMode ? "Bright Mode" : "Dark Mode"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${isBrightMode ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300" : "bg-white/10 hover:bg-white/20 text-white border-transparent"}`}
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
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${isBrightMode ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300" : "bg-white/10 hover:bg-white/20 text-white border-transparent"}`}
            >
              <RotateCcw size={13} />
              <span>60s</span>
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded-xl text-xs transition-colors cursor-pointer border ${isBrightMode ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300" : "bg-white/10 hover:bg-white/20 text-white border-transparent"}`}
              title={soundEnabled ? "Mute Buzzer" : "Enable Buzzer"}
            >
              {soundEnabled ? (
                <Volume2 size={14} className={isBrightMode ? "text-amber-700" : "text-amber-300"} />
              ) : (
                <VolumeX size={14} className={isBrightMode ? "text-slate-400" : "text-slate-500"} />
              )}
            </button>

            <button
              type="button"
              onClick={handleRequestClose}
              className={`p-2 rounded-xl transition-colors cursor-pointer ml-1 ${isBrightMode ? "text-slate-500 hover:text-slate-900 hover:bg-slate-200" : "text-slate-400 hover:text-white hover:bg-white/10"}`}
              title="Close and Return to Court"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className={`w-full h-1.5 overflow-hidden ${isBrightMode ? "bg-slate-200" : "bg-slate-800"}`}>
          <div
            className={`h-full transition-all duration-1000 ${
              secondsRemaining <= 15 ? "bg-rose-500" : "bg-amber-400"
            }`}
            style={{ width: `${Math.max(0, Math.min(100, (secondsRemaining / 60) * 100))}%` }}
          />
        </div>

        {/* SCOPE SELECTOR (SET X vs FULL MATCH) */}
        <div className={`px-4 sm:px-6 py-2.5 border-b flex items-center justify-between gap-3 shrink-0 transition-colors ${isBrightMode ? "bg-slate-100/95 border-slate-200 text-slate-800" : "bg-slate-900/90 border-slate-800 text-slate-400"}`}>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-black uppercase tracking-wider ${isBrightMode ? "text-slate-600" : "text-slate-400"}`}>
              Data Scope:
            </span>
            <div className={`flex p-1 rounded-xl border text-xs font-bold ${isBrightMode ? "bg-white border-slate-200 shadow-xs" : "bg-slate-950 border-slate-800"}`}>
              <button
                type="button"
                onClick={() => setViewScope("set")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewScope === "set"
                    ? isBrightMode
                      ? "bg-blue-600 text-white shadow-xs font-black"
                      : "bg-indigo-600 text-white shadow-xs font-black"
                    : isBrightMode
                    ? "text-slate-600 hover:text-slate-900"
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
                    ? isBrightMode
                      ? "bg-blue-600 text-white shadow-xs font-black"
                      : "bg-indigo-600 text-white shadow-xs font-black"
                    : isBrightMode
                    ? "text-slate-600 hover:text-slate-900"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers size={13} />
                <span>Entire Match</span>
              </button>
            </div>
          </div>

          <div className={`flex items-center gap-3 text-xs ${isBrightMode ? "text-slate-700" : "text-slate-400"}`}>
            <div>
              <span className={`font-bold ${isBrightMode ? "text-slate-900" : "text-slate-300"}`}>Timeouts:</span>{" "}
              <span className={`font-black ${isBrightMode ? "text-amber-700" : "text-amber-400"}`}>
                {ourTeamName} {teamStats.uccTimeouts}/2
              </span>{" "}
              •{" "}
              <span className={isBrightMode ? "text-slate-600 font-bold" : "text-slate-400"}>
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
                className={`hidden sm:flex px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider items-center gap-1 transition-colors cursor-pointer border ${isBrightMode ? "bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-xs" : "bg-white/10 hover:bg-white/20 text-white border-transparent"}`}
              >
                <ArrowRightLeft size={12} />
                <span>Lineup Subs</span>
              </button>
            )}
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* ========================================================= */}
          {/* LAST 10 POINTS: TWO BIGGEST TREND SHIFTS (1 POS, 1 NEG)  */}
          {/* ========================================================= */}
          <div className={`rounded-2xl p-4 sm:p-5 shadow-xl transition-colors ${
            isBrightMode
              ? "bg-white border-2 border-slate-200 text-slate-950 shadow-md"
              : "bg-slate-950/70 border border-slate-700/80 text-white backdrop-blur-xs"
          }`}>
            {/* Header banner */}
            <div className={`flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b ${
              isBrightMode ? "border-slate-200" : "border-slate-800"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                  isBrightMode
                    ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                    : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                }`}>
                  <Activity size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${
                      isBrightMode ? "text-slate-950" : "text-white"
                    }`}>
                      Last 10 Points Trend Shifts
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border font-mono ${
                      isBrightMode
                        ? "bg-amber-100 text-amber-900 border-amber-300 font-black"
                        : "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                    }`}>
                      {tenPointTrends.hasSubstantialData
                        ? `Last ${tenPointTrends.windowSize} Pts (${tenPointTrends.recentUccPoints}-${tenPointTrends.recentOppPoints})`
                        : `Early Set (${tenPointTrends.totalPointsPlayed}/10 Pts)`}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-0.5 font-medium ${
                    isBrightMode ? "text-slate-600" : "text-slate-400"
                  }`}>
                    The two biggest performance shifts impacting the match right now (1 Positive • 1 Negative)
                  </p>
                </div>
              </div>

              {tenPointTrends.allCandidates.length > 2 && (
                <button
                  type="button"
                  onClick={() => setShowAllTrends(!showAllTrends)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                    isBrightMode
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                      : "bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border-slate-700"
                  }`}
                >
                  <span>{showAllTrends ? "Hide Extra Shifts" : `All Detected Shifts (${tenPointTrends.allCandidates.length})`}</span>
                  {showAllTrends ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
            </div>

            {/* TWO CORE TREND CARDS (1 POSITIVE, 1 NEGATIVE) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              {/* 1. TOP POSITIVE SHIFT */}
              <div className={`rounded-2xl p-4 sm:p-4.5 flex flex-col justify-between shadow-md relative overflow-hidden group transition-all ${
                isBrightMode
                  ? "bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 border-2 border-emerald-400 shadow-emerald-900/5 text-slate-950"
                  : "bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900/95 border border-emerald-500/40 text-white"
              }`}>
                <div className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-2xl pointer-events-none ${
                  isBrightMode ? "bg-emerald-400/10" : "bg-emerald-500/5"
                }`} />

                <div>
                  {/* Card Pill & Impact Score */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs ${
                      isBrightMode
                        ? "bg-emerald-600 text-white border border-emerald-700"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    }`}>
                      <TrendingUp size={12} />
                      <span>Top Positive Shift</span>
                    </span>

                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                      isBrightMode
                        ? "text-emerald-900 bg-emerald-100 border-emerald-300 font-black"
                        : "text-emerald-400 bg-emerald-950/80 border-emerald-700/50"
                    }`}>
                      <Sparkles size={11} className={isBrightMode ? "text-amber-600" : "text-amber-300"} />
                      <span>Impact +{tenPointTrends.topPositive.impactScore}</span>
                    </span>
                  </div>

                  {/* Target & Title */}
                  <div className="flex items-center gap-2.5 my-1.5">
                    {tenPointTrends.topPositive.targetNumber ? (
                      <span className="h-8 w-8 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-xs font-mono shadow-xs shrink-0">
                        #{tenPointTrends.topPositive.targetNumber}
                      </span>
                    ) : (
                      <span className={`h-8 w-8 rounded-xl font-black flex items-center justify-center text-xs shadow-xs shrink-0 ${
                        isBrightMode ? "bg-emerald-200 text-emerald-900" : "bg-emerald-700/70 text-emerald-200"
                      }`}>
                        <Users size={14} />
                      </span>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={`text-sm sm:text-base font-black truncate ${
                          isBrightMode ? "text-slate-950" : "text-white"
                        }`}>
                          {tenPointTrends.topPositive.targetName}
                        </h4>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-md border shrink-0 ${
                          isBrightMode
                            ? "text-emerald-900 bg-emerald-100 border-emerald-300"
                            : "text-emerald-300 bg-emerald-900/40 border-emerald-600/30"
                        }`}>
                          {tenPointTrends.topPositive.title}
                        </span>
                      </div>
                      {tenPointTrends.topPositive.targetRole && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          isBrightMode ? "text-slate-600" : "text-slate-400"
                        }`}>
                          {tenPointTrends.topPositive.targetRole}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3-Column Metric Box */}
                  <div className={`grid grid-cols-3 gap-2 my-2.5 p-2 rounded-xl border text-center font-mono ${
                    isBrightMode
                      ? "bg-emerald-50/80 border-emerald-200"
                      : "bg-slate-950/70 border-emerald-900/40"
                  }`}>
                    <div className={`rounded-lg p-1.5 border ${
                      isBrightMode
                        ? "bg-white border-slate-200 shadow-2xs"
                        : "bg-slate-900/60 border-slate-800"
                    }`}>
                      <span className={`block text-[9px] uppercase tracking-wider font-sans font-bold ${
                        isBrightMode ? "text-slate-500" : "text-slate-400"
                      }`}>
                        Last 10 Pts
                      </span>
                      <span className={`font-black text-xs sm:text-sm ${
                        isBrightMode ? "text-slate-950" : "text-white"
                      }`}>
                        {tenPointTrends.topPositive.recentDisplay}
                      </span>
                    </div>
                    <div className={`rounded-lg p-1.5 border ${
                      isBrightMode
                        ? "bg-white border-slate-200 shadow-2xs"
                        : "bg-slate-900/60 border-slate-800"
                    }`}>
                      <span className={`block text-[9px] uppercase tracking-wider font-sans font-bold ${
                        isBrightMode ? "text-slate-500" : "text-slate-400"
                      }`}>
                        Prior Baseline
                      </span>
                      <span className={`font-bold text-xs sm:text-sm ${
                        isBrightMode ? "text-slate-700" : "text-slate-300"
                      }`}>
                        {tenPointTrends.topPositive.priorDisplay}
                      </span>
                    </div>
                    <div className={`rounded-lg p-1.5 border ${
                      isBrightMode
                        ? "bg-emerald-100 border-emerald-300 shadow-2xs"
                        : "bg-emerald-950/60 border-emerald-700/40"
                    }`}>
                      <span className={`block text-[9px] uppercase tracking-wider font-sans font-black ${
                        isBrightMode ? "text-emerald-800" : "text-emerald-400"
                      }`}>
                        Net Shift
                      </span>
                      <span className={`font-black text-xs sm:text-sm ${
                        isBrightMode ? "text-emerald-900" : "text-emerald-300"
                      }`}>
                        {tenPointTrends.topPositive.deltaDisplay}
                      </span>
                    </div>
                  </div>

                  {/* Plain Language Summary */}
                  <p className={`text-xs font-medium leading-relaxed ${
                    isBrightMode ? "text-slate-800" : "text-slate-200"
                  }`}>
                    {tenPointTrends.topPositive.summary}
                  </p>
                </div>
              </div>

              {/* 2. TOP NEGATIVE SHIFT */}
              <div className={`rounded-2xl p-4 sm:p-4.5 flex flex-col justify-between shadow-md relative overflow-hidden group transition-all ${
                isBrightMode
                  ? "bg-gradient-to-br from-rose-50 via-white to-rose-50/40 border-2 border-rose-400 shadow-rose-900/5 text-slate-950"
                  : "bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900/95 border border-rose-500/40 text-white"
              }`}>
                <div className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-2xl pointer-events-none ${
                  isBrightMode ? "bg-rose-400/10" : "bg-rose-500/5"
                }`} />

                <div>
                  {/* Card Pill & Impact Score */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs ${
                      isBrightMode
                        ? "bg-rose-600 text-white border border-rose-700"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    }`}>
                      <AlertTriangle size={12} />
                      <span>Top Negative Shift</span>
                    </span>

                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                      isBrightMode
                        ? "text-rose-900 bg-rose-100 border-rose-300 font-black"
                        : "text-rose-400 bg-rose-950/80 border-rose-700/50"
                    }`}>
                      <TrendingDown size={11} className={isBrightMode ? "text-rose-700" : "text-rose-400"} />
                      <span>Impact -{tenPointTrends.topNegative.impactScore}</span>
                    </span>
                  </div>

                  {/* Target & Title */}
                  <div className="flex items-center gap-2.5 my-1.5">
                    {tenPointTrends.topNegative.targetNumber ? (
                      <span className="h-8 w-8 rounded-xl bg-rose-600 text-white font-black flex items-center justify-center text-xs font-mono shadow-xs shrink-0">
                        #{tenPointTrends.topNegative.targetNumber}
                      </span>
                    ) : (
                      <span className={`h-8 w-8 rounded-xl font-black flex items-center justify-center text-xs shadow-xs shrink-0 ${
                        isBrightMode ? "bg-rose-200 text-rose-900" : "bg-rose-700/70 text-rose-200"
                      }`}>
                        <Users size={14} />
                      </span>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={`text-sm sm:text-base font-black truncate ${
                          isBrightMode ? "text-slate-950" : "text-white"
                        }`}>
                          {tenPointTrends.topNegative.targetName}
                        </h4>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-md border shrink-0 ${
                          isBrightMode
                            ? "text-rose-900 bg-rose-100 border-rose-300"
                            : "text-rose-300 bg-rose-900/40 border-rose-600/30"
                        }`}>
                          {tenPointTrends.topNegative.title}
                        </span>
                      </div>
                      {tenPointTrends.topNegative.targetRole && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          isBrightMode ? "text-slate-600" : "text-slate-400"
                        }`}>
                          {tenPointTrends.topNegative.targetRole}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3-Column Metric Box */}
                  <div className={`grid grid-cols-3 gap-2 my-2.5 p-2 rounded-xl border text-center font-mono ${
                    isBrightMode
                      ? "bg-rose-50/80 border-rose-200"
                      : "bg-slate-950/70 border-rose-900/40"
                  }`}>
                    <div className={`rounded-lg p-1.5 border ${
                      isBrightMode
                        ? "bg-white border-slate-200 shadow-2xs"
                        : "bg-slate-900/60 border-slate-800"
                    }`}>
                      <span className={`block text-[9px] uppercase tracking-wider font-sans font-bold ${
                        isBrightMode ? "text-slate-500" : "text-slate-400"
                      }`}>
                        Last 10 Pts
                      </span>
                      <span className={`font-black text-xs sm:text-sm ${
                        isBrightMode ? "text-slate-950" : "text-white"
                      }`}>
                        {tenPointTrends.topNegative.recentDisplay}
                      </span>
                    </div>
                    <div className={`rounded-lg p-1.5 border ${
                      isBrightMode
                        ? "bg-white border-slate-200 shadow-2xs"
                        : "bg-slate-900/60 border-slate-800"
                    }`}>
                      <span className={`block text-[9px] uppercase tracking-wider font-sans font-bold ${
                        isBrightMode ? "text-slate-500" : "text-slate-400"
                      }`}>
                        Prior Baseline
                      </span>
                      <span className={`font-bold text-xs sm:text-sm ${
                        isBrightMode ? "text-slate-700" : "text-slate-300"
                      }`}>
                        {tenPointTrends.topNegative.priorDisplay}
                      </span>
                    </div>
                    <div className={`rounded-lg p-1.5 border ${
                      isBrightMode
                        ? "bg-rose-100 border-rose-300 shadow-2xs"
                        : "bg-rose-950/60 border-rose-700/40"
                    }`}>
                      <span className={`block text-[9px] uppercase tracking-wider font-sans font-black ${
                        isBrightMode ? "text-rose-800" : "text-rose-400"
                      }`}>
                        Net Shift
                      </span>
                      <span className={`font-black text-xs sm:text-sm ${
                        isBrightMode ? "text-rose-900" : "text-rose-300"
                      }`}>
                        {tenPointTrends.topNegative.deltaDisplay}
                      </span>
                    </div>
                  </div>

                  {/* Plain Language Summary */}
                  <p className={`text-xs font-medium leading-relaxed ${
                    isBrightMode ? "text-slate-800" : "text-slate-200"
                  }`}>
                    {tenPointTrends.topNegative.summary}
                  </p>
                </div>
              </div>
            </div>

            {/* EXPANDABLE: ALL DETECTED TREND SHIFTS */}
            {showAllTrends && tenPointTrends.allCandidates.length > 2 && (
              <div className={`mt-4 pt-3.5 border-t space-y-2 animate-in fade-in duration-150 ${
                isBrightMode ? "border-slate-200" : "border-slate-800"
              }`}>
                <div className={`flex items-center justify-between text-xs font-bold mb-2 ${
                  isBrightMode ? "text-slate-700" : "text-slate-300"
                }`}>
                  <span className={`uppercase tracking-wider text-[10px] ${
                    isBrightMode ? "text-slate-500 font-black" : "text-slate-400"
                  }`}>
                    All Evaluated Trend Parameters ({tenPointTrends.allCandidates.length})
                  </span>
                  <span className={`text-[10px] ${isBrightMode ? "text-slate-500 font-semibold" : "text-slate-500"}`}>
                    Sorted by Impact Magnitude
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {tenPointTrends.allCandidates.slice(2).map((item) => {
                    const isPos = item.direction === "positive";
                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between text-xs shadow-xs ${
                          isBrightMode
                            ? isPos
                              ? "bg-emerald-50/60 border-emerald-200 text-slate-900"
                              : "bg-rose-50/60 border-rose-200 text-slate-900"
                            : isPos
                            ? "bg-slate-900/80 border-emerald-900/40 text-emerald-300"
                            : "bg-slate-900/80 border-rose-900/40 text-rose-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {isPos ? (
                              <TrendingUp size={12} className={isBrightMode ? "text-emerald-700 shrink-0" : "text-emerald-400 shrink-0"} />
                            ) : (
                              <TrendingDown size={12} className={isBrightMode ? "text-rose-700 shrink-0" : "text-rose-400 shrink-0"} />
                            )}
                            <span className={`font-black truncate max-w-[140px] ${
                              isBrightMode ? "text-slate-950" : "text-white"
                            }`}>
                              {item.targetName}
                            </span>
                            <span className={`text-[10px] font-bold ${
                              isBrightMode ? "text-slate-600" : "text-slate-400"
                            }`}>
                              • {item.title}
                            </span>
                          </div>
                          <span
                            className={`font-mono font-black text-[10px] px-1.5 py-0.2 rounded border ${
                              isBrightMode
                                ? isPos
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                  : "bg-rose-100 text-rose-900 border-rose-300"
                                : isPos
                                ? "bg-emerald-950 text-emerald-300 border-emerald-700/40"
                                : "bg-rose-950 text-rose-300 border-rose-700/40"
                            }`}
                          >
                            {item.deltaDisplay}
                          </span>
                        </div>
                        <p className={`text-[11px] mt-1 line-clamp-2 ${
                          isBrightMode ? "text-slate-700 font-medium" : "text-slate-300"
                        }`}>
                          {item.summary}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4 CORE HERO TILES */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. SERVE +/- & ACES */}
            <div className={`p-4 rounded-2xl flex flex-col justify-between shadow-md relative overflow-hidden group transition-colors ${
              isBrightMode
                ? "bg-white border-2 border-slate-200 text-slate-950 shadow-sm"
                : "bg-slate-800/90 border border-slate-700/80 text-white"
            }`}>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className={`uppercase tracking-wider text-[11px] ${
                  isBrightMode ? "text-slate-500 font-bold" : "text-slate-400"
                }`}>
                  Serving
                </span>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${
                  isBrightMode
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-amber-400/20 text-amber-300 border-amber-400/30"
                }`}>
                  <Target size={12} />
                  <span>Serve +/-</span>
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-2.5">
                  <span
                    className={`text-3xl font-black font-mono tracking-tight ${
                      computedMetrics.servePlusMinus > 0
                        ? isBrightMode ? "text-emerald-700" : "text-emerald-400"
                        : computedMetrics.servePlusMinus < 0
                        ? isBrightMode ? "text-rose-700" : "text-rose-400"
                        : isBrightMode ? "text-slate-800" : "text-slate-200"
                    }`}
                  >
                    {computedMetrics.servePlusMinus > 0
                      ? `+${computedMetrics.servePlusMinus}`
                      : computedMetrics.servePlusMinus}
                  </span>
                  <span className={`text-sm font-black ${
                    isBrightMode ? "text-amber-800" : "text-amber-300"
                  }`}>
                    {computedMetrics.aces} {computedMetrics.aces === 1 ? "Ace" : "Aces"}
                  </span>
                </div>

                <div className={`text-[11px] mt-2 space-y-0.5 ${
                  isBrightMode ? "text-slate-700" : "text-slate-300"
                }`}>
                  <div className="flex justify-between font-medium">
                    <span>Serve Errors:</span>
                    <span className={`font-bold ${
                      isBrightMode ? "text-rose-700 font-black" : "text-rose-300"
                    }`}>
                      {computedMetrics.serveErrors} errs
                    </span>
                  </div>
                  <div className={`flex justify-between font-medium text-[10px] ${
                    isBrightMode ? "text-slate-500" : "text-slate-400"
                  }`}>
                    <span>Total Serves:</span>
                    <span>
                      {computedMetrics.totalServes} ({computedMetrics.acePct.toFixed(0)}% ace rate)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. TEAM PASSING GRADE, INDEX & RECEPTIONS */}
            <div className={`p-4 rounded-2xl flex flex-col justify-between shadow-md transition-colors ${
              isBrightMode
                ? "bg-white border-2 border-slate-200 text-slate-950 shadow-sm"
                : "bg-slate-800/90 border border-slate-700/80 text-white"
            }`}>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className={`uppercase tracking-wider text-[11px] ${
                  isBrightMode ? "text-slate-500 font-bold" : "text-slate-400"
                }`}>
                  Passing
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                      isBrightMode
                        ? "bg-purple-100 text-purple-900 border-purple-300"
                        : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                    }`}
                    title="Passing Index (0-100)"
                  >
                    Index: {computedMetrics.teamPassingIndex}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    isBrightMode
                      ? "text-slate-600 bg-slate-100 border-slate-300"
                      : "text-slate-400 bg-slate-900/60 border-slate-700"
                  }`}>
                    0-3 Scale
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-3xl font-black font-mono tracking-tight ${
                    isBrightMode ? "text-slate-950" : "text-white"
                  }`}>
                    {computedMetrics.passAvg.toFixed(2)}
                  </span>
                  <span className={`text-xs font-bold ${
                    isBrightMode ? "text-slate-500" : "text-slate-400"
                  }`}>
                    / 3.00
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                      isBrightMode
                        ? "text-indigo-900 bg-indigo-100 border-indigo-300 font-black"
                        : "text-indigo-300 bg-indigo-900/40 border-indigo-700/50"
                    }`}>
                      {computedMetrics.inSystemPassPct.toFixed(0)}% In-Sys
                    </span>
                    {computedMetrics.teamAcedCount > 0 && (
                      <span className={`text-xs font-black px-2 py-0.5 rounded border ${
                        isBrightMode
                          ? "text-rose-900 bg-rose-100 border-rose-300"
                          : "text-rose-300 bg-rose-950/60 border-rose-600/40"
                      }`}>
                        {computedMetrics.teamAcedCount} Aced
                      </span>
                    )}
                  </div>
                </div>

                <div className={`text-[11px] mt-2 space-y-1 ${
                  isBrightMode ? "text-slate-700" : "text-slate-300"
                }`}>
                  <div className={`flex justify-between text-[10px] font-bold uppercase tracking-wider ${
                    isBrightMode ? "text-slate-600" : "text-slate-400"
                  }`}>
                    <span>{computedMetrics.passCount} Receptions</span>
                    <span>Aced: {computedMetrics.teamAcedCount}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-bold">
                    <div className={`border rounded p-1 ${
                      isBrightMode
                        ? "bg-emerald-100 border-emerald-300 text-emerald-950 font-black"
                        : "bg-emerald-950/60 border-emerald-600/40 text-emerald-300"
                    }`}>
                      <div>3s: {computedMetrics.count3}</div>
                      <div className={`text-[8px] font-semibold ${
                        isBrightMode ? "text-emerald-800" : "text-emerald-400"
                      }`}>
                        In-System
                      </div>
                    </div>
                    <div className={`border rounded p-1 ${
                      isBrightMode
                        ? "bg-teal-100 border-teal-300 text-teal-950 font-black"
                        : "bg-teal-950/60 border-teal-600/40 text-teal-300"
                    }`}>
                      <div>2s: {computedMetrics.count2}</div>
                      <div className={`text-[8px] font-semibold ${
                        isBrightMode ? "text-teal-800" : "text-teal-400"
                      }`}>
                        In-System
                      </div>
                    </div>
                    <div className={`border rounded p-1 ${
                      isBrightMode
                        ? "bg-amber-100 border-amber-300 text-amber-950 font-black"
                        : "bg-amber-950/60 border-amber-600/40 text-amber-300"
                    }`}>
                      <div>1s: {computedMetrics.count1}</div>
                      <div className={`text-[8px] font-semibold ${
                        isBrightMode ? "text-amber-800" : "text-amber-400"
                      }`}>
                        Out-of-Sys
                      </div>
                    </div>
                    <div className={`border rounded p-1 ${
                      isBrightMode
                        ? "bg-slate-100 border-slate-300 text-slate-800 font-bold"
                        : "bg-slate-800/80 border-slate-600/40 text-slate-300"
                    }`}>
                      <div>0s: {computedMetrics.count0}</div>
                      <div className={`text-[8px] font-semibold ${
                        isBrightMode ? "text-slate-600" : "text-slate-400"
                      }`}>
                        Out-of-Sys
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. BEST PASSER & LOWEST PASSER */}
            <div className={`p-4 rounded-2xl flex flex-col justify-between shadow-md transition-colors ${
              isBrightMode
                ? "bg-white border-2 border-slate-200 text-slate-950 shadow-sm"
                : "bg-slate-800/90 border border-slate-700/80 text-white"
            }`}>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className={`uppercase tracking-wider text-[11px] ${
                  isBrightMode ? "text-slate-500 font-bold" : "text-slate-400"
                }`}>
                  Passers
                </span>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${
                  isBrightMode
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                }`}>
                  <Award size={12} />
                  <span>Passing Index</span>
                </div>
              </div>

              <div className="space-y-2">
                {/* Best Passer */}
                <div className={`rounded-xl p-2 border ${
                  isBrightMode
                    ? "bg-emerald-50/80 border-emerald-300 shadow-2xs"
                    : "bg-slate-900/80 border-emerald-500/40"
                }`}>
                  <div className={`flex items-center justify-between text-[10px] font-black uppercase mb-0.5 ${
                    isBrightMode ? "text-emerald-800" : "text-emerald-400"
                  }`}>
                    <span className="flex items-center gap-1">
                      <ThumbsUp size={11} />
                      <span>Best Passer</span>
                    </span>
                    {computedMetrics.bestPasser && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-black border ${
                        isBrightMode
                          ? "text-emerald-900 bg-emerald-200 border-emerald-300"
                          : "text-emerald-300 bg-emerald-950/80 border-emerald-700/50"
                      }`}>
                        Index: {computedMetrics.bestPasser.passingIndex}
                      </span>
                    )}
                  </div>
                  {computedMetrics.bestPasser ? (
                    <div className="flex items-baseline justify-between text-xs">
                      <span className={`font-black truncate max-w-[120px] ${
                        isBrightMode ? "text-slate-950" : "text-white"
                      }`}>
                        #{computedMetrics.bestPasser.number} {computedMetrics.bestPasser.name}
                      </span>
                      <span className={`font-bold ${isBrightMode ? "text-slate-800" : "text-slate-200"}`}>
                        <strong className={`font-mono text-sm ${
                          isBrightMode ? "text-emerald-800 font-black" : "text-emerald-300"
                        }`}>
                          {computedMetrics.bestPasser.average.toFixed(2)}
                        </strong>{" "}
                        <span className={`text-[10px] ${isBrightMode ? "text-slate-500 font-semibold" : "text-slate-400"}`}>
                          ({computedMetrics.bestPasser.attempts} passes)
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className={`text-[10px] italic ${isBrightMode ? "text-slate-500" : "text-slate-400"}`}>
                      No pass attempts yet
                    </div>
                  )}
                </div>

                {/* Lowest Passer */}
                <div className={`rounded-xl p-2 border ${
                  isBrightMode
                    ? "bg-rose-50/80 border-rose-300 shadow-2xs"
                    : "bg-slate-900/80 border-rose-500/40"
                }`}>
                  <div className={`flex items-center justify-between text-[10px] font-black uppercase mb-0.5 ${
                    isBrightMode ? "text-rose-800" : "text-rose-400"
                  }`}>
                    <span className="flex items-center gap-1">
                      <ThumbsDown size={11} />
                      <span>Lowest Passer</span>
                    </span>
                    {computedMetrics.worstPasser && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-black border ${
                        isBrightMode
                          ? "text-rose-900 bg-rose-200 border-rose-300"
                          : "text-rose-300 bg-rose-950/80 border-rose-700/50"
                      }`}>
                        Index: {computedMetrics.worstPasser.passingIndex}
                      </span>
                    )}
                  </div>
                  {computedMetrics.worstPasser &&
                  (computedMetrics.rankedPassers.length > 1 ||
                    computedMetrics.worstPasser.average < 2.0) ? (
                    <div className="flex items-baseline justify-between text-xs">
                      <span className={`font-black truncate max-w-[120px] ${
                        isBrightMode ? "text-slate-950" : "text-white"
                      }`}>
                        #{computedMetrics.worstPasser.number} {computedMetrics.worstPasser.name}
                      </span>
                      <span className={`font-bold ${isBrightMode ? "text-slate-800" : "text-slate-200"}`}>
                        <strong className={`font-mono text-sm ${
                          isBrightMode ? "text-rose-800 font-black" : "text-rose-300"
                        }`}>
                          {computedMetrics.worstPasser.average.toFixed(2)}
                        </strong>{" "}
                        <span className={`text-[10px] ${isBrightMode ? "text-slate-500 font-semibold" : "text-slate-400"}`}>
                          ({computedMetrics.worstPasser.attempts} passes
                          {computedMetrics.worstPasser.countAced > 0
                            ? `, ${computedMetrics.worstPasser.countAced} aced`
                            : ""}
                          )
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className={`text-[10px] italic ${isBrightMode ? "text-slate-500" : "text-slate-400"}`}>
                      {computedMetrics.rankedPassers.length === 1
                        ? "Only 1 passer active so far"
                        : "No pass errors"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. KILL % & KILL EFFICIENCY */}
            <div className={`p-4 rounded-2xl flex flex-col justify-between shadow-md transition-colors ${
              isBrightMode
                ? "bg-white border-2 border-slate-200 text-slate-950 shadow-sm"
                : "bg-slate-800/90 border border-slate-700/80 text-white"
            }`}>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className={`uppercase tracking-wider text-[11px] ${
                  isBrightMode ? "text-slate-500 font-bold" : "text-slate-400"
                }`}>
                  Attacking
                </span>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${
                  isBrightMode
                    ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                }`}>
                  <Flame size={12} />
                  <span>Kill % & Eff</span>
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-black font-mono tracking-tight ${
                    isBrightMode ? "text-slate-950" : "text-white"
                  }`}>
                    {computedMetrics.killPct.toFixed(1)}%
                  </span>
                  <span
                    className={`text-sm font-black font-mono px-2 py-0.5 rounded ${
                      computedMetrics.hittingEff >= 0.3
                        ? isBrightMode ? "bg-emerald-100 text-emerald-950 border border-emerald-300" : "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                        : computedMetrics.hittingEff >= 0.15
                        ? isBrightMode ? "bg-blue-100 text-blue-950 border border-blue-300" : "bg-blue-950/80 text-blue-300 border border-blue-500/40"
                        : computedMetrics.hittingEff >= 0
                        ? isBrightMode ? "bg-slate-100 text-slate-800" : "bg-slate-700 text-slate-300"
                        : isBrightMode ? "bg-rose-100 text-rose-950 border border-rose-300" : "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                    }`}
                  >
                    eff {formatEff(computedMetrics.hittingEff)}
                  </span>
                </div>

                <div className={`text-[11px] mt-2 space-y-0.5 ${
                  isBrightMode ? "text-slate-700" : "text-slate-300"
                }`}>
                  <div className={`flex justify-between font-bold ${
                    isBrightMode ? "text-slate-950 font-black" : "text-white"
                  }`}>
                    <span>{computedMetrics.kills} Kills</span>
                    <span className={`font-normal ${
                      isBrightMode ? "text-slate-600" : "text-slate-400"
                    }`}>
                      from {computedMetrics.totalAttacks} total swings
                    </span>
                  </div>
                  <div className={`flex justify-between text-[10px] ${
                    isBrightMode ? "text-slate-600" : "text-slate-400"
                  }`}>
                    <span>
                      Unforced Errs:{" "}
                      <strong className={`font-black ${
                        isBrightMode ? "text-rose-700" : "text-rose-400"
                      }`}>
                        {computedMetrics.unforcedAttackErrors}
                      </strong>{" "}
                      (out/net)
                    </span>
                    <span>
                      Blocked:{" "}
                      <strong className={`font-black ${
                        isBrightMode ? "text-amber-800" : "text-amber-400"
                      }`}>
                        {computedMetrics.blockedAttacks}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DETAILED LEADERBOARD & COURT STATUS SECTION */}
          <div className={`rounded-2xl overflow-hidden transition-colors ${
            isBrightMode
              ? "bg-white border-2 border-slate-200/90 shadow-sm"
              : "bg-slate-800/50 border border-slate-700/80"
          }`}>
            {/* TABS */}
            <div className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 transition-colors ${
              isBrightMode
                ? "bg-slate-100/90 border-slate-200"
                : "bg-slate-900 border-slate-700"
            }`}>
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDetailTab("passers")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeDetailTab === "passers"
                      ? "bg-purple-600 text-white shadow-xs"
                      : isBrightMode
                      ? "text-slate-600 hover:text-slate-950 hover:bg-slate-200/70"
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
                      : isBrightMode
                      ? "text-slate-600 hover:text-slate-950 hover:bg-slate-200/70"
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
                      : isBrightMode
                      ? "text-slate-600 hover:text-slate-950 hover:bg-slate-200/70"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Users size={13} />
                  <span>On Court ({computedMetrics.courtPlayerStats.length})</span>
                </button>
              </div>

              <div className={`text-[10px] font-semibold hidden md:block ${isBrightMode ? "text-slate-500" : "text-slate-400"}`}>
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
                    <div className={`py-8 text-center text-xs italic ${isBrightMode ? "text-slate-500" : "text-slate-400"}`}>
                      No serve receive or passing repetitions recorded yet in this scope.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                            isBrightMode ? "border-slate-200 text-slate-500" : "border-slate-700/80 text-slate-400"
                          }`}>
                            <th className="pb-2">Passer</th>
                            <th className="pb-2 text-center">Attempts</th>
                            <th className="pb-2 text-center">Avg (0-3)</th>
                            <th className="pb-2 text-center" title="Passing Index (0-100) combining volume workload and 0-3 quality">
                              Pass Index
                            </th>
                            <th className="pb-2 text-center">3s / 2s / 1s / 0s</th>
                            <th className={`pb-2 text-center ${isBrightMode ? "text-rose-600" : "text-rose-400"}`}>Aced</th>
                            <th className="pb-2 text-right" title="In-System (3s & 2s) vs Out-of-System (1s & 0s)">In-Sys / Out%</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isBrightMode ? "divide-slate-200" : "divide-slate-700/50"}`}>
                          {computedMetrics.rankedPassers.map((p, idx) => {
                            const isTop = idx === 0;
                            const isBottom =
                              idx === computedMetrics.rankedPassers.length - 1 &&
                              computedMetrics.rankedPassers.length > 1;

                            return (
                              <tr key={p.id} className={isBrightMode ? "hover:bg-slate-50/80" : "hover:bg-slate-800/40"}>
                                <td className="py-2.5 font-bold flex items-center gap-2">
                                  <span className={`h-6 w-6 rounded-full border font-black flex items-center justify-center text-[10px] shrink-0 font-mono ${
                                    isBrightMode
                                      ? "bg-slate-100 border-slate-300 text-indigo-700 font-black"
                                      : "bg-slate-800 border-slate-700 text-indigo-300"
                                  }`}>
                                    #{p.number}
                                  </span>
                                  <div className="flex flex-col">
                                    <span className={`font-black truncate max-w-[130px] ${isBrightMode ? "text-slate-950" : "text-white"}`}>
                                      {p.name}
                                    </span>
                                    {isTop && (
                                      <span className={`text-[9px] font-black uppercase ${isBrightMode ? "text-emerald-700" : "text-emerald-400"}`}>
                                        ★ Best Passer
                                      </span>
                                    )}
                                    {isBottom && p.average < 2.0 && (
                                      <span className={`text-[9px] font-black uppercase ${isBrightMode ? "text-rose-700" : "text-rose-400"}`}>
                                        ⚠ Struggling
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className={`py-2.5 text-center font-mono font-bold ${isBrightMode ? "text-slate-800" : "text-slate-200"}`}>
                                  {p.attempts}
                                </td>
                                <td className="py-2.5 text-center font-mono font-black text-sm">
                                  <span
                                    className={`${
                                      p.average >= 2.3
                                        ? isBrightMode ? "text-emerald-700 font-black" : "text-emerald-400"
                                        : p.average >= 1.8
                                        ? isBrightMode ? "text-blue-700 font-black" : "text-blue-300"
                                        : isBrightMode ? "text-rose-700 font-black" : "text-rose-400"
                                    }`}
                                  >
                                    {p.average.toFixed(2)}
                                  </span>
                                </td>
                                <td className="py-2.5 text-center font-mono font-black text-sm">
                                  <span
                                    className={`px-2 py-0.5 rounded-lg border ${
                                      p.passingIndex >= 85
                                        ? isBrightMode
                                          ? "bg-purple-100 text-purple-950 border-purple-300 font-black"
                                          : "bg-purple-950/80 text-purple-300 border-purple-500/50"
                                        : p.passingIndex >= 70
                                        ? isBrightMode
                                          ? "bg-indigo-100 text-indigo-950 border-indigo-300 font-black"
                                          : "bg-indigo-950/80 text-indigo-300 border-indigo-500/50"
                                        : p.passingIndex >= 55
                                        ? isBrightMode
                                          ? "bg-slate-100 text-slate-800 border-slate-300 font-bold"
                                          : "bg-slate-800 text-slate-300 border-slate-600"
                                        : isBrightMode
                                        ? "bg-rose-100 text-rose-950 border-rose-300 font-black"
                                        : "bg-rose-950/80 text-rose-300 border-rose-500/50"
                                    }`}
                                  >
                                    {p.passingIndex}
                                  </span>
                                </td>
                                <td className={`py-2.5 text-center font-mono text-[11px] ${isBrightMode ? "text-slate-700" : "text-slate-300"}`}>
                                  <span className={`${isBrightMode ? "text-emerald-700 font-black" : "text-emerald-300 font-bold"}`}>{p.count3}</span> /{" "}
                                  <span className={`${isBrightMode ? "text-teal-700 font-black" : "text-teal-300 font-bold"}`}>{p.count2}</span> /{" "}
                                  <span className={`${isBrightMode ? "text-amber-700 font-black" : "text-amber-300 font-bold"}`}>{p.count1}</span> /{" "}
                                  <span className={`${isBrightMode ? "text-slate-500 font-bold" : "text-slate-400 font-bold"}`}>{p.count0}</span>
                                </td>
                                <td className="py-2.5 text-center font-mono font-black text-sm">
                                  <span
                                    className={`${
                                      p.countAced > 0
                                        ? isBrightMode ? "text-rose-700 font-black" : "text-rose-400 font-bold"
                                        : isBrightMode ? "text-slate-400" : "text-slate-500"
                                    }`}
                                  >
                                    {p.countAced}
                                  </span>
                                </td>
                                <td className={`py-2.5 text-right font-mono font-bold ${isBrightMode ? "text-slate-800" : "text-slate-200"}`}>
                                  <span className={isBrightMode ? "text-emerald-700 font-black" : "text-emerald-400"}>{p.inSystemPct.toFixed(0)}%</span>
                                  <span className={`text-[10px] font-normal ml-1 ${isBrightMode ? "text-slate-500" : "text-slate-400"}`}>
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
                    <div className={`py-8 text-center text-xs italic ${isBrightMode ? "text-slate-500" : "text-slate-400"}`}>
                      No attack attempts logged yet in this scope.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                            isBrightMode ? "border-slate-200 text-slate-500" : "border-slate-700/80 text-slate-400"
                          }`}>
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
                        <tbody className={`divide-y ${isBrightMode ? "divide-slate-200" : "divide-slate-700/50"}`}>
                          {computedMetrics.rankedHitters.map((h) => (
                            <tr key={h.id} className={isBrightMode ? "hover:bg-slate-50/80" : "hover:bg-slate-800/40"}>
                              <td className="py-2.5 font-bold flex items-center gap-2">
                                <span className={`h-6 w-6 rounded-full border font-black flex items-center justify-center text-[10px] shrink-0 font-mono ${
                                  isBrightMode
                                    ? "bg-amber-100 border-amber-300 text-amber-900 font-black"
                                    : "bg-slate-800 border-slate-700 text-amber-300"
                                }`}>
                                  #{h.number}
                                </span>
                                <span className={`font-black truncate max-w-[140px] ${isBrightMode ? "text-slate-950" : "text-white"}`}>
                                  {h.name}
                                </span>
                              </td>
                              <td className={`py-2.5 text-center font-mono font-bold ${isBrightMode ? "text-slate-800" : "text-slate-300"}`}>
                                {h.totalAttacks}
                              </td>
                              <td
                                className={`py-2.5 text-center font-mono font-bold ${isBrightMode ? "text-indigo-800" : "text-indigo-300"}`}
                                title={`When in front row: ${h.frontAttacks} of ${h.teamFrontAttacksWhileInFront || h.frontAttacks} sets directed to ${h.name} (${h.frontSetDistPct.toFixed(0)}%)`}
                              >
                                {h.frontSetDistPct.toFixed(0)}%{" "}
                                <span className={`text-[9px] font-normal ${isBrightMode ? "text-slate-500" : "text-slate-400"}`}>
                                  ({h.frontAttacks}/{h.teamFrontAttacksWhileInFront || h.frontAttacks})
                                </span>
                              </td>
                              <td className={`py-2.5 text-center font-mono font-black text-sm ${isBrightMode ? "text-emerald-700" : "text-emerald-400"}`}>
                                {h.kills}
                              </td>
                              <td className={`py-2.5 text-center font-mono font-bold ${isBrightMode ? "text-slate-800" : "text-slate-200"}`}>
                                {h.killPct.toFixed(1)}%
                              </td>
                              <td className={`py-2.5 text-center font-mono font-bold ${isBrightMode ? "text-rose-700" : "text-rose-400"}`}>
                                {h.unforcedErrors}
                              </td>
                              <td className={`py-2.5 text-center font-mono font-bold ${isBrightMode ? "text-amber-800" : "text-amber-400"}`}>
                                {h.blockedAttacks}
                              </td>
                              <td className="py-2.5 text-right font-mono font-black text-sm">
                                <span
                                  className={`px-1.5 py-0.5 rounded ${
                                    h.efficiency >= 0.3
                                      ? isBrightMode
                                        ? "bg-emerald-100 text-emerald-950 border border-emerald-300 font-black"
                                        : "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                                      : h.efficiency >= 0.15
                                      ? isBrightMode
                                        ? "bg-blue-100 text-blue-950 border border-blue-300 font-black"
                                        : "bg-blue-950/80 text-blue-300 border border-blue-500/40"
                                      : h.efficiency >= 0
                                      ? isBrightMode
                                        ? "bg-slate-100 text-slate-800 font-bold"
                                        : "text-slate-300"
                                      : isBrightMode
                                      ? "bg-rose-100 text-rose-950 border border-rose-300 font-black"
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
                    <div className={`py-8 text-center text-xs italic ${isBrightMode ? "text-slate-500" : "text-slate-400"}`}>
                      No court players currently assigned in lineup.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {computedMetrics.courtPlayerStats.map((p) => {
                        if (!p) return null;
                        return (
                          <div
                            key={p.id}
                            className={`rounded-xl p-3 flex flex-col justify-between space-y-2 transition-colors ${
                              isBrightMode
                                ? "bg-slate-50 border-2 border-slate-200/90 shadow-2xs text-slate-900"
                                : "bg-slate-900/90 border border-slate-700/80 text-white shadow-2xs"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`h-7 w-7 rounded-xl font-black flex items-center justify-center text-xs font-mono ${
                                  isBrightMode
                                    ? "bg-indigo-600 text-white"
                                    : "bg-indigo-600 text-white"
                                }`}>
                                  #{p.number}
                                </span>
                                <div className="flex flex-col">
                                  <span className={`font-black text-xs truncate max-w-[110px] ${
                                    isBrightMode ? "text-slate-950" : "text-white"
                                  }`}>
                                    {p.name}
                                  </span>
                                  <span className={`text-[9px] font-bold uppercase ${
                                    isBrightMode ? "text-slate-500" : "text-slate-400"
                                  }`}>
                                    Pos {p.posIndex}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className={`text-xs font-black font-mono ${
                                  isBrightMode ? "text-emerald-700" : "text-emerald-400"
                                }`}>
                                  {p.kills}K ({formatEff(p.efficiency)})
                                </div>
                                <div className={`text-[9px] ${isBrightMode ? "text-slate-500 font-semibold" : "text-slate-400"}`}>
                                  {p.attacks} swings • {p.unforcedErrors} err
                                </div>
                              </div>
                            </div>

                            <div className={`grid grid-cols-4 gap-1 pt-1.5 border-t text-center font-mono text-[10px] ${
                              isBrightMode ? "border-slate-200" : "border-slate-800"
                            }`}>
                              <div className={`rounded p-1 ${isBrightMode ? "bg-white border border-slate-200" : "bg-slate-950/60"}`}>
                                <span className={`block text-[8px] uppercase ${isBrightMode ? "text-slate-500 font-bold" : "text-slate-400"}`}>
                                  Pass Avg
                                </span>
                                <span className={`font-bold ${isBrightMode ? "text-purple-800 font-black" : "text-purple-300"}`}>
                                  {p.passAvg !== null ? p.passAvg.toFixed(2) : "-"}
                                </span>
                              </div>
                              <div className={`rounded p-1 ${isBrightMode ? "bg-white border border-slate-200" : "bg-slate-950/60"}`}>
                                <span className={`block text-[8px] uppercase ${isBrightMode ? "text-slate-500 font-bold" : "text-slate-400"}`}>
                                  Pass Idx
                                </span>
                                <span className={`font-bold ${isBrightMode ? "text-indigo-800 font-black" : "text-indigo-300"}`}>
                                  {p.passIndex !== null ? p.passIndex : "-"}
                                </span>
                              </div>
                              <div className={`rounded p-1 ${isBrightMode ? "bg-white border border-slate-200" : "bg-slate-950/60"}`}>
                                <span className={`block text-[8px] uppercase ${isBrightMode ? "text-slate-500 font-bold" : "text-slate-400"}`}>
                                  Aced
                                </span>
                                <span
                                  className={`font-bold ${
                                    p.acedCount > 0
                                      ? isBrightMode ? "text-rose-700 font-black" : "text-rose-400"
                                      : isBrightMode ? "text-slate-400" : "text-slate-400"
                                  }`}
                                >
                                  {p.acedCount}
                                </span>
                              </div>
                              <div className={`rounded p-1 ${isBrightMode ? "bg-white border border-slate-200" : "bg-slate-950/60"}`}>
                                <span className={`block text-[8px] uppercase ${isBrightMode ? "text-slate-500 font-bold" : "text-slate-400"}`}>
                                  Srv +/-
                                </span>
                                <span
                                  className={`font-bold ${
                                    p.servePlusMinus > 0
                                      ? isBrightMode ? "text-emerald-700 font-black" : "text-emerald-400"
                                      : p.servePlusMinus < 0
                                      ? isBrightMode ? "text-rose-700 font-black" : "text-rose-400"
                                      : isBrightMode ? "text-slate-700 font-bold" : "text-slate-300"
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
        <div className={`px-4 sm:px-6 py-3 border-t flex items-center justify-between gap-3 shrink-0 transition-colors ${
          isBrightMode
            ? "bg-slate-100/90 border-slate-200 text-slate-800"
            : "bg-slate-950 border-slate-800 text-white"
        }`}>
          <div className={`text-[11px] hidden sm:block ${isBrightMode ? "text-slate-600 font-medium" : "text-slate-400"}`}>
            Press <kbd className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${
              isBrightMode
                ? "bg-white text-slate-800 border-slate-300 shadow-2xs"
                : "bg-slate-800 text-slate-300 border-slate-700"
            }`}>Esc</kbd> to close timeout
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
          <div className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl relative transition-colors ${
            isBrightMode
              ? "bg-white border-2 border-slate-300 text-slate-950 shadow-2xl"
              : "bg-slate-900 border border-slate-700 text-white"
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-400/30">
                <Clock size={20} />
              </div>
              <div>
                <h3 className={`text-base font-black uppercase tracking-wider ${isBrightMode ? "text-slate-950" : "text-white"}`}>
                  Record Timeout Event
                </h3>
                <p className={`text-xs ${isBrightMode ? "text-slate-600" : "text-slate-400"}`}>
                  Select who called the timeout or continue without recording one
                </p>
              </div>
            </div>

            <div className="space-y-2.5 my-5">
              {/* Option 1: Lancers Called Timeout */}
              <button
                type="button"
                onClick={() => handleSelectTimeout("ucc")}
                className="w-full p-3.5 bg-blue-600 hover:bg-blue-500 rounded-2xl text-left flex items-center justify-between text-xs font-bold transition-all shadow-md group cursor-pointer border border-blue-400/30 text-white"
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
                className={`w-full p-3.5 rounded-2xl text-left flex items-center justify-between text-xs font-bold transition-all group cursor-pointer border ${
                  isBrightMode
                    ? "bg-slate-100 hover:bg-slate-200/80 border-slate-300 text-slate-900"
                    : "bg-slate-800 hover:bg-slate-750 border-slate-700 text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0"></span>
                  <div>
                    <div className={`font-black text-sm ${isBrightMode ? "text-slate-950" : "text-white"}`}>
                      {opponentName} Called Timeout
                    </div>
                    <div className={`text-[11px] ${isBrightMode ? "text-slate-600 font-semibold" : "text-slate-400"}`}>
                      Record opponent timeout ({teamStats.oppTimeouts + 1}/2 used)
                    </div>
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className={`${isBrightMode ? "text-slate-600" : "text-slate-400"} group-hover:translate-x-1 transition-transform shrink-0`}
                />
              </button>

              {/* Option 3: Just Looking at Stats (No Official TO) */}
              <button
                type="button"
                onClick={() => handleSelectTimeout("none")}
                className={`w-full p-3.5 rounded-2xl text-left flex items-center justify-between text-xs font-bold transition-all border border-dashed cursor-pointer ${
                  isBrightMode
                    ? "bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800"
                    : "bg-slate-800/50 hover:bg-slate-800 border-slate-700 text-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Eye size={18} className="text-emerald-500 shrink-0" />
                  <div>
                    <div className={`font-bold text-sm ${isBrightMode ? "text-slate-950 font-black" : "text-white"}`}>
                      Just Reviewing Stats
                    </div>
                    <div className={`text-[11px] ${isBrightMode ? "text-slate-600" : "text-slate-400"}`}>
                      No timeout called (keeps counts at {teamStats.uccTimeouts}/2 and {teamStats.oppTimeouts}/2)
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className={`${isBrightMode ? "text-slate-500" : "text-slate-500"} shrink-0`} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCloseDialog(false)}
              className={`w-full py-2.5 text-center text-xs font-bold transition-colors cursor-pointer ${
                isBrightMode ? "text-slate-600 hover:text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              Cancel / Keep Reviewing Stats
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
