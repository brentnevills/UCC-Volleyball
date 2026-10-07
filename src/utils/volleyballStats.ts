/**
 * Volleyball Analytics: Comprehensive Passing Index (Quantity + Quality)
 *
 * Combines:
 * 1. Quality Component (Bayesian Stabilized Quality):
 *    Q_adj = (Sum of Scores + m * B) / (N + m)
 *    where m = 4 (prior attempt weight) and B = 2.0 (neutral 2-pass benchmark).
 *    This stabilizes sample sizes so a single 3-pass (1 attempt) does not skew the rating.
 *
 * 2. Quantity Component (Workload Volume Scaling):
 *    V(N) = 1 + 0.08 * ln(1 + N)
 *    Reward high reception volume under serve pressure.
 *
 * 3. Unified Passing Index (0–100 Scale):
 *    Passing Index = round( (Q_adj / 3.0) * 100 * (1 + 0.08 * ln(1 + N)) )
 *    Bounded within [0, 100].
 */

export function calculatePassingIndex(sum: number, attempts: number): number {
  if (!attempts || attempts <= 0) return 0;
  const priorWeight = 4;
  const baselineBenchmark = 2.0;
  const qAdj = (sum + priorWeight * baselineBenchmark) / (attempts + priorWeight);
  const volumeMultiplier = 1 + 0.08 * Math.log(1 + attempts);
  const rawIndex = (qAdj / 3.0) * 100 * volumeMultiplier;
  return Math.round(Math.min(100, Math.max(0, rawIndex)));
}

export function calculateAdjustedPassQuality(sum: number, attempts: number): number {
  if (!attempts || attempts <= 0) return 0;
  const priorWeight = 4;
  const baselineBenchmark = 2.0;
  return (sum + priorWeight * baselineBenchmark) / (attempts + priorWeight);
}

/**
 * Front Row Set Distribution:
 * When in front row, percentage of sets directed to this hitter.
 * Only considers when that specific player is in the front row:
 * (Hitter's Front-Row Swings / Team Front-Row Sets While This Hitter Was In Front Row) * 100
 */
export interface PlayerFrontRowSetDistInfo {
  playerId: string;
  frontSwings: number;
  teamFrontSwingsWhileInFront: number;
  frontRowSetDistPct: number;
}

export const isAttackKill = (met: string): boolean => {
  const m = (met || "").toLowerCase();
  return m.includes("kill");
};

export const isAttackError = (met: string): boolean => {
  const m = (met || "").toLowerCase();
  return (
    m.includes("error") ||
    m.includes("err") ||
    m.includes("out") ||
    m.includes("net") ||
    m.includes("stuff") ||
    m.includes("stuffed") ||
    m.includes("antenna") ||
    m.includes("fault") ||
    m.includes("miss") ||
    m.includes("blocked")
  );
};

export const isFrontRowAttack = (st: any): boolean => {
  const cat = (st.category || "").toLowerCase();
  const met = (st.metric || "").toLowerCase();
  const isSwing =
    cat === "attack" ||
    cat.includes("att") ||
    (cat === "error" && (met.includes("att") || isAttackError(met))) ||
    isAttackKill(met) ||
    [
      "swing",
      "swing front",
      "swing back",
      "kill",
      "out",
      "net",
      "out/net",
      "blocked",
      "stuffed",
    ].includes(met);
  if (!isSwing) return false;
  return st.row === "Front" || met.includes("front") || (!st.row && st.row !== "Back");
};

/**
 * Calculates front-row set distribution for every player in the dataset.
 *
 * For each player P:
 * - frontSwings: Number of front-row attacks taken by player P
 * - teamFrontSwingsWhileInFront: Total front-row attacks taken by the team WHILE player P was in the front row
 * - frontRowSetDistPct: (frontSwings / teamFrontSwingsWhileInFront) * 100
 */
export function calculateFrontRowSetDistribution(
  stats: any[],
  sets?: any[],
  roster?: any[]
): Map<string, PlayerFrontRowSetDistInfo> {
  const resultMap = new Map<string, PlayerFrontRowSetDistInfo>();

  // Initialize roster players if provided
  if (Array.isArray(roster)) {
    roster.forEach((p) => {
      const pId = String(p.id);
      resultMap.set(pId, {
        playerId: pId,
        frontSwings: 0,
        teamFrontSwingsWhileInFront: 0,
        frontRowSetDistPct: 0,
      });
    });
  }

  if (!Array.isArray(stats) || stats.length === 0) {
    return resultMap;
  }

  // Filter our team's stats
  const ourStats = stats.filter((s) => !s.isOpponent);

  // Group stats by setId
  const statsBySet = new Map<string, any[]>();
  ourStats.forEach((st) => {
    const sId = String(st.setId || "unknown");
    if (!statsBySet.has(sId)) {
      statsBySet.set(sId, []);
    }
    statsBySet.get(sId)!.push(st);
  });

  statsBySet.forEach((setStats, sId) => {
    // Sort chronologically
    const sorted = [...setStats].sort((a, b) => {
      const tA = new Date(a.timestamp || 0).getTime();
      const tB = new Date(b.timestamp || 0).getTime();
      return tA - tB;
    });

    const setObj = Array.isArray(sets) ? sets.find((s) => String(s.id) === sId) : null;
    const startingLineup =
      setObj &&
      Array.isArray(setObj.lineup) &&
      setObj.lineup.length === 6 &&
      setObj.lineup.some(Boolean)
        ? [...setObj.lineup]
        : null;
    const pointHistory =
      setObj && Array.isArray(setObj.pointHistory) ? [...setObj.pointHistory] : [];

    let curLineup = startingLineup ? [...startingLineup] : null;
    let curServing = setObj?.serving || "ucc";
    let ptIdx = 0;

    // First pass: collect front-row attacks with active front row info
    interface FrontAttackEvent {
      hitterId: string;
      value: number;
      frontRowPlayers: Set<string>;
      timestamp: number;
    }

    const frontEvents: FrontAttackEvent[] = [];

    sorted.forEach((st) => {
      const stTime = new Date(st.timestamp || 0).getTime();

      // Advance pointHistory to track rotation if available
      if (curLineup && pointHistory.length > 0) {
        while (
          ptIdx < pointHistory.length &&
          new Date(pointHistory[ptIdx].timestamp || 0).getTime() <= stTime
        ) {
          const pt = pointHistory[ptIdx];
          if (pt.team === "ucc" && curServing === "opp") {
            // UCC sideout -> rotates 1 position clockwise
            curLineup = [
              curLineup[1],
              curLineup[2],
              curLineup[3],
              curLineup[4],
              curLineup[5],
              curLineup[0],
            ];
            curServing = "ucc";
          } else if (pt.team === "opp" && curServing === "ucc") {
            curServing = "opp";
          }
          ptIdx++;
        }
      }

      if (isFrontRowAttack(st)) {
        const val = Number(st.value) || 1;
        const hitterId = String(st.playerId || "");
        const frontRow = new Set<string>();

        // 1. Check if stat explicitly recorded frontRowPlayers
        if (Array.isArray(st.frontRowPlayers) && st.frontRowPlayers.length > 0) {
          st.frontRowPlayers.forEach((id: any) => {
            if (id) frontRow.add(String(id));
          });
        }
        // 2. Check if stat explicitly recorded lineup (indices 1, 2, 3)
        else if (Array.isArray(st.lineup) && st.lineup.length === 6) {
          [st.lineup[1], st.lineup[2], st.lineup[3]].filter(Boolean).forEach((id: any) => {
            frontRow.add(String(id));
          });
        }
        // 3. Fallback to active rotated lineup
        else if (curLineup) {
          [curLineup[1], curLineup[2], curLineup[3]].filter(Boolean).forEach((id: any) => {
            frontRow.add(String(id));
          });
        }

        // Always ensure the hitter who took this front-row swing is in the front row
        if (hitterId) {
          frontRow.add(hitterId);
        }

        frontEvents.push({
          hitterId,
          value: val,
          frontRowPlayers: frontRow,
          timestamp: stTime,
        });
      }
    });

    // If startingLineup / explicit frontRow was not available, cluster attacks by time/sequence
    // so hitters in the same rotation window share the front-row sets
    const hasExplicitFrontRows = frontEvents.some((ev) => ev.frontRowPlayers.size >= 2);

    if (!hasExplicitFrontRows && frontEvents.length > 0) {
      // Cluster into rotation spells: attacks within 180 seconds or consecutive attacks
      let currentCluster: FrontAttackEvent[] = [];
      const clusters: FrontAttackEvent[][] = [];

      frontEvents.forEach((ev, idx) => {
        if (idx === 0) {
          currentCluster.push(ev);
        } else {
          const prev = frontEvents[idx - 1];
          const timeDiff = Math.abs(ev.timestamp - prev.timestamp);
          // If within 180s and at most 6 attacks in cluster, treat as same rotation spell
          if (timeDiff <= 180000 && currentCluster.length < 6) {
            currentCluster.push(ev);
          } else {
            clusters.push(currentCluster);
            currentCluster = [ev];
          }
        }
      });
      if (currentCluster.length > 0) {
        clusters.push(currentCluster);
      }

      clusters.forEach((cluster) => {
        // Collect all hitters who took front row swings in this cluster
        const clusterHitters = new Set<string>();
        cluster.forEach((ev) => {
          if (ev.hitterId) clusterHitters.add(ev.hitterId);
        });

        // Assign these hitters to each event's frontRowPlayers in this cluster
        cluster.forEach((ev) => {
          clusterHitters.forEach((hId) => ev.frontRowPlayers.add(hId));
        });
      });
    }

    // Now tally for this set
    frontEvents.forEach((ev) => {
      // For each player in the front row during this set/swing:
      ev.frontRowPlayers.forEach((pId) => {
        if (!resultMap.has(pId)) {
          resultMap.set(pId, {
            playerId: pId,
            frontSwings: 0,
            teamFrontSwingsWhileInFront: 0,
            frontRowSetDistPct: 0,
          });
        }
        const rec = resultMap.get(pId)!;
        rec.teamFrontSwingsWhileInFront += ev.value;
      });

      // Credit the hitter with their front swing
      if (ev.hitterId) {
        if (!resultMap.has(ev.hitterId)) {
          resultMap.set(ev.hitterId, {
            playerId: ev.hitterId,
            frontSwings: 0,
            teamFrontSwingsWhileInFront: 0,
            frontRowSetDistPct: 0,
          });
        }
        const rec = resultMap.get(ev.hitterId)!;
        rec.frontSwings += ev.value;
        // Ensure denominator is never smaller than numerator
        if (rec.teamFrontSwingsWhileInFront < rec.frontSwings) {
          rec.teamFrontSwingsWhileInFront = rec.frontSwings;
        }
      }
    });
  });

  // Calculate final percentages
  resultMap.forEach((rec) => {
    // If teamFrontSwingsWhileInFront is somehow less than frontSwings, clamp it
    if (rec.teamFrontSwingsWhileInFront < rec.frontSwings) {
      rec.teamFrontSwingsWhileInFront = rec.frontSwings;
    }
    rec.frontRowSetDistPct =
      rec.teamFrontSwingsWhileInFront > 0
        ? (rec.frontSwings / rec.teamFrontSwingsWhileInFront) * 100
        : rec.frontSwings > 0
        ? 100
        : 0;
  });

  return resultMap;
}
