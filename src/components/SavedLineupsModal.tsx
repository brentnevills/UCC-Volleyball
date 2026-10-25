import React, { useState, useMemo } from "react";
import {
  Users,
  Shield,
  Save,
  Trash2,
  Edit3,
  Check,
  X,
  Plus,
  ArrowRightLeft,
  Copy,
  ChevronDown,
  Sparkles,
  Search,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

export interface LineupPreset {
  lineup: (string | null)[];
  liberoId?: string | null;
  updatedAt?: string;
  notes?: string;
}

interface SavedLineupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedLineups: Record<string, LineupPreset>;
  roster: Array<{
    id: string;
    name: string;
    number: string;
    position?: string;
    isRetired?: boolean;
  }>;
  currentCourtLineup: (string | null)[];
  currentLiberoId: string;
  onSaveLineup: (
    name: string,
    lineup: (string | null)[],
    liberoId: string,
    notes?: string,
  ) => void;
  onDeleteLineup: (name: string) => void;
  onRenameLineup: (oldName: string, newName: string) => void;
  onLoadLineup: (name: string, preset: LineupPreset) => void;
  contextTitle?: string;
}

export const SavedLineupsModal: React.FC<SavedLineupsModalProps> = ({
  isOpen,
  onClose,
  savedLineups = {},
  roster = [],
  currentCourtLineup = [null, null, null, null, null, null],
  currentLiberoId = "",
  onSaveLineup,
  onDeleteLineup,
  onRenameLineup,
  onLoadLineup,
  contextTitle = "Saved Lineups",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const [editingNameKey, setEditingNameKey] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  // Custom builder state
  const [builderName, setBuilderName] = useState("");
  const [builderLineup, setBuilderLineup] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
    null,
    null,
  ]);
  const [builderLibero, setBuilderLibero] = useState("");

  const rosterMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; number: string; position?: string }>();
    roster.forEach((p) => {
      map.set(p.id, p);
    });
    return map;
  }, [roster]);

  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => {
      const numA = parseInt(a.number, 10);
      const numB = parseInt(b.number, 10);
      if (isNaN(numA) && isNaN(numB)) return a.name.localeCompare(b.name);
      if (isNaN(numA)) return 1;
      if (isNaN(numB)) return -1;
      return numA - numB;
    });
  }, [roster]);

  const presetList = useMemo(() => {
    const entries = Object.entries(savedLineups || {});
    return entries.filter(([name]) =>
      name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
    );
  }, [savedLineups, searchQuery]);

  const activeStarterCount = useMemo(() => {
    return (currentCourtLineup || []).filter(Boolean).length;
  }, [currentCourtLineup]);

  const quickNameSuggestions = [
    "Starting 6",
    "Rotation 1 (Setter in 1)",
    "Rotation 2",
    "Rotation 3",
    "Rotation 4",
    "Rotation 5",
    "Rotation 6",
    "5-1 Offense",
    "6-2 Rotation",
    "Double Sub",
  ];

  if (!isOpen) return null;

  const handleSaveCurrentCourt = (presetName: string) => {
    const trimmed = presetName.trim();
    if (!trimmed) return;
    onSaveLineup(trimmed, currentCourtLineup, currentLiberoId);
    setNewPresetName("");
  };

  const handleStartRename = (key: string) => {
    setEditingNameKey(key);
    setEditNameValue(key);
  };

  const handleConfirmRename = (oldKey: string) => {
    const trimmed = editNameValue.trim();
    if (trimmed && trimmed !== oldKey) {
      onRenameLineup(oldKey, trimmed);
    }
    setEditingNameKey(null);
  };

  const handleCreateFromBuilder = () => {
    const trimmed = builderName.trim();
    if (!trimmed) return;
    onSaveLineup(trimmed, builderLineup, builderLibero);
    setBuilderName("");
    setBuilderLineup([null, null, null, null, null, null]);
    setBuilderLibero("");
    setShowBuilder(false);
  };

  const getPlayerLabel = (playerId: string | null) => {
    if (!playerId) return "Unassigned";
    const p = rosterMap.get(playerId);
    if (!p) return `Player (${playerId})`;
    return `#${p.number || "-"} ${p.name}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 z-[130] flex items-center justify-center p-2 sm:p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-[2rem] max-w-2xl w-full max-h-[92vh] shadow-2xl flex flex-col my-auto border border-slate-200 overflow-hidden">
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-blue-900 via-[#0033A0] to-indigo-900 p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <Users size={22} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider">
                  {contextTitle}
                </h2>
                <span className="bg-white/20 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/20">
                  {Object.keys(savedLineups || {}).length} Saved
                </span>
              </div>
              <p className="text-xs text-blue-200 font-medium">
                Save, load, and manage starting 6 court rotations & liberos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
          {/* QUICK SAVE CURRENT COURT CARD */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-200 shadow-sm bg-gradient-to-br from-blue-50/50 to-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Save size={16} className="text-[#0033A0]" />
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                  Save Active Court As Lineup Preset
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
                {activeStarterCount}/6 Assigned
              </span>
            </div>

            {/* Current Court mini summary */}
            <div className="bg-slate-900 text-white rounded-xl p-3 mb-3 text-xs">
              <div className="flex items-center justify-between text-[10px] font-black text-amber-400 uppercase tracking-widest pb-1 mb-2 border-b border-white/10">
                <span>Active Court Starters</span>
                <span className="text-slate-300">
                  Libero:{" "}
                  {currentLiberoId ? (
                    <span className="text-amber-400 font-black">
                      {getPlayerLabel(currentLiberoId)}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">None</span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-white/10 rounded px-1.5 py-1 text-[11px] font-bold truncate">
                  <span className="text-[9px] text-blue-300 block">P4 (LF)</span>
                  {getPlayerLabel(currentCourtLineup[3])}
                </div>
                <div className="bg-white/10 rounded px-1.5 py-1 text-[11px] font-bold truncate">
                  <span className="text-[9px] text-blue-300 block">P3 (MF)</span>
                  {getPlayerLabel(currentCourtLineup[2])}
                </div>
                <div className="bg-white/10 rounded px-1.5 py-1 text-[11px] font-bold truncate">
                  <span className="text-[9px] text-blue-300 block">P2 (RF)</span>
                  {getPlayerLabel(currentCourtLineup[1])}
                </div>
                <div className="bg-white/10 rounded px-1.5 py-1 text-[11px] font-bold truncate">
                  <span className="text-[9px] text-amber-300 block">P5 (LB)</span>
                  {getPlayerLabel(currentCourtLineup[4])}
                </div>
                <div className="bg-white/10 rounded px-1.5 py-1 text-[11px] font-bold truncate">
                  <span className="text-[9px] text-amber-300 block">P6 (MB)</span>
                  {getPlayerLabel(currentCourtLineup[5])}
                </div>
                <div className="bg-amber-500/20 border border-amber-400/40 rounded px-1.5 py-1 text-[11px] font-bold truncate">
                  <span className="text-[9px] text-amber-300 block">P1 (SRV)</span>
                  {getPlayerLabel(currentCourtLineup[0])}
                </div>
              </div>
            </div>

            {/* Input & Save Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                placeholder="Enter preset name (e.g. Starting 6, Rotation 1)..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPresetName.trim()) {
                    handleSaveCurrentCourt(newPresetName);
                  }
                }}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#0033A0] focus:ring-2 focus:ring-[#0033A0]/20 shadow-xs"
              />
              <button
                type="button"
                onClick={() => handleSaveCurrentCourt(newPresetName)}
                disabled={!newPresetName.trim()}
                className="bg-[#0033A0] hover:bg-blue-800 disabled:opacity-50 disabled:pointer-events-none text-white px-4 py-2 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Save size={15} />
                <span>Save Lineup</span>
              </button>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">
                Suggestions:
              </span>
              {quickNameSuggestions.slice(0, 5).map((sugg) => (
                <button
                  key={sugg}
                  type="button"
                  onClick={() => setNewPresetName(sugg)}
                  className="bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-900 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                >
                  +{sugg}
                </button>
              ))}
            </div>
          </div>

          {/* BUILD CUSTOM PRESET EXPANDER */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowBuilder((prev) => !prev)}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left text-xs font-black uppercase tracking-wider text-slate-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Plus size={15} className="text-[#0033A0]" />
                <span>Build New Lineup From Scratch</span>
              </span>
              <ChevronDown
                size={16}
                className={`transform transition-transform ${showBuilder ? "rotate-180" : ""}`}
              />
            </button>

            {showBuilder && (
              <div className="p-4 sm:p-5 space-y-4 border-t border-slate-200 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Lineup Preset Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 6-2 Rotation 1, Double Sub..."
                      value={builderName}
                      onChange={(e) => setBuilderName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Designated Libero
                    </label>
                    <select
                      value={builderLibero}
                      onChange={(e) => setBuilderLibero(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
                    >
                      <option value="">No Libero</option>
                      {sortedRoster.map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.number} {p.name} {p.position ? `(${p.position})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 6 Positions Selector */}
                <div className="bg-slate-900 rounded-xl p-3 text-white">
                  <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">
                    Front Row (Net Side)
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { idx: 3, label: "Pos 4 • LF" },
                      { idx: 2, label: "Pos 3 • MF" },
                      { idx: 1, label: "Pos 2 • RF" },
                    ].map(({ idx, label }) => (
                      <div key={idx} className="bg-white/10 rounded-lg p-2 border border-white/10">
                        <span className="text-[9px] font-black text-blue-300 block mb-1 uppercase">
                          {label}
                        </span>
                        <select
                          value={builderLineup[idx] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBuilderLineup((prev) => {
                              const n = [...prev];
                              n[idx] = val || null;
                              return n;
                            });
                          }}
                          className="w-full bg-slate-800 text-white text-xs font-bold rounded p-1 border border-white/20 outline-none"
                        >
                          <option value="">Select...</option>
                          {sortedRoster.map((p) => (
                            <option key={p.id} value={p.id}>
                              #{p.number} {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Back Row
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { idx: 4, label: "Pos 5 • LB" },
                      { idx: 5, label: "Pos 6 • MB" },
                      { idx: 0, label: "Pos 1 • RB (Server)" },
                    ].map(({ idx, label }) => (
                      <div
                        key={idx}
                        className={`rounded-lg p-2 border ${
                          idx === 0
                            ? "bg-amber-500/15 border-amber-400/40"
                            : "bg-white/10 border-white/10"
                        }`}
                      >
                        <span className="text-[9px] font-black text-amber-300 block mb-1 uppercase">
                          {label}
                        </span>
                        <select
                          value={builderLineup[idx] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBuilderLineup((prev) => {
                              const n = [...prev];
                              n[idx] = val || null;
                              return n;
                            });
                          }}
                          className="w-full bg-slate-800 text-white text-xs font-bold rounded p-1 border border-white/20 outline-none"
                        >
                          <option value="">Select...</option>
                          {sortedRoster.map((p) => (
                            <option key={p.id} value={p.id}>
                              #{p.number} {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBuilder(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateFromBuilder}
                    disabled={!builderName.trim()}
                    className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Check size={14} />
                    <span>Create Lineup Preset</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SAVED PRESETS LIST HEADER & SEARCH */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>Existing Lineup Presets</span>
                <span className="text-slate-400 font-bold text-xs">
                  ({presetList.length})
                </span>
              </h3>
            </div>
            <div className="relative w-full sm:w-60">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search presets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* PRESETS LIST */}
          {presetList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
                <Users size={24} />
              </div>
              <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-1">
                {searchQuery ? "No Lineups Match Your Search" : "No Lineups Saved Yet"}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                {searchQuery
                  ? "Try clearing your search query to see all saved lineups."
                  : "Save your active 6-player starting court rotation and libero above to quickly load it before matches or between sets."}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSaveCurrentCourt("Starting 6")}
                  className="bg-[#0033A0] hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95"
                >
                  Save Active Court as "Starting 6"
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {presetList.map(([name, preset]) => {
                const isEditing = editingNameKey === name;
                const isDeleting = deleteConfirmKey === name;
                const presetLineup = Array.isArray(preset.lineup) ? preset.lineup : [];
                const presetLiberoId = preset.liberoId || "";

                return (
                  <div
                    key={name}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-blue-300 transition-all flex flex-col gap-3"
                  >
                    {/* Top Row: Name, Libero Badge, and Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={editNameValue}
                              onChange={(e) => setEditNameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleConfirmRename(name);
                                if (e.key === "Escape") setEditingNameKey(null);
                              }}
                              className="bg-slate-50 border border-blue-400 rounded-lg px-2.5 py-1 text-sm font-black text-slate-900 outline-none flex-1"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleConfirmRename(name)}
                              className="p-1 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg border border-green-200"
                              title="Save Name"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNameKey(null)}
                              className="p-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-black text-sm sm:text-base text-slate-900 truncate">
                              {name}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartRename(name)}
                              className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                              title="Rename preset"
                            >
                              <Edit3 size={13} />
                            </button>
                          </div>
                        )}

                        {presetLiberoId && (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-[#0033A0] border border-blue-200 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                            <Shield size={10} />
                            <span>Libero: {getPlayerLabel(presetLiberoId)}</span>
                          </span>
                        )}
                      </div>

                      {/* Right action buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            onSaveLineup(name, currentCourtLineup, currentLiberoId);
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1"
                          title="Overwrite this preset with active court starters"
                        >
                          <RotateCcw size={11} />
                          <span className="hidden sm:inline">Update with Court</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onLoadLineup(name, preset)}
                          className="px-3 py-1.5 bg-[#0033A0] hover:bg-blue-800 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check size={14} />
                          <span>Load Lineup</span>
                        </button>

                        {isDeleting ? (
                          <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200">
                            <span className="text-[10px] font-black text-red-600 uppercase px-1">
                              Delete?
                            </span>
                            <button
                              type="button"
                              onClick={() => onDeleteLineup(name)}
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded font-black text-[10px] uppercase"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmKey(null)}
                              className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold text-[10px]"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmKey(name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete preset"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mini Court Layout */}
                    <div className="bg-slate-900 rounded-xl p-2.5 text-white">
                      <div className="flex items-center justify-between text-[9px] font-black text-amber-400 uppercase tracking-widest pb-1 mb-1.5 border-b border-white/10">
                        <span>Net • Front Row</span>
                        <span className="text-slate-400 font-medium">
                          LF • MF • RF
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
                        <div className="bg-white/10 rounded px-1.5 py-1 truncate">
                          <span className="text-[8px] text-blue-300 block font-black">
                            POS 4 (LF)
                          </span>
                          <span className="text-[11px] font-bold">
                            {getPlayerLabel(presetLineup[3])}
                          </span>
                        </div>
                        <div className="bg-white/10 rounded px-1.5 py-1 truncate">
                          <span className="text-[8px] text-blue-300 block font-black">
                            POS 3 (MF)
                          </span>
                          <span className="text-[11px] font-bold">
                            {getPlayerLabel(presetLineup[2])}
                          </span>
                        </div>
                        <div className="bg-white/10 rounded px-1.5 py-1 truncate">
                          <span className="text-[8px] text-blue-300 block font-black">
                            POS 2 (RF)
                          </span>
                          <span className="text-[11px] font-bold">
                            {getPlayerLabel(presetLineup[1])}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest pb-1 mb-1.5 border-b border-white/10">
                        <span>Back Row</span>
                        <span className="text-slate-400 font-medium">
                          LB • MB • RB
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="bg-white/10 rounded px-1.5 py-1 truncate">
                          <span className="text-[8px] text-amber-300 block font-black">
                            POS 5 (LB)
                          </span>
                          <span className="text-[11px] font-bold">
                            {getPlayerLabel(presetLineup[4])}
                          </span>
                        </div>
                        <div className="bg-white/10 rounded px-1.5 py-1 truncate">
                          <span className="text-[8px] text-amber-300 block font-black">
                            POS 6 (MB)
                          </span>
                          <span className="text-[11px] font-bold">
                            {getPlayerLabel(presetLineup[5])}
                          </span>
                        </div>
                        <div className="bg-amber-500/20 border border-amber-400/40 rounded px-1.5 py-1 truncate">
                          <span className="text-[8px] text-amber-300 block font-black flex items-center justify-center gap-1">
                            POS 1 (RB)
                            <span className="bg-amber-400 text-slate-950 px-1 py-0.2 rounded text-[7px] font-black">
                              SRV
                            </span>
                          </span>
                          <span className="text-[11px] font-bold text-amber-100">
                            {getPlayerLabel(presetLineup[0])}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-100 p-3 sm:p-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] font-medium text-slate-500">
            Lineups persist offline and sync to the team cloud automatically.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
