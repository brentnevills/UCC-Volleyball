import React, { useState, useEffect } from "react";
import { X, Shield, Users, Check, AlertCircle } from "lucide-react";

interface TeamNameEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  ourTeamName: string;
  opponentTeamName?: string;
  targetMatchTitle?: string;
  onSave: (newOurName: string, newOppName?: string) => Promise<void> | void;
  showOpponentEdit?: boolean;
}

export const TeamNameEditModal: React.FC<TeamNameEditModalProps> = ({
  isOpen,
  onClose,
  ourTeamName,
  opponentTeamName = "",
  targetMatchTitle,
  onSave,
  showOpponentEdit = true,
}) => {
  const [ourName, setOurName] = useState(ourTeamName);
  const [oppName, setOppName] = useState(opponentTeamName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOurName(ourTeamName);
      setOppName(opponentTeamName);
    }
  }, [isOpen, ourTeamName, opponentTeamName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ourName.trim()) {
      alert("Please enter a valid name for your team.");
      return;
    }
    if (showOpponentEdit && !oppName.trim()) {
      alert("Please enter a valid name for the opponent team.");
      return;
    }

    try {
      setSaving(true);
      await onSave(ourName.trim(), showOpponentEdit ? oppName.trim() : undefined);
      onClose();
    } catch (err) {
      console.error("Failed to update team names:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[180] bg-slate-900/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-[#001b5e] to-slate-900 text-white p-5 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Shield className="text-amber-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider">
                Adjust Team Names
              </h2>
              <p className="text-xs text-indigo-200 font-bold">
                {targetMatchTitle ? targetMatchTitle : "Update display & database names"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Your Team Name */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0033A0]"></span>
              <span>Your Team Name</span>
            </label>
            <input
              type="text"
              value={ourName}
              onChange={(e) => setOurName(e.target.value)}
              placeholder="e.g. Lancers or UCC Lancers"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0033A0] focus:border-transparent outline-none transition-all"
              autoFocus
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Displayed on scoreboards, stats headers, and export reports.
            </span>
          </div>

          {/* Opponent Team Name */}
          {showOpponentEdit && (
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Opponent Team Name</span>
              </label>
              <input
                type="text"
                value={oppName}
                onChange={(e) => setOppName(e.target.value)}
                placeholder="e.g. North High or Oakland"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Updates opponent name for this match and historical stats.
              </span>
            </div>
          )}

          <div className="pt-3 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-[#0033A0] to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check size={16} />
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
