import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Table,
  Check,
  Search,
  Filter,
  Layers,
  ChevronRight,
  Download,
  Plus,
  RefreshCw,
  Trash2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Shield,
  FileSpreadsheet,
  X,
} from "lucide-react";

export interface StatSpreadsheetEditorProps {
  roster: Array<{ id: string; name: string; number?: string; isRetired?: boolean }>;
  matches: Array<any>;
  sets: Array<any>;
  stats: Array<any>;
  activeMatch?: any;
  activeSetId?: string | null;
  initialMatchId?: string | null;
  initialSetId?: string | null;
  onApplyStatsBatch: (batch: {
    matchId: string;
    setId: string;
    statsToAdd: any[];
    statIdsToDelete: string[];
  }) => Promise<void> | void;
  onClose?: () => void;
  isReadOnly?: boolean;
  ourTeamName?: string;
  onAddPlayerToRoster?: (name: string, number: string) => void;
}

// Columns definition for spreadsheet
interface MetricColDef {
  key: string;
  label: string;
  shortLabel: string;
  category: "Pass" | "Dig" | "Attack" | "Block" | "Serve";
  metric: string;
  value?: number;
  bgHeader: string;
  bgCell: string;
  tooltip: string;
}

const STAT_COLUMNS: MetricColDef[] = [
  // PASSING
  { key: "pass3", label: "3 (Perfect)", shortLabel: "3", category: "Pass", metric: "Pass", value: 3, bgHeader: "bg-blue-900/60 text-blue-200", bgCell: "focus:ring-blue-500", tooltip: "Perfect 3-point pass to setter" },
  { key: "pass2", label: "2 (Good)", shortLabel: "2", category: "Pass", metric: "Pass", value: 2, bgHeader: "bg-blue-900/60 text-blue-200", bgCell: "focus:ring-blue-500", tooltip: "Positive 2-point pass" },
  { key: "pass1", label: "1 (Playable)", shortLabel: "1", category: "Pass", metric: "Pass", value: 1, bgHeader: "bg-blue-900/60 text-blue-200", bgCell: "focus:ring-blue-500", tooltip: "Poor/Playable 1-point pass" },
  { key: "pass0", label: "0 (Ace Against)", shortLabel: "0", category: "Pass", metric: "Pass", value: 0, bgHeader: "bg-blue-900/60 text-red-200", bgCell: "focus:ring-red-500", tooltip: "0-point shanked or direct ace allowed" },
  
  // DIGS
  { key: "digCount", label: "Digs", shortLabel: "Dig", category: "Dig", metric: "Dig", bgHeader: "bg-cyan-900/60 text-cyan-200", bgCell: "focus:ring-cyan-500", tooltip: "Successful defensive dig" },
  { key: "digErr", label: "Dig Errors", shortLabel: "D-Err", category: "Dig", metric: "Error", bgHeader: "bg-cyan-900/60 text-red-200", bgCell: "focus:ring-red-500", tooltip: "Defensive dig error/miss" },
  
  // ATTACKS / SWINGS
  { key: "attKill", label: "Kills", shortLabel: "Kill", category: "Attack", metric: "Kill", bgHeader: "bg-emerald-900/60 text-emerald-200", bgCell: "focus:ring-emerald-500", tooltip: "Kill / Point scored on swing" },
  { key: "attErr", label: "Att Errors", shortLabel: "A-Err", category: "Attack", metric: "Out/Net", bgHeader: "bg-emerald-900/60 text-red-200", bgCell: "focus:ring-red-500", tooltip: "Hitting error (out or net)" },
  { key: "attBlk", label: "Att Blocked", shortLabel: "A-Blk", category: "Attack", metric: "Blocked", bgHeader: "bg-emerald-900/60 text-amber-200", bgCell: "focus:ring-amber-500", tooltip: "Attack blocked by opponent" },
  { key: "attInPlay", label: "In Play", shortLabel: "Swing", category: "Attack", metric: "Swing", bgHeader: "bg-emerald-900/60 text-slate-200", bgCell: "focus:ring-slate-500", tooltip: "Attack kept in play / rally continued" },

  // BLOCKS
  { key: "blkStuff", label: "Stuffs", shortLabel: "Stuff", category: "Block", metric: "Stuff", bgHeader: "bg-amber-900/60 text-amber-200", bgCell: "focus:ring-amber-500", tooltip: "Terminal block for point (solo/assist)" },
  { key: "blkTouch", label: "Touches", shortLabel: "Touch", category: "Block", metric: "Play On", bgHeader: "bg-amber-900/60 text-amber-200", bgCell: "focus:ring-amber-500", tooltip: "Block touch / slow-down (play continued)" },
  { key: "blkErr", label: "Net / Viol", shortLabel: "B-Err", category: "Block", metric: "Net Viol", bgHeader: "bg-amber-900/60 text-red-200", bgCell: "focus:ring-red-500", tooltip: "Net violation or blocking fault" },

  // SERVES
  { key: "srvAce", label: "Aces", shortLabel: "Ace", category: "Serve", metric: "Ace", bgHeader: "bg-purple-900/60 text-purple-200", bgCell: "focus:ring-purple-500", tooltip: "Service Ace (direct point)" },
  { key: "srvErr", label: "Serve Errors", shortLabel: "S-Err", category: "Serve", metric: "Error", bgHeader: "bg-purple-900/60 text-red-200", bgCell: "focus:ring-red-500", tooltip: "Service miss / fault" },
  { key: "srvInPlay", label: "In Play Serves", shortLabel: "Serve", category: "Serve", metric: "Attempt", bgHeader: "bg-purple-900/60 text-slate-200", bgCell: "focus:ring-purple-500", tooltip: "Good serve put into play" },
];

export const StatSpreadsheetEditor: React.FC<StatSpreadsheetEditorProps> = ({
  roster,
  matches,
  sets,
  stats,
  activeMatch,
  activeSetId,
  initialMatchId,
  initialSetId,
  onApplyStatsBatch,
  onClose,
  isReadOnly = false,
  ourTeamName = "UCC Lancers",
  onAddPlayerToRoster,
}) => {
  // 1. MATCH & SET SELECTION
  const [selectedMatchId, setSelectedMatchId] = useState<string>(() => {
    if (initialMatchId) return initialMatchId;
    if (activeMatch?.id) return activeMatch.id;
    if (matches.length > 0) return matches[0].id;
    return "general_match";
  });

  // Available sets for chosen match
  const availableSets = useMemo(() => {
    return sets.filter((s) => s.matchId === selectedMatchId);
  }, [sets, selectedMatchId]);

  const [selectedSetId, setSelectedSetId] = useState<string>(() => {
    if (initialSetId) return initialSetId;
    if (activeSetId && (!initialMatchId || initialMatchId === activeMatch?.id)) return activeSetId;
    return availableSets.length > 0 ? availableSets[0].id : "set_1";
  });

  // When match changes, auto-select first set if current set is not in it
  useEffect(() => {
    const matchSets = sets.filter((s) => s.matchId === selectedMatchId);
    if (matchSets.length > 0 && !matchSets.some((s) => s.id === selectedSetId)) {
      setSelectedSetId(matchSets[0].id);
    }
  }, [selectedMatchId, sets, selectedSetId]);

  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNum, setNewPlayerNum] = useState("");

  // Grid element refs for Excel-like keyboard navigation: gridRefs[playerId][columnKey]
  const cellRefs = useRef<Record<string, Record<string, HTMLInputElement | null>>>({});

  // 2. EXTRACT CURRENT STATS FOR TARGET MATCH & SET
  // Map of statId[] for player + columnKey so we know which events exist
  const existingStatsMap = useMemo(() => {
    const map: Record<string, Record<string, string[]>> = {};

    stats.forEach((s) => {
      // Must match our team, not opponent
      if (s.isOpponent) return;
      if (s.matchId !== selectedMatchId) return;
      // If set is specific, match set
      if (selectedSetId && selectedSetId !== "all" && s.setId && s.setId !== selectedSetId) return;

      const pId = s.playerId;
      if (!pId) return;

      if (!map[pId]) map[pId] = {};

      let colKey: string | null = null;
      if (s.category === "Pass") {
        if (s.value === 3) colKey = "pass3";
        else if (s.value === 2) colKey = "pass2";
        else if (s.value === 1) colKey = "pass1";
        else if (s.value === 0) colKey = "pass0";
        else colKey = "pass2";
      } else if (s.category === "Dig") {
        if (s.metric === "Dig") colKey = "digCount";
        else if (s.metric === "Error") colKey = "digErr";
      } else if (s.category === "Attack") {
        if (s.metric === "Kill") colKey = "attKill";
        else if (s.metric === "Out" || s.metric === "Net" || s.metric === "Out/Net" || s.metric === "Error") colKey = "attErr";
        else if (s.metric === "Blocked" || s.metric === "Stuffed") colKey = "attBlk";
        else colKey = "attInPlay";
      } else if (s.category === "Block") {
        if (s.metric === "Stuff" || s.metric === "Block" || s.metric === "Stuffed") colKey = "blkStuff";
        else if (s.metric === "Play On" || s.metric === "Touch") colKey = "blkTouch";
        else colKey = "blkErr";
      } else if (s.category === "Serve") {
        if (s.metric === "Ace") colKey = "srvAce";
        else if (s.metric?.includes("Miss") || s.metric === "Error") colKey = "srvErr";
        else colKey = "srvInPlay";
      }

      if (colKey) {
        if (!map[pId][colKey]) map[pId][colKey] = [];
        map[pId][colKey].push(s.id);
      }
    });

    return map;
  }, [stats, selectedMatchId, selectedSetId]);

  // 3. LOCAL EDITABLE GRID STATE: gridData[playerId][colKey] = number
  const [gridData, setGridData] = useState<Record<string, Record<string, number>>>({});

  // Sync grid data whenever selected match/set changes or external stats change
  useEffect(() => {
    const initial: Record<string, Record<string, number>> = {};
    roster.forEach((p) => {
      initial[p.id] = {};
      STAT_COLUMNS.forEach((col) => {
        const count = existingStatsMap[p.id]?.[col.key]?.length || 0;
        initial[p.id][col.key] = count;
      });
    });
    setGridData(initial);
  }, [existingStatsMap, roster]);

  // 4. HANDLE DIRECT CELL VALUE CHANGE
  const handleCellChange = useCallback(
    (playerId: string, colKey: string, rawVal: string) => {
      if (isReadOnly) return;
      const num = rawVal === "" ? 0 : Math.max(0, parseInt(rawVal, 10) || 0);

      setGridData((prev) => ({
        ...prev,
        [playerId]: {
          ...(prev[playerId] || {}),
          [colKey]: num,
        },
      }));

      // Calculate diff against existingStatsMap
      const currentStatIds = existingStatsMap[playerId]?.[colKey] || [];
      const currentCount = currentStatIds.length;

      const colDef = STAT_COLUMNS.find((c) => c.key === colKey);
      if (!colDef) return;

      const targetMatch = selectedMatchId;
      const targetSet = selectedSetId === "all" ? (availableSets[0]?.id || "set_1") : selectedSetId;

      const statIdsToDelete: string[] = [];
      const statsToAdd: any[] = [];

      if (num < currentCount) {
        // Delete excess items
        const deleteCount = currentCount - num;
        statIdsToDelete.push(...currentStatIds.slice(0, deleteCount));
      } else if (num > currentCount) {
        // Add new items
        const addCount = num - currentCount;
        for (let i = 0; i < addCount; i++) {
          const statId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          statsToAdd.push({
            id: statId,
            matchId: targetMatch,
            setId: targetSet,
            playerId,
            category: colDef.category,
            metric: colDef.metric,
            value: colDef.value ?? 1,
            isOpponent: false,
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (statIdsToDelete.length > 0 || statsToAdd.length > 0) {
        setSaveStatus("saving");
        try {
          onApplyStatsBatch({
            matchId: targetMatch,
            setId: targetSet,
            statsToAdd,
            statIdsToDelete,
          });
          setTimeout(() => setSaveStatus("saved"), 300);
        } catch {
          setSaveStatus("saved");
        }
      }
    },
    [isReadOnly, existingStatsMap, selectedMatchId, selectedSetId, availableSets, onApplyStatsBatch]
  );

  // Quick increment/decrement helper
  const handleQuickStep = (playerId: string, colKey: string, delta: number) => {
    const cur = gridData[playerId]?.[colKey] || 0;
    const next = Math.max(0, cur + delta);
    handleCellChange(playerId, colKey, next.toString());
  };

  // 5. KEYBOARD NAVIGATION (Excel / Google Sheets style)
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    playerIndex: number,
    colIndex: number,
    playerId: string,
    colKey: string
  ) => {
    const filteredRoster = visibleRoster;
    if (e.key === "Enter") {
      e.preventDefault();
      // Move down one row in same column
      const targetPlayerIndex = e.shiftKey ? playerIndex - 1 : playerIndex + 1;
      if (targetPlayerIndex >= 0 && targetPlayerIndex < filteredRoster.length) {
        const targetP = filteredRoster[targetPlayerIndex];
        const nextInput = cellRefs.current[targetP.id]?.[colKey];
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const targetPlayerIndex = playerIndex + 1;
      if (targetPlayerIndex < filteredRoster.length) {
        const targetP = filteredRoster[targetPlayerIndex];
        const nextInput = cellRefs.current[targetP.id]?.[colKey];
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const targetPlayerIndex = playerIndex - 1;
      if (targetPlayerIndex >= 0) {
        const targetP = filteredRoster[targetPlayerIndex];
        const nextInput = cellRefs.current[targetP.id]?.[colKey];
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    } else if (e.key === "Tab") {
      // Tab naturally moves across elements; ensure selected text
      setTimeout(() => {
        if (document.activeElement instanceof HTMLInputElement) {
          document.activeElement.select();
        }
      }, 10);
    }
  };

  // Filter roster
  const visibleRoster = useMemo(() => {
    return roster.filter((p) => {
      if (p.isRetired) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.number && p.number.toString().includes(q))
      );
    });
  }, [roster, searchQuery]);

  // Compute live aggregates per player
  const playerComputed = useMemo(() => {
    const comp: Record<
      string,
      {
        passTot: number;
        passAvg: string;
        digNet: number;
        swingsTot: number;
        killPct: string;
        blkTot: number;
        srvTot: number;
        srvDiff: number;
      }
    > = {};

    visibleRoster.forEach((p) => {
      const data = gridData[p.id] || {};
      const p3 = data.pass3 || 0;
      const p2 = data.pass2 || 0;
      const p1 = data.pass1 || 0;
      const p0 = data.pass0 || 0;
      const passTot = p3 + p2 + p1 + p0;
      const passSum = p3 * 3 + p2 * 2 + p1 * 1 + p0 * 0;
      const passAvg = passTot > 0 ? (passSum / passTot).toFixed(2) : "-";

      const digs = data.digCount || 0;
      const digErr = data.digErr || 0;
      const digNet = digs - digErr;

      const kills = data.attKill || 0;
      const attErr = data.attErr || 0;
      const attBlk = data.attBlk || 0;
      const attInPlay = data.attInPlay || 0;
      const swingsTot = kills + attErr + attBlk + attInPlay;
      const killPct = swingsTot > 0 ? `${((kills / swingsTot) * 100).toFixed(1)}%` : "0.0%";

      const stuffs = data.blkStuff || 0;
      const touches = data.blkTouch || 0;
      const blkTot = stuffs + touches;

      const aces = data.srvAce || 0;
      const srvErr = data.srvErr || 0;
      const srvInPlay = data.srvInPlay || 0;
      const srvTot = aces + srvErr + srvInPlay;
      const srvDiff = aces - srvErr;

      comp[p.id] = {
        passTot,
        passAvg,
        digNet,
        swingsTot,
        killPct,
        blkTot,
        srvTot,
        srvDiff,
      };
    });

    return comp;
  }, [visibleRoster, gridData]);

  // Compute live team totals for top row
  const teamTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    STAT_COLUMNS.forEach((col) => {
      let sum = 0;
      visibleRoster.forEach((p) => {
        sum += gridData[p.id]?.[col.key] || 0;
      });
      totals[col.key] = sum;
    });

    const p3 = totals.pass3 || 0;
    const p2 = totals.pass2 || 0;
    const p1 = totals.pass1 || 0;
    const p0 = totals.pass0 || 0;
    const passTot = p3 + p2 + p1 + p0;
    const passSum = p3 * 3 + p2 * 2 + p1 * 1 + p0 * 0;
    const passAvg = passTot > 0 ? (passSum / passTot).toFixed(2) : "-";

    const swingsTot = (totals.attKill || 0) + (totals.attErr || 0) + (totals.attBlk || 0) + (totals.attInPlay || 0);
    const killPct = swingsTot > 0 ? `${(((totals.attKill || 0) / swingsTot) * 100).toFixed(1)}%` : "0.0%";

    const blkTot = (totals.blkStuff || 0) + (totals.blkTouch || 0);
    const srvTot = (totals.srvAce || 0) + (totals.srvErr || 0) + (totals.srvInPlay || 0);
    const srvDiff = (totals.srvAce || 0) - (totals.srvErr || 0);

    return {
      totals,
      passTot,
      passAvg,
      swingsTot,
      killPct,
      blkTot,
      srvTot,
      srvDiff,
    };
  }, [visibleRoster, gridData]);

  // Quick export spreadsheet to CSV
  const handleExportSheetCSV = () => {
    const selectedMatch = matches.find((m) => m.id === selectedMatchId);
    const matchName = selectedMatch ? (selectedMatch.opponent ? `vs_${selectedMatch.opponent}` : selectedMatch.title || "Match") : "Match";
    const headerRow = ["Number", "Player", ...STAT_COLUMNS.map((c) => `${c.category}_${c.label}`), "Pass_Avg", "Total_Swings", "Kill_Pct", "Total_Blocks", "Total_Serves", "Serve_PlusMinus"];
    
    const rows = visibleRoster.map((p) => {
      const c = playerComputed[p.id];
      const pData = gridData[p.id] || {};
      const row = [
        p.number || "",
        `"${p.name.replace(/"/g, '""')}"`,
        ...STAT_COLUMNS.map((col) => pData[col.key] || 0),
        c?.passAvg || "-",
        c?.swingsTot || 0,
        c?.killPct || "0.0%",
        c?.blkTot || 0,
        c?.srvTot || 0,
        c?.srvDiff || 0,
      ];
      return row.join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headerRow.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `UCC_Stats_Spreadsheet_${matchName}_Set_${selectedSetId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add new player inline
  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    if (onAddPlayerToRoster) {
      onAddPlayerToRoster(newPlayerName.trim(), newPlayerNum.trim());
    }
    setNewPlayerName("");
    setNewPlayerNum("");
    setShowAddPlayer(false);
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden font-sans text-slate-100 max-w-full">
      {/* 1. TOP TOOLBAR & SCOPE SELECTOR */}
      <div className="bg-gradient-to-r from-[#001b5e] via-blue-950 to-slate-900 p-4 border-b border-blue-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shadow">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-wide text-white uppercase flex items-center gap-2">
                <span>Spreadsheet Stat Editor</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-500/40">
                  Live Sync
                </span>
              </h2>
            </div>
            <p className="text-xs text-blue-200">
              Type numbers directly into any stat cell. Hit <kbd className="px-1 py-0.5 bg-black/40 rounded border border-white/20 text-[10px] font-mono">Tab</kbd> for next stat, <kbd className="px-1 py-0.5 bg-black/40 rounded border border-white/20 text-[10px] font-mono">Enter</kbd> for next player.
            </p>
          </div>
        </div>

        {/* CONTROLS & SAVE BADGE */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-bold text-slate-300">
            {saveStatus === "saving" ? (
              <>
                <RefreshCw size={13} className="text-amber-400 animate-spin" />
                <span className="text-amber-300">Syncing...</span>
              </>
            ) : (
              <>
                <Check size={14} className="text-emerald-400" />
                <span className="text-emerald-300">Saved</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportSheetCSV}
            className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Download this spreadsheet view as CSV"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Close Spreadsheet"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 2. MATCH & SET SELECTION BAR */}
      <div className="bg-slate-800/90 px-4 py-2.5 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Match Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400">Match:</span>
            <select
              value={selectedMatchId}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1 text-xs font-bold text-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {matches.length === 0 && <option value="general_match">General Match</option>}
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.type === "Practice" ? "Practice: " : "vs "}
                  {m.opponent || m.title || "Match"} ({m.date ? new Date(m.date).toLocaleDateString() : "Active"})
                </option>
              ))}
            </select>
          </div>

          {/* Set Selector */}
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400">Set:</span>
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-600">
              {availableSets.length === 0 ? (
                <button
                  type="button"
                  className="px-2.5 py-1 rounded bg-blue-600 text-white font-black text-xs"
                >
                  Set 1
                </button>
              ) : (
                availableSets.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSetId(s.id)}
                    className={`px-2.5 py-1 rounded text-xs font-black transition-all cursor-pointer ${
                      selectedSetId === s.id
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Set {s.setNum || idx + 1}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SEARCH & QUICK FILTER */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter player..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-700 pl-7 pr-2.5 py-1 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-blue-500 w-36 sm:w-44"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {onAddPlayerToRoster && (
            <button
              type="button"
              onClick={() => setShowAddPlayer(!showAddPlayer)}
              className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">Add Player</span>
            </button>
          )}
        </div>
      </div>

      {/* OPTIONAL: INLINE ADD PLAYER FORM */}
      {showAddPlayer && (
        <div className="bg-slate-800 p-3 border-b border-slate-700 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-300">Add to Roster:</span>
          <input
            type="text"
            placeholder="Player Name"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            className="bg-slate-900 border border-slate-600 px-2.5 py-1 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="# (Jersey)"
            value={newPlayerNum}
            onChange={(e) => setNewPlayerNum(e.target.value)}
            className="bg-slate-900 border border-slate-600 px-2.5 py-1 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-blue-500 w-20"
          />
          <button
            type="button"
            onClick={handleAddPlayer}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1 rounded-lg"
          >
            Save Player
          </button>
          <button
            type="button"
            onClick={() => setShowAddPlayer(false)}
            className="text-slate-400 hover:text-white text-xs px-2 py-1"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 3. SPREADSHEET TABLE GRID */}
      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto scrollbar-thin">
        <table className="w-full text-left border-collapse min-w-[1250px] text-xs">
          {/* HEADER ROW 1: CATEGORY BANDS */}
          <thead>
            <tr className="bg-slate-950 text-slate-300 uppercase tracking-widest text-[10px] font-black border-b border-slate-700 select-none sticky top-0 z-30">
              <th className="p-2.5 sticky left-0 bg-slate-950 z-40 w-48 shadow-[2px_0_5px_rgba(0,0,0,0.5)] border-r border-slate-700">
                ROSTER ({visibleRoster.length})
              </th>
              
              {/* PASSING BAND */}
              <th colSpan={4} className="p-2 text-center bg-blue-950/80 border-r border-blue-900/60 text-blue-300">
                PASSING (3 - 2 - 1 - 0)
              </th>
              <th className="p-2 text-center bg-blue-900/40 border-r border-blue-800 text-blue-200">
                PASS AVG
              </th>

              {/* DIGS BAND */}
              <th colSpan={2} className="p-2 text-center bg-cyan-950/80 border-r border-cyan-900/60 text-cyan-300">
                DEFENSE / DIGS
              </th>
              <th className="p-2 text-center bg-cyan-900/40 border-r border-cyan-800 text-cyan-200">
                NET DIGS
              </th>

              {/* ATTACK BAND */}
              <th colSpan={4} className="p-2 text-center bg-emerald-950/80 border-r border-emerald-900/60 text-emerald-300">
                ATTACKS / SWINGS
              </th>
              <th className="p-2 text-center bg-emerald-900/40 border-r border-emerald-800 text-emerald-200">
                KILL %
              </th>

              {/* BLOCK BAND */}
              <th colSpan={3} className="p-2 text-center bg-amber-950/80 border-r border-amber-900/60 text-amber-300">
                BLOCKING
              </th>
              <th className="p-2 text-center bg-amber-900/40 border-r border-amber-800 text-amber-200">
                TOT BLK
              </th>

              {/* SERVE BAND */}
              <th colSpan={3} className="p-2 text-center bg-purple-950/80 border-r border-purple-900/60 text-purple-300">
                SERVING
              </th>
              <th className="p-2 text-center bg-purple-900/40 text-purple-200">
                SRV +/-
              </th>
            </tr>

            {/* HEADER ROW 2: SPECIFIC COLUMNS */}
            <tr className="bg-slate-900 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b-2 border-slate-700 sticky top-[33px] z-20 select-none">
              <th className="p-2 sticky left-0 bg-slate-900 z-30 border-r border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                Player
              </th>

              {/* Passing Cols */}
              {STAT_COLUMNS.slice(0, 4).map((col) => (
                <th key={col.key} className="p-2 text-center w-16 border-r border-slate-800" title={col.tooltip}>
                  {col.shortLabel}
                </th>
              ))}
              <th className="p-2 text-center w-20 border-r border-slate-700 bg-blue-950/20 text-blue-300">
                Avg(Tot)
              </th>

              {/* Dig Cols */}
              {STAT_COLUMNS.slice(4, 6).map((col) => (
                <th key={col.key} className="p-2 text-center w-16 border-r border-slate-800" title={col.tooltip}>
                  {col.shortLabel}
                </th>
              ))}
              <th className="p-2 text-center w-18 border-r border-slate-700 bg-cyan-950/20 text-cyan-300">
                +/-
              </th>

              {/* Attack Cols */}
              {STAT_COLUMNS.slice(6, 10).map((col) => (
                <th key={col.key} className="p-2 text-center w-16 border-r border-slate-800" title={col.tooltip}>
                  {col.shortLabel}
                </th>
              ))}
              <th className="p-2 text-center w-20 border-r border-slate-700 bg-emerald-950/20 text-emerald-300">
                Kill% (Tot)
              </th>

              {/* Block Cols */}
              {STAT_COLUMNS.slice(10, 13).map((col) => (
                <th key={col.key} className="p-2 text-center w-16 border-r border-slate-800" title={col.tooltip}>
                  {col.shortLabel}
                </th>
              ))}
              <th className="p-2 text-center w-18 border-r border-slate-700 bg-amber-950/20 text-amber-300">
                Total
              </th>

              {/* Serve Cols */}
              {STAT_COLUMNS.slice(13, 16).map((col) => (
                <th key={col.key} className="p-2 text-center w-16 border-r border-slate-800" title={col.tooltip}>
                  {col.shortLabel}
                </th>
              ))}
              <th className="p-2 text-center w-18 bg-purple-950/20 text-purple-300">
                +/- (Tot)
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800">
            {/* STICKY TOP ROW: TEAM TOTALS (LIVE UPDATES) */}
            <tr className="bg-gradient-to-r from-blue-950 via-indigo-950 to-blue-950 text-white font-black text-xs border-b-2 border-blue-500/50 sticky top-[62px] z-10 shadow-md">
              <td className="p-2.5 sticky left-0 bg-[#001742] text-amber-300 z-20 border-r border-blue-400/40 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-[9px]">
                    Σ
                  </span>
                  <span>TEAM TOTALS</span>
                </div>
              </td>

              {/* Passing Totals */}
              <td className="p-2 text-center font-black">{teamTotals.totals.pass3 || 0}</td>
              <td className="p-2 text-center font-black">{teamTotals.totals.pass2 || 0}</td>
              <td className="p-2 text-center font-black">{teamTotals.totals.pass1 || 0}</td>
              <td className="p-2 text-center font-black text-red-300">{teamTotals.totals.pass0 || 0}</td>
              <td className="p-2 text-center font-black bg-blue-900/40 text-amber-300 border-r border-slate-700">
                {teamTotals.passAvg} <span className="text-[10px] text-blue-200">({teamTotals.passTot})</span>
              </td>

              {/* Digs Totals */}
              <td className="p-2 text-center font-black text-cyan-300">{teamTotals.totals.digCount || 0}</td>
              <td className="p-2 text-center font-black text-red-300">{teamTotals.totals.digErr || 0}</td>
              <td className="p-2 text-center font-black bg-cyan-900/40 border-r border-slate-700">
                {(teamTotals.totals.digCount || 0) - (teamTotals.totals.digErr || 0)}
              </td>

              {/* Attacks Totals */}
              <td className="p-2 text-center font-black text-emerald-300">{teamTotals.totals.attKill || 0}</td>
              <td className="p-2 text-center font-black text-red-300">{teamTotals.totals.attErr || 0}</td>
              <td className="p-2 text-center font-black text-amber-300">{teamTotals.totals.attBlk || 0}</td>
              <td className="p-2 text-center font-black text-slate-300">{teamTotals.totals.attInPlay || 0}</td>
              <td className="p-2 text-center font-black bg-emerald-900/40 text-emerald-300 border-r border-slate-700">
                {teamTotals.killPct} <span className="text-[10px] text-slate-300">({teamTotals.swingsTot})</span>
              </td>

              {/* Blocks Totals */}
              <td className="p-2 text-center font-black text-amber-300">{teamTotals.totals.blkStuff || 0}</td>
              <td className="p-2 text-center font-black text-amber-200">{teamTotals.totals.blkTouch || 0}</td>
              <td className="p-2 text-center font-black text-red-300">{teamTotals.totals.blkErr || 0}</td>
              <td className="p-2 text-center font-black bg-amber-900/40 border-r border-slate-700">
                {teamTotals.blkTot}
              </td>

              {/* Serves Totals */}
              <td className="p-2 text-center font-black text-purple-300">{teamTotals.totals.srvAce || 0}</td>
              <td className="p-2 text-center font-black text-red-300">{teamTotals.totals.srvErr || 0}</td>
              <td className="p-2 text-center font-black text-slate-300">{teamTotals.totals.srvInPlay || 0}</td>
              <td className="p-2 text-center font-black bg-purple-900/40 text-purple-300">
                {teamTotals.srvDiff > 0 ? `+${teamTotals.srvDiff}` : teamTotals.srvDiff}{" "}
                <span className="text-[10px] text-slate-300">({teamTotals.srvTot})</span>
              </td>
            </tr>

            {/* PLAYER SPREADSHEET ROWS */}
            {visibleRoster.map((player, pIdx) => {
              const comp = playerComputed[player.id];
              const pData = gridData[player.id] || {};

              return (
                <tr
                  key={player.id}
                  className="hover:bg-slate-800/60 transition-colors group border-b border-slate-800"
                >
                  {/* Sticky Player Name & Jersey Column */}
                  <td className="p-2 sticky left-0 bg-slate-900 group-hover:bg-slate-850 z-10 border-r border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center font-mono font-black text-xs shrink-0">
                        {player.number || "-"}
                      </span>
                      <span className="font-bold text-white truncate max-w-[130px]" title={player.name}>
                        {player.name}
                      </span>
                    </div>
                  </td>

                  {/* PASSING CELLS */}
                  {STAT_COLUMNS.slice(0, 4).map((col, cIdx) => (
                    <td key={col.key} className="p-1 border-r border-slate-800 text-center">
                      <input
                        ref={(el) => {
                          if (!cellRefs.current[player.id]) cellRefs.current[player.id] = {};
                          cellRefs.current[player.id][col.key] = el;
                        }}
                        type="number"
                        min="0"
                        value={pData[col.key] ?? 0}
                        onChange={(e) => handleCellChange(player.id, col.key, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, pIdx, cIdx, player.id, col.key)}
                        onFocus={(e) => e.target.select()}
                        disabled={isReadOnly}
                        className={`w-14 text-center font-bold text-xs py-1 rounded bg-slate-950/80 hover:bg-slate-950 border border-slate-700/80 focus:border-blue-400 focus:bg-blue-950/30 text-white outline-none transition-all ${
                          (pData[col.key] || 0) > 0 ? "text-blue-300 font-black" : "text-slate-500"
                        }`}
                      />
                    </td>
                  ))}
                  {/* PASS AVG DISPLAY */}
                  <td className="p-2 text-center font-bold bg-blue-950/10 border-r border-slate-700 text-blue-300 whitespace-nowrap">
                    {comp?.passAvg}{" "}
                    <span className="text-[10px] text-slate-500">({comp?.passTot})</span>
                  </td>

                  {/* DIGS CELLS */}
                  {STAT_COLUMNS.slice(4, 6).map((col, cIdx) => (
                    <td key={col.key} className="p-1 border-r border-slate-800 text-center">
                      <input
                        ref={(el) => {
                          if (!cellRefs.current[player.id]) cellRefs.current[player.id] = {};
                          cellRefs.current[player.id][col.key] = el;
                        }}
                        type="number"
                        min="0"
                        value={pData[col.key] ?? 0}
                        onChange={(e) => handleCellChange(player.id, col.key, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, pIdx, 4 + cIdx, player.id, col.key)}
                        onFocus={(e) => e.target.select()}
                        disabled={isReadOnly}
                        className={`w-14 text-center font-bold text-xs py-1 rounded bg-slate-950/80 hover:bg-slate-950 border border-slate-700/80 focus:border-cyan-400 focus:bg-cyan-950/30 text-white outline-none transition-all ${
                          (pData[col.key] || 0) > 0
                            ? col.key === "digErr"
                              ? "text-red-400 font-black"
                              : "text-cyan-300 font-black"
                            : "text-slate-500"
                        }`}
                      />
                    </td>
                  ))}
                  {/* DIG NET DISPLAY */}
                  <td className="p-2 text-center font-bold bg-cyan-950/10 border-r border-slate-700 text-cyan-300">
                    {comp?.digNet}
                  </td>

                  {/* ATTACKS / SWINGS CELLS */}
                  {STAT_COLUMNS.slice(6, 10).map((col, cIdx) => (
                    <td key={col.key} className="p-1 border-r border-slate-800 text-center">
                      <input
                        ref={(el) => {
                          if (!cellRefs.current[player.id]) cellRefs.current[player.id] = {};
                          cellRefs.current[player.id][col.key] = el;
                        }}
                        type="number"
                        min="0"
                        value={pData[col.key] ?? 0}
                        onChange={(e) => handleCellChange(player.id, col.key, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, pIdx, 6 + cIdx, player.id, col.key)}
                        onFocus={(e) => e.target.select()}
                        disabled={isReadOnly}
                        className={`w-14 text-center font-bold text-xs py-1 rounded bg-slate-950/80 hover:bg-slate-950 border border-slate-700/80 focus:border-emerald-400 focus:bg-emerald-950/30 text-white outline-none transition-all ${
                          (pData[col.key] || 0) > 0
                            ? col.key === "attKill"
                              ? "text-emerald-300 font-black"
                              : col.key === "attErr"
                              ? "text-red-400 font-black"
                              : col.key === "attBlk"
                              ? "text-amber-400 font-black"
                              : "text-slate-200"
                            : "text-slate-500"
                        }`}
                      />
                    </td>
                  ))}
                  {/* KILL % DISPLAY */}
                  <td className="p-2 text-center font-bold bg-emerald-950/10 border-r border-slate-700 text-emerald-300 whitespace-nowrap">
                    {comp?.killPct}{" "}
                    <span className="text-[10px] text-slate-500">({comp?.swingsTot})</span>
                  </td>

                  {/* BLOCKING CELLS */}
                  {STAT_COLUMNS.slice(10, 13).map((col, cIdx) => (
                    <td key={col.key} className="p-1 border-r border-slate-800 text-center">
                      <input
                        ref={(el) => {
                          if (!cellRefs.current[player.id]) cellRefs.current[player.id] = {};
                          cellRefs.current[player.id][col.key] = el;
                        }}
                        type="number"
                        min="0"
                        value={pData[col.key] ?? 0}
                        onChange={(e) => handleCellChange(player.id, col.key, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, pIdx, 10 + cIdx, player.id, col.key)}
                        onFocus={(e) => e.target.select()}
                        disabled={isReadOnly}
                        className={`w-14 text-center font-bold text-xs py-1 rounded bg-slate-950/80 hover:bg-slate-950 border border-slate-700/80 focus:border-amber-400 focus:bg-amber-950/30 text-white outline-none transition-all ${
                          (pData[col.key] || 0) > 0 ? "text-amber-300 font-black" : "text-slate-500"
                        }`}
                      />
                    </td>
                  ))}
                  {/* TOT BLK DISPLAY */}
                  <td className="p-2 text-center font-bold bg-amber-950/10 border-r border-slate-700 text-amber-300">
                    {comp?.blkTot}
                  </td>

                  {/* SERVING CELLS */}
                  {STAT_COLUMNS.slice(13, 16).map((col, cIdx) => (
                    <td key={col.key} className="p-1 border-r border-slate-800 text-center">
                      <input
                        ref={(el) => {
                          if (!cellRefs.current[player.id]) cellRefs.current[player.id] = {};
                          cellRefs.current[player.id][col.key] = el;
                        }}
                        type="number"
                        min="0"
                        value={pData[col.key] ?? 0}
                        onChange={(e) => handleCellChange(player.id, col.key, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, pIdx, 13 + cIdx, player.id, col.key)}
                        onFocus={(e) => e.target.select()}
                        disabled={isReadOnly}
                        className={`w-14 text-center font-bold text-xs py-1 rounded bg-slate-950/80 hover:bg-slate-950 border border-slate-700/80 focus:border-purple-400 focus:bg-purple-950/30 text-white outline-none transition-all ${
                          (pData[col.key] || 0) > 0
                            ? col.key === "srvAce"
                              ? "text-purple-300 font-black"
                              : col.key === "srvErr"
                              ? "text-red-400 font-black"
                              : "text-slate-200"
                            : "text-slate-500"
                        }`}
                      />
                    </td>
                  ))}
                  {/* SRV +/- DISPLAY */}
                  <td className="p-2 text-center font-bold bg-purple-950/10 text-purple-300 whitespace-nowrap">
                    {comp ? (comp.srvDiff > 0 ? `+${comp.srvDiff}` : comp.srvDiff) : 0}{" "}
                    <span className="text-[10px] text-slate-500">({comp?.srvTot})</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. BOTTOM INFO FOOTER */}
      <div className="bg-slate-950 p-3 border-t border-slate-800 text-slate-400 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            <span>Numbers save automatically on typing</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-[11px] text-slate-300">Enter</span>
            <span>moves down</span>
            <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-[11px] text-slate-300 ml-2">Tab</span>
            <span>moves right</span>
          </div>
        </div>

        <div className="text-slate-400 text-[11px]">
          Editing: <strong className="text-white">{matches.find((m) => m.id === selectedMatchId)?.opponent ? `vs ${matches.find((m) => m.id === selectedMatchId)?.opponent}` : "Match"}</strong> • <span className="text-blue-300 font-semibold">{selectedSetId ? (selectedSetId === "all" ? "All Sets" : `Set ${availableSets.find((s) => s.id === selectedSetId)?.setNum || 1}`) : "Set 1"}</span>
        </div>
      </div>
    </div>
  );
};
