import React, { useState, useMemo } from "react";
import { X, ArrowRightLeft, Users, Check, AlertCircle } from "lucide-react";

export interface OpponentSubModalProps {
  isOpen: boolean;
  onClose: () => void;
  oppLineup: string[]; // 6 strings
  opponentName: string;
  subPairs: Record<string, string>;
  oppLiberoId?: string | null;
  oppSetterId?: string | null;
  knownOppNumbers?: string[];
  onConfirmSub: (outPlayer: string, inPlayer: string) => void;
  onToggleLibero?: (player: string) => void;
}

export const OpponentSubModal: React.FC<OpponentSubModalProps> = ({
  isOpen,
  onClose,
  oppLineup,
  opponentName,
  subPairs,
  oppLiberoId,
  oppSetterId,
  knownOppNumbers = [],
  onConfirmSub,
  onToggleLibero,
}) => {
  const [selectedOutPlayer, setSelectedOutPlayer] = useState<string>(() => oppLineup[0] || "");
  const [newPlayerNumber, setNewPlayerNumber] = useState<string>("");

  // When selectedOutPlayer changes, check if there's a paired sub
  const pairedSub = selectedOutPlayer ? subPairs[selectedOutPlayer] : null;

  // On open, ensure selectedOutPlayer is in current oppLineup
  React.useEffect(() => {
    if (oppLineup.length > 0 && !oppLineup.includes(selectedOutPlayer)) {
      setSelectedOutPlayer(oppLineup[0]);
    }
  }, [oppLineup, selectedOutPlayer]);

  // Candidates for quick sub (numbers known for this opponent not currently on court)
  const availableKnownNumbers = useMemo(() => {
    const onCourtSet = new Set(oppLineup);
    const set = new Set<string>();
    knownOppNumbers.forEach((num) => {
      if (num && !onCourtSet.has(num)) {
        set.add(num);
      }
    });
    // Also include paired sub if not on court
    if (pairedSub && !onCourtSet.has(pairedSub)) {
      set.add(pairedSub);
    }
    return Array.from(set).sort((a, b) => {
      const nA = parseInt(a.replace(/\D/g, ""), 10);
      const nB = parseInt(b.replace(/\D/g, ""), 10);
      if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
      return a.localeCompare(b);
    });
  }, [knownOppNumbers, oppLineup, pairedSub]);

  if (!isOpen) return null;

  const handleSubmit = (inNum?: string) => {
    const targetIn = (inNum || newPlayerNumber).trim();
    if (!targetIn || !selectedOutPlayer) return;
    onConfirmSub(selectedOutPlayer, targetIn);
    setNewPlayerNumber("");
    onClose();
  };

  const courtPosOfSelected = oppLineup.indexOf(selectedOutPlayer) + 1;

  return (
    <div className="fixed inset-0 z-[160] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="p-4 bg-slate-850 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-md">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h3 className="font-black text-white text-base sm:text-lg tracking-wide uppercase">
                Substitute Opponent Player
              </h3>
              <p className="text-xs font-bold text-slate-400 truncate max-w-[240px]">
                {opponentName || "Opponent"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* STEP 1: SELECT PLAYER GOING OUT */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                1. Select Player Leaving Court (OUT)
              </span>
              <span className="text-[10px] font-bold text-blue-400">
                Selected: #{selectedOutPlayer} (Pos {courtPosOfSelected})
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {oppLineup.map((pNum, idx) => {
                const courtPos = idx + 1;
                const isSelected = selectedOutPlayer === pNum;
                const isSetter = pNum === oppSetterId;
                const isLibero = pNum === oppLiberoId;
                const isBackRow = [1, 5, 6].includes(courtPos);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedOutPlayer(pNum);
                      setNewPlayerNumber("");
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center relative ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-400 shadow-lg ring-2 ring-blue-400/50 scale-[1.02]"
                        : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    <span className="text-[9px] font-black uppercase tracking-wider opacity-75">
                      Pos {courtPos} ({isBackRow ? "Back" : "Front"})
                    </span>
                    <span className="text-xl sm:text-2xl font-black my-0.5">
                      #{pNum}
                    </span>
                    <span className="text-[9px] font-bold opacity-80">
                      {isSetter ? "Setter" : isLibero ? "Libero" : idx === 0 ? "Server" : "Hitter"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: SELECT PLAYER COMING IN */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2">
              2. Select or Enter Player Entering (IN)
            </span>

            {/* QUICK RE-ENTRY BUTTON IF SUB PAIR EXISTS */}
            {pairedSub && (
              <div className="mb-3 bg-indigo-950/40 border border-indigo-500/40 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-300 block">
                    Original Sub Pair
                  </span>
                  <span className="text-xs font-bold text-slate-200">
                    Re-enter #{pairedSub} for #{selectedOutPlayer}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSubmit(pairedSub)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase rounded-lg shadow-sm transition-all flex items-center gap-1 active:scale-95"
                >
                  <ArrowRightLeft size={13} />
                  Re-enter #{pairedSub}
                </button>
              </div>
            )}

            {/* KNOWN BENCH PLAYERS CHIPS */}
            {availableKnownNumbers.length > 0 && (
              <div className="mb-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">
                  Known Opponent Players:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableKnownNumbers.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setNewPlayerNumber(num);
                        handleSubmit(num);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 text-slate-200 hover:text-white font-black text-xs transition-all active:scale-95"
                    >
                      #{num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CUSTOM NUMBER INPUT */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Enter Jersey # (e.g. 14)"
                  value={newPlayerNumber}
                  onChange={(e) => setNewPlayerNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newPlayerNumber.trim()) {
                      handleSubmit();
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white font-black text-base outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <button
                type="button"
                disabled={!newPlayerNumber.trim() || !selectedOutPlayer}
                onClick={() => handleSubmit()}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95"
              >
                Sub In
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-3 bg-slate-850 border-t border-slate-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white font-bold text-xs uppercase"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
