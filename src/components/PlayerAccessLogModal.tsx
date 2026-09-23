import React, { useState, useEffect } from "react";
import {
  X,
  Users,
  Eye,
  Shield,
  Clock,
  Calendar,
  Smartphone,
  Laptop,
  CheckCircle,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Mail,
  UserCheck,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";

export interface PlayerAccessRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: string;
  lastStatsAccess?: any;
  statsAccessCount?: number;
  lastActive?: any;
  joinedAt?: any;
  lastViewedPath?: string;
  device?: string;
}

export interface PlayerAccessHistoryEntry {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: string;
  accessedAt: any;
  view: string;
  device?: string;
}

interface PlayerAccessLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  playerCode?: string;
  publicPath?: string;
  db?: any;
}

export const PlayerAccessLogModal: React.FC<PlayerAccessLogModalProps> = ({
  isOpen,
  onClose,
  teamId,
  teamName,
  playerCode,
  publicPath = "teams",
  db,
}) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"players" | "history">("players");
  const [searchQuery, setSearchQuery] = useState("");
  const [players, setPlayers] = useState<PlayerAccessRecord[]>([]);
  const [history, setHistory] = useState<PlayerAccessHistoryEntry[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAccessData = async () => {
    if (!teamId || !db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch team members to get all players and their Google accounts
      const membersRef = collection(db, `${publicPath}/${teamId}/members`);
      const membersSnap = await getDocs(membersRef);
      const memberList: PlayerAccessRecord[] = [];

      membersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        // Check if member is player or has stats access
        if (data.role === "player" || data.lastStatsAccess || data.email) {
          memberList.push({
            uid: data.uid || docSnap.id,
            email: data.email || "No Google Email Logged",
            displayName: data.displayName || data.email?.split("@")[0] || "Player",
            photoURL: data.photoURL,
            role: data.role || "player",
            lastStatsAccess: data.lastStatsAccess,
            statsAccessCount: data.statsAccessCount || (data.lastStatsAccess ? 1 : 0),
            lastActive: data.lastActive,
            joinedAt: data.joinedAt,
            lastViewedPath: data.lastViewedPath,
            device: data.device,
          });
        }
      });

      // Sort by last stats access descending (most recent first)
      memberList.sort((a, b) => {
        const timeA = a.lastStatsAccess?.toDate
          ? a.lastStatsAccess.toDate().getTime()
          : a.lastStatsAccess
          ? new Date(a.lastStatsAccess).getTime()
          : 0;
        const timeB = b.lastStatsAccess?.toDate
          ? b.lastStatsAccess.toDate().getTime()
          : b.lastStatsAccess
          ? new Date(b.lastStatsAccess).getTime()
          : 0;
        return timeB - timeA;
      });

      setPlayers(memberList);

      // 2. Fetch detailed access history logs
      try {
        const logsRef = collection(db, `${publicPath}/${teamId}/player_access_logs`);
        const logsQuery = query(logsRef, limit(50));
        const logsSnap = await getDocs(logsQuery);
        const logList: PlayerAccessHistoryEntry[] = [];
        logsSnap.forEach((docSnap) => {
          const d = docSnap.data();
          logList.push({
            id: docSnap.id,
            uid: d.uid,
            email: d.email || "Unknown Account",
            displayName: d.displayName || d.email?.split("@")[0] || "Player",
            role: d.role || "player",
            accessedAt: d.accessedAt,
            view: d.view || "Stats Overview",
            device: d.device || "Mobile / Web App",
          });
        });

        // Sort history by time desc
        logList.sort((a, b) => {
          const tA = a.accessedAt?.toDate
            ? a.accessedAt.toDate().getTime()
            : a.accessedAt
            ? new Date(a.accessedAt).getTime()
            : 0;
          const tB = b.accessedAt?.toDate
            ? b.accessedAt.toDate().getTime()
            : b.accessedAt
            ? new Date(b.accessedAt).getTime()
            : 0;
          return tB - tA;
        });

        setHistory(logList);
      } catch (logErr) {
        console.warn("History logs query notice:", logErr);
      }

      setLastRefreshed(new Date());
    } catch (e: any) {
      console.error("Error fetching player access audit:", e);
      setErrorMsg(e.message || "Failed to load player stats access data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAccessData();
    }
  }, [isOpen, teamId]);

  if (!isOpen) return null;

  const formatDate = (val: any) => {
    if (!val) return "Not recorded yet";
    try {
      const d = val?.toDate ? val.toDate() : new Date(val);
      if (isNaN(d.getTime())) return "Unknown";
      
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      let relative = "";
      if (diffMins < 1) relative = "Just now";
      else if (diffMins < 60) relative = `${diffMins}m ago`;
      else if (diffHours < 24) relative = `${diffHours}h ago`;
      else if (diffDays === 1) relative = "Yesterday";
      else relative = `${diffDays}d ago`;

      const formatted = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      return `${relative} (${formatted})`;
    } catch (e) {
      return "Invalid date";
    }
  };

  const filteredPlayers = players.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.email?.toLowerCase().includes(q) ||
      p.displayName?.toLowerCase().includes(q) ||
      p.role?.toLowerCase().includes(q)
    );
  });

  const totalAccesses = players.reduce(
    (acc, curr) => acc + (curr.statsAccessCount || 0),
    0
  );

  const playersWithAccessCount = players.filter(
    (p) => (p.statsAccessCount && p.statsAccessCount > 0) || p.lastStatsAccess
  ).length;

  return (
    <div
      className="fixed inset-0 z-[100000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-b border-slate-700/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <Eye size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
                  Player Stats Access Audit
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-black tracking-widest uppercase">
                  Live Coach View
                </span>
              </div>
              <p className="text-slate-400 text-xs sm:text-sm font-medium mt-0.5">
                Track which players and Google accounts accessed <span className="text-slate-200 font-bold">{teamName}</span> statistics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAccessData}
              disabled={loading}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600/60 text-slate-300 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh access records"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 sm:p-5 bg-slate-950/60 border-b border-slate-800">
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users size={12} className="text-blue-400" />
              Players Logged
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
              {playersWithAccessCount}{" "}
              <span className="text-xs font-semibold text-slate-500">
                / {players.length} members
              </span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Eye size={12} className="text-emerald-400" />
              Total Stats Views
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 tabular-nums">
              {totalAccesses}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Shield size={12} className="text-amber-400" />
              Player Code
            </div>
            <div className="text-sm sm:text-base font-black text-amber-300 mt-1.5 tracking-wider font-mono truncate">
              {playerCode || "N/A"}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock size={12} className="text-purple-400" />
              Last Synced
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-300 mt-1.5 truncate">
              {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        {/* Toolbar & Tabs */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("players")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "players"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users size={13} />
              <span>Google Accounts ({players.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "history"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Clock size={13} />
              <span>Activity Feed ({history.length})</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Google email or name..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <RefreshCw size={28} className="animate-spin text-blue-500 mb-3" />
              <p className="text-xs font-bold uppercase tracking-wider">
                Loading Player Access Records...
              </p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0" />
              <div>
                <p className="font-bold">Error loading audit data</p>
                <p className="text-red-300/80 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          ) : activeTab === "players" ? (
            /* Google Accounts Player Directory */
            filteredPlayers.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-950/30 rounded-3xl border border-slate-800/80">
                <Users size={40} className="mx-auto text-slate-600 mb-3" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  {searchQuery ? "No matching accounts found" : "No Player Access Recorded Yet"}
                </h3>
                <p className="text-slate-500 text-xs max-w-md mx-auto mt-1 leading-relaxed">
                  {searchQuery
                    ? "Try adjusting your search terms to find the player."
                    : "When players join your team with their Player Code and view stats on their devices, their Google accounts and access timestamps will appear here automatically."}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredPlayers.map((player) => {
                  const hasViewed =
                    (player.statsAccessCount && player.statsAccessCount > 0) ||
                    player.lastStatsAccess;
                  return (
                    <div
                      key={player.uid}
                      className="bg-slate-950/80 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Avatar */}
                        {player.photoURL ? (
                          <img
                            src={player.photoURL}
                            alt={player.displayName}
                            referrerPolicy="no-referrer"
                            className="h-11 w-11 rounded-2xl object-cover border border-slate-700 shrink-0 shadow-sm"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-base uppercase shrink-0 border border-blue-400/30 shadow-md">
                            {(player.displayName || player.email || "P").charAt(0)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-white truncate">
                              {player.displayName || "Volleyball Player"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                player.role === "coach"
                                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                  : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                              }`}
                            >
                              {player.role || "Player"}
                            </span>
                            {hasViewed && (
                              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="Active stats viewer" />
                            )}
                          </div>

                          {/* Google Email Address */}
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-300 font-mono">
                            <Mail size={12} className="text-blue-400 shrink-0" />
                            <span className="truncate">{player.email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Access Details */}
                      <div className="flex items-center gap-3 sm:gap-4 shrink-0 sm:self-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800/80">
                        <div className="text-left sm:text-right">
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Last Stats Access
                          </div>
                          <div className="text-xs font-bold text-slate-200 mt-0.5">
                            {formatDate(player.lastStatsAccess)}
                          </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-center min-w-[70px]">
                          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Views
                          </div>
                          <div className="text-sm font-black text-emerald-400 tabular-nums">
                            {player.statsAccessCount || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Live Activity Feed */
            history.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-950/30 rounded-3xl border border-slate-800/80">
                <Clock size={40} className="mx-auto text-slate-600 mb-3" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  No Activity Logs Recorded Yet
                </h3>
                <p className="text-slate-500 text-xs max-w-md mx-auto mt-1 leading-relaxed">
                  As players browse sets, matches, and season stats on their phones or tablets, granular page views and timestamps will stream in here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {history
                  .filter((entry) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      entry.email?.toLowerCase().includes(q) ||
                      entry.displayName?.toLowerCase().includes(q) ||
                      entry.view?.toLowerCase().includes(q)
                    );
                  })
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-slate-950/80 border border-slate-800/90 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs shrink-0">
                          {entry.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white truncate">
                              {entry.displayName}
                            </span>
                            <span className="text-slate-400 font-mono text-[11px] truncate">
                              &lt;{entry.email}&gt;
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>Viewed: <strong className="text-blue-300">{entry.view}</strong></span>
                            {entry.device && (
                              <span className="text-slate-500">• {entry.device}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-400 shrink-0 font-medium">
                        {formatDate(entry.accessedAt)}
                      </div>
                    </div>
                  ))}
              </div>
            )
          )}
        </div>

        {/* Footer Security Notice */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-amber-400 shrink-0" />
            <span>
              Players with player codes are restricted to <strong>on-device view-only</strong>. Downloads & screenshots are blocked and audited.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer w-full sm:w-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
