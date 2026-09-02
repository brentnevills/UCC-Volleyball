import React, { useState, useMemo } from "react";
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
} from "lucide-react";

interface StatCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: Array<any>;
  roster: Array<{ id: string; name: string; number?: string; isRetired?: boolean }>;
  activeSetId: string | null;
  activeMatch: any;
  onDeleteStat: (statId: string) => void;
  onUpdateStat: (statId: string, updatedFields: any) => void;
  onAddStat: (statData: any) => void;
}

export const StatCorrectionModal: React.FC<StatCorrectionModalProps> = ({
  isOpen,
  onClose,
  stats,
  roster,
  activeSetId,
  activeMatch,
  onDeleteStat,
  onUpdateStat,
  onAddStat,
}) => {
  const [scope, setScope] = useState<"current_set" | "all_sets">("current_set");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPlayer, setFilterPlayer] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // Add stat form state
  const [newTeam, setNewTeam] = useState<"ucc" | "opp">("ucc");
  const [newPlayerId, setNewPlayerId] = useState<string>("");
  const [newCategory, setNewCategory] = useState<string>("Attack");
  const [newMetric, setNewMetric] = useState<string>("Kill");
  const [newValue, setNewValue] = useState<number>(1);
  const [newRow, setNewRow] = useState<"Front" | "Back">("Front");

  // Inline edit state
  const [editingStatId, setEditingStatId] = useState<string | null>(null);
  const [editPlayerId, setEditPlayerId] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("");
  const [editMetric, setEditMetric] = useState<string>("");
  const [editValue, setEditValue] = useState<number>(1);
  const [editRow, setEditRow] = useState<string>("");

  const filteredStats = useMemo(() => {
    let result = [...stats];

    // Filter by match
    if (activeMatch?.id) {
      result = result.filter((s) => s.matchId === activeMatch.id);
    }

    // Filter by set if current_set is selected
    if (scope === "current_set" && activeSetId) {
      result = result.filter((s) => s.setId === activeSetId);
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
        return (
          playerName.toLowerCase().includes(q) ||
          playerNum.includes(q) ||
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
  }, [stats, activeMatch, activeSetId, scope, filterCategory, filterPlayer, searchQuery, roster]);

  if (!isOpen) return null;

  const handleStartEdit = (stat: any) => {
    setEditingStatId(stat.id);
    setEditPlayerId(stat.playerId);
    setEditCategory(stat.category);
    setEditMetric(stat.metric);
    setEditValue(stat.value ?? 1);
    setEditRow(stat.row || (stat.metric === "Swing Back" ? "Back" : "Front"));
  };

  const handleSaveEdit = (statId: string) => {
    onUpdateStat(statId, {
      playerId: editPlayerId,
      category: editCategory,
      metric: editMetric,
      value: editValue,
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

    onAddStat({
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

  return (
    <div className="fixed inset-0 z-[160] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-6 overflow-hidden">
      <div className="bg-white w-full max-w-5xl h-[94vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Edit3 className="text-amber-400" size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-black uppercase tracking-wider flex items-center gap-2">
                Data Correction & Stat Log
              </h2>
              <p className="text-xs sm:text-sm text-indigo-200 font-bold">
                Review, correct, delete, or add missing stats in real-time
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            >
              <PlusCircle size={16} />
              <span>{showAddForm ? "Cancel Add" : "Add Stat"}</span>
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

        {/* ADD MISSED STAT FORM */}
        {showAddForm && (
          <form
            onSubmit={handleCreateStat}
            className="bg-indigo-50 border-b border-indigo-200 p-4 shrink-0 animate-in slide-in-from-top-2"
          >
            <div className="font-black text-indigo-950 uppercase text-xs tracking-wider mb-3 flex items-center justify-between">
              <span>Manual Stat Entry</span>
              <span className="text-slate-500 font-normal lowercase text-[11px]">
                Target: {scope === "current_set" ? "Current Set" : "Match"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-3">
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
                  <option value="ucc">Lancers</option>
                  <option value="opp">Opponent</option>
                </select>
              </div>

              {/* Player Selector */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Player</label>
                {newTeam === "ucc" ? (
                  <select
                    value={newPlayerId}
                    onChange={(e) => setNewPlayerId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                  >
                    <option value="">-- Select Player --</option>
                    {roster.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.number || "-"} {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Opponent Jersey #"
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

              {/* Metric / Value based on category */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Metric / Action</label>
                {newCategory === "Pass" ? (
                  <div className="flex gap-1.5">
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
                      <option value="Kill">Kill (Point)</option>
                      <option value="Swing">Swing (In Play)</option>
                      <option value="Out">Out (Error)</option>
                      <option value="Net">Net (Error)</option>
                      <option value="Blocked">Blocked (Play On)</option>
                      <option value="Stuffed">Stuffed (Blocked Error)</option>
                    </select>
                    <select
                      value={newRow}
                      onChange={(e) => setNewRow(e.target.value as "Front" | "Back")}
                      className="w-20 bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                    >
                      <option value="Front">Front</option>
                      <option value="Back">Back</option>
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
                    <option value="Touch_1">Block Touch / Play On</option>
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
                className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-sm"
              >
                Save Record
              </button>
            </div>
          </form>
        )}

        {/* FILTERS & SEARCH BAR */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 w-full sm:w-64 shadow-sm">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search stats, players..."
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

            {/* Scope toggle */}
            {activeSetId && (
              <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-sm text-xs font-bold shrink-0">
                <button
                  onClick={() => setScope("current_set")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    scope === "current_set" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Current Set
                </button>
                <button
                  onClick={() => setScope("all_sets")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    scope === "all_sets" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Sets
                </button>
              </div>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm text-xs font-bold overflow-x-auto">
            {["all", "Pass", "Attack", "Serve", "Block", "Dig"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 rounded-lg transition-all capitalize ${
                  filterCategory === cat ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {cat === "all" ? "All Categories" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* STATS EVENT LOG TABLE / LIST */}
        <div className="flex-1 overflow-auto bg-slate-100 min-h-0 divide-y divide-slate-200">
          {filteredStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <AlertCircle size={40} className="mb-2 opacity-50" />
              <p className="font-bold text-sm">No recorded stats match current filters</p>
              <span className="text-xs mt-1">Try switching to &quot;All Sets&quot; or changing categories</span>
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
                      <div className="sm:w-48">
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

                      <div className="sm:w-32">
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
                        <label className="block text-[9px] font-black text-slate-400 uppercase">Metric</label>
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

                      <div className="flex items-center gap-1.5 self-end sm:self-center mt-2 sm:mt-4">
                        <button
                          onClick={() => handleSaveEdit(stat.id)}
                          className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm"
                          title="Save Changes"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // VIEW EVENT ROW
                    <>
                      <div className="flex items-center space-x-3">
                        <span className="text-[11px] font-mono text-slate-400 w-18 shrink-0">
                          {timeFormatted}
                        </span>

                        <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider border shrink-0 ${getCategoryColor(stat.category)}`}>
                          {stat.category}
                        </span>

                        <div className="flex flex-col">
                          <span className="font-black text-slate-800 text-sm">
                            {playerName}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {stat.category === "Pass" ? (
                              <>Rating: <strong className="text-blue-700">{stat.value}</strong></>
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

                      <div className="flex items-center space-x-2 self-end sm:self-center">
                        <button
                          onClick={() => handleStartEdit(stat)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit Stat"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => onDeleteStat(stat.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Stat"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
            className="bg-slate-800 hover:bg-slate-700 text-white font-black px-6 py-2 rounded-xl text-xs sm:text-sm uppercase tracking-wider transition-colors active:scale-95"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
