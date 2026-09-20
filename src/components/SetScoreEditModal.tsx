import React, { useState, useEffect } from "react";
import { X, Trophy, Check } from "lucide-react";

interface SetScoreEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  set: any;
  matchTitle?: string;
  ourTeamName: string;
  opponentName: string;
  onSave: (setId: string, newUccScore: number, newOppScore: number) => Promise<void> | void;
}

export const SetScoreEditModal: React.FC<SetScoreEditModalProps> = ({
  isOpen,
  onClose,
  set,
  matchTitle,
  ourTeamName,
  opponentName,
  onSave,
}) => {
  const [uccScore, setUccScore] = useState<number>(0);
  const [oppScore, setOppScore] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && set) {
      setUccScore(set.scoreUcc ?? 0);
      setOppScore(set.scoreOpp ?? 0);
    }
  }, [isOpen, set]);

  if (!isOpen || !set) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await onSave(set.id, Number(uccScore), Number(oppScore));
      onClose();
    } catch (err) {
      console.error("Failed to save set score:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[180] bg-slate-900/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-slate-900 via-[#001b5e] to-slate-900 text-white p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Trophy className="text-amber-400" size={20} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider">
                Adjust Set {set.setNum || 1} Score
              </h2>
              <p className="text-[11px] text-indigo-200 font-bold truncate max-w-[200px]">
                {matchTitle || "Correct recorded final score"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-100 flex flex-col items-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0033A0] mb-2 truncate max-w-full">
                {ourTeamName}
              </span>
              <input
                type="number"
                min="0"
                max="99"
                value={uccScore}
                onChange={(e) => setUccScore(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20 text-center text-3xl font-black text-[#0033A0] bg-white border border-blue-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-[#0033A0]"
              />
            </div>

            <div className="bg-slate-100/70 p-3 rounded-2xl border border-slate-200 flex flex-col items-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 mb-2 truncate max-w-full">
                {opponentName || "Opponent"}
              </span>
              <input
                type="number"
                min="0"
                max="99"
                value={oppScore}
                onChange={(e) => setOppScore(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20 text-center text-3xl font-black text-slate-800 bg-white border border-slate-300 rounded-xl p-2 outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
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
              className="px-5 py-2 bg-gradient-to-r from-[#0033A0] to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check size={15} />
              <span>{saving ? "Saving..." : "Save Score"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
