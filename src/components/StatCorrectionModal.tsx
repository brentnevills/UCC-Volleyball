import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Trash2,
  Edit3,
  Check,
  PlusCircle,
  Search,
  Filter,
  ArrowRightLeft,
  Activity,
  AlertCircle,
  Shield,
  Layers,
  Calendar,
  FileSpreadsheet,
  Table,
} from "lucide-react";
import { StatSpreadsheetEditor } from "./StatSpreadsheetEditor";

interface StatCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: Array<any>;
  roster: Array<{ id: string; name: string; number?: string; isRetired?: boolean }>;
  activeSetId?: string | null;
  activeMatch?: any;
  matches?: Array<any>;
  sets?: Array<any>;
  initialMatchId?: string | null;
  initialSetId?: string | null;
  initialPlayerId?: string | null;
  onDeleteStat: (statId: string) => void;
  onUpdateStat: (statId: string, updatedFields: any) => void;
  onAddStat: (statData: any) => void;
  onApplyStatsBatch?: (batch: {
    matchId: string;
    setId: string;
    statsToAdd: any[];
    statIdsToDelete: string[];
  }) => Promise<void> | void;
  ourTeamName?: string;
  isReadOnly?: boolean;
}

export const StatCorrectionModal: React.FC<StatCorrectionModalProps> = ({
  isOpen,
  onClose,
  stats,
  roster,
  activeSetId,
  activeMatch,
  matches = [],
  sets = [],
  initialMatchId,
  initialSetId,
  initialPlayerId,
  onDeleteStat,
  onUpdateStat,
  onAddStat,
  onApplyStatsBatch,
  ourTeamName = "Lancers",
  isReadOnly = false,
}) => {
  const [modalMode, setModalMode] = useState<"spreadsheet" | "log">("spreadsheet");
  // Navigation & Scope state
  const [selectedMatchId, setSelectedMatchId] = useState<string>(() => {
    if (initialMatchId) return initialMatchId;
    if (activeMatch?.id) return activeMatch.id;
    return "all";
  });

  const [selectedSetId, setSelectedSetId] = useState<string>(() => {
    if (initialSetId) return initialSetId;
    if (activeSetId && (!initialMatchId || initialMatchId === activeMatch?.id)) return activeSetId;
    return "all";
  });

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPlayer, setFilterPlayer] = useState<string>(() => initialPlayerId || "all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // Sync with initial props whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      if (initialMatchId) setSelectedMatchId(initialMatchId);
      else if (activeMatch?.id) setSelectedMatchId(activeMatch.id);
      
      if (initialSetId) setSelectedSetId(initialSetId);
      else if (activeSetId && (!initialMatchId || initialMatchId === activeMatch?.id)) setSelectedSetId(activeSetId);
      
      if (initialPlayerId) setFilterPlayer(initialPlayerId);
    }
  }, [isOpen, initialMatchId, initialSetId, initialPlayerId, activeMatch, activeSetId]);

  // Add stat form state
  const [newMatchId, setNewMatchId] = useState<string>("");
  const [newSetId, setNewSetId] = useState<string>("");
  const [newTeam, setNewTeam] = useState<"ucc" | "opp">("ucc");
  const [newPlayerId, setNewPlayerId] = useState<string>("");
  const [newCategory, setNewCategory] = useState<string>("Attack");
  const [newMetric, setNewMetric] = useState<string>("Kill");
  const [newValue, setNewValue] = useState<number>(1);
  const [newRow, setNewRow] = useState<"Front" | "Back">("Front");

  // Keep target match/set for Add form initialized
  useEffect(() => {
    const targetM = selectedMatchId !== "all" ? selectedMatchId : (activeMatch?.id || (matches.length > 0 ? matches[0].id : ""));
    setNewMatchId(targetM);
    const availableSets = sets.filter((s) => s.matchId === targetM);
    if (selectedSetId !== "all") {
      setNewSetId(selectedSetId);
    } else if (availableSets.length > 0) {
      setNewSetId(availableSets[0].id);
    } else {
      setNewSetId(activeSetId || "");
    }
  }, [selectedMatchId, selectedSetId, activeMatch, activeSetId, matches, sets, showAddForm]);

  // Inline edit state
  const [editingStatId, setEditingStatId] = useState<string | null>(null);
  const [editPlayerId, setEditPlayerId] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("");
  const [editMetric, setEditMetric] = useState<string>("");
  const [editValue, setEditValue] = useState<number>(1);
  const [editRow, setEditRow] = useState<string>("");
  const [editSetId, setEditSetId] = useState<string>("");

  // Available sets for the current selected match
  const availableSetsForMatch = useMemo(() => {
    if (!selectedMatchId || selectedMatchId === "all") return sets;
    return sets.filter((s) => s.matchId === selectedMatchId).sort((a, b) => (a.setNum || 0) - (b.setNum || 0));
  }, [sets, selectedMatchId]);

  // Filtered stats list
  const filteredStats = useMemo(() => {
    let result = [...stats];

    // Filter by match
    if (selectedMatchId && selectedMatchId !== "all") {
      result = result.filter((s) => s.matchId === selectedMatchId);
    }

    // Filter by set
    if (selectedSetId && selectedSetId !== "all") {
      result = result.filter((s) => s.setId === selectedSetId);
    }

    // Filter by category
    if (filterCategory !== "all") {
      result = result.filter((s) => s.category === filterCategory);
    }

    // Filter by player
    if (filterPlayer !== "all") {
      result = result.filter((s) => s.playerId === filterPlayer);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => {
        const playerName = roster.find((r) => r.id === s.playerId)?.name || s.playerId;
        const playerNum = roster.find((r) => r.id === s.playerId)?.number || "";
        const matchObj = matches.find((m) => m.id === s.matchId);
        const oppName = matchObj?.opponent || "";
        return (
          playerName.toLowerCase().includes(q) ||
          playerNum.includes(q) ||
          oppName.toLowerCase().includes(q) ||
          s.metric?.toLowerCase().includes(q) ||
          s.category?.toLowerCase().includes(q)
        );
      });
    }

    // Sort reverse chronological (newest first)
    result.sort((a, b) => {
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tB - tA;
    });

    return result;
  }, [stats, selectedMatchId, selectedSetId, filterCategory, filterPlayer, searchQuery, roster, matches]);

  // Quick summary stats for current filtered view
  const summaryMetrics = useMemo(() => {
    let kills = 0;
    let attackErrors = 0;
    let swings = 0;
    let aces = 0;
    let serveErrors = 0;
    let blocks = 0;
    let digs = 0;
    let passSum = 0;
    let passCount = 0;

    filteredStats.forEach((s) => {
      if (s.category === "Attack") {
        swings++;
        if (s.metric === "Kill") kills++;
        else if (["Out", "Net", "Stuffed"].includes(s.metric)) attackErrors++;
      } else if (s.category === "Serve") {
        if (s.metric === "Ace") aces++;
        else if (typeof s.metric === "string" && s.metric.startsWith("Miss")) serveErrors++;
      } else if (s.category === "Block") {
        if (s.metric === "Stuff") blocks += s.value ?? 1;
      } else if (s.category === "Dig") {
        if (s.metric === "Dig") digs++;
      } else if (s.category === "Pass") {
        passSum += Number(s.value ?? 0);
        passCount++;
      }
    });

    const passAvg = passCount > 0 ? (passSum / passCount).toFixed(2) : "0.00";
    return { kills, attackErrors, swings, aces, serveErrors, blocks, digs, passAvg, passCount };
  }, [filteredStats]);

  if (!isOpen) return null;

  const handleStartEdit = (stat: any) => {
    setEditingStatId(stat.id);
    setEditPlayerId(stat.playerId);
    setEditCategory(stat.category);
    setEditMetric(stat.metric);
    setEditValue(stat.value ?? 1);
    setEditRow(stat.row || (stat.metric === "Swing Back" ? "Back" : "Front"));
    setEditSetId(stat.setId || "");
  };

  const handleSaveEdit = (statId: string) => {
    onUpdateStat(statId, {
      playerId: editPlayerId,
      category: editCategory,
      metric: editMetric,
      value: editValue,
      ...(editSetId ? { setId: editSetId } : {}),
      ...(editCategory === "Attack" ? { row: editRow } : {}),
    });
    setEditingStatId(null);
  };

  const handleCancelEdit = () => {
    setEditingStatId(null);
  };

  const handleCreateStat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerId.trim()) {
      alert("Please select or enter a player.");
      return;
    }

    const targetMatchId = newMatchId || selectedMatchId !== "all" ? (newMatchId || selectedMatchId) : (activeMatch?.id || (matches.length > 0 ? matches[0].id : "general_match"));
    const targetSetId = newSetId || (selectedSetId !== "all" ? selectedSetId : (activeSetId || (sets.find((s) => s.matchId === targetMatchId)?.id) || "manual_set"));

    onAddStat({
      matchId: targetMatchId,
      setId: targetSetId,
      playerId: newPlayerId,
      category: newCategory,
      metric: newMetric,
      value: Number(newValue),
      isOpponent: newTeam === "opp",
      row: newCategory === "Attack" ? newRow : undefined,
    });

    setShowAddForm(false);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Pass":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Attack":
        return "bg-green-100 text-green-800 border-green-200";
      case "Serve":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Block":
        return "bg-teal-100 text-teal-800 border-teal-200";
      case "Dig":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  // Helper to format match title
  const getMatchLabel = (m: any) => {
    if (!m) return "Unknown Match";
    const dateStr = m.date ? new Date(m.date).toLocaleDateString([], { month: "short", day: "numeric" }) : "";
    if (m.type === "Practice") return `Practice ${dateStr ? `(${dateStr})` : ""}`;
    return `vs ${m.opponent || "Opponent"} ${dateStr ? `(${dateStr})` : ""}`;
  };

  return (
    <div className="fixed inset-0 z-[160] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-6 overflow-hidden">
      <div className="bg-white w-full max-w-5xl h-[95vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-[#001b5e] to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Edit3 className="text-amber-400" size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-black uppercase tracking-wider flex items-center gap-2">
                Data Correction & Stat Log
              </h2>
              <p className="text-xs sm:text-sm text-indigo-200 font-bold">
                Review, correct, delete, or add stats after games or during play
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {isReadOnly ? (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-xl text-xs font-bold">
                Player View-Only (Editing Restricted)
              </span>
            ) : (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <PlusCircle size={16} />
                <span>{showAddForm ? "Cancel Add" : "+ Add Stat"}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors shrink-0 cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* MODE SWITCHER TAB BAR */}
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalMode("spreadsheet")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                modalMode === "spreadsheet"
                  ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <FileSpreadsheet size={15} />
              <span>Spreadsheet Mode (Type Numbers)</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase px-1.5 py-0.2 rounded border border-emerald-500/40">
                Live
              </span>
            </button>
            <button
              type="button"
              onClick={() => setModalMode("log")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                modalMode === "log"
                  ? "bg-slate-700 text-white shadow-md ring-2 ring-slate-500"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <Table size={14} />
              <span>Play-by-Play Event Log</span>
            </button>
          </div>
          <div className="text-[11px] text-slate-400 hidden sm:block">
            {modalMode === "spreadsheet"
              ? "💡 Type stats directly into cells. Press Tab for next stat, Enter for next player."
              : "Review and delete individual play-by-play timestamps"}
          </div>
        </div>

        {modalMode === "spreadsheet" ? (
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-slate-950 flex flex-col">
            <StatSpreadsheetEditor
              roster={roster}
              matches={matches}
              sets={sets}
              stats={stats}
              activeMatch={activeMatch}
              activeSetId={activeSetId}
              initialMatchId={initialMatchId || (selectedMatchId !== "all" ? selectedMatchId : undefined)}
              initialSetId={initialSetId || (selectedSetId !== "all" ? selectedSetId : undefined)}
              onApplyStatsBatch={async (batch) => {
                if (onApplyStatsBatch) {
                  await onApplyStatsBatch(batch);
                } else {
                  batch.statIdsToDelete.forEach((id) => onDeleteStat(id));
                  batch.statsToAdd.forEach((s) => onAddStat(s));
                }
              }}
              isReadOnly={isReadOnly}
              ourTeamName={ourTeamName}
            />
          </div>
        ) : (
          <>
            {/* ADD MISSED STAT FORM */}
        {showAddForm && (
          <form
            onSubmit={handleCreateStat}
            className="bg-indigo-50/90 border-b border-indigo-200 p-4 shrink-0 animate-in slide-in-from-top-2"
          >
            <div className="font-black text-indigo-950 uppercase text-xs tracking-wider mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <PlusCircle size={14} className="text-emerald-600" />
                <span>Add Missing Stat Record</span>
              </span>
              <span className="text-slate-500 font-bold text-[11px]">
                Target: {matches.find((m) => m.id === newMatchId)?.opponent ? `vs ${matches.find((m) => m.id === newMatchId)?.opponent}` : (selectedMatchId === "all" ? "All Matches" : "Selected Match")}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-3">
              {/* Match Selector (if multiple matches) */}
              {matches.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Target Game</label>
                  <select
                    value={newMatchId}
                    onChange={(e) => {
                      const mId = e.target.value;
                      setNewMatchId(mId);
                      const mSets = sets.filter((s) => s.matchId === mId);
                      if (mSets.length > 0) setNewSetId(mSets[0].id);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                  >
                    {matches.map((m) => (
                      <option key={m.id} value={m.id}>
                        {getMatchLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Set Selector */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Target Set</label>
                <select
                  value={newSetId}
                  onChange={(e) => setNewSetId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                >
                  {sets
                    .filter((s) => !newMatchId || s.matchId === newMatchId)
                    .sort((a, b) => (a.setNum || 0) - (b.setNum || 0))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        Set {s.setNum || 1} {s.scoreUcc !== undefined ? `(${s.scoreUcc}-${s.scoreOpp})` : ""}
                      </option>
                    ))}
                  {sets.filter((s) => !newMatchId || s.matchId === newMatchId).length === 0 && (
                    <option value={activeSetId || "set_1"}>Set 1</option>
                  )}
                </select>
              </div>

              {/* Team Selector */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Team</label>
                <select
                  value={newTeam}
                  onChange={(e) => {
                    const t = e.target.value as "ucc" | "opp";
                    setNewTeam(t);
                    setNewPlayerId(t === "ucc" && roster[0] ? roster[0].id : "");
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                >
                  <option value="ucc">{ourTeamName}</option>
                  <option value="opp">Opponent</option>
                </select>
              </div>

              {/* Player Selector */}
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Player</label>
                {newTeam === "ucc" ? (
                  <select
                    value={newPlayerId}
                    onChange={(e) => setNewPlayerId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                  >
                    <option value="">-- Player --</option>
                    {roster.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.number || "-"} {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Opp Jersey #"
                    value={newPlayerId}
                    onChange={(e) => setNewPlayerId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                  />
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setNewCategory(cat);
                    if (cat === "Pass") {
                      setNewMetric("Rating");
                      setNewValue(3);
                    } else if (cat === "Attack") {
                      setNewMetric("Kill");
                      setNewValue(1);
                    } else if (cat === "Serve") {
                      setNewMetric("Ace");
                      setNewValue(1);
                    } else if (cat === "Dig") {
                      setNewMetric("Dig");
                      setNewValue(1);
                    } else if (cat === "Block") {
                      setNewMetric("Stuff");
                      setNewValue(1);
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                >
                  <option value="Attack">Attack</option>
                  <option value="Pass">Pass</option>
                  <option value="Serve">Serve</option>
                  <option value="Dig">Dig</option>
                  <option value="Block">Block</option>
                </select>
              </div>

              {/* Metric / Value */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Action / Metric</label>
                {newCategory === "Pass" ? (
                  <div className="flex gap-1">
                    {[3, 2, 1, 0].map((val) => (
                      <button
                        type="button"
                        key={val}
                        onClick={() => {
                          setNewMetric("Rating");
                          setNewValue(val);
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                          newValue === val ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-700 border border-slate-200"
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                ) : newCategory === "Attack" ? (
                  <div className="flex gap-1">
                    <select
                      value={newMetric}
                      onChange={(e) => setNewMetric(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                    >
                      <option value="Kill">Kill</option>
                      <option value="Swing">Swing</option>
                      <option value="Out">Out</option>
                      <option value="Net">Net</option>
                      <option value="Blocked">Blocked</option>
                      <option value="Stuffed">Stuffed</option>
                    </select>
                    <select
                      value={newRow}
                      onChange={(e) => setNewRow(e.target.value as "Front" | "Back")}
                      className="w-16 bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                    >
                      <option value="Front">Fr</option>
                      <option value="Back">Bk</option>
                    </select>
                  </div>
                ) : newCategory === "Serve" ? (
                  <select
                    value={newMetric}
                    onChange={(e) => setNewMetric(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                  >
                    <option value="Ace">Ace</option>
                    <option value="Attempt">In Play (Attempt)</option>
                    <option value="Miss - Net">Miss - Net</option>
                    <option value="Miss - Long">Miss - Long</option>
                    <option value="Miss - Wide">Miss - Wide</option>
                    <option value="Miss - Foot Fault">Miss - Foot Fault</option>
                    <option value="Miss - Out">Miss - Out</option>
                  </select>
                ) : newCategory === "Dig" ? (
                  <select
                    value={newMetric}
                    onChange={(e) => setNewMetric(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                  >
                    <option value="Dig">Successful Dig</option>
                    <option value="Error">Dig Error</option>
                  </select>
                ) : (
                  <select
                    value={`${newMetric}_${newValue}`}
                    onChange={(e) => {
                      const [m, v] = e.target.value.split("_");
                      setNewMetric(m);
                      setNewValue(Number(v));
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                  >
                    <option value="Stuff_1">Solo Stuff Block (1.0)</option>
                    <option value="Stuff_0.5">Assist Block (0.5)</option>
                    <option value="Touch_1">Block Touch</option>
                    <option value="Late_1">Late Block</option>
                    <option value="Net Viol_1">Net Violation</option>
                    <option value="Used_1">Used / Tooled</option>
                  </select>
                )}
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer"
              >
                Save Record
              </button>
            </div>
          </form>
        )}

        {/* SCOPE & FILTER BAR */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
              {/* Match Filter Dropdown */}
              {matches.length > 0 && (
                <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-black uppercase text-slate-400">Match:</span>
                  <select
                    value={selectedMatchId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedMatchId(val);
                      setSelectedSetId("all");
                    }}
                    className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer max-w-[180px] sm:max-w-[240px] truncate"
                  >
                    <option value="all">── All Matches ──</option>
                    {matches.map((m) => (
                      <option key={m.id} value={m.id}>
                        {getMatchLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Set Filter Dropdown */}
              <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-black uppercase text-slate-400">Set:</span>
                <select
                  value={selectedSetId}
                  onChange={(e) => setSelectedSetId(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                >
                  <option value="all">All Sets</option>
                  {availableSetsForMatch.map((s) => (
                    <option key={s.id} value={s.id}>
                      Set {s.setNum || 1} {s.scoreUcc !== undefined ? `(${s.scoreUcc}-${s.scoreOpp})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Player Filter Dropdown */}
              <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-black uppercase text-slate-400">Player:</span>
                <select
                  value={filterPlayer}
                  onChange={(e) => setFilterPlayer(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer max-w-[140px] truncate"
                >
                  <option value="all">All Players</option>
                  {roster.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.number || "-"} {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Box */}
              <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs flex-1 min-w-[150px]">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search stats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none w-full"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-bold overflow-x-auto">
              {["all", "Pass", "Attack", "Serve", "Block", "Dig"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1 rounded-lg transition-all capitalize cursor-pointer ${
                    filterCategory === cat ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {cat === "all" ? "All" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stat Summary Badges */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-[11px] font-bold text-slate-600">
            <span className="text-slate-400 uppercase font-black text-[10px] tracking-wider">Filtered View:</span>
            <span className="bg-slate-200/80 px-2 py-0.5 rounded-md text-slate-800 font-mono">
              <strong>{filteredStats.length}</strong> events
            </span>
            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-md border border-green-200">
              Kills: <strong>{summaryMetrics.kills}</strong> (Errors: {summaryMetrics.attackErrors})
            </span>
            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md border border-purple-200">
              Aces: <strong>{summaryMetrics.aces}</strong> (Errors: {summaryMetrics.serveErrors})
            </span>
            <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md border border-teal-200">
              Blocks: <strong>{summaryMetrics.blocks}</strong>
            </span>
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
              Digs: <strong>{summaryMetrics.digs}</strong>
            </span>
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200">
              Pass Avg: <strong>{summaryMetrics.passAvg}</strong> ({summaryMetrics.passCount})
            </span>
          </div>
        </div>

        {/* STATS EVENT LOG TABLE / LIST */}
        <div className="flex-1 overflow-auto bg-slate-100 min-h-0 divide-y divide-slate-200">
          {filteredStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <AlertCircle size={40} className="mb-2 opacity-50" />
              <p className="font-bold text-sm">No recorded stats match the current filters</p>
              <span className="text-xs mt-1">Try switching matches, sets, or categories, or click "+ Add Stat" to insert a record</span>
            </div>
          ) : (
            filteredStats.map((stat) => {
              const isEditing = editingStatId === stat.id;
              const player = roster.find((r) => r.id === stat.playerId);
              const playerName = stat.isOpponent
                ? `Opponent #${stat.playerId}`
                : player
                  ? `#${player.number || "-"} ${player.name}`
                  : stat.playerId;

              const statMatch = matches.find((m) => m.id === stat.matchId);
              const statSet = sets.find((s) => s.id === stat.setId);

              const timeFormatted = stat.timestamp
                ? new Date(stat.timestamp).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "Just now";

              return (
                <div
                  key={stat.id}
                  className={`p-3 sm:p-4 bg-white hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isEditing ? "bg-indigo-50/70 border-l-4 border-indigo-600" : ""
                  }`}
                >
                  {isEditing ? (
                    // INLINE EDIT MODE
                    <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="sm:w-44">
                        <label className="block text-[9px] font-black text-slate-400 uppercase">Player</label>
                        {!stat.isOpponent ? (
                          <select
                            value={editPlayerId}
                            onChange={(e) => setEditPlayerId(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-bold"
                          >
                            {roster.map((p) => (
                              <option key={p.id} value={p.id}>
                                #{p.number || "-"} {p.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={editPlayerId}
                            onChange={(e) => setEditPlayerId(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-bold"
                          />
                        )}
                      </div>

                      <div className="sm:w-28">
                        <label className="block text-[9px] font-black text-slate-400 uppercase">Category</label>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-bold"
                        >
                          <option value="Attack">Attack</option>
                          <option value="Pass">Pass</option>
                          <option value="Serve">Serve</option>
                          <option value="Dig">Dig</option>
                          <option value="Block">Block</option>
                        </select>
                      </div>

                      <div className="flex-1">
                        <label className="block text-[9px] font-black text-slate-400 uppercase">Metric / Value</label>
                        {editCategory === "Pass" ? (
                          <div className="flex gap-1">
                            {[3, 2, 1, 0].map((v) => (
                              <button
                                type="button"
                                key={v}
                                onClick={() => setEditValue(v)}
                                className={`flex-1 py-1 rounded text-xs font-bold ${
                                  editValue === v ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        ) : editCategory === "Attack" ? (
                          <div className="flex gap-1">
                            <select
                              value={editMetric}
                              onChange={(e) => setEditMetric(e.target.value)}
                              className="flex-1 bg-white border border-slate-300 rounded p-1.5 text-xs font-bold"
                            >
                              <option value="Kill">Kill</option>
                              <option value="Swing">Swing</option>
                              <option value="Out">Out</option>
                              <option value="Net">Net</option>
                              <option value="Blocked">Blocked</option>
                              <option value="Stuffed">Stuffed</option>
                            </select>
                            <select
                              value={editRow}
                              onChange={(e) => setEditRow(e.target.value)}
                              className="w-20 bg-white border border-slate-300 rounded p-1.5 text-xs font-bold"
                            >
                              <option value="Front">Front</option>
                              <option value="Back">Back</option>
                            </select>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={editMetric}
                            onChange={(e) => setEditMetric(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-bold"
                          />
                        )}
                      </div>

                      {availableSetsForMatch.length > 0 && (
                        <div className="sm:w-28">
                          <label className="block text-[9px] font-black text-slate-400 uppercase">Set</label>
                          <select
                            value={editSetId}
                            onChange={(e) => setEditSetId(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-bold"
                          >
                            {availableSetsForMatch.map((s) => (
                              <option key={s.id} value={s.id}>
                                Set {s.setNum || 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 self-end sm:self-center mt-2 sm:mt-4">
                        <button
                          onClick={() => handleSaveEdit(stat.id)}
                          className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm cursor-pointer"
                          title="Save Changes"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg cursor-pointer"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // VIEW EVENT ROW
                    <>
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <span className="text-[11px] font-mono text-slate-400 w-16 sm:w-18 shrink-0">
                          {timeFormatted}
                        </span>

                        <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider border shrink-0 ${getCategoryColor(stat.category)}`}>
                          {stat.category}
                        </span>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-800 text-sm">
                              {playerName}
                            </span>
                            {/* Match & Set tag */}
                            {(statMatch || statSet) && (
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 flex items-center gap-1">
                                {statMatch && statMatch.opponent && (
                                  <span>vs {statMatch.opponent}</span>
                                )}
                                {statSet && (
                                  <span>• Set {statSet.setNum || 1}</span>
                                )}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 font-medium">
                            {stat.category === "Pass" ? (
                              <>Rating: <strong className="text-blue-700 font-black">{stat.value}</strong></>
                            ) : stat.category === "Attack" ? (
                              <>{stat.metric} {stat.row ? `(${stat.row} Row)` : ""}</>
                            ) : stat.category === "Block" ? (
                              <>{stat.metric} {stat.value ? `(${stat.value === 0.5 ? "Assist" : "Solo"})` : ""}</>
                            ) : (
                              <>{stat.metric}</>
                            )}
                          </span>
                        </div>
                      </div>

                      {!isReadOnly && (
                        <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                          <button
                            onClick={() => handleStartEdit(stat)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Stat"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this recorded stat?")) {
                                onDeleteStat(stat.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Stat"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-500">
            Showing {filteredStats.length} logged events.
          </span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-black px-6 py-2 rounded-xl text-xs sm:text-sm uppercase tracking-wider transition-colors active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>
        </>
        )}

      </div>
    </div>
  );
};
