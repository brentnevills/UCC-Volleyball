import React, { useState, useEffect } from "react";
import {
  X,
  History,
  RotateCcw,
  Download,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
  HardDrive,
  Database,
  Calendar,
  Users,
  Shield,
  UploadCloud,
  FileJson,
  Layers,
} from "lucide-react";
import {
  RollingSnapshotInfo,
  getRollingSnapshots,
  createManualSnapshot,
  restoreRollingSnapshot,
  deleteRollingSnapshot,
} from "../ruggedStorage";

interface RollingSnapshotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTeam: string;
  onRestoreSuccess?: (restoredData: any, uploadToCloud: boolean) => Promise<void>;
  showToast?: (message: string, type?: "info" | "success" | "warning" | "error") => void;
  syncLocalGamesToCloud?: (isManualTrigger?: boolean) => Promise<void>;
  currentAppData?: any;
}

export const RollingSnapshotsModal: React.FC<RollingSnapshotsModalProps> = ({
  isOpen,
  onClose,
  activeTeam,
  onRestoreSuccess,
  showToast,
  syncLocalGamesToCloud,
  currentAppData,
}) => {
  const [snapshots, setSnapshots] = useState<RollingSnapshotInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<"current" | "all">("current");
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);

  // Manual snapshot capture state
  const [isCapturing, setIsCapturing] = useState(false);
  const [manualNote, setManualNote] = useState("");
  const [showCaptureInput, setShowCaptureInput] = useState(false);

  // Restore confirmation state
  const [selectedSnapshotForRestore, setSelectedSnapshotForRestore] = useState<RollingSnapshotInfo | null>(null);
  const [uploadToCloudOnRestore, setUploadToCloudOnRestore] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const list = await getRollingSnapshots(teamFilter === "all" ? "all" : activeTeam);
      setSnapshots(list);
    } catch (err) {
      console.warn("Error fetching snapshots:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSnapshots();
    }
  }, [isOpen, activeTeam, teamFilter]);

  if (!isOpen) return null;

  const handleCaptureSnapshot = async () => {
    if (!currentAppData) return;
    setIsCapturing(true);
    try {
      const note = manualNote.trim() || `Manual Checkpoint (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
      await createManualSnapshot(activeTeam, currentAppData, note);
      setManualNote("");
      setShowCaptureInput(false);
      if (showToast) {
        showToast("New rolling snapshot captured successfully!", "success");
      }
      await fetchSnapshots();
    } catch (err) {
      console.error("Capture snapshot error:", err);
      if (showToast) {
        showToast("Could not capture snapshot", "error");
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!selectedSnapshotForRestore) return;
    setIsRestoring(true);
    try {
      const targetTeam = selectedSnapshotForRestore.teamId || activeTeam;
      const success = await restoreRollingSnapshot(targetTeam, selectedSnapshotForRestore.data);

      if (success) {
        if (onRestoreSuccess) {
          await onRestoreSuccess(selectedSnapshotForRestore.data, uploadToCloudOnRestore);
        } else if (uploadToCloudOnRestore && syncLocalGamesToCloud) {
          await syncLocalGamesToCloud(true);
        }

        const matchCount = selectedSnapshotForRestore.matchesCount;
        const statCount = selectedSnapshotForRestore.statsCount;
        if (showToast) {
          showToast(
            `Snapshot restored! Recovered ${matchCount} game(s) and ${statCount} stat(s).`,
            "success"
          );
        }
        setSelectedSnapshotForRestore(null);
        onClose();
      } else {
        throw new Error("Restoration failed");
      }
    } catch (err: any) {
      console.error("Restore snapshot error:", err);
      if (showToast) {
        showToast("Failed to restore snapshot: " + (err?.message || "Unknown error"), "error");
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDownloadSnapshotJson = (snap: RollingSnapshotInfo) => {
    try {
      const exportData = {
        snapshotId: snap.id,
        teamId: snap.teamId,
        createdAt: snap.createdAt,
        date: snap.dateFormatted,
        source: snap.source,
        note: snap.note,
        matchesCount: snap.matchesCount,
        statsCount: snap.statsCount,
        payload: snap.data,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cleanDate = (snap.dateFormatted || "snapshot").replace(/[^a-zA-Z0-9]/g, "_");
      a.download = `ucc_snapshot_${snap.teamId}_${cleanDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (showToast) {
        showToast("Snapshot downloaded as JSON file", "success");
      }
    } catch (err) {
      console.error("Export snapshot error:", err);
    }
  };

  const handleDeleteSnapshot = async (snapId: string) => {
    if (!window.confirm("Are you sure you want to remove this historical snapshot from local storage?")) {
      return;
    }
    const success = await deleteRollingSnapshot(snapId);
    if (success) {
      setSnapshots((prev) => prev.filter((s) => s.id !== snapId));
      if (showToast) showToast("Snapshot removed", "info");
    }
  };

  const filteredSnapshots = snapshots.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchTitlesMatch = (s.matchTitles || []).some((t) => t.toLowerCase().includes(q));
    const noteMatch = (s.note || "").toLowerCase().includes(q);
    const dateMatch = s.dateFormatted.toLowerCase().includes(q);
    const sourceMatch = s.source.toLowerCase().includes(q);
    const teamMatch = s.teamId.toLowerCase().includes(q);
    return matchTitlesMatch || noteMatch || dateMatch || sourceMatch || teamMatch;
  });

  return (
    <div className="fixed inset-0 z-[280] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 text-white">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-[#001b5e] to-slate-950 px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <History size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg tracking-wider uppercase text-white">
                  Rolling Snapshots & Data Recovery
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Zero Data Loss
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Inspect automated snapshots saved before resyncs and during offline games. Restore any point with 1 click.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Close snapshots viewer"
            aria-label="Close snapshots viewer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="bg-slate-800/80 px-4 sm:px-6 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search games, opponents, dates, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Team filter toggle */}
            <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-700 text-[11px] font-bold shrink-0">
              <button
                type="button"
                onClick={() => setTeamFilter("current")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  teamFilter === "current"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Current Team
              </button>
              <button
                type="button"
                onClick={() => setTeamFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  teamFilter === "all"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All Teams
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchSnapshots}
              disabled={loading}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh snapshot list"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCaptureInput((prev) => !prev)}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Camera size={14} />
              <span>Capture Point</span>
            </button>
          </div>
        </div>

        {/* Inline Manual Snapshot Capture Drawer */}
        {showCaptureInput && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 p-4 animate-in slide-in-from-top-2 duration-150 shrink-0">
            <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                placeholder="Snapshot label/note (e.g., 'Before Tournament Final', 'Set 2 Checkpoint')"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-amber-400"
                autoFocus
              />
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  disabled={isCapturing}
                  className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>{isCapturing ? "Saving..." : "Save Snapshot"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCaptureInput(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Snapshot List Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 custom-scrollbar">
          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <RefreshCw size={28} className="animate-spin mx-auto text-indigo-400" />
              <p className="text-sm font-semibold">Scanning local storage tiers for snapshots...</p>
            </div>
          ) : filteredSnapshots.length === 0 ? (
            <div className="py-12 px-4 text-center max-w-md mx-auto space-y-3 border border-dashed border-slate-700 rounded-3xl bg-slate-800/40">
              <Shield size={36} className="text-amber-400 mx-auto" />
              <h4 className="text-base font-black uppercase tracking-wider text-white">
                No Snapshots Found for this Filter
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Snapshots are automatically recorded every time you log a stat, finish a set, start a match, or before you resync with Firebase.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setTeamFilter("all");
                }}
                className="text-indigo-400 hover:text-indigo-300 text-xs font-bold underline cursor-pointer"
              >
                Clear search and view all teams
              </button>
            </div>
          ) : (
            filteredSnapshots.map((snap, idx) => {
              const isExpanded = expandedSnapshotId === snap.id;
              const matches = Array.isArray(snap.data?.matches) ? snap.data.matches : [];
              const sets = Array.isArray(snap.data?.sets) ? snap.data.sets : [];
              const stats = Array.isArray(snap.data?.stats) ? snap.data.stats : [];
              const roster = Array.isArray(snap.data?.roster) ? snap.data.roster : [];

              const isPreResync = snap.source === "Pre-Resync Snapshot" || snap.id.includes("pre_resync");
              const isManual = snap.source === "Manual Snapshot" || snap.id.startsWith("manual_");

              return (
                <div
                  key={snap.id || idx}
                  className={`bg-slate-800/90 border rounded-2xl p-4 transition-all duration-150 ${
                    isPreResync
                      ? "border-emerald-500/50 shadow-md shadow-emerald-950/30"
                      : isManual
                      ? "border-amber-500/40 shadow-md shadow-amber-950/20"
                      : "border-slate-700 hover:border-slate-600"
                  }`}
                >
                  {/* Top Bar of Card */}
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                            isPreResync
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : isManual
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                          }`}
                        >
                          {snap.source}
                        </span>

                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          <span>{snap.dateFormatted}</span>
                        </span>

                        {snap.teamId && (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-700">
                            Team: {snap.teamId}
                          </span>
                        )}
                      </div>

                      {snap.note && (
                        <div className="text-xs font-black text-amber-300 flex items-center gap-1.5 pt-0.5">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                          <span>{snap.note}</span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedSnapshotForRestore(snap)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                        title="Restore all games, sets, and stats from this snapshot"
                      >
                        <RotateCcw size={13} />
                        <span>Restore This</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedSnapshotId(isExpanded ? null : snap.id)}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Inspect snapshot contents"
                      >
                        <span>{isExpanded ? "Hide" : "Inspect"}</span>
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadSnapshotJson(snap)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                        title="Download JSON file for this snapshot"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-700/60 text-center">
                    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Matches / Games</div>
                      <div className="text-base font-black text-white mt-0.5">{snap.matchesCount}</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sets Played</div>
                      <div className="text-base font-black text-white mt-0.5">{snap.setsCount}</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stat Events</div>
                      <div className="text-base font-black text-indigo-400 mt-0.5">{snap.statsCount}</div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Roster Players</div>
                      <div className="text-base font-black text-white mt-0.5">{snap.rosterCount}</div>
                    </div>
                  </div>

                  {/* Match Titles Preview */}
                  {snap.matchTitles && snap.matchTitles.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">Games:</span>
                      {snap.matchTitles.slice(0, 5).map((title, i) => (
                        <span
                          key={i}
                          className="bg-slate-900 border border-slate-700 text-slate-200 px-2 py-0.5 rounded-md font-semibold"
                        >
                          {title}
                        </span>
                      ))}
                      {snap.matchTitles.length > 5 && (
                        <span className="text-slate-400 font-semibold text-[10px]">
                          +{snap.matchTitles.length - 5} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expanded Inspector Drawer */}
                  {isExpanded && (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-700/80 space-y-3 animate-in fade-in-50 duration-150">
                      {/* Games Breakdown */}
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                          <Layers size={13} className="text-indigo-400" />
                          <span>Detailed Match Records ({matches.length})</span>
                        </div>
                        {matches.length === 0 ? (
                          <div className="text-xs text-slate-400 italic bg-slate-900/50 p-2 rounded-xl">
                            No match objects in this snapshot point.
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {matches.map((m: any, mIdx: number) => {
                              const matchSets = sets.filter((s: any) => s.matchId === m.id);
                              const matchStats = stats.filter((st: any) => st.matchId === m.id);
                              return (
                                <div
                                  key={m.id || mIdx}
                                  className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-2 text-xs flex items-center justify-between gap-2"
                                >
                                  <div>
                                    <span className="font-black text-white mr-2">
                                      vs {m.opponent || "Opponent"}
                                    </span>
                                    <span className="text-slate-400 text-[11px]">
                                      {m.type || "Match"} • {m.format || "Best of 5"} •{" "}
                                      {m.date ? new Date(m.date).toLocaleDateString() : "Date N/A"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 text-[11px]">
                                    <span className="bg-indigo-900/60 border border-indigo-700/60 text-indigo-300 px-2 py-0.5 rounded font-bold">
                                      {matchSets.length} sets
                                    </span>
                                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold">
                                      {matchStats.length} stats
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Roster Preview */}
                      {roster.length > 0 && (
                        <div>
                          <div className="text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Users size={13} className="text-indigo-400" />
                            <span>Roster ({roster.length} athletes)</span>
                          </div>
                          <div className="flex flex-wrap gap-1 text-[11px]">
                            {roster.map((p: any, pIdx: number) => (
                              <span
                                key={p.id || pIdx}
                                className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded"
                              >
                                #{p.number || "-"} {p.name || "Player"}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info & close */}
        <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-emerald-400" />
            <span>Dual-Engine Tier: IndexedDB + LocalStorage Double-Buffer</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      {selectedSnapshotForRestore && (
        <div className="fixed inset-0 z-[290] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-amber-500/50 rounded-3xl shadow-2xl max-w-md w-full p-6 text-white space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                <RotateCcw size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider text-white">
                  Confirm Snapshot Restore
                </h3>
                <p className="text-xs text-slate-300">
                  Restore team data to state from {selectedSnapshotForRestore.dateFormatted}
                </p>
              </div>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-400">Target Team:</span>
                <span className="font-black text-white">{selectedSnapshotForRestore.teamId || activeTeam}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-400">Matches / Games:</span>
                <span className="font-black text-emerald-400">{selectedSnapshotForRestore.matchesCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-400">Sets Recorded:</span>
                <span className="font-black text-emerald-400">{selectedSnapshotForRestore.setsCount}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Total Stat Events:</span>
                <span className="font-black text-indigo-400">{selectedSnapshotForRestore.statsCount}</span>
              </div>
            </div>

            <label className="flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/80 p-3 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={uploadToCloudOnRestore}
                onChange={(e) => setUploadToCloudOnRestore(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-200">
                Upload and sync restored games & stats to Firebase cloud immediately
              </span>
            </label>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setSelectedSnapshotForRestore(null)}
                disabled={isRestoring}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
              >
                <RotateCcw size={14} className={isRestoring ? "animate-spin" : ""} />
                <span>{isRestoring ? "Restoring..." : "Confirm & Restore"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
