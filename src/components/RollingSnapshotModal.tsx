import React, { useState, useEffect } from "react";
import {
  History,
  RotateCcw,
  Clock,
  HardDrive,
  Download,
  Upload,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Shield,
  Activity,
  AlertTriangle,
  RefreshCw,
  Eye,
  Layers,
} from "lucide-react";
import {
  getRollingSnapshots,
  createManualSnapshot,
  RollingSnapshotInfo,
} from "../ruggedStorage";

interface RollingSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTeam: string;
  currentAppData: any;
  onRestoreData: (restoredData: any, shouldUploadToCloud: boolean) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const RollingSnapshotModal: React.FC<RollingSnapshotModalProps> = ({
  isOpen,
  onClose,
  activeTeam,
  currentAppData,
  onRestoreData,
  showToast,
}) => {
  const [snapshots, setSnapshots] = useState<RollingSnapshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);
  const [confirmingRestoreSnapshot, setConfirmingRestoreSnapshot] = useState<RollingSnapshotInfo | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [uploadAfterRestore, setUploadAfterRestore] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const list = await getRollingSnapshots(activeTeam);
      setSnapshots(list);
    } catch (e) {
      console.warn("Failed to load rolling snapshots:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSnapshots();
      setExpandedSnapshotId(null);
      setConfirmingRestoreSnapshot(null);
    }
  }, [isOpen, activeTeam]);

  if (!isOpen) return null;

  const handleCaptureSnapshotNow = async () => {
    setIsCapturing(true);
    try {
      await createManualSnapshot(activeTeam, currentAppData, "Manual snapshot point");
      showToast("Snapshot saved successfully to local device!", "success");
      await fetchSnapshots();
    } catch {
      showToast("Could not create snapshot", "error");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDownloadSnapshotJson = (snap: RollingSnapshotInfo) => {
    try {
      const jsonStr = JSON.stringify(snap.data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const datePart = new Date(snap.createdAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `snapshot_${snap.teamId}_${datePart}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Snapshot JSON downloaded!", "success");
    } catch (e) {
      showToast("Failed to export snapshot", "error");
    }
  };

  const executeRestore = (snapshot: RollingSnapshotInfo) => {
    const snapData = snapshot.data;
    if (!snapData || typeof snapData !== "object") {
      showToast("Snapshot contains invalid data.", "error");
      return;
    }

    let finalData = snapData;

    if (restoreMode === "merge") {
      // Safe merge: keep current data and merge in missing matches, sets, stats, and roster
      const currentMatches = Array.isArray(currentAppData.matches) ? currentAppData.matches : [];
      const currentSets = Array.isArray(currentAppData.sets) ? currentAppData.sets : [];
      const currentStats = Array.isArray(currentAppData.stats) ? currentAppData.stats : [];
      const currentRoster = Array.isArray(currentAppData.roster) ? currentAppData.roster : [];

      const snapMatches = Array.isArray(snapData.matches) ? snapData.matches : [];
      const snapSets = Array.isArray(snapData.sets) ? snapData.sets : [];
      const snapStats = Array.isArray(snapData.stats) ? snapData.stats : [];
      const snapRoster = Array.isArray(snapData.roster) ? snapData.roster : [];

      // Merge matches (by ID)
      const existingMatchIds = new Set(currentMatches.map((m: any) => m.id));
      const recoveredMatches = snapMatches.filter((m: any) => !existingMatchIds.has(m.id));
      const mergedMatches = [...currentMatches, ...recoveredMatches];

      // Merge sets (by ID)
      const existingSetIds = new Set(currentSets.map((s: any) => s.id));
      const recoveredSets = snapSets.filter((s: any) => !existingSetIds.has(s.id));
      const mergedSets = [...currentSets, ...recoveredSets];

      // Merge stats (by ID)
      const existingStatIds = new Set(currentStats.map((s: any) => s.id));
      const recoveredStats = snapStats.filter((s: any) => !existingStatIds.has(s.id));
      const mergedStats = [...currentStats, ...recoveredStats];

      // Merge roster (by ID)
      const existingPlayerIds = new Set(currentRoster.map((p: any) => p.id));
      const recoveredPlayers = snapRoster.filter((p: any) => !existingPlayerIds.has(p.id));
      const mergedRoster = [...currentRoster, ...recoveredPlayers];

      // Merge opponents
      const mergedOpponents = {
        ...(snapData.opponents || {}),
        ...(currentAppData.opponents || {}),
      };

      finalData = {
        ...currentAppData,
        ...snapData,
        matches: mergedMatches,
        sets: mergedSets,
        stats: mergedStats,
        roster: mergedRoster,
        opponents: mergedOpponents,
      };

      const recoveredCount = recoveredMatches.length;
      showToast(
        `Merged! Recovered ${recoveredCount} missing match(es) and ${recoveredStats.length} stat(s).`,
        "success",
      );
    } else {
      showToast(
        `Snapshot restored! Loaded ${snapData.matches?.length || 0} match(es) and ${snapData.stats?.length || 0} stat(s).`,
        "success",
      );
    }

    onRestoreData(finalData, uploadAfterRestore);
    setConfirmingRestoreSnapshot(null);
    onClose();
  };

  const currentMatchCount = Array.isArray(currentAppData.matches) ? currentAppData.matches.length : 0;
  const currentStatCount = Array.isArray(currentAppData.stats) ? currentAppData.stats.length : 0;

  return (
    <div className="fixed inset-0 z-[270] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
              <History size={22} />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg tracking-wide uppercase text-white flex items-center gap-2">
                Rolling Snapshots & Data Recovery
              </h3>
              <p className="text-slate-300 text-xs font-semibold">
                Recover matches, sets, and stats stored in device history
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={fetchSnapshots}
              className="text-slate-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
              title="Refresh snapshot list"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* CURRENT STATE SUMMARY & NOTICE */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Active State:</span>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
              {currentMatchCount} Matches
            </span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              {currentStatCount} Stats
            </span>
          </div>
          <button
            type="button"
            onClick={handleCaptureSnapshotNow}
            disabled={isCapturing}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Clock size={12} />
            <span>{isCapturing ? "Saving..." : "Take Snapshot Now"}</span>
          </button>
        </div>

        {/* GUIDANCE BANNER */}
        <div className="bg-amber-50/70 border-b border-amber-200/60 p-3 sm:px-5 flex items-start gap-2.5 shrink-0">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-950 font-medium leading-relaxed">
            <strong>Did games disappear after syncing?</strong> The app preserves continuous rolling copies of your matches and stats in IndexedDB before any sync. Find the snapshot timestamp that had your games below, then click <strong>Restore</strong> to recover them and re-upload to Firebase.
          </p>
        </div>

        {/* SNAPSHOT LIST */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 bg-slate-100/50">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw size={24} className="animate-spin text-indigo-500" />
              <span className="text-xs font-bold uppercase tracking-wider">Scanning local storage & IndexedDB...</span>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="py-12 bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center">
              <HardDrive size={36} className="mx-auto text-slate-400 mb-2" />
              <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">No rolling snapshots found yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Rolling snapshots are automatically recorded whenever you score matches or record stats on this device.
              </p>
              <button
                type="button"
                onClick={handleCaptureSnapshotNow}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
              >
                Create First Snapshot
              </button>
            </div>
          ) : (
            snapshots.map((snap, idx) => {
              const isExpanded = expandedSnapshotId === snap.id;
              const matches: any[] = Array.isArray(snap.data?.matches) ? snap.data.matches : [];
              const hasMoreMatchesThanCurrent = snap.matchesCount > currentMatchCount;

              return (
                <div
                  key={snap.id || idx}
                  className={`bg-white rounded-2xl border transition-all shadow-sm overflow-hidden ${
                    hasMoreMatchesThanCurrent
                      ? "border-amber-300 ring-1 ring-amber-300/40 bg-gradient-to-r from-amber-50/20 to-white"
                      : "border-slate-200"
                  }`}
                >
                  <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-slate-800 text-sm sm:text-base flex items-center gap-1.5">
                          <Clock size={15} className="text-indigo-600" />
                          {snap.dateFormatted}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          {snap.source}
                        </span>
                        {hasMoreMatchesThanCurrent && (
                          <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider">
                            + More Matches ({snap.matchesCount} vs {currentMatchCount})
                          </span>
                        )}
                      </div>

                      {/* Stat chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                          {snap.matchesCount} {snap.matchesCount === 1 ? "Match" : "Matches"}
                        </span>
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                          {snap.setsCount} Sets
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                          {snap.statsCount} Stats
                        </span>
                        <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg">
                          {snap.rosterCount} Roster
                        </span>
                      </div>

                      {/* Match previews */}
                      {snap.matchTitles.length > 0 && (
                        <div className="text-[11px] text-slate-500 font-semibold truncate max-w-md pt-0.5">
                          Games: {snap.matchTitles.slice(0, 4).join(", ")}
                          {snap.matchTitles.length > 4 ? ` +${snap.matchTitles.length - 4} more` : ""}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => setExpandedSnapshotId(isExpanded ? null : snap.id)}
                        className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="View details of matches and scores in this snapshot"
                      >
                        <Eye size={14} />
                        <span className="hidden sm:inline">Inspect</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadSnapshotJson(snap)}
                        className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                        title="Download raw snapshot as JSON file"
                      >
                        <Download size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmingRestoreSnapshot(snap)}
                        className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw size={14} />
                        <span>Restore</span>
                      </button>
                    </div>
                  </div>

                  {/* EXPANDED DETAILS */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50/80 border-t border-slate-200 space-y-3 animate-in fade-in duration-150">
                      <h5 className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={13} className="text-indigo-600" />
                        Matches in this Snapshot ({matches.length})
                      </h5>
                      {matches.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No matches in this snapshot.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                          {matches.map((m: any, mIdx: number) => {
                            const matchSets = (Array.isArray(snap.data?.sets) ? snap.data.sets : []).filter(
                              (s: any) => s.matchId === m.id,
                            );
                            return (
                              <div
                                key={m.id || mIdx}
                                className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs text-xs"
                              >
                                <div className="flex items-center justify-between font-black text-slate-800">
                                  <span className="truncate">{m.opponent ? `vs ${m.opponent}` : m.type || "Match"}</span>
                                  <span className="text-[10px] text-indigo-600 font-bold uppercase">{m.type || "Game"}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1">
                                  <span>{m.date || "No date"}</span>
                                  <span className="font-bold text-slate-600">
                                    {matchSets.length} {matchSets.length === 1 ? "Set" : "Sets"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* RESTORE CONFIRMATION DIALOG MODAL */}
        {confirmingRestoreSnapshot && (
          <div className="fixed inset-0 z-[280] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-6 border border-slate-200 animate-in zoom-in-95 duration-150 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                  <RotateCcw size={22} />
                </div>
                <div>
                  <h4 className="font-black text-lg text-slate-900 uppercase tracking-tight">
                    Restore Snapshot?
                  </h4>
                  <p className="text-xs text-slate-500">
                    From {confirmingRestoreSnapshot.dateFormatted}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>Matches in Snapshot:</span>
                  <span className="font-black text-indigo-700">{confirmingRestoreSnapshot.matchesCount}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-700">
                  <span>Sets in Snapshot:</span>
                  <span className="font-black text-indigo-700">{confirmingRestoreSnapshot.setsCount}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-700">
                  <span>Recorded Stats:</span>
                  <span className="font-black text-emerald-700">{confirmingRestoreSnapshot.statsCount}</span>
                </div>
              </div>

              {/* RESTORE MODE CHOICE */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Recovery Strategy:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRestoreMode("merge")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      restoreMode === "merge"
                        ? "bg-indigo-50 border-indigo-400 text-indigo-900 shadow-2xs ring-1 ring-indigo-400"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-black text-xs uppercase flex items-center gap-1.5">
                      <Shield size={13} className="text-indigo-600" />
                      Merge (Recommended)
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Keeps existing data and recovers missing matches & stats.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestoreMode("replace")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      restoreMode === "replace"
                        ? "bg-amber-50 border-amber-400 text-amber-900 shadow-2xs ring-1 ring-amber-400"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-black text-xs uppercase flex items-center gap-1.5">
                      <RotateCcw size={13} className="text-amber-600" />
                      Full Revert
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Overwrites current state completely with this snapshot.
                    </div>
                  </button>
                </div>
              </div>

              {/* UPLOAD TO FIREBASE OPTION */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uploadAfterRestore}
                  onChange={(e) => setUploadAfterRestore(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 mt-0.5 h-4 w-4"
                />
                <span className="text-xs text-slate-700 leading-snug">
                  <strong>Upload recovered games to Firebase immediately</strong> so they are safely backed up in the cloud and synced across devices.
                </span>
              </label>

              {/* CONFIRM BUTTONS */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmingRestoreSnapshot(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => executeRestore(confirmingRestoreSnapshot)}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>Confirm Restore</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
