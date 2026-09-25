// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Download,
  Users,
  Play,
  CheckCircle2,
  XCircle,
  X,
  Menu,
  Activity,
  Shield,
  ShieldAlert,
  Crosshair,
  ArrowRightLeft,
  Save,
  FolderOpen,
  FileText,
  Clock,
  ChevronUp,
  ChevronDown,
  PlusCircle,
  Trophy,
  BarChart3,
  Database,
  Undo,
  ChevronRight,
  Home,
  LogOut,
  Trash2,
  Maximize,
  Minimize,
  Eye,
  EyeOff,
  Share2,
  Smartphone,
  Laptop,
  Sparkles,
  Info,
  Edit3,
  ListFilter,
  Search,
  Filter,
  Check,
  Calendar,
  Layers,
  Target,
  Plus,
  Minus,
  Lock,
  Unlock,
  Key,
  AlertTriangle,
} from "lucide-react";

import { PracticeStatsModal } from "./components/PracticeStatsModal";
import { StatCorrectionModal } from "./components/StatCorrectionModal";
import { StatBreakdownModal } from "./components/StatBreakdownModal";
import { TeamNameEditModal } from "./components/TeamNameEditModal";
import { SetScoreEditModal } from "./components/SetScoreEditModal";
import { OpponentReportModal } from "./components/OpponentReportModal";
import { OpponentSubModal } from "./components/OpponentSubModal";
import { PlayerAccessLogModal } from "./components/PlayerAccessLogModal";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Firebase Imports
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  query,
  where,
  getDocFromServer,
  enableIndexedDbPersistence,
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// -------------------------------------------------------------
// ENVIRONMENT & CLOUD CONFIGURATION
// -------------------------------------------------------------
const isFirebaseAvailable = !!firebaseConfig.apiKey;

let app, auth, db;
try {
  if (isFirebaseAvailable) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    console.log("Firebase initialized successfully");
  } else {
    console.warn("Firebase configuration missing - running in LOCAL mode");
  }
} catch (e) {
  console.error("Firebase Initialization Failed:", e);
}

// Enable Persistence for "Offline Changes"
if (typeof window !== "undefined" && db) {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("Persistence failed: Multiple tabs open.");
    } else if (err.code === "unimplemented") {
      console.warn("Persistence failed: Browser doesn't support it.");
    }
  });
}

const publicPath = `teams`;

const APP_LOGO_SRC = `${import.meta.env.BASE_URL}lancer-logo.png`;
const FALLBACK_LOGO_SRC = `${import.meta.env.BASE_URL}LancerVolleyballLogo.png`;

const DEFAULT_ROSTER = [
  { id: "1", name: "Player 1", number: "1" },
  { id: "2", name: "Player 2", number: "2" },
  { id: "3", name: "Player 3", number: "3" },
  { id: "4", name: "Player 4", number: "4" },
  { id: "5", name: "Player 5", number: "5" },
  { id: "6", name: "Player 6", number: "6" },
];

const TEAM_COLORS = [
  "from-[#0044cc] to-[#001b5e]",
  "from-blue-400 to-blue-600",
  "from-amber-500 to-amber-700",
  "from-orange-400 to-orange-500",
  "from-emerald-500 to-teal-700",
  "from-rose-500 to-red-700",
  "from-purple-500 to-fuchsia-700",
  "from-slate-600 to-gray-800",
];

function generateTeamId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper to determine Event ID/Name for grouping
const getEventDetails = (match) => {
  if (match.type === "Tournament" && match.title)
    return { id: `tourney_${match.title}`, name: `Tournament: ${match.title}` };
  const dateStr = match.date
    ? new Date(match.date).toLocaleDateString()
    : "Unknown Date";
  if (match.type === "Practice") {
    const cleanDate = dateStr.replace(/[/\\?%*:|"<> ]/g, "_");
    return {
      id: `practice_${cleanDate}`,
      name: `Practice - ${dateStr}`,
    };
  }
  const cleanDate = dateStr.replace(/[/\\?%*:|"<> ]/g, "_");
  return {
    id: `day_${match.type}_${cleanDate}`,
    name: `${match.type} Day - ${dateStr}`,
  };
};

const CareerStatsModal = ({ playerName, myTeams, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [careerList, setCareerList] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let teamResults = [];
      let tot = {
        name: "CAREER TOTAL",
        teamColor: "bg-slate-800",
        passCount: 0,
        passSum: 0,
        attCount: 0,
        attKill: 0,
        attErr: 0,
        blkCount: 0,
        blkStuff: 0,
        blkLate: 0,
        blkNet: 0,
        blkUsed: 0,
        srvCount: 0,
        srvAce: 0,
        srvErr: 0,
        digCount: 0,
        digErr: 0,
      };

      for (let team of myTeams) {
        try {
          const setSnap = await getDoc(
            doc(db, `teams/${team.id}/settings/core`),
          );
          if (!setSnap.exists()) continue;
          const r = setSnap.data().roster || [];

          // Match by name
          const playerMatch = r.find(
            (p) => p.name.toLowerCase() === playerName.toLowerCase(),
          );

          if (!playerMatch) continue;

          let pTeam = {
            name: team.name,
            teamColor: team.color,
            passCount: 0,
            passSum: 0,
            attCount: 0,
            attKill: 0,
            attErr: 0,
            blkCount: 0,
            blkStuff: 0,
            blkLate: 0,
            blkNet: 0,
            blkUsed: 0,
            srvCount: 0,
            srvAce: 0,
            srvErr: 0,
            digCount: 0,
            digErr: 0,
          };

          const q = query(
            collection(db, `teams/${team.id}/stats`),
            where("playerId", "==", playerMatch.id),
          );
          const statsSnap = await getDocs(q);

          statsSnap.forEach((docSnap) => {
            const s = docSnap.data();
            if (s.isOpponent) return;

            if (s.category === "Pass") {
              pTeam.passCount += 1;
              pTeam.passSum += s.value;
            } else if (s.category === "Dig") {
              if (s.metric === "Dig") pTeam.digCount += 1;
              if (s.metric === "Error") pTeam.digErr += 1;
            } else if (s.category === "Attack") {
              if (
                [
                  "Swing",
                  "Swing Front",
                  "Swing Back",
                  "Blocked",
                  "Stuffed",
                  "Out",
                  "Net",
                  "Out/Net",
                  "Kill",
                ].includes(s.metric)
              ) {
                pTeam.attCount += 1;
              }
              if (s.metric === "Kill") pTeam.attKill += 1;
              if (
                s.metric === "Out" ||
                s.metric === "Net" ||
                s.metric === "Out/Net" ||
                s.metric === "Stuffed"
              )
                pTeam.attErr += 1;
              if (s.metric === "Blocked" || s.metric === "Stuffed")
                pTeam.attBlk = (pTeam.attBlk || 0) + 1;
            } else if (s.category === "Block") {
              if (s.metric === "Play On" || s.metric === "Touch")
                pTeam.blkCount += s.value || 1;
              if (
                s.metric === "Block" ||
                s.metric === "Stuffed" ||
                s.metric === "Stuff"
              )
                pTeam.blkStuff += s.value || 1;
              if (s.metric === "Late") pTeam.blkLate += s.value || 1;
              if (s.metric === "Net Viol") pTeam.blkNet += s.value || 1;
              if (s.metric === "Used") pTeam.blkUsed += s.value || 1;
            } else if (s.category === "Serve") {
              if (s.metric === "Attempt") pTeam.srvCount += 1;
              if (s.metric === "Ace") pTeam.srvAce += 1;
              if (s.metric?.includes("Miss") || s.metric === "Error") pTeam.srvErr += 1;
            }
          });

          teamResults.push(pTeam);
          tot.passCount += pTeam.passCount;
          tot.passSum += pTeam.passSum;
          tot.attCount += pTeam.attCount;
          tot.attKill += pTeam.attKill;
          tot.attErr += pTeam.attErr;
          tot.blkCount += pTeam.blkCount;
          tot.blkStuff += pTeam.blkStuff;
          tot.blkLate += pTeam.blkLate;
          tot.blkNet += pTeam.blkNet;
          tot.blkUsed += pTeam.blkUsed;
          tot.srvCount += pTeam.srvCount;
          tot.srvAce += pTeam.srvAce;
          tot.srvErr += pTeam.srvErr;
          tot.digCount += pTeam.digCount;
          tot.digErr += pTeam.digErr;
        } catch (e) {
          console.error(e);
        }
      }
      if (teamResults.length > 0) {
        setCareerList([...teamResults, tot]);
      } else {
        setCareerList([]); // No matching player found
      }
      setLoading(false);
    }
    if (playerName && myTeams.length > 0) {
      load();
    }
  }, [playerName, myTeams]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex flex-col p-4 sm:p-12 overflow-hidden items-center justify-center">
      <div className="bg-white max-w-5xl w-full rounded-3xl sm:rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] border border-white/20">
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 p-6 sm:p-10 rounded-t-3xl sm:rounded-t-[3rem] text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-widest uppercase flex items-center">
              PROFILE: {playerName}
            </h2>
            <p className="text-indigo-200 mt-2 font-bold tracking-widest text-sm uppercase">
              Global Career Stats
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors shrink-0 outline-none"
          >
            <XCircle size={32} />
          </button>
        </div>

        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-50">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : careerList.length === 0 ? (
            <div className="text-center text-slate-500 py-10 font-bold tracking-widest uppercase">
              No stats recorded yet across your teams.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl shadow-sm border border-slate-200 bg-white">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 text-xs tracking-widest uppercase border-b-2 border-slate-200">
                    <th className="p-3 sm:p-4 font-black bg-slate-100 sticky left-0 z-10 w-48 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                      TEAM
                    </th>
                    <th className="p-3 font-black text-center border-l bg-slate-50">
                      PASS Avg(Tot)
                    </th>
                    <th className="p-3 font-black text-center border-l">
                      DIGS (D-Err)
                    </th>
                    <th className="p-3 font-black text-center border-l bg-slate-50">
                      SWINGS (Att-K-Err)
                    </th>
                    <th className="p-3 font-black text-center border-l text-green-600">
                      KILL %
                    </th>
                    <th className="p-3 font-black text-center border-l bg-slate-50">
                      BLOCKS (Tot(Stf)-Lt-Net-Usd)
                    </th>
                    <th className="p-3 font-black text-center border-l">
                      SERVES (Tot-A-Err)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {careerList.map((p, i) => {
                    const isTotal = p.name === "CAREER TOTAL";
                    const passAvg =
                      p.passCount > 0
                        ? (p.passSum / p.passCount).toFixed(2)
                        : "-";
                    const killPct =
                      p.attCount > 0
                        ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%"
                        : "0.0%";
                    const blkTot = p.blkCount + p.blkStuff;
                    const srvTot = p.srvCount + p.srvAce + p.srvErr;

                    return (
                      <tr
                        key={i}
                        className={`text-xs sm:text-sm ${isTotal ? "bg-indigo-50/80 border-t-[3px] border-indigo-200" : "hover:bg-slate-50 border-b border-slate-100"}`}
                      >
                        <td
                          className={`p-3 font-black ${isTotal ? "text-indigo-900 bg-indigo-50/80" : "text-slate-800 bg-white"} sticky left-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)] flex items-center gap-2 h-full min-h-[50px]`}
                        >
                          {!isTotal && (
                            <span
                              className={`w-3 h-3 rounded-full bg-gradient-to-r ${p.teamColor} shadow`}
                            ></span>
                          )}
                          {p.name}
                        </td>
                        <td className="p-3 text-center border-l bg-slate-50/30">
                          <strong>{passAvg}</strong>{" "}
                          <span className="opacity-50">({p.passCount})</span>
                        </td>
                        <td className="p-3 text-center border-l">
                          <strong className="text-blue-600 text-base">
                            {p.digCount}
                          </strong>{" "}
                          - <span className="text-red-500">{p.digErr}</span>
                        </td>
                        <td className="p-3 text-center border-l bg-slate-50/30">
                          {p.attCount} -{" "}
                          <strong className="text-green-600 text-base">
                            {p.attKill}
                          </strong>{" "}
                          - <span className="text-red-500">{p.attErr}</span>
                        </td>
                        <td className="p-3 text-center border-l text-green-700 font-black tracking-wider">
                          {killPct}
                        </td>
                        <td className="p-3 text-center border-l bg-slate-50/30 relative group whitespace-nowrap">
                          <span className="font-bold">{blkTot}</span>(
                          <strong className="text-indigo-600 text-base">
                            {p.blkStuff}
                          </strong>
                          ) -<span>{p.blkLate}</span> - <span>{p.blkNet}</span>{" "}
                          - <span>{p.blkUsed}</span>
                        </td>
                        <td className="p-3 text-center border-l whitespace-nowrap">
                          <strong className="mr-1">{srvTot}</strong>
                          <span className="text-orange-500 mx-1 font-bold text-base">
                            {p.srvAce}
                          </span>
                          <span className="text-red-500 ml-1">{p.srvErr}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isDocFull = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isDocFull);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    // Initial check
    handleFullscreenChange();

    // Auto-enforce fullscreen on first user gestures
    const autoFullscreenHandler = () => {
      enforceFullscreen();
    };
    window.addEventListener("click", autoFullscreenHandler);
    window.addEventListener("touchend", autoFullscreenHandler);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      window.removeEventListener("click", autoFullscreenHandler);
      window.removeEventListener("touchend", autoFullscreenHandler);
    };
  }, []);

  const enforceFullscreen = () => {
    try {
      const doc = document as any;
      const docElm = document.documentElement as any;
      const isFull = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      if (!isFull) {
        if (docElm.requestFullscreen) {
          docElm.requestFullscreen().catch(() => {});
        } else if (docElm.webkitRequestFullscreen) {
          docElm.webkitRequestFullscreen();
        } else if (docElm.mozRequestFullScreen) {
          docElm.mozRequestFullScreen();
        } else if (docElm.msRequestFullscreen) {
          docElm.msRequestFullscreen();
        }
      }
    } catch (e) {}
  };

  const toggleFullscreen = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      const doc = document as any;
      const docElm = document.documentElement as any;
      const isFull = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      if (!isFull) {
        if (docElm.requestFullscreen) {
          docElm.requestFullscreen().catch(() => {});
        } else if (docElm.webkitRequestFullscreen) {
          docElm.webkitRequestFullscreen();
        } else if (docElm.mozRequestFullScreen) {
          docElm.mozRequestFullScreen();
        } else if (docElm.msRequestFullscreen) {
          docElm.msRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      }
    } catch (e) {}
  };

  const [view, setView] = useState(() =>
    localStorage.getItem("ucc_vball_active_team") ? "menu" : "team_select",
  );
  const [user, setUser] = useState(null);
  const currentUser = user;

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).currentUser = user;
    }
  }, [user]);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authTimeoutReached, setAuthTimeoutReached] = useState(false);
  const [myTeams, setMyTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(
    () => localStorage.getItem("ucc_vball_active_team") || null,
  );

  // Master Cloud Data State (Scoped to activeTeam)
  const [appData, setAppData] = useState({
    roster: DEFAULT_ROSTER,
    savedRosters: {},
    savedLineups: {},
    opponents: {},
    matches: [],
    sets: [],
    stats: [],
  });

  // Current Session State
  const [activeMatch, setActiveMatch] = useState(null);
  const [activeSetId, setActiveSetId] = useState(null);
  const [matchFormat, setMatchFormat] = useState("Best of 5");
  const [matchType, setMatchType] = useState("League");
  const [tourneyTitle, setTourneyTitle] = useState("");
  const [scoreCap, setScoreCap] = useState("");
  const [history, setHistory] = useState([]);

  // Setup State
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNum, setNewPlayerNum] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [rosterPresetName, setRosterPresetName] = useState("");
  const [lineupPresetName, setLineupPresetName] = useState("");
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);

  // Game State
  const [lineup, setLineup] = useState([null, null, null, null, null, null]);
  const [oppLineup, setOppLineup] = useState([
    "O1",
    "O2",
    "O3",
    "O4",
    "O5",
    "O6",
  ]);
  const [score, setScore] = useState({ ucc: 0, opp: 0 });
  const [setsWon, setSetsWon] = useState({ ucc: 0, opp: 0 });
  const [currentSetNum, setCurrentSetNum] = useState(1);
  const [serving, setServing] = useState("ucc");
  const [teamStats, setTeamStats] = useState({
    uccSubs: 0,
    oppSubs: 0,
    uccTimeouts: 0,
    oppTimeouts: 0,
  });

  // Game Tracking States
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [liberoId, setLiberoId] = useState("");
  const [liberoSwappedOutId, setLiberoSwappedOutId] = useState(null);
  const [oppLiberoId, setOppLiberoId] = useState("");
  const [oppLiberoSwappedOutId, setOppLiberoSwappedOutId] = useState(null);
  const [oppSetterId, setOppSetterId] = useState(null);
  const [rallyPhase, setRallyPhase] = useState("serve");
  const [oppNotesMem, setOppNotesMem] = useState({});

  // Modals & UI
  const [servePromptVisible, setServePromptVisible] = useState(false);
  const [serveErrorPrompt, setServeErrorPrompt] = useState(null);
  const [blockAssistPrompt, setBlockAssistPrompt] = useState(null);
  const [aceReceiverPrompt, setAceReceiverPrompt] = useState(null);
  const [pendingAceData, setPendingAceData] = useState(null);
  const [selectedAceReceivers, setSelectedAceReceivers] = useState([]);
  const [oppServeReceivePrompt, setOppServeReceivePrompt] = useState<{
    passerId: string | null;
    serverId?: string | null;
    selectingAce?: boolean;
  } | null>(null);
  const [betweenSetsModal, setBetweenSetsModal] = useState<{
    nextSetNum: number;
    newSetsWon: { ucc: number; opp: number };
    tempLineup: (string | null)[];
    tempLibero: string;
    tempServing: string;
    tempOppLineup: string[];
    tempOppLibero: string;
    activeTab?: "ucc" | "opp";
  } | null>(null);
  const [showLineupEditModal, setShowLineupEditModal] = useState(false);
  const [inGameLineupTab, setInGameLineupTab] = useState<"ucc" | "opp">("ucc");
  const [tempInGameLineup, setTempInGameLineup] = useState<(string | null)[]>([]);
  const [tempInGameLibero, setTempInGameLibero] = useState("");
  const [tempInGameOppLineup, setTempInGameOppLineup] = useState<string[]>([]);
  const [tempInGameOppLibero, setTempInGameOppLibero] = useState("");
  const [betweenSetsPresetName, setBetweenSetsPresetName] = useState("");
  const [endRallyVisible, setEndRallyVisible] = useState(false);
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [showLiberoDesignateModal, setShowLiberoDesignateModal] = useState(false);
  const [liberoPromptPlayerId, setLiberoPromptPlayerId] = useState<string | null>(null);
  const [showLiberoOutModal, setShowLiberoOutModal] = useState(false);
  const [showOppLineupPrompt, setShowOppLineupPrompt] = useState(false);
  const [tempOppLineup, setTempOppLineup] = useState(["", "", "", "", "", ""]);
  const [newOppNumber, setNewOppNumber] = useState("");
  const [showOpponentReportModal, setShowOpponentReportModal] = useState(false);
  const [reportOpponentName, setReportOpponentName] = useState("");
  const [showOppSubModal, setShowOppSubModal] = useState(false);
  const [selectedOppId, setSelectedOppId] = useState(null);
  const [lateBlockPlayerId, setLateBlockPlayerId] = useState(null);
  const [statPrompt, setStatPrompt] = useState<{
    playerId: string;
    type: string;
    isOpp: boolean;
    step?: string;
    latePressed?: boolean;
  } | null>(null);
  const [practiceStatPrompt, setPracticeStatPrompt] = useState<{
    playerId: string;
    type: string;
    step?: string;
    latePressed?: boolean;
  } | null>(null);
  const [hiddenPracticePlayers, setHiddenPracticePlayers] = useState<string[]>([]);
  const [hiddenPlayerIds, setHiddenPlayerIds] = useState<string[]>([]);

  const isPlayerHidden = (playerOrId: any) => {
    if (!playerOrId) return false;
    const idStr = typeof playerOrId === "object" ? String(playerOrId.id ?? playerOrId.name) : String(playerOrId);
    const nameStr = typeof playerOrId === "object" && playerOrId.name ? String(playerOrId.name).trim().toLowerCase() : "";
    return hiddenPlayerIds.some((hId) => {
      const hStr = String(hId);
      return hStr === idStr || (nameStr !== "" && hStr.trim().toLowerCase() === nameStr);
    });
  };

  const toggleHidePlayer = (playerOrId: any) => {
    if (!playerOrId) return;
    const idStr = typeof playerOrId === "object" ? String(playerOrId.id ?? playerOrId.name) : String(playerOrId);
    const nameStr = typeof playerOrId === "object" && playerOrId.name ? String(playerOrId.name).trim().toLowerCase() : "";
    setHiddenPlayerIds((prev) => {
      const exists = prev.some((hId) => {
        const hStr = String(hId);
        return hStr === idStr || (nameStr !== "" && hStr.trim().toLowerCase() === nameStr);
      });
      if (exists) {
        return prev.filter((hId) => {
          const hStr = String(hId);
          return hStr !== idStr && (nameStr === "" || hStr.trim().toLowerCase() !== nameStr);
        });
      } else {
        return [...prev, idStr];
      }
    });
  };
  const [showPlayerFilterModal, setShowPlayerFilterModal] = useState(false);
  const [showPracticeStats, setShowPracticeStats] = useState(false);
  const [showStatCorrectionModal, setShowStatCorrectionModal] = useState(false);
  const [customTeamName, setCustomTeamName] = useState<string>(
    () => localStorage.getItem("ucc_vball_custom_team_name") || "Lancers",
  );
  const effectiveTeamName =
    myTeams.find((t) => t.id === activeTeam)?.name || customTeamName || "Lancers";
  const activeTeamProfile = myTeams.find((t) => t.id === activeTeam);

  // Coaches Access: Anyone with coach role in team, or coach unlock key, or owner/creator of team, or coach email
  const isCoachRole = Boolean(
    activeTeamProfile?.role === "coach" ||
    localStorage.getItem(`ucc_team_role_${activeTeam}`) === "coach" ||
    localStorage.getItem("ucc_current_role") === "coach" ||
    localStorage.getItem("ucc_coach_unlocked_global") === "true" ||
    (activeTeam && localStorage.getItem(`ucc_coach_unlocked_${activeTeam}`) === "true") ||
    (user && myTeams.some((t: any) => t.id === activeTeam && t.role === "coach")) ||
    (user && myTeams.some((t: any) => t.role === "coach")) ||
    (appData.createdBy && user && appData.createdBy === user.uid) ||
    (user && user.email && (
      user.email.toLowerCase() === "brent.nevills@sccdsb.net" ||
      user.email.toLowerCase().includes("coach")
    ))
  );

  // A user is strictly in player role ONLY if they are NOT a coach and have player indicator
  const isPlayerRole = !isCoachRole && Boolean(
    activeTeamProfile?.role === "player" ||
    localStorage.getItem(`ucc_team_role_${activeTeam}`) === "player" ||
    localStorage.getItem("ucc_current_role") === "player" ||
    (user && myTeams.some((t: any) => t.id === activeTeam && t.role === "player"))
  );

  const effectiveRole = isCoachRole
    ? "coach"
    : isPlayerRole
    ? "player"
    : activeTeamProfile?.role || "coach";

  // Anti-screenshot protection is ONLY active for players, NEVER for coaches
  const isShieldProtectionActive = Boolean(isPlayerRole && !isCoachRole);
  const isPlayerAccessAllowed = (appData as any).playerAccessEnabled !== false;

  const [showCoachLoginModal, setShowCoachLoginModal] = useState(false);
  const [coachCodeInput, setCoachCodeInput] = useState("");
  const [coachLoginMsg, setCoachLoginMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [isVerifyingCoach, setIsVerifyingCoach] = useState(false);

  const handleVerifyCoachCode = async (codeToVerify?: string) => {
    const rawCode = (codeToVerify !== undefined ? codeToVerify : coachCodeInput).trim().toUpperCase();
    if (!rawCode) {
      setCoachLoginMsg({ text: "Please enter a valid Coach Code.", isError: true });
      return;
    }
    setIsVerifyingCoach(true);
    setCoachLoginMsg(null);

    try {
      let isMatch = false;
      let targetTeamId = activeTeam;

      // 1. Check against active team's coachCode or ID
      if (activeTeam) {
        if (
          rawCode === (appData.coachCode || "").trim().toUpperCase() ||
          rawCode === activeTeam.trim().toUpperCase()
        ) {
          isMatch = true;
          targetTeamId = activeTeam;
        }
      }

      // 2. Check share_codes in Firestore
      if (!isMatch && isFirebaseAvailable && db) {
        try {
          const codeSnap = await getDoc(doc(db, "share_codes", rawCode));
          if (codeSnap.exists()) {
            const data = codeSnap.data();
            if (data.role === "coach") {
              isMatch = true;
              targetTeamId = data.teamId;
            }
          }
        } catch (e) {
          console.log("share_codes check error:", e);
        }
      }

      // 3. Check core settings in Firestore for activeTeam
      if (!isMatch && isFirebaseAvailable && db && activeTeam) {
        try {
          const teamSettingsSnap = await getDoc(doc(db, `${publicPath}/${activeTeam}/settings/core`));
          if (teamSettingsSnap.exists()) {
            const coreData = teamSettingsSnap.data();
            if (coreData.coachCode && coreData.coachCode.trim().toUpperCase() === rawCode) {
              isMatch = true;
              targetTeamId = activeTeam;
            }
          }
        } catch (e) {
          console.log("core settings check error:", e);
        }
      }

      if (!isMatch) {
        setCoachLoginMsg({
          text: "Incorrect Coach Code. Please check the code provided by your coaching staff.",
          isError: true,
        });
        setIsVerifyingCoach(false);
        return;
      }

      const teamKey = targetTeamId || activeTeam || "default";
      localStorage.setItem(`ucc_team_role_${teamKey}`, "coach");
      localStorage.setItem("ucc_current_role", "coach");
      localStorage.setItem(`ucc_coach_unlocked_${teamKey}`, "true");

      if (user && isFirebaseAvailable && db && targetTeamId) {
        try {
          await setDoc(
            doc(db, `${publicPath}/${targetTeamId}/members/${user.uid}`),
            {
              uid: user.uid,
              role: "coach",
              joinedAt: serverTimestamp(),
              email: user.email || "",
              displayName: user.displayName || user.email?.split("@")[0] || "Coach",
              photoURL: user.photoURL || "",
              lastActive: serverTimestamp(),
            },
            { merge: true },
          );

          const existing = myTeams.find((t) => t.id === targetTeamId);
          let newTeams = [];
          if (existing) {
            newTeams = myTeams.map((t) =>
              t.id === targetTeamId ? { ...t, role: "coach" } : t,
            );
          } else {
            newTeams = [
              ...myTeams,
              {
                id: targetTeamId,
                name: effectiveTeamName,
                color: "from-[#002B7A] to-blue-950",
                role: "coach",
              },
            ];
          }
          setMyTeams(newTeams);
          await setDoc(
            doc(db, "users", user.uid),
            { teams: newTeams },
            { merge: true },
          );
        } catch (err) {
          console.error("Failed to sync coach role to Firebase:", err);
        }
      }

      if (targetTeamId && targetTeamId !== activeTeam) {
        setActiveTeam(targetTeamId);
        localStorage.setItem("ucc_vball_active_team", targetTeamId);
      }

      setCoachLoginMsg({
        text: "Coach access verified! Full access granted.",
        isError: false,
      });

      setTimeout(() => {
        setShowCoachLoginModal(false);
        setCoachCodeInput("");
        setCoachLoginMsg(null);
        setIsVerifyingCoach(false);
      }, 700);
    } catch (err: any) {
      console.error("Coach verification error:", err);
      setCoachLoginMsg({
        text: err?.message || "Failed to verify coach code. Please try again.",
        isError: true,
      });
      setIsVerifyingCoach(false);
    }
  };

  const handleGoogleCoachSignIn = async () => {
    const provider = new GoogleAuthProvider();
    setIsVerifyingCoach(true);
    setCoachLoginMsg(null);
    try {
      const res = await signInWithPopup(auth, provider);
      if (res.user && activeTeam && isFirebaseAvailable && db) {
        try {
          const memberDoc = await getDoc(
            doc(db, `${publicPath}/${activeTeam}/members/${res.user.uid}`),
          );
          const teamDoc = await getDoc(
            doc(db, `${publicPath}/${activeTeam}`),
          );
          const isCreator = teamDoc.exists() && teamDoc.data()?.createdBy === res.user.uid;
          const isMemberCoach = memberDoc.exists() && memberDoc.data()?.role === "coach";

          if (isCreator || isMemberCoach) {
            localStorage.setItem(`ucc_team_role_${activeTeam}`, "coach");
            localStorage.setItem("ucc_current_role", "coach");
            localStorage.setItem(`ucc_coach_unlocked_${activeTeam}`, "true");
            setCoachLoginMsg({
              text: `Recognized Coach Account (${res.user.email})! Access granted.`,
              isError: false,
            });
            setTimeout(() => {
              setShowCoachLoginModal(false);
              setCoachLoginMsg(null);
              setIsVerifyingCoach(false);
            }, 700);
            return;
          }
        } catch (e) {
          console.log("Check coach doc error:", e);
        }
      }
      setIsVerifyingCoach(false);
      setCoachLoginMsg({
        text: `Signed in as ${res.user.email}. If you have a Coach Code, enter it below to activate Coach permissions.`,
        isError: false,
      });
    } catch (err: any) {
      setIsVerifyingCoach(false);
      if (err.code !== "auth/popup-closed-by-user") {
        setCoachLoginMsg({
          text: `Sign-in error: ${err.message}`,
          isError: true,
        });
      }
    }
  };

  const togglePlayerAccess = async () => {
    const nextState = !isPlayerAccessAllowed;
    setAppData((prev: any) => ({ ...prev, playerAccessEnabled: nextState }));

    if (isFirebaseAvailable && user && activeTeam) {
      try {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/settings/core`),
          { playerAccessEnabled: nextState },
          { merge: true }
        );
      } catch (e) {
        console.error("Failed to update playerAccessEnabled in Firestore:", e);
      }
    } else if (!isFirebaseAvailable && activeTeam) {
      writeLocalDb({ ...appData, playerAccessEnabled: nextState });
      localStorage.setItem(`ucc_player_access_${activeTeam}`, String(nextState));
    }

    setScreenshotAttemptNotice(
      nextState
        ? "Player Access: ENABLED (Players can view stats)"
        : "Player Access: DISABLED (Players locked out)"
    );
  };

  const [showPlayerAccessModal, setShowPlayerAccessModal] = useState(false);
  const [isFullTableRevealed, setIsFullTableRevealed] = useState(false);
  const [revealedPlayerId, setRevealedPlayerId] = useState<string | null>(null);
  const [screenCaptureShieldActive, setScreenCaptureShieldActive] = useState(false);
  const [screenshotAttemptNotice, setScreenshotAttemptNotice] = useState<string | null>(null);
  const [teamNameModalConfig, setTeamNameModalConfig] = useState<{
    isOpen: boolean;
    ourTeamName: string;
    opponentTeamName?: string;
    targetMatchId?: string;
    targetMatchTitle?: string;
    showOpponentEdit?: boolean;
  }>({
    isOpen: false,
    ourTeamName: "Lancers",
    opponentTeamName: "",
    showOpponentEdit: true,
  });
  const [setScoreModalConfig, setSetScoreModalConfig] = useState<{
    isOpen: boolean;
    set: any;
    matchTitle?: string;
  }>({
    isOpen: false,
    set: null,
  });
  const [statCorrectionConfig, setStatCorrectionConfig] = useState<{
    isOpen: boolean;
    initialMatchId?: string | null;
    initialSetId?: string | null;
    initialPlayerId?: string | null;
  }>({
    isOpen: false,
    initialMatchId: null,
    initialSetId: null,
    initialPlayerId: null,
  });
  const [showPositioning, setShowPositioning] = useState(false);
  const [viewOppStats, setViewOppStats] = useState(false);
  const [subPairs, setSubPairs] = useState<{ [key: string]: string }>({});
  const [pendingAutoSub, setPendingAutoSub] = useState<{
    outId: string;
    inId: string;
    isOpp?: boolean;
  } | null>(null);
  const [tempNote, setTempNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [setWinnerModal, setSetWinnerModal] = useState(null);
  const [nextSetServing, setNextSetServing] = useState<"ucc" | "opp">("opp");
  const [careerPlayerName, setCareerPlayerName] = useState(null);
  const [statBreakdownModal, setStatBreakdownModal] = useState<{
    isOpen: boolean;
    selectedPlayer: any;
    category: "serve" | "attack" | "block" | "pass" | "dig";
    titleContext?: string;
  }>({
    isOpen: false,
    selectedPlayer: null,
    category: "serve",
    titleContext: "",
  });
  const [statFilter, setStatFilter] = useState("all");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installModalTab, setInstallModalTab] = useState<"auto" | "ios" | "android" | "desktop">("auto");
  const [showRetired, setShowRetired] = useState(false);
  const [compareMode, setCompareMode] = useState("players"); // "players" or "events"
  const [comparePlayer1, setComparePlayer1] = useState("");
  const [comparePlayer2, setComparePlayer2] = useState("");
  const [compareEvent1, setCompareEvent1] = useState("season"); // "season" or eventId or matchId
  const [compareEvent2, setCompareEvent2] = useState("");
  const [trackOppReceives, setTrackOppReceives] = useState(
    () => localStorage.getItem("ucc_track_opp_receives") !== "false",
  );
  const [trackedCategories, setTrackedCategories] = useState(() => {
    const saved = localStorage.getItem("ucc_tracked_categories");
    const defaults = { Pass: true, Serve: true, Attack: true, Block: true, Dig: true };
    return saved
      ? { ...defaults, ...JSON.parse(saved) }
      : defaults;
  });

  useEffect(() => {
    localStorage.setItem("ucc_track_opp_receives", trackOppReceives.toString());
  }, [trackOppReceives]);

  useEffect(() => {
    localStorage.setItem(
      "ucc_tracked_categories",
      JSON.stringify(trackedCategories),
    );
  }, [trackedCategories]);

  // Hierarchical Stats Navigation State
  const [statsPath, setStatsPath] = useState([
    { level: "season", id: "all", name: "Season Totals (Game & Practice)" },
  ]);
  const [subnavCategoryFilter, setSubnavCategoryFilter] = useState("all");
  const [expandedOppTeams, setExpandedOppTeams] = useState({});
  const isProcessingPointRef = useRef(false);
  const lastActiveViewRef = useRef<"game" | "open_practice" | null>(null);
  const lastActiveMatchRef = useRef<any>(null);
  const [debugNotice, setDebugNotice] = useState<string | null>(null);

  // Track active game view and session for reliable return navigation
  useEffect(() => {
    if (view === "game" || view === "open_practice") {
      lastActiveViewRef.current = view;
      if (activeMatch) {
        lastActiveMatchRef.current = activeMatch;
        try {
          sessionStorage.setItem("ucc_last_active_match_id", activeMatch.id);
        } catch (e) {}
      }
    }
  }, [view, activeMatch]);

  // Robust Return-to-Game Handler that supports games, open practice, and live sessions
  const returnToActiveGame = useCallback(() => {
    console.log("[VBALL DEBUG] returnToActiveGame invoked.", {
      currentView: view,
      hasActiveMatch: !!activeMatch,
      activeMatchId: activeMatch?.id,
      lastActiveView: lastActiveViewRef.current,
      activeSetId,
      score,
      setsWon,
    });

    // 1. If activeMatch is present in component state
    if (activeMatch) {
      if (
        activeMatch.type === "Practice" &&
        activeMatch.format === "Open Drill (Grid)"
      ) {
        setView("open_practice");
        return;
      }
      setView("game");
      return;
    }

    // 2. If activeMatch is null, check for live match in appData.matches
    const liveMatches = (appData.matches || []).filter((m: any) => m.isLive === true);
    if (liveMatches.length > 0) {
      const latestMatch = liveMatches[liveMatches.length - 1];
      const matchSets = (appData.sets || [])
        .filter((s: any) => s.matchId === latestMatch.id)
        .sort((a: any, b: any) => a.setNum - b.setNum);
      const latestSet = matchSets[matchSets.length - 1];

      setActiveMatch(latestMatch);
      setActiveSetId(latestSet ? latestSet.id : null);
      setOpponentName(latestMatch.opponent || "Opponent");
      setMatchFormat(latestMatch.format || "Best of 5");

      if (appData.opponents?.[latestMatch.opponent]) {
        const opp = appData.opponents[latestMatch.opponent];
        setOppLineup(opp.defaultLineup || ["O1", "O2", "O3", "O4", "O5", "O6"]);
        setOppNotesMem(opp.notes || {});
        setOppSetterId(opp.setterId || null);
        setOppLiberoId(opp.liberoId || "");
      }

      if (latestMatch.type === "Practice" && latestMatch.format === "Open Drill (Grid)") {
        setView("open_practice");
      } else {
        setView("game");
      }
      return;
    }

    // 3. Fallback to lastActiveMatchRef if remembered
    if (lastActiveMatchRef.current) {
      setActiveMatch(lastActiveMatchRef.current);
      if (lastActiveViewRef.current === "open_practice") {
        setView("open_practice");
      } else {
        setView("game");
      }
      return;
    }

    // 4. If no game is running, go to menu
    console.warn("[VBALL DEBUG] No active or live match session found. Returning to menu.");
    setView("menu");
  }, [activeMatch, appData.matches, appData.sets, appData.opponents, view, activeSetId, score, setsWon]);

  // Comprehensive System Diagnostics Tool
  const runDebugDiagnostics = useCallback(() => {
    const issues: string[] = [];
    const liveMatches = (appData.matches || []).filter((m: any) => m.isLive === true);
    const hasLiveOrActive = !!activeMatch || liveMatches.length > 0;

    const report = {
      CurrentView: view,
      ActiveTeam: activeTeam || "None",
      ActiveMatchId: activeMatch?.id || (liveMatches[0] ? `${liveMatches[0].id} (live in matches)` : "None"),
      ActiveMatchOpponent: activeMatch?.opponent || (liveMatches[0] ? liveMatches[0].opponent : "None"),
      ActiveSetId: activeSetId || "None",
      Score: `${score.ucc} - ${score.opp}`,
      SetsWon: `${setsWon.ucc} - ${setsWon.opp}`,
      CurrentSetNum: currentSetNum,
      Serving: serving,
      LineupAssigned: lineup ? `${lineup.filter(Boolean).length}/6 players` : "None",
      LastActiveView: lastActiveViewRef.current || "None",
      TotalMatches: appData.matches?.length || 0,
      LiveMatchesCount: liveMatches.length,
      TotalSets: appData.sets?.length || 0,
      TotalStatsCount: appData.stats?.length || 0,
      Role: effectiveRole,
      FirebaseConnected: isFirebaseAvailable,
    };

    if (!hasLiveOrActive) {
      issues.push("No active match in state or live match in matches list.");
    }
    if (activeMatch && !activeSetId) {
      issues.push("Active match is present but activeSetId is null.");
    }
    if (view === "game" && lineup.some((p) => p === null)) {
      issues.push("Court lineup has unassigned positions.");
    }

    console.group("🏐 [VOLLEYBALL DEBUG & DIAGNOSTICS REPORT]");
    console.table(report);
    if (issues.length > 0) {
      console.warn("⚠️ Detected Session Notices:", issues);
    } else {
      console.log("✅ All game and navigation systems healthy and verified.");
    }
    console.groupEnd();

    const noticeText = issues.length === 0
      ? `Debug OK: Game "${activeMatch ? activeMatch.opponent : "Match"}" Set ${currentSetNum} (${score.ucc}-${score.opp}) ready to return.`
      : `Debug Notice: ${issues.join(" | ")}`;

    setDebugNotice(noticeText);
    setTimeout(() => setDebugNotice(null), 5000);
    return { report, issues };
  }, [view, activeTeam, activeMatch, activeSetId, score, setsWon, currentSetNum, serving, lineup, appData, effectiveRole, isFirebaseAvailable]);

  // Expose global debug interface for console verification
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__vball_debug = {
        getState: () => ({
          view,
          activeTeam,
          activeMatch,
          activeSetId,
          score,
          setsWon,
          currentSetNum,
          serving,
          lineup,
          lastActiveView: lastActiveViewRef.current,
        }),
        returnToGame: returnToActiveGame,
        diagnose: runDebugDiagnostics,
        setView: (v: string) => setView(v),
      };
    }
  }, [view, activeTeam, activeMatch, activeSetId, score, setsWon, currentSetNum, serving, lineup, returnToActiveGame, runDebugDiagnostics]);

  // -------------------------------------------------------------
  // INITIALIZATION (APP ICON & FIREBASE OR LOCAL FALLBACK)
  // -------------------------------------------------------------

  useEffect(() => {
    // Favicon logic removed to prevent missing image error
  }, []);

  useEffect(() => {
    if (!auth || !isFirebaseAvailable) {
      console.warn("Auth service unavailable - skipping login listener");
      setLoadingAuth(false);
      return;
    }

    // Safety timeout for the loading screen
    const timeout = setTimeout(() => {
      setAuthTimeoutReached(true);
    }, 8000);

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, async (u) => {
        clearTimeout(timeout);
        setUser(u);
        setLoadingAuth(false);
        const storedTeam = localStorage.getItem("ucc_vball_active_team");
        if (!u && !storedTeam) {
          setView("team_select");
        }
      });
    } catch (err) {
      console.error("Auth Listener Error:", err);
      setLoadingAuth(false);
    }

    // Also verify connection in background
    if (db) {
      getDocFromServer(doc(db, "test", "connection")).catch((e) => {
        if (e.message?.includes("insufficient permissions")) {
          console.log("Firebase connection verified.");
        }
      });
    }

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []); // Run on initial mount only! Do not tear down on view changes!

  useEffect(() => {
    if (!user || !db || !isFirebaseAvailable) {
      setMyTeams([]);
      return;
    }
    let unsub = () => {};
    try {
      unsub = onSnapshot(
        doc(db, "users", user.uid),
        (docSnap) => {
          if (docSnap.exists() && docSnap.data().teams) {
            setMyTeams(docSnap.data().teams);
          } else {
            setMyTeams([]);
          }
        },
        (err) => {
          console.error("Teams Sync Error:", err);
        },
      );
    } catch (err) {
      console.error("Teams Listener Setup Error:", err);
    }
    return () => unsub();
  }, [user]);

  // Role Recovery Mechanism
  // This must run every time myTeams updates, otherwise if it's empty during initial load, we miss the role sync.
  useEffect(() => {
    if (!user || !isFirebaseAvailable || !activeTeam || myTeams.length === 0)
      return;
    const existingTeam = myTeams.find((t) => t.id === activeTeam);
    if (existingTeam) {
      setDoc(
        doc(db, `${publicPath}/${activeTeam}/members/${user.uid}`),
        { uid: user.uid, joinedAt: serverTimestamp(), role: existingTeam.role },
        { merge: true },
      ).catch((e) => console.log("Role sync ignored", e));
    }
  }, [user, activeTeam, myTeams]);

  // Member Coach Role Sync
  useEffect(() => {
    if (!user || !isFirebaseAvailable || !activeTeam || !db) return;
    let unsub = () => {};
    try {
      unsub = onSnapshot(
        doc(db, `${publicPath}/${activeTeam}/members/${user.uid}`),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data?.role === "coach") {
              localStorage.setItem(`ucc_team_role_${activeTeam}`, "coach");
              localStorage.setItem("ucc_current_role", "coach");
              localStorage.setItem(`ucc_coach_unlocked_${activeTeam}`, "true");
              setMyTeams((prev: any[]) =>
                prev.map((t) => (t.id === activeTeam ? { ...t, role: "coach" } : t)),
              );
            }
          }
        },
        (err) => console.log("Member role listener error:", err),
      );
    } catch (e) {
      console.log("Member role setup error:", e);
    }
    return () => unsub();
  }, [user, activeTeam]);

  // Player Stats Access Audit Logger
  const logPlayerStatsAccess = async (targetViewName?: string) => {
    if (!user || !activeTeam || !db) return;
    try {
      const isPlayer = isPlayerRole;

      const userEmail = user.email || "Unknown Google Account";
      const userDisplayName = user.displayName || user.email?.split("@")[0] || "Player";
      const userPhoto = user.photoURL || "";

      // 1. Update or create member record in the team with Google account details
      const memberRef = doc(db, `${publicPath}/${activeTeam}/members/${user.uid}`);
      await setDoc(
        memberRef,
        {
          uid: user.uid,
          email: userEmail,
          displayName: userDisplayName,
          photoURL: userPhoto,
          role: isPlayer ? "player" : (activeTeamProfile?.role || "coach"),
          lastStatsAccess: serverTimestamp(),
          lastActive: serverTimestamp(),
          lastViewedPath: targetViewName || "Stats Overview",
          device: navigator.userAgent.includes("iPhone")
            ? "iPhone (iOS)"
            : navigator.userAgent.includes("iPad")
            ? "iPad (iPadOS)"
            : navigator.userAgent.includes("Android")
            ? "Android Mobile"
            : navigator.userAgent.includes("Mac")
            ? "Mac (Desktop)"
            : navigator.userAgent.includes("Win")
            ? "Windows PC"
            : "Mobile / Web Device",
        },
        { merge: true },
      );

      // 2. Also log audit record in player_access_logs if player role
      if (isPlayer) {
        const logId = `${user.uid}_${Date.now()}`;
        const logRef = doc(db, `${publicPath}/${activeTeam}/player_access_logs/${logId}`);
        await setDoc(logRef, {
          id: logId,
          uid: user.uid,
          email: userEmail,
          displayName: userDisplayName,
          photoURL: userPhoto,
          role: "player",
          accessedAt: serverTimestamp(),
          view: targetViewName || "Stats Overview",
          device: navigator.userAgent.includes("iPhone")
            ? "iPhone (iOS)"
            : navigator.userAgent.includes("iPad")
            ? "iPad (iPadOS)"
            : navigator.userAgent.includes("Android")
            ? "Android Mobile"
            : navigator.userAgent.includes("Mac")
            ? "Mac (Desktop)"
            : navigator.userAgent.includes("Win")
            ? "Windows PC"
            : "Mobile / Web Device",
        });
      }
    } catch (err) {
      console.warn("Player stats access audit log notice:", err);
    }
  };

  // Automatically record stats access whenever a player is in the stats view
  useEffect(() => {
    if (view === "stats" && user && activeTeam) {
      const activeNavName = statsPath[statsPath.length - 1]?.name || "Season Totals";
      logPlayerStatsAccess(activeNavName);
    }
  }, [view, activeTeam, user, statsPath]);

  // Netflix-Grade Screen Capture Prevention & Instant Solid Blackout
  // Produces a 100% pitch-black screen upon screenshot attempts, blur, visibility changes,
  // hardware button triggers, or screen capture shortcuts (matching Netflix DRM behavior).
  useEffect(() => {
    if (!isShieldProtectionActive) {
      document.documentElement.classList.remove("player-restricted");
      document.documentElement.classList.remove("shield-active");
      document.body.classList.remove("player-restricted");
      document.body.classList.remove("shield-active");
      setScreenCaptureShieldActive(false);
      return;
    }

    document.documentElement.classList.add("player-restricted");
    document.body.classList.add("player-restricted");

    let toastTimeout: any = null;
    const triggerSecurityNotice = (msg: string) => {
      setScreenshotAttemptNotice(msg);
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        setScreenshotAttemptNotice(null);
      }, 4000);
    };

    const activateShield = () => {
      if (!isShieldProtectionActive) return;
      document.documentElement.classList.add("shield-active");
      document.body.classList.add("shield-active");
      setScreenCaptureShieldActive(true);
      setRevealedPlayerId(null);
      setIsFullTableRevealed(false);
    };

    const handleTouchCancel = () => {
      // Hardware screenshot combos (Power + Vol) interrupt touches
      setRevealedPlayerId(null);
      setIsFullTableRevealed(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen (Windows/Linux)
      if (e.key === "PrintScreen" || e.code === "PrintScreen" || (e as any).keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        activateShield();
        triggerSecurityNotice("Screenshots are blocked (Protected View).");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText("Protected Content. Screenshots are blocked.").catch(() => {});
        }
        return;
      }

      // Preemptive modifier interception:
      // Mac screenshot combos (Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5, Cmd+Shift+6)
      // Windows Snipping Tool (Win+Shift+S)
      // The moment both Meta/Ctrl and Shift are pressed down, screen turns solid black immediately
      const isMetaShift = (e.metaKey || e.ctrlKey) && e.shiftKey;
      if (isMetaShift) {
        e.preventDefault();
        e.stopPropagation();
        activateShield();
        triggerSecurityNotice("Screen capture shortcuts are blocked.");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText("Protected Content. Screenshots are blocked.").catch(() => {});
        }
        return;
      }

      // Print / PDF export shortcuts: Ctrl+P / Cmd+P
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P" || e.code === "KeyP")) {
        e.preventDefault();
        e.stopPropagation();
        activateShield();
        triggerSecurityNotice("Printing and PDF export are disabled.");
        return;
      }

      // Save page shortcuts: Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S" || e.code === "KeyS")) {
        e.preventDefault();
        e.stopPropagation();
        activateShield();
        triggerSecurityNotice("Saving content is disabled.");
        return;
      }

      // DevTools and View Source shortcuts: F12, Ctrl+U, Ctrl+Shift+I/J/C
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U" || e.code === "KeyU")) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "I", "j", "J", "c", "C"].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.code === "PrintScreen" || (e as any).keyCode === 44) {
        e.preventDefault();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText("Protected Content. Screenshots are blocked.").catch(() => {});
        }
        activateShield();
        triggerSecurityNotice("Screenshots are blocked (Protected View).");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerSecurityNotice("Right-click menu is disabled in protected view.");
    };

    const handleBeforePrint = (e: Event) => {
      e.preventDefault();
      activateShield();
      triggerSecurityNotice("Printing and PDF export are disabled.");
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData("text/plain", "Protected Content. Screen capture and copying are prohibited.");
      }
    };

    window.addEventListener("touchcancel", handleTouchCancel, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("copy", handleCopy);
    window.addEventListener("cut", handleCopy);

    // Intercept navigator.mediaDevices.getDisplayMedia to block screen capture extensions
    let origGDM: any = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        origGDM = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getDisplayMedia = async function(...args) {
          activateShield();
          throw new DOMException("Screen capture is prohibited by security policy.", "NotAllowedError");
        };
      } catch {}
    }

    return () => {
      clearTimeout(toastTimeout);
      document.documentElement.classList.remove("player-restricted");
      document.documentElement.classList.remove("shield-active");
      document.body.classList.remove("player-restricted");
      document.body.classList.remove("shield-active");
      window.removeEventListener("touchcancel", handleTouchCancel, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("cut", handleCopy);
      if (origGDM && navigator.mediaDevices) {
        try {
          navigator.mediaDevices.getDisplayMedia = origGDM;
        } catch {}
      }
    };
  }, [isShieldProtectionActive]);

  // LOAD DATA BASED ON ACTIVE TEAM
  useEffect(() => {
    if (!activeTeam) return;

    // Reset local state when switching teams
    setAppData({
      roster: DEFAULT_ROSTER,
      savedRosters: {},
      savedLineups: {},
      opponents: {},
      matches: [],
      sets: [],
      stats: [],
    });
    setActiveMatch(null);
    setActiveSetId(null);

    if (!isFirebaseAvailable) {
      try {
        const storedData = localStorage.getItem(`ucc_vball_db_${activeTeam}`);
        if (storedData) setAppData(JSON.parse(storedData));
      } catch (e) {
        console.error("Local storage load failed", e);
      }
      return;
    }

    if (!user) return;

    // Scoped Firebase Listeners
    const unsubSettings = onSnapshot(
      doc(db, `${publicPath}/${activeTeam}/settings/core`),
      (d) => {
        if (d.exists()) setAppData((prev) => ({ ...prev, ...d.data() }));
        else
          setDoc(doc(db, `${publicPath}/${activeTeam}/settings/core`), {
            roster: DEFAULT_ROSTER,
            savedRosters: {},
            savedLineups: {},
          });
      },
      (err) => console.error("Firebase settings error:", err),
    );

    const unsubOpponents = onSnapshot(
      collection(db, `${publicPath}/${activeTeam}/opponents`),
      (snap) => {
        const opps = {};
        snap.forEach((d) => {
          opps[d.id] = d.data();
        });
        setAppData((prev) => ({ ...prev, opponents: opps }));
      },
      (err) => console.error("Firebase opponents error:", err),
    );

    const unsubMatches = onSnapshot(
      collection(db, `${publicPath}/${activeTeam}/matches`),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push(d.data()));
        setAppData((prev) => ({ ...prev, matches: arr }));
      },
      (err) => console.error("Firebase matches error:", err),
    );

    const unsubSets = onSnapshot(
      collection(db, `${publicPath}/${activeTeam}/sets`),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push(d.data()));
        setAppData((prev) => ({ ...prev, sets: arr }));
      },
      (err) => console.error("Firebase sets error:", err),
    );

    const unsubStats = onSnapshot(
      collection(db, `${publicPath}/${activeTeam}/stats`),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push(d.data()));
        setAppData((prev) => ({ ...prev, stats: arr }));
      },
      (err) => console.error("Firebase stats error:", err),
    );

    return () => {
      unsubSettings();
      unsubOpponents();
      unsubMatches();
      unsubSets();
      unsubStats();
    };
  }, [user, activeTeam]);

  useEffect(() => {
    // Detect standalone mode (already installed)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsAppInstalled(isStandalone);

    // Detect iOS devices
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (activeSetId && appData.sets.length > 0) {
      const currentSet = appData.sets.find((s) => s.id === activeSetId);
      if (currentSet) {
        if (
          score.ucc !== currentSet.scoreUcc ||
          score.opp !== currentSet.scoreOpp
        ) {
          setScore({
            ucc: currentSet.scoreUcc || 0,
            opp: currentSet.scoreOpp || 0,
          });
        }
        if (
          currentSet.lineup &&
          JSON.stringify(lineup) !== JSON.stringify(currentSet.lineup)
        ) {
          setLineup(currentSet.lineup);
        }
        if (currentSet.serving && serving !== currentSet.serving) {
          setServing(currentSet.serving);
        }
        if (currentSet.rallyPhase && rallyPhase !== currentSet.rallyPhase) {
          setRallyPhase(currentSet.rallyPhase);
        }
      }
    }
  }, [appData.sets, activeSetId, lineup, score, serving, rallyPhase]);

  useEffect(() => {
    if (setWinnerModal) {
      setNextSetServing(serving === "ucc" ? "opp" : "ucc");
    }
  }, [setWinnerModal, serving]);

  // -------------------------------------------------------------
  // HELPER FUNCTIONS & DUAL-MODE DATA WRITES
  // -------------------------------------------------------------

  const writeLocalDb = (updatedData) => {
    setAppData(updatedData);
    if (!isFirebaseAvailable)
      localStorage.setItem(
        `ucc_vball_db_${activeTeam}`,
        JSON.stringify(updatedData),
      );
  };

  const sortPlayersByNumberThenAlpha = useCallback(
    (
      a: { number?: string | number; name?: string; id?: string } | null | undefined,
      b: { number?: string | number; name?: string; id?: string } | null | undefined,
    ) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;

      const rawA = a.number != null ? String(a.number).trim() : "";
      const rawB = b.number != null ? String(b.number).trim() : "";
      const numA = parseInt(rawA.replace(/\D/g, ""), 10);
      const numB = parseInt(rawB.replace(/\D/g, ""), 10);
      const hasNumA = !isNaN(numA) && rawA !== "";
      const hasNumB = !isNaN(numB) && rawB !== "";

      if (hasNumA && hasNumB) {
        if (numA !== numB) return numA - numB;
        return (a.name || a.id || "").localeCompare(
          b.name || b.id || "",
          undefined,
          { sensitivity: "base" },
        );
      }
      if (hasNumA && !hasNumB) return -1;
      if (!hasNumA && hasNumB) return 1;
      return (a.name || a.id || "").localeCompare(
        b.name || b.id || "",
        undefined,
        { sensitivity: "base" },
      );
    },
    [],
  );

  const sortedRoster = useMemo(() => {
    return [...(appData.roster || [])].sort(sortPlayersByNumberThenAlpha);
  }, [appData.roster, sortPlayersByNumberThenAlpha]);

  const updateSetState = async (updates) => {
    if (isFirebaseAvailable && user && activeSetId) {
      try {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/sets/${activeSetId}`),
          updates,
          { merge: true },
        );
      } catch (e) {
        console.error("Failed to sync set state:", e);
      }
    } else if (activeSetId) {
      writeLocalDb({
        ...appData,
        sets: (appData.sets || []).map((s) =>
          s.id === activeSetId ? { ...s, ...updates } : s,
        ),
      });
    }
  };

  const rotateUCC = () => {
    setLineup((prev) => {
      let newLineup = [...prev.slice(1), prev[0]];
      // If libero rotates to the front row (indices 1, 2, 3 correspond to positions 2, 3, 4)
      if (
        liberoId &&
        (newLineup[1] === liberoId ||
          newLineup[2] === liberoId ||
          newLineup[3] === liberoId)
      ) {
        if (liberoSwappedOutId) {
          const idx = newLineup.indexOf(liberoId);
          if (idx !== -1) {
            newLineup[idx] = liberoSwappedOutId;
            setLiberoSwappedOutId(null);
          }
        }
      }
      updateSetState({ lineup: newLineup });
      return newLineup;
    });
  };
  const rotateOpp = () => {
    setOppLineup((prev) => {
      const newLineup = [...prev.slice(1), prev[0]];
      updateSetState({ oppLineup: newLineup });
      return newLineup;
    });
  };

  const changeRallyPhase = (newPhase) => {
    setRallyPhase(newPhase);
    updateSetState({ rallyPhase: newPhase });
  };

  const addPlayer = async () => {
    if (newPlayerName) {
      let finalName = newPlayerName.trim();
      const existingNames = appData.roster.map(p => p.name.toLowerCase());
      
      if (existingNames.includes(finalName.toLowerCase())) {
        const initials = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let i = 0; i < initials.length; i++) {
          const testName = `${finalName} ${initials[i]}.`;
          if (!existingNames.includes(testName.toLowerCase())) {
            finalName = testName;
            break;
          }
        }
      }

      const newPlayer = {
        id: Date.now().toString(),
        name: finalName,
        number: newPlayerNum || "",
        isRetired: false,
      };
      if (isFirebaseAvailable && user) {
        const newRoster = [...appData.roster, newPlayer];
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/settings/core`),
          { roster: newRoster },
          { merge: true },
        );
      } else if (!isFirebaseAvailable) {
        writeLocalDb({ ...appData, roster: [...appData.roster, newPlayer] });
      }
      setNewPlayerName("");
      setNewPlayerNum("");
    } else {
      alert("Please fill in Name and Number.");
    }
  };

  const updatePlayer = async (id, updates) => {
    const newRoster = appData.roster.map((p) =>
      p.id === id ? { ...p, ...updates } : p,
    );
    setAppData((prev) => ({ ...prev, roster: newRoster }));
    if (isFirebaseAvailable && user) {
      await setDoc(
        doc(db, `${publicPath}/${activeTeam}/settings/core`),
        { roster: newRoster },
        { merge: true },
      );
    } else if (!isFirebaseAvailable) {
      writeLocalDb({ ...appData, roster: newRoster });
    }
  };

  const removePlayer = async (id) => {
    const p = appData.roster.find((player) => player.id === id);
    if (
      p &&
      !confirm(`Are you sure you want to remove ${p.name} from the roster?`)
    )
      return;

    const newRoster = appData.roster.filter((p) => p.id !== id);
    if (isFirebaseAvailable && user) {
      await setDoc(
        doc(db, `${publicPath}/${activeTeam}/settings/core`),
        { roster: newRoster },
        { merge: true },
      );
    } else if (!isFirebaseAvailable) {
      writeLocalDb({ ...appData, roster: newRoster });
    }
    if (lineup.includes(id))
      setLineup(lineup.map((p) => (p === id ? null : p)));
  };

  const saveRosterAsPreset = async (suppliedNameTitle) => {
    const finalName =
      typeof suppliedNameTitle === "string"
        ? suppliedNameTitle
        : rosterPresetName;
    if (!finalName || !finalName.trim()) {
      setErrorMsg("Please enter a name for the roster preset.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    const updatedRosters = {
      ...appData.savedRosters,
      [finalName]: appData.roster,
    };
    if (isFirebaseAvailable && user) {
      await setDoc(
        doc(db, `${publicPath}/${activeTeam}/settings/core`),
        { savedRosters: updatedRosters },
        { merge: true },
      );
    } else if (!isFirebaseAvailable) {
      writeLocalDb({ ...appData, savedRosters: updatedRosters });
    }
    setRosterPresetName(finalName);
    setErrorMsg(`Roster saved as "${finalName}"`);
    setTimeout(() => setErrorMsg(""), 3000);
  };

  const loadRosterPreset = async (name) => {
    if (name && appData.savedRosters[name]) {
      const loadedRoster = appData.savedRosters[name];
      if (isFirebaseAvailable && user) {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/settings/core`),
          { roster: loadedRoster },
          { merge: true },
        );
      } else if (!isFirebaseAvailable) {
        writeLocalDb({ ...appData, roster: loadedRoster });
      }
      const currentIds = loadedRoster.map((p) => p.id);
      setLineup((prev) =>
        prev.map((id) => (currentIds.includes(id) ? id : null)),
      );
    }
  };

  const importRosterFromTeam = async (sourceTeamId) => {
    if (!sourceTeamId || sourceTeamId === activeTeam) return;
    if (
      !confirm(
        "This will merge the selected team's roster into your current roster. Continue?",
      )
    )
      return;

    let importedRoster = [];

    if (isFirebaseAvailable && user) {
      try {
        const docSnap = await getDoc(
          doc(db, `${publicPath}/${sourceTeamId}/settings/core`),
        );
        if (docSnap.exists() && docSnap.data().roster) {
          importedRoster = docSnap.data().roster;
        }
      } catch (e) {
        console.error("Failed to import roster from Firebase:", e);
      }
    } else {
      const sourceDbRaw = localStorage.getItem(`ucc_vball_db_${sourceTeamId}`);
      if (sourceDbRaw) {
        const sourceDb = JSON.parse(sourceDbRaw);
        if (sourceDb.roster) importedRoster = sourceDb.roster;
      }
    }

    if (importedRoster.length > 0) {
      // Merge by ID to prevent duplicates
      const currentIds = new Set(appData.roster.map((p) => p.id));
      const newPlayers = importedRoster.filter((p) => !currentIds.has(p.id));
      const mergedRoster = [...appData.roster, ...newPlayers];

      const newAppData = { ...appData, roster: mergedRoster };
      if (isFirebaseAvailable && user) {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/settings/core`),
          { roster: mergedRoster },
          { merge: true },
        );
      } else {
        writeLocalDb(newAppData);
      }
      setAppData(newAppData);
    }
  };

  const saveLineupAsPreset = async () => {
    if (!lineupPresetName.trim()) {
      alert("Please enter a name for the lineup preset.");
      return;
    }
    const updatedLineups = {
      ...appData.savedLineups,
      [lineupPresetName]: { lineup, liberoId },
    };
    try {
      if (isFirebaseAvailable && user) {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/settings/core`),
          { savedLineups: updatedLineups },
          { merge: true },
        );
      } else if (!isFirebaseAvailable) {
        writeLocalDb({ ...appData, savedLineups: updatedLineups });
      }
      setLineupPresetName("");
      alert(`Lineup saved as "${lineupPresetName}"`);
    } catch (e) {
      console.error(e);
      alert("Failed to save lineup");
    }
  };

  const loadLineupPreset = (name) => {
    if (name && appData.savedLineups?.[name]) {
      const preset = appData.savedLineups[name];
      setLineup(preset.lineup || [null, null, null, null, null, null]);
      setLiberoId(preset.liberoId || "");
    }
  };

  const handleOpponentNameChange = (e) => {
    const val = e.target.value.replace(/\//g, "-");
    setOpponentName(val);
    const existingKey = Object.keys(appData.opponents).find(
      (o) => o.toLowerCase() === val.toLowerCase(),
    );
    if (existingKey) {
      const opp = appData.opponents[existingKey];
      setTempOppLineup(opp.defaultLineup || ["", "", "", "", "", ""]);
      setOppNotesMem(opp.notes || {});
      setOppSetterId(opp.setterId || null);
      setOppLiberoId(opp.liberoId || "");
    } else {
      setTempOppLineup(["", "", "", "", "", ""]);
      setOppNotesMem({});
      setOppSetterId(null);
      setOppLiberoId("");
    }
  };

  const startSetup = async (type) => {
    enforceFullscreen();
    if (type === "Practice") {
      const todayDateStr = new Date().toLocaleDateString();
      const existingTodayPractice = appData.matches.find(
        (m) =>
          m.type === "Practice" &&
          m.date &&
          new Date(m.date).toLocaleDateString() === todayDateStr,
      );

      if (existingTodayPractice) {
        const existingSets = appData.sets.filter(
          (s) => s.matchId === existingTodayPractice.id,
        );
        let targetSetId = existingSets[0]?.id;
        if (!targetSetId) {
          targetSetId = Date.now().toString() + "_set";
          const newSet = {
            id: targetSetId,
            matchId: existingTodayPractice.id,
            setNum: 1,
            scoreUcc: 0,
            scoreOpp: 0,
          };
          if (isFirebaseAvailable && user) {
            try {
              await setDoc(
                doc(db, `${publicPath}/${activeTeam}/sets/${targetSetId}`),
                newSet,
              );
            } catch (err) {
              console.error("Error creating practice set:", err);
            }
          } else if (!isFirebaseAvailable) {
            writeLocalDb({
              ...appData,
              sets: [...appData.sets, newSet],
            });
          }
        }

        setActiveMatch(existingTodayPractice);
        setActiveSetId(targetSetId);
        setScore({ ucc: 0, opp: 0 });
        setSetsWon({ ucc: 0, opp: 0 });
        setCurrentSetNum(1);
        setView("open_practice");
        return;
      }

      const matchId = Date.now().toString();
      const newMatch = {
        id: matchId,
        date: new Date().toISOString(),
        type: "Practice",
        title: "Open Drill",
        opponent: "Practice",
        format: "Open Drill (Grid)",
        cap: "",
        isLive: true,
      };

      const setId = Date.now().toString() + "_set";
      const newSet = {
        id: setId,
        matchId: matchId,
        setNum: 1,
        scoreUcc: 0,
        scoreOpp: 0,
      };

      if (isFirebaseAvailable && user) {
        const batch = writeBatch(db);
        batch.set(
          doc(db, `${publicPath}/${activeTeam}/matches/${matchId}`),
          newMatch,
        );
        batch.set(doc(db, `${publicPath}/${activeTeam}/sets/${setId}`), newSet);
        try {
          await batch.commit();
        } catch (err) {
          console.error("Practice start error", err);
          alert("Failed to start practice mode. Details: " + err.message);
          return;
        }
      } else if (!isFirebaseAvailable) {
        writeLocalDb({
          ...appData,
          matches: [...appData.matches, newMatch],
          sets: [...appData.sets, newSet],
        });
      }

      setActiveMatch(newMatch);
      setActiveSetId(setId);
      setScore({ ucc: 0, opp: 0 });
      setSetsWon({ ucc: 0, opp: 0 });
      setCurrentSetNum(1);
      setView("open_practice");
      return;
    }

    setMatchType(type);
    setView("setup");
    if (activeMatch) {
      setActiveMatch(null);
      setActiveSetId(null);
      setScore({ ucc: 0, opp: 0 });
      setSetsWon({ ucc: 0, opp: 0 });
      setCurrentSetNum(1);
      setOpponentName("");
      setTourneyTitle("");
      setScoreCap("");
      setLiberoId("");
      setOppLiberoId("");
      setOppSetterId(null);
      setOppNotesMem({});
    }
  };

  const [isJoinLiveModalOpen, setIsJoinLiveModalOpen] = useState(false);

  const joinLiveMatch = () => {
    const sortedMatches = [...appData.matches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const liveMatches = sortedMatches.filter((m) => m.isLive === true);
    if (liveMatches.length === 0) {
      alert("No recent live matches found.");
      return;
    }
    setIsJoinLiveModalOpen(true);
  };

  const confirmJoinLiveMatch = () => {
    setIsJoinLiveModalOpen(false);
    enforceFullscreen();
    const sortedMatches = [...appData.matches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const liveMatches = sortedMatches.filter((m) => m.isLive === true);
    const latestMatch =
      liveMatches.length > 0 ? liveMatches[liveMatches.length - 1] : null;
    if (!latestMatch) {
      alert("No recent live matches found.");
      return;
    }

    const matchSets = appData.sets
      .filter((s) => s.matchId === latestMatch.id)
      .sort((a, b) => a.setNum - b.setNum);
    const latestSet = matchSets[matchSets.length - 1];

    setActiveMatch(latestMatch);
    setActiveSetId(latestSet ? latestSet.id : null);
    setOpponentName(latestMatch.opponent);
    setMatchFormat(latestMatch.format);

    if (appData.opponents[latestMatch.opponent]) {
      const opp = appData.opponents[latestMatch.opponent];
      setOppLineup(opp.defaultLineup || ["O1", "O2", "O3", "O4", "O5", "O6"]);
      setOppNotesMem(opp.notes || {});
      setOppSetterId(opp.setterId || null);
      setOppLiberoId(opp.liberoId || "");
    }

    setView("game");
  };

  const handleEndGameLive = async () => {
    if (!activeMatch) return;
    if (
      window.confirm(
        "Are you sure you want to end this game? It will become inaccessible for new users to join.",
      )
    ) {
      if (isFirebaseAvailable && user && activeTeam) {
        try {
          await setDoc(
            doc(db, `${publicPath}/${activeTeam}/matches/${activeMatch.id}`),
            { isLive: false },
            { merge: true },
          );
        } catch (e) {
          console.error("Failed to mark match complete", e);
        }
      }

      const newMatches = appData.matches.map((m) =>
        m.id === activeMatch.id ? { ...m, isLive: false } : m,
      );

      if (!isFirebaseAvailable) {
        writeLocalDb({ ...appData, matches: newMatches });
      } else {
        setAppData((prev) => ({ ...prev, matches: newMatches }));
      }

      viewStatsWithCurrentMatch();
      setActiveMatch(null);
      setActiveSetId(null);
    }
  };

  const startGame = async () => {
    enforceFullscreen();
    if (matchType === "Practice" && matchFormat === "Open Drill (Grid)") {
      const matchId = Date.now().toString();
      const newMatch = {
        id: matchId,
        date: new Date().toISOString(),
        type: "Practice",
        title: "Open Drill",
        opponent: "Practice",
        format: matchFormat,
        cap: "",
        isLive: true,
      };

      const setId = Date.now().toString() + "_set";
      const newSet = {
        id: setId,
        matchId: matchId,
        setNum: 1,
        scoreUcc: 0,
        scoreOpp: 0,
      };

      if (isFirebaseAvailable && user) {
        const batch = writeBatch(db);
        batch.set(
          doc(db, `${publicPath}/${activeTeam}/matches/${matchId}`),
          newMatch,
        );
        batch.set(doc(db, `${publicPath}/${activeTeam}/sets/${setId}`), newSet);
        try {
          await batch.commit();
        } catch (err) {
          console.error("Practice start error", err);
          alert("Failed to start practice mode. Details: " + err.message);
          return;
        }
      } else if (!isFirebaseAvailable) {
        writeLocalDb({
          ...appData,
          matches: [...appData.matches, newMatch],
          sets: [...appData.sets, newSet],
        });
      }

      setActiveMatch(newMatch);
      setActiveSetId(setId);
      setScore({ ucc: 0, opp: 0 });
      setSetsWon({ ucc: 0, opp: 0 });
      setCurrentSetNum(1);
      setView("open_practice");
      return;
    }

    if (lineup.some((p) => p === null)) {
      setErrorMsg("Assign a player to all 6 starting positions.");
      return;
    }
    if (
      !opponentName.trim() ||
      opponentName.trim().toLowerCase() === "practice"
    ) {
      setErrorMsg("Please enter a valid opponent name (cannot be 'Practice').");
      return;
    }
    setErrorMsg("");
    setShowOppLineupPrompt(true);
  };

  const finalizeStartGame = async () => {
    const finalOppLineup = tempOppLineup.map((val, idx) =>
      val.trim() !== "" ? val : `O${idx + 1}`,
    );
    setOppLineup(finalOppLineup);

    const matchId = Date.now().toString();
    const newMatch = {
      id: matchId,
      date: new Date().toISOString(),
      type: matchType,
      title: matchType === "Tournament" ? tourneyTitle : "",
      opponent: opponentName,
      format: matchFormat,
      cap: scoreCap,
      isLive: true,
    };

    const setId = Date.now().toString() + "_set";
    const newSet = {
      id: setId,
      matchId: matchId,
      setNum: 1,
      scoreUcc: 0,
      scoreOpp: 0,
      lineup: lineup,
      oppLineup: finalOppLineup,
      serving: serving,
      rallyPhase: serving === "ucc" ? "serve" : "receive",
    };
    const safeOppName = opponentName.trim().replace(/\//g, "-");

    try {
      if (isFirebaseAvailable && user) {
        const batch = writeBatch(db);
        batch.set(
          doc(db, `${publicPath}/${activeTeam}/opponents/${safeOppName}`),
          {
            teamName: opponentName, // Explicitly store team name
            defaultLineup: finalOppLineup,
            notes: oppNotesMem,
            setterId: oppSetterId,
            liberoId: oppLiberoId,
            updatedAt: serverTimestamp(),
          },
        );
        batch.set(
          doc(db, `${publicPath}/${activeTeam}/matches/${matchId}`),
          newMatch,
        );
        batch.set(doc(db, `${publicPath}/${activeTeam}/sets/${setId}`), newSet);
        await batch.commit();
      } else if (!isFirebaseAvailable) {
        writeLocalDb({
          ...appData,
          opponents: {
            ...appData.opponents,
            [safeOppName]: {
              teamName: opponentName,
              defaultLineup: finalOppLineup,
              notes: oppNotesMem,
              setterId: oppSetterId,
              liberoId: oppLiberoId,
            },
          },
          matches: [...appData.matches, newMatch],
          sets: [...appData.sets, newSet],
        });
      }

      setActiveMatch(newMatch);
      setActiveSetId(setId);
      setScore({ ucc: 0, opp: 0 });
      setSetsWon({ ucc: 0, opp: 0 });
      setCurrentSetNum(1);
      setTeamStats({ uccSubs: 0, oppSubs: 0, uccTimeouts: 0, oppTimeouts: 0 });
      setHistory([]);
      setShowOppLineupPrompt(false);
      setView("game");
      setRallyPhase(serving === "ucc" ? "serve" : "receive");
      setServePromptVisible(true);
    } catch (err) {
      console.error("Start Game Error:", err);
      alert(
        "Failed to start game. Check your connection or verified email status. Details: " +
          err.message,
      );
    }
  };

  const pushToHistory = () => {
    const snapshot = {
      score: { ...score },
      lineup: [...lineup],
      oppLineup: [...oppLineup],
      liberoSwappedOutId,
      oppLiberoSwappedOutId,
      serving,
      rallyPhase,
      stats: [...appData.stats],
      sets: JSON.parse(JSON.stringify(appData.sets)),
      teamStats: { ...teamStats },
      setsWon: { ...setsWon },
      currentSetNum,
      activeSetId,
    };
    setHistory((prev) => [...prev.slice(-49), snapshot]);
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));

    setScore(lastState.score);
    setLineup(lastState.lineup);
    setOppLineup(lastState.oppLineup);
    if (lastState.liberoSwappedOutId !== undefined) {
      setLiberoSwappedOutId(lastState.liberoSwappedOutId);
    }
    if (lastState.oppLiberoSwappedOutId !== undefined) {
      setOppLiberoSwappedOutId(lastState.oppLiberoSwappedOutId);
    }
    setServing(lastState.serving);
    setRallyPhase(lastState.rallyPhase);
    setTeamStats(lastState.teamStats);
    setSetsWon(lastState.setsWon);
    setCurrentSetNum(lastState.currentSetNum);
    setActiveSetId(lastState.activeSetId);

    if (isFirebaseAvailable && user) {
      const currentStatIds = appData.stats.map((s) => s.id);
      const lastStatIds = lastState.stats.map((s) => s.id);
      const statsToDelete = currentStatIds.filter(
        (id) => !lastStatIds.includes(id),
      );

      const batch = writeBatch(db);
      statsToDelete.forEach((id) =>
        batch.delete(doc(db, `${publicPath}/${activeTeam}/stats/${id}`)),
      );
      lastState.sets.forEach((s) =>
        batch.set(doc(db, `${publicPath}/${activeTeam}/sets/${s.id}`), s),
      );
      await batch.commit();
    } else if (!isFirebaseAvailable) {
      writeLocalDb({
        ...appData,
        stats: lastState.stats,
        sets: lastState.sets,
      });
    }

    setAppData((prev) => ({
      ...prev,
      stats: lastState.stats,
      sets: lastState.sets,
    }));

    setSetWinnerModal(null);
    setEndRallyVisible(false);
    setServeErrorPrompt(null);
    setSelectedPlayerId(null);
    setSelectedOppId(null);
    setSubModalVisible(false);
  };

  const logStat = async (
    playerId,
    category,
    metric,
    value = 1,
    isOpponent = false,
    row = null,
  ) => {
    if (!activeMatch || !activeSetId) {
      console.error("Attempted to log stat without active match/set context.");
      alert(
        "Error: Game context lost. Please restart the match from the menu.",
      );
      return;
    }
    const statId =
      Date.now().toString() + Math.random().toString(36).substring(7);
    const newStat = {
      id: statId,
      matchId: activeMatch.id,
      setId: activeSetId,
      playerId,
      category,
      metric,
      value,
      isOpponent,
      ...(row ? { row } : {}),
      timestamp: new Date().toISOString(),
    };

    // Optimistic local update for responsiveness
    setAppData((prev) => ({
      ...prev,
      stats: [...prev.stats, newStat],
    }));

    if (isFirebaseAvailable && user) {
      try {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/stats/${statId}`),
          newStat,
        );
      } catch (err) {
        console.error("Failed to save stat to cloud:", err);
        alert(
          `Cloud Save Failed: ${err.message}. The stat was recorded locally but may not sync until connection is restored.`,
        );
      }
    } else if (!isFirebaseAvailable) {
      writeLocalDb({ ...appData, stats: [...appData.stats, newStat] });
    }
  };

  const handleDeleteStat = async (statId: string) => {
    setAppData((prev) => ({
      ...prev,
      stats: prev.stats.filter((s) => s.id !== statId),
    }));

    if (isFirebaseAvailable && user) {
      try {
        await deleteDoc(doc(db, `${publicPath}/${activeTeam}/stats/${statId}`));
      } catch (err) {
        console.error("Failed to delete stat from cloud:", err);
      }
    } else if (!isFirebaseAvailable) {
      writeLocalDb({
        ...appData,
        stats: appData.stats.filter((s) => s.id !== statId),
      });
    }
  };

  const handleUpdateStat = async (statId: string, updatedFields: any) => {
    setAppData((prev) => ({
      ...prev,
      stats: prev.stats.map((s) =>
        s.id === statId ? { ...s, ...updatedFields } : s,
      ),
    }));

    const existingStat = appData.stats.find((s) => s.id === statId);
    const mergedStat = { ...(existingStat || {}), ...updatedFields };

    if (isFirebaseAvailable && user) {
      try {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/stats/${statId}`),
          mergedStat,
          { merge: true },
        );
      } catch (err) {
        console.error("Failed to update stat in cloud:", err);
      }
    } else if (!isFirebaseAvailable) {
      writeLocalDb({
        ...appData,
        stats: appData.stats.map((s) => (s.id === statId ? mergedStat : s)),
      });
    }
  };

  const handleAddManualStat = async (statData: {
    playerId: string;
    category: string;
    metric: string;
    value?: number;
    isOpponent?: boolean;
    row?: string;
    matchId?: string;
    setId?: string;
  }) => {
    const targetMatchId =
      statData.matchId ||
      activeMatch?.id ||
      (appData.matches.length > 0 ? appData.matches[0].id : "general_match");
    const targetSetId =
      statData.setId ||
      activeSetId ||
      appData.sets.find((s) => s.matchId === targetMatchId)?.id ||
      "manual_set";
    const statId =
      Date.now().toString() + Math.random().toString(36).substring(7);
    const newStat = {
      id: statId,
      matchId: targetMatchId,
      setId: targetSetId,
      playerId: statData.playerId,
      category: statData.category,
      metric: statData.metric,
      value: statData.value ?? 1,
      isOpponent: !!statData.isOpponent,
      ...(statData.row ? { row: statData.row } : {}),
      timestamp: new Date().toISOString(),
    };

    setAppData((prev) => ({
      ...prev,
      stats: [...prev.stats, newStat],
    }));

    if (isFirebaseAvailable && user) {
      try {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/stats/${statId}`),
          newStat,
        );
      } catch (err) {
        console.error("Failed to add stat to cloud:", err);
      }
    } else if (!isFirebaseAvailable) {
      writeLocalDb({
        ...appData,
        stats: [...appData.stats, newStat],
      });
    }
  };

  const handleSaveTeamNames = async (
    newOurName: string,
    newOppName?: string,
    targetMatchId?: string,
  ) => {
    const trimmedOur = newOurName?.trim();
    const trimmedOpp = newOppName?.trim();

    if (trimmedOur) {
      setCustomTeamName(trimmedOur);
      try {
        localStorage.setItem("ucc_vball_custom_team_name", trimmedOur);
      } catch (e) {}

      if (activeTeam) {
        const updatedTeams = myTeams.map((t) =>
          t.id === activeTeam ? { ...t, name: trimmedOur } : t,
        );
        setMyTeams(updatedTeams);

        if (isFirebaseAvailable && user) {
          try {
            const batch = writeBatch(db);
            batch.set(
              doc(db, "users", user.uid),
              { teams: updatedTeams },
              { merge: true },
            );
            batch.set(
              doc(db, `${publicPath}/${activeTeam}`),
              { name: trimmedOur },
              { merge: true },
            );
            batch.set(
              doc(db, `${publicPath}/${activeTeam}/settings/core`),
              { teamName: trimmedOur },
              { merge: true },
            );
            await batch.commit();
          } catch (e) {
            console.error("Failed to rename team in Firebase:", e);
          }
        }
      }
    }

    if (trimmedOpp) {
      if (activeMatch && (!targetMatchId || targetMatchId === activeMatch.id)) {
        setOpponentName(trimmedOpp);
        setActiveMatch((prev) =>
          prev ? { ...prev, opponent: trimmedOpp } : prev,
        );
      }

      const matchIdToUpdate = targetMatchId || activeMatch?.id;
      if (matchIdToUpdate) {
        setAppData((prev) => ({
          ...prev,
          matches: prev.matches.map((m) =>
            m.id === matchIdToUpdate ? { ...m, opponent: trimmedOpp } : m,
          ),
        }));

        setStatsPath((prev) =>
          prev.map((item) =>
            item.level === "match" && item.id === matchIdToUpdate
              ? { ...item, name: `vs ${trimmedOpp}` }
              : item,
          ),
        );

        if (isFirebaseAvailable && user && activeTeam) {
          try {
            await setDoc(
              doc(db, `${publicPath}/${activeTeam}/matches/${matchIdToUpdate}`),
              { opponent: trimmedOpp },
              { merge: true },
            );
          } catch (e) {
            console.error("Failed to update opponent in Firebase:", e);
          }
        } else if (!isFirebaseAvailable) {
          writeLocalDb({
            ...appData,
            matches: appData.matches.map((m) =>
              m.id === matchIdToUpdate ? { ...m, opponent: trimmedOpp } : m,
            ),
          });
        }
      }
    }
  };

  const handleSaveSetScore = async (
    setId: string,
    newUccScore: number,
    newOppScore: number,
  ) => {
    setAppData((prev) => ({
      ...prev,
      sets: prev.sets.map((s) =>
        s.id === setId
          ? { ...s, scoreUcc: newUccScore, scoreOpp: newOppScore }
          : s,
      ),
    }));

    if (activeSetId === setId) {
      setScore({ ucc: newUccScore, opp: newOppScore });
    }

    if (isFirebaseAvailable && user && activeTeam) {
      try {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/sets/${setId}`),
          { scoreUcc: newUccScore, scoreOpp: newOppScore },
          { merge: true },
        );
      } catch (e) {
        console.error("Failed to update set score in Firebase:", e);
      }
    } else if (!isFirebaseAvailable) {
      writeLocalDb({
        ...appData,
        sets: appData.sets.map((s) =>
          s.id === setId
            ? { ...s, scoreUcc: newUccScore, scoreOpp: newOppScore }
            : s,
        ),
      });
    }
  };

  const handleBlockAction = (playerId, blockMetric) => {
    if (blockMetric === "Late") {
      if (lateBlockPlayerId === playerId) {
        setLateBlockPlayerId(null);
        recordStatAndCheckPoint(playerId, "Block", "Late");
        setSelectedPlayerId(null);
      } else {
        setLateBlockPlayerId(playerId);
      }
    } else {
      if (lateBlockPlayerId === playerId) {
        logStat(playerId, "Block", "Late");
        setLateBlockPlayerId(null);
      }

      if (blockMetric === "Stuff" || blockMetric === "Play On") {
        setBlockAssistPrompt({
          playerId,
          isOpp: false,
          step: "type",
          metric: blockMetric,
        });
        setSelectedPlayerId(null);
      } else {
        recordStatAndCheckPoint(playerId, "Block", blockMetric);
      }
    }
  };

  const recordStatAndCheckPoint = (playerId, category, metric, value = 1) => {
    pushToHistory();

    const currentLineupIdx = lineup.indexOf(playerId);
    const isBackRow =
      [0, 4, 5].includes(currentLineupIdx) || playerId === liberoId;
    const row = category === "Attack" ? (isBackRow ? "Back" : "Front") : null;

    logStat(playerId, category, metric, value, false, row);

    if (category !== "Block") {
      setSelectedPlayerId(null);
    }

    // ANY stat recorded during receive phase satisfies the "first touch", so we transition to PLAY.
    if (
      rallyPhase === "receive" ||
      rallyPhase === "opp_receive" ||
      category === "Pass"
    ) {
      changeRallyPhase("play");
    }
  };

  const recordOppStatAndCheckPoint = (oppId, category, metric, value = 1) => {
    pushToHistory();

    const currentLineupIdx = oppLineup.indexOf(oppId);
    const isBackRow =
      [0, 4, 5].includes(currentLineupIdx) || oppId === oppLiberoId;
    const row = category === "Attack" ? (isBackRow ? "Back" : "Front") : null;

    logStat(oppId, category, metric, value, true, row);

    if (category !== "Block") {
      setSelectedOppId(null);
    }

    // ANY stat recorded during receive phase satisfies the "first touch", so we transition to PLAY.
    if (
      rallyPhase === "receive" ||
      rallyPhase === "opp_receive" ||
      category === "Pass"
    ) {
      changeRallyPhase("play");
    }
  };

  const isTieBreaker = () =>
    (matchFormat === "Best of 3" && currentSetNum === 3) ||
    (matchFormat === "Best of 5" && currentSetNum === 5);

  const checkSetWin = (uScore, oScore) => {
    const target = isTieBreaker() ? 15 : 25;
    const cap = activeMatch?.cap ? parseInt(activeMatch.cap) : null;
    if (cap && uScore >= cap) return "ucc";
    if (cap && oScore >= cap) return "opp";
    if (uScore >= target && uScore - oScore >= 2) return "ucc";
    if (oScore >= target && oScore - uScore >= 2) return "opp";
    return null;
  };

  const handlePoint = async (team, skipHistory = false) => {
    if (!skipHistory) pushToHistory();
    setEndRallyVisible(false);
    setSelectedOppId(null);
    setSelectedPlayerId(null);

    let newUcc = score.ucc;
    let newOpp = score.opp;
    if (team === "ucc") {
      newUcc += 1;
      setScore((s) => ({ ...s, ucc: newUcc }));
      if (serving === "opp") {
        setServing("ucc");
        rotateUCC();
      }
    } else {
      newOpp += 1;
      setScore((s) => ({ ...s, opp: newOpp }));
      if (serving === "ucc") {
        setServing("opp");
        rotateOpp();
      }
    }

    if (isFirebaseAvailable && user) {
      updateSetState({
        scoreUcc: newUcc,
        scoreOpp: newOpp,
        serving:
          serving === "opp" && team === "ucc"
            ? "ucc"
            : serving === "ucc" && team !== "ucc"
              ? "opp"
              : serving,
      });
    } else if (!isFirebaseAvailable) {
      writeLocalDb({
        ...appData,
        sets: appData.sets.map((s) =>
          s.id === activeSetId
            ? { ...s, scoreUcc: newUcc, scoreOpp: newOpp }
            : s,
        ),
      });
    }

    const winner = checkSetWin(newUcc, newOpp);
    if (winner) {
      setSetWinnerModal(winner);
      setNextSetServing(serving === "ucc" ? "opp" : "ucc");
    } else {
      changeRallyPhase("serve");
    }
  };

  const handleSetFinishContinue = (
    switchLineup = true,
    chosenServing?: "ucc" | "opp",
    initialTab: "ucc" | "opp" = "ucc",
  ) => {
    const newSetsWon = { ...setsWon };
    if (setWinnerModal === "ucc") newSetsWon.ucc += 1;
    else newSetsWon.opp += 1;
    setSetsWon(newSetsWon);

    const nextSetNum = currentSetNum + 1;

    let matchOver = false;
    if (
      matchFormat === "Best of 3" &&
      (newSetsWon.ucc === 2 || newSetsWon.opp === 2)
    )
      matchOver = true;
    if (
      matchFormat === "Best of 5" &&
      (newSetsWon.ucc === 3 || newSetsWon.opp === 3)
    )
      matchOver = true;
    if (matchFormat === "2 Sets" && nextSetNum > 2) matchOver = true;
    if (matchFormat === "Single Set" && nextSetNum > 1) matchOver = true;

    if (matchOver) {
      setCurrentSetNum(nextSetNum);
      setSetWinnerModal(null);
      viewStatsWithCurrentMatch();
      return;
    }

    const nextServing = chosenServing || nextSetServing || (serving === "ucc" ? "opp" : "ucc");

    if (switchLineup) {
      setBetweenSetsModal({
        nextSetNum,
        newSetsWon,
        tempLineup: [...lineup],
        tempLibero: liberoId,
        tempServing: nextServing,
        tempOppLineup: [...oppLineup],
        tempOppLibero: oppLiberoId,
        activeTab: initialTab,
      });
      setSetWinnerModal(null);
    } else {
      executeStartNextSet({
        nextSetNum,
        selectedLineup: lineup,
        selectedLibero: liberoId,
        selectedServing: nextServing,
        selectedOppLineup: oppLineup,
        selectedOppLibero: oppLiberoId,
      });
      setSetWinnerModal(null);
    }
  };

  const executeStartNextSet = async ({
    nextSetNum,
    selectedLineup,
    selectedLibero,
    selectedServing,
    selectedOppLineup,
    selectedOppLibero,
  }) => {
    setCurrentSetNum(nextSetNum);
    setLineup(selectedLineup);
    setLiberoId(selectedLibero || "");
    setServing(selectedServing);
    setOppLineup(selectedOppLineup);
    if (selectedOppLibero !== undefined) setOppLiberoId(selectedOppLibero);

    const setId = Date.now().toString() + "_set";
    const newSet = {
      id: setId,
      matchId: activeMatch.id,
      setNum: nextSetNum,
      scoreUcc: 0,
      scoreOpp: 0,
      lineup: selectedLineup,
      oppLineup: selectedOppLineup,
      serving: selectedServing,
      rallyPhase: "serve",
    };

    if (isFirebaseAvailable && user) {
      await setDoc(
        doc(db, `${publicPath}/${activeTeam}/sets/${setId}`),
        newSet,
      );
    } else if (!isFirebaseAvailable) {
      writeLocalDb({ ...appData, sets: [...appData.sets, newSet] });
    }

    setActiveSetId(setId);
    setScore({ ucc: 0, opp: 0 });
    setTeamStats({ uccSubs: 0, oppSubs: 0, uccTimeouts: 0, oppTimeouts: 0 });
    setHistory([]);
    setBetweenSetsModal(null);
    changeRallyPhase("serve");
    setServePromptVisible(true);
  };

  const startNextSet = async () => {
    handleSetFinishContinue(true);
  };

  const openInGameLineupEdit = () => {
    setTempInGameLineup([...lineup]);
    setTempInGameLibero(liberoId);
    setTempInGameOppLineup([...oppLineup]);
    setTempInGameOppLibero(oppLiberoId);
    setInGameLineupTab("ucc");
    setShowLineupEditModal(true);
  };

  const saveInGameLineupEdit = async () => {
    setLineup(tempInGameLineup);
    setLiberoId(tempInGameLibero);
    const finalOpp = tempInGameOppLineup.map((val, idx) =>
      val && val.trim() !== "" ? val.trim() : `O${idx + 1}`,
    );
    setOppLineup(finalOpp);
    setOppLiberoId(tempInGameOppLibero);

    if (isFirebaseAvailable && user && activeSetId) {
      await setDoc(
        doc(db, `${publicPath}/${activeTeam}/sets/${activeSetId}`),
        { lineup: tempInGameLineup, oppLineup: finalOpp },
        { merge: true },
      );
    } else if (!isFirebaseAvailable && activeSetId) {
      writeLocalDb({
        ...appData,
        sets: appData.sets.map((s) =>
          s.id === activeSetId
            ? { ...s, lineup: tempInGameLineup, oppLineup: finalOpp }
            : s,
        ),
      });
    }
    setShowLineupEditModal(false);
  };

  const handleServeStat = (metric, team) => {
    if (
      (metric === "Ace" || metric === "Error") &&
      isProcessingPointRef.current
    )
      return;
    if (metric === "Ace" || metric === "Error") {
      isProcessingPointRef.current = true;
      setTimeout(() => {
        isProcessingPointRef.current = false;
      }, 500);
    }

    pushToHistory();
    const serverId = team === "ucc" ? lineup[0] : oppLineup[0];
    const isOpp = team === "opp";
    setServePromptVisible(false);

    if (metric === "Ace") {
      setPendingAceData({ serverId, team, isOpp });
      setAceReceiverPrompt(team);
    } else if (metric === "Error") setServeErrorPrompt(team);
    else if (metric === "In Play") {
      logStat(serverId, "Serve", "Attempt", 1, isOpp);
      if (team === "opp") {
        changeRallyPhase("receive");
        setOppServeReceivePrompt({ passerId: null });
      } else {
        changeRallyPhase(
          trackOppReceives ? "opp_receive" : "play",
        );
      }
    }
  };

  const toggleAceReceiver = (receiverId) => {
    if (selectedAceReceivers.includes(receiverId)) {
      setSelectedAceReceivers(
        selectedAceReceivers.filter((id) => id !== receiverId),
      );
    } else {
      if (selectedAceReceivers.length < 2) {
        setSelectedAceReceivers([...selectedAceReceivers, receiverId]);
      }
    }
  };

  const confirmAceReceivers = () => {
    const { serverId, team, isOpp } = pendingAceData;
    logStat(serverId, "Serve", "Ace", 1, isOpp);

    selectedAceReceivers.forEach((receiverId) => {
      logStat(receiverId, "Pass", "Rating", 0, !isOpp);
    });

    setAceReceiverPrompt(null);
    setPendingAceData(null);
    setSelectedAceReceivers([]);
    handlePoint(team, true);
  };

  const skipAceReceivers = () => {
    const { serverId, team, isOpp } = pendingAceData;
    logStat(serverId, "Serve", "Ace", 1, isOpp);
    setAceReceiverPrompt(null);
    setPendingAceData(null);
    setSelectedAceReceivers([]);
    handlePoint(team, true);
  };

  const getSevenReceivers = (receivingTeam: "ucc" | "opp") => {
    if (receivingTeam === "ucc") {
      const courtConfigs = [
        { idx: 3, label: "Pos 4 • LF" },
        { idx: 2, label: "Pos 3 • MF" },
        { idx: 1, label: "Pos 2 • RF" },
        { idx: 4, label: "Pos 5 • LB" },
        { idx: 5, label: "Pos 6 • MB" },
        { idx: 0, label: "Pos 1 • RB" },
      ];

      const list = courtConfigs.map(({ idx, label }) => {
        const id = lineup[idx];
        const p = appData.roster.find((r) => r.id === id);
        const isLib = id && id === liberoId;
        return {
          id: id || `ucc_pos_${idx}`,
          number: p?.number || "?",
          name: p?.name || "Player",
          posLabel: isLib ? "LIBERO" : label,
          isLibero: !!isLib,
          isCourt: true,
        };
      });

      // Find 7th player (Libero or swapped-out court player)
      let seventhId: string | null = null;
      let seventhRole = "LIBERO";

      if (liberoId && !lineup.includes(liberoId)) {
        seventhId = liberoId;
        seventhRole = "LIBERO";
      } else if (liberoId && lineup.includes(liberoId)) {
        if (liberoSwappedOutId && !lineup.includes(liberoSwappedOutId)) {
          seventhId = liberoSwappedOutId;
          seventhRole = "Swapped Out";
        }
      }

      if (!seventhId) {
        const currentCourtIds = list.map((item) => item.id);
        const benchPlayer =
          sortedRoster.find(
            (r) => !currentCourtIds.includes(r.id) && r.id !== liberoId,
          ) ||
          (liberoId && !currentCourtIds.includes(liberoId)
            ? sortedRoster.find((r) => r.id === liberoId)
            : null);
        if (benchPlayer) {
          seventhId = benchPlayer.id;
          seventhRole = benchPlayer.position || "Bench";
        }
      }

      if (seventhId) {
        const p = appData.roster.find((r) => r.id === seventhId);
        list.push({
          id: seventhId,
          number: p?.number || (seventhId === liberoId ? "L" : "?"),
          name: p?.name || (seventhId === liberoId ? "Libero" : "Bench"),
          posLabel: seventhRole,
          isLibero: seventhId === liberoId,
          isCourt: false,
        });
      }

      return list;
    } else {
      const courtConfigs = [
        { idx: 3, label: "Pos 4 • LF" },
        { idx: 2, label: "Pos 3 • MF" },
        { idx: 1, label: "Pos 2 • RF" },
        { idx: 4, label: "Pos 5 • LB" },
        { idx: 5, label: "Pos 6 • MB" },
        { idx: 0, label: "Pos 1 • RB" },
      ];

      const list = courtConfigs.map(({ idx, label }) => {
        const num = oppLineup[idx] || `O${idx + 1}`;
        const isLib = oppLiberoId && num === oppLiberoId;
        return {
          id: num,
          number: num,
          name: isLib ? "Libero" : `Opp ${num}`,
          posLabel: isLib ? "LIBERO" : label,
          isLibero: !!isLib,
          isCourt: true,
        };
      });

      let seventhOppId = "";
      let seventhOppRole = "LIBERO";

      if (oppLiberoId && !oppLineup.includes(oppLiberoId)) {
        seventhOppId = oppLiberoId;
        seventhOppRole = "LIBERO";
      } else if (
        oppLiberoId &&
        oppLineup.includes(oppLiberoId) &&
        oppLiberoSwappedOutId &&
        !oppLineup.includes(oppLiberoSwappedOutId)
      ) {
        seventhOppId = oppLiberoSwappedOutId;
        seventhOppRole = "Swapped Out";
      } else {
        seventhOppId = oppLiberoId || "LIB";
        seventhOppRole = "LIBERO";
      }

      list.push({
        id: seventhOppId,
        number: seventhOppId,
        name: seventhOppRole === "LIBERO" ? "Libero" : `Opp ${seventhOppId}`,
        posLabel: seventhOppRole,
        isLibero: seventhOppRole === "LIBERO",
        isCourt: false,
      });

      return list;
    }
  };

  const handleInstallApp = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setIsAppInstalled(true);
          setDeferredPrompt(null);
          setShowInstallModal(false);
        }
      } catch (err) {
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const handleBlockAssistChoice = (assistPlayerId) => {
    const { playerId, isOpp, metric } = blockAssistPrompt;

    const dbMetric = metric === "Stuff" ? "Stuff" : "Block";

    // Log the main stuff (1 if solo, 0.5 if assist)
    recordStatAndCheckPoint(
      playerId,
      "Block",
      dbMetric,
      assistPlayerId ? 0.5 : 1,
    );

    // If an assist was selected, log for them too, but don't check point again (already done)
    if (assistPlayerId) {
      logStat(assistPlayerId, "Block", dbMetric, 0.5, isOpp);
    }

    setBlockAssistPrompt(null);
  };

  const handleServeErrorChoice = (errorType) => {
    const team = serveErrorPrompt;
    const serverId = team === "ucc" ? lineup[0] : oppLineup[0];
    logStat(serverId, "Serve", `Miss - ${errorType}`, 1, team === "opp");
    setServeErrorPrompt(null);
    handlePoint(team === "ucc" ? "opp" : "ucc", true);
  };

  const manualScoreAdjust = async (team, delta) => {
    pushToHistory();
    const newScore = { ...score };
    newScore[team] = Math.max(0, newScore[team] + delta);
    setScore(newScore);

    if (isFirebaseAvailable && user) {
      const currentSet = appData.sets.find((s) => s.id === activeSetId);
      if (currentSet)
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/sets/${activeSetId}`),
          { ...currentSet, scoreUcc: newScore.ucc, scoreOpp: newScore.opp },
        );
    } else if (!isFirebaseAvailable) {
      writeLocalDb({
        ...appData,
        sets: appData.sets.map((s) =>
          s.id === activeSetId
            ? { ...s, scoreUcc: newScore.ucc, scoreOpp: newScore.opp }
            : s,
        ),
      });
    }
    const winner = checkSetWin(newScore.ucc, newScore.opp);
    if (winner) {
      setSetWinnerModal(winner);
      setNextSetServing(serving === "ucc" ? "opp" : "ucc");
    }
  };

  const handleSub = (benchPlayerId) => {
    pushToHistory();
    const index = lineup.indexOf(selectedPlayerId);
    if (index !== -1) {
      const newLineup = [...lineup];
      newLineup[index] = benchPlayerId;
      setLineup(newLineup);
      updateSetState({ lineup: newLineup });
      setSelectedPlayerId(benchPlayerId);

      // Libero substitutions/replacements do NOT count towards team sub total
      const isLibSub = benchPlayerId === liberoId || selectedPlayerId === liberoId;
      if (!isLibSub) {
        setTeamStats((s) => ({ ...s, uccSubs: s.uccSubs + 1 }));
      }
      if (benchPlayerId === liberoId) {
        setLiberoSwappedOutId(selectedPlayerId);
      } else if (selectedPlayerId === liberoId) {
        setLiberoSwappedOutId(null);
      }

      const newPairs = { ...subPairs };
      newPairs[selectedPlayerId] = benchPlayerId;
      newPairs[benchPlayerId] = selectedPlayerId;
      setSubPairs(newPairs);
    }
    setSubModalVisible(false);
    setSelectedPlayerId(null);
  };

  const saveOppNote = async () => {
    if (!opponentName) return;
    const updatedMem = { ...oppNotesMem, [selectedOppId]: tempNote };
    setOppNotesMem(updatedMem);
    const safeOppName = opponentName.trim().replace(/\//g, "-");

    if (isFirebaseAvailable && user) {
      await setDoc(
        doc(db, `${publicPath}/${activeTeam}/opponents/${safeOppName}`),
        { notes: updatedMem },
        { merge: true },
      );
    } else if (!isFirebaseAvailable) {
      writeLocalDb({
        ...appData,
        opponents: {
          ...appData.opponents,
          [safeOppName]: {
            ...appData.opponents[safeOppName],
            notes: updatedMem,
          },
        },
      });
    }
  };

  const handleOppSetterSwap = async () => {
    if (!opponentName) return;
    const newSetter = oppSetterId === selectedOppId ? null : selectedOppId;
    setOppSetterId(newSetter);
    const safeOppName = opponentName.trim().replace(/\//g, "-");

    if (isFirebaseAvailable && user) {
      await setDoc(
        doc(db, `${publicPath}/${activeTeam}/opponents/${safeOppName}`),
        { setterId: newSetter },
        { merge: true },
      );
    } else if (!isFirebaseAvailable) {
      writeLocalDb({
        ...appData,
        opponents: {
          ...appData.opponents,
          [safeOppName]: {
            ...appData.opponents[safeOppName],
            setterId: newSetter,
          },
        },
      });
    }
  };

  const handleOppLiberoToggle = (targetOppId?: string) => {
    const target = targetOppId || selectedOppId;
    if (!target) return;
    pushToHistory();
    const index = oppLineup.indexOf(target);
    if (index === -1) return;
    const newLineup = [...oppLineup];
    if (target === oppLiberoId) {
      newLineup[index] = oppLiberoSwappedOutId || "";
      setOppLiberoSwappedOutId(null);
    } else {
      const currentOppLibIdx = newLineup.indexOf(oppLiberoId);
      if (currentOppLibIdx !== -1 && oppLiberoSwappedOutId) {
        newLineup[currentOppLibIdx] = oppLiberoSwappedOutId;
      }
      setOppLiberoSwappedOutId(target);
      newLineup[index] = oppLiberoId;
    }
    setOppLineup(newLineup);
    updateSetState({ oppLineup: newLineup });
    setSelectedOppId(null);
  };

  const handleOppSub = () => {
    if (!newOppNumber.trim()) {
      if (subPairs[selectedOppId]) {
        setPendingAutoSub({
          outId: selectedOppId,
          inId: subPairs[selectedOppId],
        });
      }
      return;
    }
    pushToHistory();
    const index = oppLineup.indexOf(selectedOppId);
    if (index !== -1) {
      const newLineup = [...oppLineup];
      newLineup[index] = newOppNumber;
      setOppLineup(newLineup);
      updateSetState({ oppLineup: newLineup });
      const isOppLibSub = newOppNumber === oppLiberoId || selectedOppId === oppLiberoId;
      if (!isOppLibSub) {
        setTeamStats((s) => ({ ...s, oppSubs: s.oppSubs + 1 }));
      }

      const newPairs = { ...subPairs };
      newPairs[selectedOppId] = newOppNumber;
      newPairs[newOppNumber] = selectedOppId;
      setSubPairs(newPairs);

      setSelectedOppId(newOppNumber);
      setNewOppNumber("");
      setShowOppLineupPrompt(false);
    }
  };

  const handleLiberoSwap = (targetPlayerId?: string) => {
    const target = targetPlayerId || selectedPlayerId;
    if (!target) return;

    if (!liberoId) {
      setLiberoPromptPlayerId(target);
      setShowLiberoDesignateModal(true);
      return;
    }

    pushToHistory();
    const index = lineup.indexOf(target);
    if (index === -1) return;
    const newLineup = [...lineup];
    if (target === liberoId) {
      // Swapping Libero OUT -> restore original swapped out player
      if (liberoSwappedOutId) {
        newLineup[index] = liberoSwappedOutId;
        setLiberoSwappedOutId(null);
      } else {
        // Prompt for replacement bench player to enter without charging a sub
        setLiberoPromptPlayerId(target);
        setShowLiberoOutModal(true);
        return;
      }
    } else {
      // Swapping Libero IN for this back-row player
      const currentLibIdx = newLineup.indexOf(liberoId);
      if (currentLibIdx !== -1 && liberoSwappedOutId) {
        newLineup[currentLibIdx] = liberoSwappedOutId;
      }
      setLiberoSwappedOutId(target);
      newLineup[index] = liberoId;
    }
    setLineup(newLineup);
    updateSetState({ lineup: newLineup });
    setSelectedPlayerId(null);
  };

  const callTimeout = (team) => {
    if (team === "ucc")
      setTeamStats((s) => ({ ...s, uccTimeouts: s.uccTimeouts + 1 }));
    if (team === "opp")
      setTeamStats((s) => ({ ...s, oppTimeouts: s.oppTimeouts + 1 }));
  };

  // -------------------------------------------------------------
  // STATS CALCULATION ENGINE
  // -------------------------------------------------------------
  const viewStatsFromMenu = () => {
    setStatsPath([
      { level: "season", id: "all", name: "Season Totals (Game & Practice)" },
    ]);
    setView("stats");
  };

  const viewStatsWithCurrentMatch = () => {
    if (!activeMatch) return viewStatsFromMenu();
    lastActiveMatchRef.current = activeMatch;
    lastActiveViewRef.current =
      activeMatch.type === "Practice" && activeMatch.format === "Open Drill (Grid)"
        ? "open_practice"
        : "game";
    const eventDetails = getEventDetails(activeMatch);
    if (activeMatch.type === "Practice") {
      setStatsPath([
        {
          level: "season",
          id: "practice",
          name: "Season Totals (Practice Only)",
        },
        { level: "event", id: eventDetails.id, name: eventDetails.name },
      ]);
    } else {
      setStatsPath([
        {
          level: "season",
          id: "games",
          name: "Season Totals (Games Only)",
        },
        { level: "event", id: eventDetails.id, name: eventDetails.name },
        {
          level: "match",
          id: activeMatch.id,
          name: `vs ${activeMatch.opponent}`,
        },
      ]);
    }
    setView("stats");
  };

  const setSeasonScope = (scope) => {
    const scopeNames = {
      all: "Season Totals (Game & Practice)",
      games: "All Games (Season)",
      practice: "All Practices (Season)",
    };
    setStatsPath([{ level: "season", id: scope, name: scopeNames[scope] || "Season Totals" }]);
  };

  const gameCount = useMemo(() => {
    return appData.matches.filter((m) => m.type !== "Practice").length;
  }, [appData.matches]);

  const practiceCount = useMemo(() => {
    return appData.matches.filter((m) => m.type === "Practice").length;
  }, [appData.matches]);

  // Helper to extract drills for a practice day/event
  const getDrillsForPracticeEvent = (eventId: string) => {
    const dayMatches = appData.matches.filter(
      (m) => m.type === "Practice" && getEventDetails(m).id === eventId
    );
    const drills: Array<{
      id: string;
      level: string;
      name: string;
      drillNum: number;
      matchId: string;
      setId: string;
      date?: string;
      isPractice: boolean;
      isDrill: boolean;
    }> = [];

    let overallDrillIndex = 1;
    dayMatches.forEach((m, matchIdx) => {
      const matchSets = appData.sets
        .filter((s) => s.matchId === m.id)
        .sort((a, b) => a.setNum - b.setNum);

      if (matchSets.length > 0) {
        matchSets.forEach((s) => {
          let label = "";
          if (m.title && m.title !== "Open Drill") {
            label = `${m.title} (Drill ${s.setNum})`;
          } else if (matchSets.length > 1) {
            label = `Drill ${s.setNum}${dayMatches.length > 1 ? ` (Session #${matchIdx + 1})` : ""}`;
          } else {
            label = `Drill ${overallDrillIndex}: ${m.title || "Open Practice"}`;
          }
          drills.push({
            id: s.id,
            level: "drill",
            name: label,
            drillNum: overallDrillIndex,
            matchId: m.id,
            setId: s.id,
            date: m.date,
            isPractice: true,
            isDrill: true,
          });
          overallDrillIndex++;
        });
      } else {
        drills.push({
          id: m.id,
          level: "drill",
          name: m.title ? `${m.title} (Drill #${overallDrillIndex})` : `Drill #${overallDrillIndex}`,
          drillNum: overallDrillIndex,
          matchId: m.id,
          setId: m.id,
          date: m.date,
          isPractice: true,
          isDrill: true,
        });
        overallDrillIndex++;
      }
    });

    return drills;
  };

  const {
    gameEventsList,
    practiceDaysList,
    tournamentsList,
    gameMatchesList,
    practicesList,
  } = useMemo(() => {
    const gameEvents: Record<string, any> = {};
    const practiceDays: Record<string, any> = {};
    const tourneys: Record<string, any> = {};
    const gameMatches: any[] = [];
    const practices: Record<string, any> = {};

    appData.matches.forEach((m) => {
      const dateStr = m.date
        ? new Date(m.date).toLocaleDateString()
        : "Unknown Date";
      const detail = getEventDetails(m);

      if (m.type === "Practice") {
        const matchSets = appData.sets.filter((s) => s.matchId === m.id);
        const count = matchSets.length > 0 ? matchSets.length : 1;
        if (!practiceDays[detail.id]) {
          practiceDays[detail.id] = {
            id: detail.id,
            name: detail.name,
            date: m.date,
            drillCount: count,
            matchCount: 1,
            isPractice: true,
          };
        } else {
          practiceDays[detail.id].drillCount += count;
          practiceDays[detail.id].matchCount += 1;
        }

        if (!practices[detail.id]) {
          practices[detail.id] = {
            id: detail.id,
            name: detail.name,
            date: m.date,
            count: 1,
          };
        } else {
          practices[detail.id].count += 1;
        }
      } else {
        if (!gameEvents[detail.id]) {
          gameEvents[detail.id] = {
            id: detail.id,
            name: detail.name,
            date: m.date,
            isTournament: m.type === "Tournament",
            matchCount: 1,
            isPractice: false,
          };
        } else {
          gameEvents[detail.id].matchCount += 1;
        }

        if (m.type === "Tournament" && m.title) {
          if (!tourneys[detail.id]) {
            tourneys[detail.id] = {
              id: detail.id,
              name: detail.name,
              date: m.date,
              count: 1,
            };
          } else {
            tourneys[detail.id].count += 1;
          }
        }

        gameMatches.push({
          id: m.id,
          opponent: m.opponent || "Opponent",
          dateStr,
          date: m.date,
          type: m.type,
          title: m.title,
          eventId: detail.id,
          eventName: detail.name,
        });
      }
    });

    const sortByDate = (a: any, b: any) =>
      new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();

    return {
      gameEventsList: Object.values(gameEvents).sort(sortByDate),
      practiceDaysList: Object.values(practiceDays).sort(sortByDate),
      tournamentsList: Object.values(tourneys).sort(sortByDate),
      gameMatchesList: gameMatches.sort(sortByDate),
      practicesList: Object.values(practices).sort(sortByDate),
    };
  }, [appData.matches, appData.sets]);

  // Current navigation state and branch detection
  const isPracticeBranch = useMemo(() => {
    return (
      statsPath[0]?.id === "practice" ||
      statsPath.some(
        (p) =>
          p.id?.startsWith("practice_") ||
          p.id === "practice_sessions" ||
          p.level === "drill"
      )
    );
  }, [statsPath]);

  const isGamesBranch = useMemo(() => {
    return (
      statsPath[0]?.id === "games" ||
      statsPath.some(
        (p) =>
          p.id?.startsWith("tourney_") ||
          p.id?.startsWith("day_") ||
          (p.level === "match" && !isPracticeBranch) ||
          (p.level === "set" && !isPracticeBranch)
      )
    );
  }, [statsPath, isPracticeBranch]);

  const isCombinedBranch = useMemo(() => {
    return statsPath[0]?.id === "all" && statsPath.length === 1;
  }, [statsPath]);

  const activeEventNav = statsPath.find((p) => p.level === "event");
  const activeMatchNav = statsPath.find((p) => p.level === "match");
  const activeSetNav = statsPath.find((p) => p.level === "set");
  const activeDrillNav = statsPath.find((p) => p.level === "drill");

  // Cascading Selection Handlers for Games Hierarchy
  const selectGameEvent = (eventId: string) => {
    if (!eventId || eventId === "all_events") {
      setStatsPath([{ level: "season", id: "games", name: "All Games (Season)" }]);
      return;
    }
    const sampleMatch = appData.matches.find(
      (m) => m.type !== "Practice" && getEventDetails(m).id === eventId
    );
    const eventName = sampleMatch ? getEventDetails(sampleMatch).name : eventId;
    setStatsPath([
      { level: "season", id: "games", name: "All Games (Season)" },
      { level: "event", id: eventId, name: eventName },
    ]);
  };

  const selectSpecificGame = (matchId: string) => {
    if (!matchId || matchId === "all_games_in_event") {
      if (activeEventNav) {
        setStatsPath([
          { level: "season", id: "games", name: "All Games (Season)" },
          activeEventNav,
        ]);
      } else {
        setStatsPath([{ level: "season", id: "games", name: "All Games (Season)" }]);
      }
      return;
    }
    const match = appData.matches.find((m) => m.id === matchId);
    if (!match) return;
    const eventDetail = getEventDetails(match);
    setStatsPath([
      { level: "season", id: "games", name: "All Games (Season)" },
      { level: "event", id: eventDetail.id, name: eventDetail.name },
      { level: "match", id: match.id, name: `vs ${match.opponent || "Opponent"}` },
    ]);
  };

  const selectGameSet = (setId: string) => {
    if (!setId || setId === "all_sets") {
      if (activeMatchNav && activeEventNav) {
        setStatsPath([
          { level: "season", id: "games", name: "All Games (Season)" },
          activeEventNav,
          activeMatchNav,
        ]);
      }
      return;
    }
    const setObj = appData.sets.find((s) => s.id === setId);
    if (!setObj) return;
    const match = appData.matches.find((m) => m.id === setObj.matchId);
    if (!match) return;
    const eventDetail = getEventDetails(match);
    setStatsPath([
      { level: "season", id: "games", name: "All Games (Season)" },
      { level: "event", id: eventDetail.id, name: eventDetail.name },
      { level: "match", id: match.id, name: `vs ${match.opponent || "Opponent"}` },
      { level: "set", id: setObj.id, name: `Set ${setObj.setNum}` },
    ]);
  };

  // Cascading Selection Handlers for Practices Hierarchy
  const selectPracticeDay = (eventId: string) => {
    if (!eventId || eventId === "all_practice_days") {
      setStatsPath([{ level: "season", id: "practice", name: "All Practices (Season)" }]);
      return;
    }
    const sampleMatch = appData.matches.find(
      (m) => m.type === "Practice" && getEventDetails(m).id === eventId
    );
    const eventName = sampleMatch ? getEventDetails(sampleMatch).name : eventId;
    setStatsPath([
      { level: "season", id: "practice", name: "All Practices (Season)" },
      { level: "event", id: eventId, name: eventName },
    ]);
  };

  const selectPracticeDrill = (drillId: string) => {
    if (!drillId || drillId === "all_drills_in_day") {
      if (activeEventNav) {
        setStatsPath([
          { level: "season", id: "practice", name: "All Practices (Season)" },
          activeEventNav,
        ]);
      } else {
        setStatsPath([{ level: "season", id: "practice", name: "All Practices (Season)" }]);
      }
      return;
    }

    let foundMatch: any = null;
    let drillName = "Drill";

    const foundSet = appData.sets.find((s) => s.id === drillId);
    if (foundSet) {
      foundMatch = appData.matches.find((m) => m.id === foundSet.matchId);
      if (foundMatch?.title && foundMatch.title !== "Open Drill") {
        drillName = `${foundMatch.title} (Drill ${foundSet.setNum})`;
      } else {
        drillName = `Drill ${foundSet.setNum}`;
      }
    } else {
      foundMatch = appData.matches.find((m) => m.id === drillId);
      if (foundMatch) {
        drillName = foundMatch.title || "Practice Drill";
      }
    }

    if (foundMatch) {
      const eventDetail = getEventDetails(foundMatch);
      setStatsPath([
        { level: "season", id: "practice", name: "All Practices (Season)" },
        { level: "event", id: eventDetail.id, name: eventDetail.name },
        { level: "drill", id: drillId, name: drillName },
      ]);
    }
  };

  const handleQuickSelect = (val) => {
    if (!val) return;
    if (val === "season_all") {
      setSeasonScope("all");
      return;
    }
    if (val === "season_games") {
      setSeasonScope("games");
      return;
    }
    if (val === "season_practice") {
      setSeasonScope("practice");
      return;
    }
    if (val.startsWith("event_")) {
      const eventId = val.replace("event_", "");
      const isPractice =
        eventId.startsWith("practice_") || eventId === "practice_sessions";
      const sampleMatch = appData.matches.find(
        (m) => getEventDetails(m).id === eventId
      );
      const eventName = sampleMatch
        ? getEventDetails(sampleMatch).name
        : eventId;
      if (isPractice) {
        setStatsPath([
          {
            level: "season",
            id: "practice",
            name: "All Practices (Season)",
          },
          { level: "event", id: eventId, name: eventName },
        ]);
      } else {
        setStatsPath([
          {
            level: "season",
            id: "games",
            name: "All Games (Season)",
          },
          { level: "event", id: eventId, name: eventName },
        ]);
      }
      return;
    }
    if (val.startsWith("match_")) {
      const matchId = val.replace("match_", "");
      const match = appData.matches.find((m) => m.id === matchId);
      if (!match) return;
      const detail = getEventDetails(match);
      if (match.type === "Practice") {
        setStatsPath([
          {
            level: "season",
            id: "practice",
            name: "All Practices (Season)",
          },
          { level: "event", id: detail.id, name: detail.name },
          {
            level: "drill",
            id: match.id,
            name: match.title || "Drill Session",
          },
        ]);
      } else {
        setStatsPath([
          {
            level: "season",
            id: "games",
            name: "All Games (Season)",
          },
          { level: "event", id: detail.id, name: detail.name },
          { level: "match", id: match.id, name: `vs ${match.opponent}` },
        ]);
      }
      return;
    }
    if (val.startsWith("drill_")) {
      const drillId = val.replace("drill_", "");
      selectPracticeDrill(drillId);
      return;
    }
    if (val.startsWith("set_")) {
      const setId = val.replace("set_", "");
      selectGameSet(setId);
      return;
    }
  };

  const currentNav = statsPath[statsPath.length - 1] || {
    level: "season",
    id: "all",
    name: "Season Totals (Game & Practice)",
  };

  const currentQuickSelectValue = useMemo(() => {
    if (currentNav.level === "season") {
      return `season_${currentNav.id || "all"}`;
    }
    if (currentNav.level === "event") {
      return `event_${currentNav.id}`;
    }
    if (currentNav.level === "match") {
      return `match_${currentNav.id}`;
    }
    if (currentNav.level === "drill") {
      return `drill_${currentNav.id}`;
    }
    if (currentNav.level === "set") {
      return `set_${currentNav.id}`;
    }
    return "season_all";
  }, [currentNav]);

  const navigateStats = (level, id, name) => {
    setStatsPath((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.level === level) {
        // Swap sibling (e.g. Set 1 -> Set 2, or Drill 1 -> Drill 2)
        return [...prev.slice(0, -1), { level, id, name }];
      }
      return [...prev, { level, id, name }];
    });
  };

  const popStatsTo = (index) =>
    setStatsPath((prev) => prev.slice(0, index + 1));

  const filteredStats = useMemo(() => {
    if (currentNav.level === "season") {
      const allMatchIds = new Set(appData.matches.map((m) => m.id));
      if (currentNav.id === "practice") {
        const practiceMatchIds = new Set(
          appData.matches
            .filter((m) => m.type === "Practice")
            .map((m) => m.id)
        );
        return appData.stats.filter((s) => practiceMatchIds.has(s.matchId));
      }
      if (currentNav.id === "games") {
        const gameMatchIds = new Set(
          appData.matches
            .filter((m) => m.type !== "Practice")
            .map((m) => m.id)
        );
        return appData.stats.filter((s) => gameMatchIds.has(s.matchId));
      }
      // "all" or default: Game AND Practice combined!
      return appData.stats.filter(
        (s) => allMatchIds.has(s.matchId) || !s.matchId
      );
    }
    if (currentNav.level === "event") {
      if (currentNav.id === "practice_sessions") {
        const practiceMatchIds = new Set(
          appData.matches
            .filter((m) => m.type === "Practice")
            .map((m) => m.id)
        );
        return appData.stats.filter((s) => practiceMatchIds.has(s.matchId));
      }
      if (currentNav.id === "all_games") {
        const gameMatchIds = new Set(
          appData.matches
            .filter((m) => m.type !== "Practice")
            .map((m) => m.id)
        );
        return appData.stats.filter((s) => gameMatchIds.has(s.matchId));
      }
      // Matches all matches (practices or games) belonging to this specific day/event
      const matchIds = new Set(
        appData.matches
          .filter((m) => getEventDetails(m).id === currentNav.id)
          .map((m) => m.id)
      );
      return appData.stats.filter((s) => matchIds.has(s.matchId));
    }
    if (currentNav.level === "match")
      return appData.stats.filter((s) => s.matchId === currentNav.id);
    if (currentNav.level === "set" || currentNav.level === "drill") {
      const bySet = appData.stats.filter((s) => s.setId === currentNav.id);
      if (bySet.length > 0) return bySet;
      return appData.stats.filter(
        (s) => s.setId === currentNav.id || s.matchId === currentNav.id
      );
    }
    return appData.stats;
  }, [appData.stats, appData.matches, currentNav]);

  const subNavOptions = useMemo(() => {
    if (currentNav.level === "season") {
      const scope = currentNav.id || "all";
      const events: Record<string, any> = {};

      // 1. All game matches and tournaments
      if (scope === "all" || scope === "games") {
        appData.matches
          .filter((m) => m.type !== "Practice")
          .forEach((m) => {
            const detail = getEventDetails(m);
            if (!events[detail.id]) {
              events[detail.id] = {
                ...detail,
                level: "event",
                date: m.date,
                isPractice: false,
                isTournament: m.type === "Tournament",
                matchCount: 1,
              };
            } else {
              events[detail.id].matchCount =
                (events[detail.id].matchCount || 1) + 1;
            }
          });
      }

      // 2. All practice days
      if (scope === "all" || scope === "practice") {
        appData.matches
          .filter((m) => m.type === "Practice")
          .forEach((m) => {
            const detail = getEventDetails(m);
            const matchSets = appData.sets.filter((s) => s.matchId === m.id);
            const count = matchSets.length > 0 ? matchSets.length : 1;
            if (!events[detail.id]) {
              events[detail.id] = {
                ...detail,
                level: "event",
                date: m.date,
                isPractice: true,
                isTournament: false,
                matchCount: count,
              };
            } else {
              events[detail.id].matchCount =
                (events[detail.id].matchCount || 1) + count;
            }
          });
      }

      // Sort newest events first
      return Object.values(events).sort((a: any, b: any) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
    }

    if (currentNav.level === "event") {
      const isPracticeEvent =
        currentNav.id.startsWith("practice_") ||
        currentNav.id === "practice_sessions";

      if (isPracticeEvent) {
        // Return all drills on this practice day
        return getDrillsForPracticeEvent(currentNav.id);
      }

      // Return all games in this tournament or game day
      return appData.matches
        .filter(
          (m) =>
            getEventDetails(m).id === currentNav.id && m.type !== "Practice"
        )
        .map((m) => ({
          level: "match",
          id: m.id,
          name: `vs ${m.opponent || "Opponent"}`,
          opponent: m.opponent,
          date: m.date,
          isPractice: false,
        }));
    }

    if (currentNav.level === "match") {
      const match = appData.matches.find((m) => m.id === currentNav.id);
      if (match?.type === "Practice") {
        return appData.sets
          .filter((s) => s.matchId === currentNav.id)
          .sort((a, b) => a.setNum - b.setNum)
          .map((s) => ({
            level: "drill",
            id: s.id,
            name: `Drill / Set ${s.setNum}`,
            isPractice: true,
            isDrill: true,
          }));
      }
      return appData.sets
        .filter((s) => s.matchId === currentNav.id)
        .sort((a, b) => a.setNum - b.setNum)
        .map((s) => ({
          level: "set",
          id: s.id,
          name: `Set ${s.setNum}`,
          score: `${s.scoreUcc || 0}-${s.scoreOpp || 0}`,
          isPractice: false,
        }));
    }

    if (currentNav.level === "drill") {
      // Show sibling drills on this practice day so user can switch between drills easily
      if (activeEventNav) {
        return getDrillsForPracticeEvent(activeEventNav.id).map((d) => ({
          ...d,
          isActive: d.id === currentNav.id,
        }));
      }
      return [];
    }

    if (currentNav.level === "set") {
      // Show sibling sets in this match so user can switch between Set 1, Set 2, Set 3 easily
      if (activeMatchNav) {
        return appData.sets
          .filter((s) => s.matchId === activeMatchNav.id)
          .sort((a, b) => a.setNum - b.setNum)
          .map((s) => ({
            level: "set",
            id: s.id,
            name: `Set ${s.setNum}`,
            score: `${s.scoreUcc || 0}-${s.scoreOpp || 0}`,
            isPractice: false,
            isActive: s.id === currentNav.id,
          }));
      }
      return [];
    }

    return [];
  }, [currentNav, appData.matches, appData.sets, activeEventNav, activeMatchNav]);

  const { uccStats, opponentStats } = useMemo(() => {
    const uccData = {};
    const oppData = {}; // { 'Match Opponent Name': { 'O1': stats... } }
    appData.roster.forEach((p) => {
      uccData[p.id] = {
        id: p.id,
        name: p.name,
        number: p.number,
        isRetired: p.isRetired || false,
        passSum: 0,
        passCount: 0,
        pass3: 0,
        pass2: 0,
        pass1: 0,
        pass0: 0,
        attCount: 0,
        attCountFront: 0,
        attCountBack: 0,
        attBlk: 0,
        attKill: 0,
        attErr: 0,
        attErrNet: 0,
        attErrOut: 0,
        attErrStuffed: 0,
        blkCount: 0,
        blkStuff: 0,
        blkLate: 0,
        blkNet: 0,
        blkUsed: 0,
        srvCount: 0,
        srvAce: 0,
        srvErr: 0,
        srvErrNet: 0,
        srvErrWide: 0,
        srvErrLong: 0,
        srvErrFoot: 0,
        srvErrOther: 0,
        digCount: 0,
        digErr: 0,
      };
    });

    const matchesMap = {};
    appData.matches.forEach((m) => {
      matchesMap[m.id] = m.opponent || "Unknown Team";
    });

    filteredStats.forEach((s) => {
      if (s.isOpponent) {
        const teamName = matchesMap[s.matchId] || "Unknown Team";
        if (!oppData[teamName]) {
          oppData[teamName] = {};
        }

        if (!oppData[teamName][s.playerId])
          oppData[teamName][s.playerId] = {
            attCount: 0,
            attKill: 0,
            srvAce: 0,
            srvErr: 0,
            passSum: 0,
            passCount: 0,
          };

        const p = oppData[teamName][s.playerId];
        if (s.category === "Attack") {
          if (
            s.metric === "Swing" ||
            s.metric === "Swing Front" ||
            s.metric === "Swing Back" ||
            s.metric === "Blocked" ||
            s.metric === "Stuffed" ||
            s.metric === "Out" ||
            s.metric === "Net" ||
            s.metric === "Out/Net" ||
            s.metric === "Kill"
          )
            p.attCount += 1;
          if (s.metric === "Kill") p.attKill += 1;
          if (
            s.metric === "Out" ||
            s.metric === "Net" ||
            s.metric === "Out/Net" ||
            s.metric === "Stuffed"
          )
            p.attErr = (p.attErr || 0) + 1;
        } else if (s.category === "Serve") {
          if (s.metric === "Attempt") p.srvCount = (p.srvCount || 0) + 1;
          if (s.metric === "Ace") p.srvAce += 1;
          if (s.metric?.includes("Miss") || s.metric === "Error") p.srvErr += 1;
        } else if (s.category === "Pass") {
          p.passCount += 1;
          p.passSum += s.value;
        }
      } else {
        const p = uccData[s.playerId];
        if (!p) return;
        if (s.category === "Pass") {
          p.passCount += 1;
          p.passSum += s.value;
          if (s.value === 3) p.pass3 += 1;
          else if (s.value === 2) p.pass2 += 1;
          else if (s.value === 1) p.pass1 += 1;
          else if (s.value === 0) p.pass0 += 1;
        } else if (s.category === "Dig") {
          if (s.metric === "Dig") p.digCount += 1;
          if (s.metric === "Error") p.digErr += 1;
        } else if (s.category === "Attack") {
          if (
            s.metric === "Swing" ||
            s.metric === "Swing Front" ||
            s.metric === "Swing Back" ||
            s.metric === "Blocked" ||
            s.metric === "Stuffed" ||
            s.metric === "Out" ||
            s.metric === "Net" ||
            s.metric === "Out/Net" ||
            s.metric === "Kill"
          ) {
            p.attCount += 1;
            if (s.row === "Front" || s.metric === "Swing Front") p.attCountFront += 1;
            else if (s.row === "Back" || s.metric === "Swing Back") p.attCountBack += 1;
            else p.attCountFront += 1;
          }
          if (s.metric === "Kill") p.attKill += 1;
          if (
            s.metric === "Out" ||
            s.metric === "Net" ||
            s.metric === "Out/Net" ||
            s.metric === "Stuffed"
          ) {
            p.attErr += 1;
            if (s.metric === "Net") p.attErrNet += 1;
            else if (s.metric === "Stuffed") p.attErrStuffed += 1;
            else p.attErrOut += 1;
          }
          if (s.metric === "Blocked" || s.metric === "Stuffed") p.attBlk += 1;
        } else if (s.category === "Block") {
          if (s.metric === "Play On" || s.metric === "Touch")
            p.blkCount += s.value || 1;
          if (
            s.metric === "Block" ||
            s.metric === "Stuffed" ||
            s.metric === "Stuff"
          )
            p.blkStuff += s.value || 1;
          if (s.metric === "Late") p.blkLate += s.value || 1;
          if (s.metric === "Net Viol") p.blkNet += s.value || 1;
          if (s.metric === "Used") p.blkUsed += s.value || 1;
        } else if (s.category === "Serve") {
          if (s.metric === "Attempt") p.srvCount += 1;
          if (s.metric === "Ace") p.srvAce += 1;
          if (s.metric?.includes("Miss") || s.metric === "Error") {
            p.srvErr += 1;
            const m = s.metric.toLowerCase();
            if (m.includes("net")) p.srvErrNet += 1;
            else if (m.includes("wide")) p.srvErrWide += 1;
            else if (m.includes("long") || m.includes("out") || m.includes("deep")) p.srvErrLong += 1;
            else if (m.includes("foot")) p.srvErrFoot += 1;
            else p.srvErrOther += 1;
          }
        }
      }
    });
    return { uccStats: uccData, opponentStats: oppData };
  }, [filteredStats, appData.roster, appData.matches]);

  const exportCSV = () => {
    const currentTeam = myTeams.find((t) => t.id === activeTeam);
    if (!isCoachRole && (currentTeam?.role === "player" || isPlayerRole)) {
      alert("Data export is disabled for player codes. Stats can only be viewed on your device.");
      return;
    }
    const teamName = currentTeam
      ? currentTeam.name.replace(/\s+/g, "_")
      : "Team";
    let csv = `UCC LANCERS (${teamName}) - ${currentNav.name.toUpperCase()}\nNumber,Name,Pass Avg,Passes,Digs,Dig Touches,Swings,Swings (Front),Swings (Back),Kills,Kill %,Att Errors,Att Blocked,Blocks,Blk Stuffs,Blk Late,Blk Net,Blk Used,Serves,Aces,Serve Errors,Serve +/-\n`;

    const allPlayers = Object.values(uccStats).filter((p) => {
      if (!showRetired && p.isRetired) return false;
      return true;
    });

    const visiblePlayers = allPlayers.filter((p) => {
      if (isPlayerHidden(p)) return false;
      return true;
    });

    const hasHiddenPlayers = allPlayers.some((p) => isPlayerHidden(p));

    const teamTot = {
      passCount: 0,
      passSum: 0,
      digCount: 0,
      digErr: 0,
      attCount: 0,
      attCountFront: 0,
      attCountBack: 0,
      attKill: 0,
      attErr: 0,
      attBlk: 0,
      blkCount: 0,
      blkStuff: 0,
      blkLate: 0,
      blkNet: 0,
      blkUsed: 0,
      srvCount: 0,
      srvAce: 0,
      srvErr: 0,
    };

    allPlayers.forEach((p) => {
      teamTot.passCount += p.passCount || 0;
      teamTot.passSum += p.passSum || 0;
      teamTot.digCount += p.digCount || 0;
      teamTot.digErr += p.digErr || 0;
      teamTot.attCount += p.attCount || 0;
      teamTot.attCountFront += p.attCountFront || 0;
      teamTot.attCountBack += p.attCountBack || 0;
      teamTot.attKill += p.attKill || 0;
      teamTot.attErr += p.attErr || 0;
      teamTot.attBlk += p.attBlk || 0;
      teamTot.blkCount += p.blkCount || 0;
      teamTot.blkStuff += p.blkStuff || 0;
      teamTot.blkLate += p.blkLate || 0;
      teamTot.blkNet += p.blkNet || 0;
      teamTot.blkUsed += p.blkUsed || 0;
      teamTot.srvCount += p.srvCount || 0;
      teamTot.srvAce += p.srvAce || 0;
      teamTot.srvErr += p.srvErr || 0;
    });

    const shownTot = {
      passCount: 0,
      passSum: 0,
      digCount: 0,
      digErr: 0,
      attCount: 0,
      attCountFront: 0,
      attCountBack: 0,
      attKill: 0,
      attErr: 0,
      attBlk: 0,
      blkCount: 0,
      blkStuff: 0,
      blkLate: 0,
      blkNet: 0,
      blkUsed: 0,
      srvCount: 0,
      srvAce: 0,
      srvErr: 0,
    };

    visiblePlayers.forEach((p) => {
      const passAvg =
        p.passCount > 0 ? (p.passSum / p.passCount).toFixed(2) : "0.00";
      const blkTot = p.blkCount + p.blkStuff;
      const srvTot = p.srvCount + p.srvAce + p.srvErr;
      const killPct =
        p.attCount > 0
          ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%"
          : "0.0%";
      const srvPlusMinus = p.srvAce - p.srvErr;

      shownTot.passCount += p.passCount || 0;
      shownTot.passSum += p.passSum || 0;
      shownTot.digCount += p.digCount || 0;
      shownTot.digErr += p.digErr || 0;
      shownTot.attCount += p.attCount || 0;
      shownTot.attCountFront += p.attCountFront || 0;
      shownTot.attCountBack += p.attCountBack || 0;
      shownTot.attKill += p.attKill || 0;
      shownTot.attErr += p.attErr || 0;
      shownTot.attBlk += p.attBlk || 0;
      shownTot.blkCount += p.blkCount || 0;
      shownTot.blkStuff += p.blkStuff || 0;
      shownTot.blkLate += p.blkLate || 0;
      shownTot.blkNet += p.blkNet || 0;
      shownTot.blkUsed += p.blkUsed || 0;
      shownTot.srvCount += p.srvCount || 0;
      shownTot.srvAce += p.srvAce || 0;
      shownTot.srvErr += p.srvErr || 0;

      csv += `"${p.number || ""}","${p.name}",${passAvg},${p.passCount},${p.digCount},${p.digErr},${p.attCount},${p.attCountFront},${p.attCountBack},${p.attKill},${killPct},${p.attErr},${p.attBlk},${blkTot},${p.blkStuff},${p.blkLate},${p.blkNet},${p.blkUsed},${srvTot},${p.srvAce},${p.srvErr},${srvPlusMinus}\n`;
    });

    if (hasHiddenPlayers) {
      const shownPassAvg =
        shownTot.passCount > 0 ? (shownTot.passSum / shownTot.passCount).toFixed(2) : "0.00";
      const shownBlkTot = shownTot.blkCount + shownTot.blkStuff;
      const shownSrvTot = shownTot.srvCount + shownTot.srvAce + shownTot.srvErr;
      const shownKillPct =
        shownTot.attCount > 0
          ? ((shownTot.attKill / shownTot.attCount) * 100).toFixed(1) + "%"
          : "0.0%";
      const shownSrvPlusMinus = shownTot.srvAce - shownTot.srvErr;

      csv += `"","SHOWN PLAYERS (AVG & TOT)",${shownPassAvg},${shownTot.passCount},${shownTot.digCount},${shownTot.digErr},${shownTot.attCount},${shownTot.attCountFront},${shownTot.attCountBack},${shownTot.attKill},${shownKillPct},${shownTot.attErr},${shownTot.attBlk},${shownBlkTot},${shownTot.blkStuff},${shownTot.blkLate},${shownTot.blkNet},${shownTot.blkUsed},${shownSrvTot},${shownTot.srvAce},${shownTot.srvErr},${shownSrvPlusMinus}\n`;
    }

    const totPassAvg =
      teamTot.passCount > 0 ? (teamTot.passSum / teamTot.passCount).toFixed(2) : "0.00";
    const totBlkTot = teamTot.blkCount + teamTot.blkStuff;
    const totSrvTot = teamTot.srvCount + teamTot.srvAce + teamTot.srvErr;
    const totKillPct =
      teamTot.attCount > 0
        ? ((teamTot.attKill / teamTot.attCount) * 100).toFixed(1) + "%"
        : "0.0%";
    const totSrvPlusMinus = teamTot.srvAce - teamTot.srvErr;

    csv += `"","TEAM TOTALS (WHOLE TEAM)",${totPassAvg},${teamTot.passCount},${teamTot.digCount},${teamTot.digErr},${teamTot.attCount},${teamTot.attCountFront},${teamTot.attCountBack},${teamTot.attKill},${totKillPct},${teamTot.attErr},${teamTot.attBlk},${totBlkTot},${teamTot.blkStuff},${teamTot.blkLate},${teamTot.blkNet},${teamTot.blkUsed},${totSrvTot},${teamTot.srvAce},${teamTot.srvErr},${totSrvPlusMinus}\n`;

    csv +=
      "\nOPPONENT STATS\nID,Aces,Serve Errors,Serve +/-,Swings,Kills,Kill %,Pass Avg,Passes\n";
    Object.entries(opponentStats).forEach(([teamOrId, pOrPlayers]: [string, any]) => {
      if (typeof pOrPlayers === "object" && pOrPlayers !== null && !("passCount" in pOrPlayers)) {
        Object.entries(pOrPlayers).forEach(([id, p]: [string, any]) => {
          const passAvg =
            p.passCount > 0 ? (p.passSum / p.passCount).toFixed(2) : "0.00";
          const killPct =
            p.attCount > 0
              ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%"
              : "0.0%";
          const srvPlusMinus = p.srvAce - p.srvErr;
          csv += `"${teamOrId} - ${id}",${p.srvAce},${p.srvErr},${srvPlusMinus},${p.attCount},${p.attKill},${killPct},${passAvg},${p.passCount}\n`;
        });
      } else {
        const p = pOrPlayers;
        const passAvg =
          p.passCount > 0 ? (p.passSum / p.passCount).toFixed(2) : "0.00";
        const killPct =
          p.attCount > 0
            ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%"
            : "0.0%";
        const srvPlusMinus = p.srvAce - p.srvErr;
        csv += `"${teamOrId}",${p.srvAce},${p.srvErr},${srvPlusMinus},${p.attCount},${p.attKill},${killPct},${passAvg},${p.passCount}\n`;
      }
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Lancers_${teamName}_${currentNav.name.replace(
      /[^a-z0-9]/gi,
      "_",
    )}_${new Date().toLocaleDateString().replace(/\//g, "-")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const currentTeam = myTeams.find((t) => t.id === activeTeam);
    if (!isCoachRole && (currentTeam?.role === "player" || isPlayerRole)) {
      alert("PDF downloads are disabled for player codes. Stats can only be viewed on your device.");
      return;
    }
    const teamName = currentTeam
      ? currentTeam.name.replace(/\s+/g, "_")
      : "Team";
    const filename = `Lancers_${teamName}_${currentNav.name.replace(
      /[^a-z0-9]/gi,
      "_"
    )}_${new Date().toLocaleDateString().replace(/\//g, "-")}.pdf`;

    const doc = new jsPDF({ orientation: "landscape" });
    const title = `UCC LANCERS (${teamName}) - ${currentNav.name.toUpperCase()}`;
    doc.text(title, 14, 13);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("NOTE: TOT Blocks includes both touches and stuffs. (STF) denotes blocked stuffs.", 14, 18);
    doc.setTextColor(0, 0, 0);

    const head = [
      [
        "Number",
        "Name",
        "Pass Avg",
        "Passes",
        "Digs",
        "Dig Touches",
        "Swings",
        "Swings (Front)",
        "Swings (Back)",
        "Kills",
        "Kill %",
        "Att Errors",
        "Att Blocked",
        "TOT Blocks",
        "(STF) Stuffs",
        "Blk Late",
        "Blk Net",
        "Blk Used",
        "Serves",
        "Aces",
        "Serve Errors",
        "Serve +/-",
      ],
    ];

    const allPlayers = Object.values(uccStats).filter((p) => {
      if (!showRetired && p.isRetired) return false;
      return true;
    });

    const visiblePlayers = allPlayers.filter((p) => {
      if (isPlayerHidden(p)) return false;
      return true;
    });

    const hasHiddenPlayers = allPlayers.some((p) => isPlayerHidden(p));

    const teamTot = {
      passCount: 0,
      passSum: 0,
      digCount: 0,
      digErr: 0,
      attCount: 0,
      attCountFront: 0,
      attCountBack: 0,
      attKill: 0,
      attErr: 0,
      attBlk: 0,
      blkCount: 0,
      blkStuff: 0,
      blkLate: 0,
      blkNet: 0,
      blkUsed: 0,
      srvCount: 0,
      srvAce: 0,
      srvErr: 0,
    };

    allPlayers.forEach((p) => {
      teamTot.passCount += p.passCount || 0;
      teamTot.passSum += p.passSum || 0;
      teamTot.digCount += p.digCount || 0;
      teamTot.digErr += p.digErr || 0;
      teamTot.attCount += p.attCount || 0;
      teamTot.attCountFront += p.attCountFront || 0;
      teamTot.attCountBack += p.attCountBack || 0;
      teamTot.attKill += p.attKill || 0;
      teamTot.attErr += p.attErr || 0;
      teamTot.attBlk += p.attBlk || 0;
      teamTot.blkCount += p.blkCount || 0;
      teamTot.blkStuff += p.blkStuff || 0;
      teamTot.blkLate += p.blkLate || 0;
      teamTot.blkNet += p.blkNet || 0;
      teamTot.blkUsed += p.blkUsed || 0;
      teamTot.srvCount += p.srvCount || 0;
      teamTot.srvAce += p.srvAce || 0;
      teamTot.srvErr += p.srvErr || 0;
    });

    const shownTot = {
      passCount: 0,
      passSum: 0,
      digCount: 0,
      digErr: 0,
      attCount: 0,
      attCountFront: 0,
      attCountBack: 0,
      attKill: 0,
      attErr: 0,
      attBlk: 0,
      blkCount: 0,
      blkStuff: 0,
      blkLate: 0,
      blkNet: 0,
      blkUsed: 0,
      srvCount: 0,
      srvAce: 0,
      srvErr: 0,
    };

    const body = visiblePlayers.map((p) => {
      const passAvg =
        p.passCount > 0 ? (p.passSum / p.passCount).toFixed(2) : "0.00";
      const blkTot = p.blkCount + p.blkStuff;
      const srvTot = p.srvCount + p.srvAce + p.srvErr;
      const killPct =
        p.attCount > 0
          ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%"
          : "0.0%";
      const srvPlusMinus = p.srvAce - p.srvErr;

      shownTot.passCount += p.passCount || 0;
      shownTot.passSum += p.passSum || 0;
      shownTot.digCount += p.digCount || 0;
      shownTot.digErr += p.digErr || 0;
      shownTot.attCount += p.attCount || 0;
      shownTot.attCountFront += p.attCountFront || 0;
      shownTot.attCountBack += p.attCountBack || 0;
      shownTot.attKill += p.attKill || 0;
      shownTot.attErr += p.attErr || 0;
      shownTot.attBlk += p.attBlk || 0;
      shownTot.blkCount += p.blkCount || 0;
      shownTot.blkStuff += p.blkStuff || 0;
      shownTot.blkLate += p.blkLate || 0;
      shownTot.blkNet += p.blkNet || 0;
      shownTot.blkUsed += p.blkUsed || 0;
      shownTot.srvCount += p.srvCount || 0;
      shownTot.srvAce += p.srvAce || 0;
      shownTot.srvErr += p.srvErr || 0;

      return [
        p.number || "",
        p.name,
        passAvg,
        p.passCount,
        p.digCount,
        p.digErr,
        p.attCount,
        p.attCountFront,
        p.attCountBack,
        p.attKill,
        killPct,
        p.attErr,
        p.attBlk,
        `${blkTot} (${p.blkStuff} STF)`,
        p.blkStuff,
        p.blkLate,
        p.blkNet,
        p.blkUsed,
        srvTot,
        p.srvAce,
        p.srvErr,
        srvPlusMinus,
      ];
    });

    const totPassAvg =
      teamTot.passCount > 0 ? (teamTot.passSum / teamTot.passCount).toFixed(2) : "0.00";
    const totBlkTot = teamTot.blkCount + teamTot.blkStuff;
    const totSrvTot = teamTot.srvCount + teamTot.srvAce + teamTot.srvErr;
    const totKillPct =
      teamTot.attCount > 0
        ? ((teamTot.attKill / teamTot.attCount) * 100).toFixed(1) + "%"
        : "0.0%";
    const totSrvPlusMinus = teamTot.srvAce - teamTot.srvErr;

    const foot: any[] = [];

    if (hasHiddenPlayers) {
      const shownPassAvg =
        shownTot.passCount > 0 ? (shownTot.passSum / shownTot.passCount).toFixed(2) : "0.00";
      const shownBlkTot = shownTot.blkCount + shownTot.blkStuff;
      const shownSrvTot = shownTot.srvCount + shownTot.srvAce + shownTot.srvErr;
      const shownKillPct =
        shownTot.attCount > 0
          ? ((shownTot.attKill / shownTot.attCount) * 100).toFixed(1) + "%"
          : "0.0%";
      const shownSrvPlusMinus = shownTot.srvAce - shownTot.srvErr;

      foot.push([
        "SHOWN",
        "PLAYERS (AVG)",
        shownPassAvg,
        shownTot.passCount,
        shownTot.digCount,
        shownTot.digErr,
        shownTot.attCount,
        shownTot.attCountFront,
        shownTot.attCountBack,
        shownTot.attKill,
        shownKillPct,
        shownTot.attErr,
        shownTot.attBlk,
        `${shownBlkTot} (${shownTot.blkStuff} STF)`,
        shownTot.blkStuff,
        shownTot.blkLate,
        shownTot.blkNet,
        shownTot.blkUsed,
        shownSrvTot,
        shownTot.srvAce,
        shownTot.srvErr,
        shownSrvPlusMinus,
      ]);
    }

    foot.push([
      "TEAM",
      "TOTALS (ALL)",
      totPassAvg,
      teamTot.passCount,
      teamTot.digCount,
      teamTot.digErr,
      teamTot.attCount,
      teamTot.attCountFront,
      teamTot.attCountBack,
      teamTot.attKill,
      totKillPct,
      teamTot.attErr,
      teamTot.attBlk,
      `${totBlkTot} (${teamTot.blkStuff} STF)`,
      teamTot.blkStuff,
      teamTot.blkLate,
      teamTot.blkNet,
      teamTot.blkUsed,
      totSrvTot,
      teamTot.srvAce,
      teamTot.srvErr,
      totSrvPlusMinus,
    ]);

    autoTable(doc, {
      startY: 21,
      head: head,
      body: body,
      foot: foot,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 51, 160] },
      footStyles: { fillColor: [0, 27, 94], textColor: [255, 255, 255], fontStyle: "bold" },
    });

    const finalY = doc.lastAutoTable.finalY || 20;
    doc.text("OPPONENT STATS", 14, finalY + 10);

    const oppHead = [
      [
        "ID",
        "Aces",
        "Serve Errors",
        "Serve +/-",
        "Swings",
        "Kills",
        "Kill %",
        "Pass Avg",
        "Passes",
      ],
    ];
    const oppBody: any[] = [];
    Object.entries(opponentStats).forEach(([teamOrId, pOrPlayers]: [string, any]) => {
      if (typeof pOrPlayers === "object" && pOrPlayers !== null && !("passCount" in pOrPlayers)) {
        Object.entries(pOrPlayers).forEach(([id, p]: [string, any]) => {
          const passAvg =
            p.passCount > 0 ? (p.passSum / p.passCount).toFixed(2) : "0.00";
          const killPct =
            p.attCount > 0
              ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%"
              : "0.0%";
          const srvPlusMinus = p.srvAce - p.srvErr;
          oppBody.push([
            `${teamOrId} - #${id}`,
            p.srvAce,
            p.srvErr,
            srvPlusMinus,
            p.attCount,
            p.attKill,
            killPct,
            passAvg,
            p.passCount,
          ]);
        });
      } else {
        const p = pOrPlayers;
        const passAvg =
          p.passCount > 0 ? (p.passSum / p.passCount).toFixed(2) : "0.00";
        const killPct =
          p.attCount > 0
            ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%"
            : "0.0%";
        const srvPlusMinus = p.srvAce - p.srvErr;
        oppBody.push([
          teamOrId,
          p.srvAce,
          p.srvErr,
          srvPlusMinus,
          p.attCount,
          p.attKill,
          killPct,
          passAvg,
          p.passCount,
        ]);
      }
    });

    autoTable(doc, {
      startY: finalY + 15,
      head: oppHead,
      body: oppBody,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [51, 65, 85] },
    });

    doc.save(filename);
  };

  const benchPlayers = useMemo(() => {
    return (appData.roster || [])
      .filter((p) => !lineup.includes(p.id) && !p.isRetired)
      .sort(sortPlayersByNumberThenAlpha);
  }, [appData.roster, lineup, sortPlayersByNumberThenAlpha]);
  const selectedPlayerObj = appData.roster.find(
    (r) => r.id === selectedPlayerId,
  );

  const handleCreateTeam = async () => {
    if (!user) return;

    // Safety check bypassed for broad Google Sign-in to avoid blocking organizational accounts
    const name = prompt("Enter new team name (e.g. 'Varsity Boys 2026'):");
    if (!name) return;

    const tId = generateTeamId();
    const coachCode = tId;
    const playerCode = generateTeamId();
    const color = TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)];

    try {
      console.log("Starting team creation batch...", { tId, userId: user.uid });
      const batch = writeBatch(db);

      // Initialize team root document
      batch.set(doc(db, `${publicPath}/${tId}`), {
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        name: name,
      });

      // Give access to coach
      batch.set(doc(db, `${publicPath}/${tId}/members/${user.uid}`), {
        uid: user.uid,
        role: "coach",
        joinedAt: serverTimestamp(),
        email: user.email || "",
        displayName: user.displayName || user.email?.split("@")[0] || "Coach",
        photoURL: user.photoURL || "",
        lastActive: serverTimestamp(),
      });

      localStorage.setItem(`ucc_team_role_${tId}`, "coach");
      localStorage.setItem("ucc_current_role", "coach");

      // Core settings
      batch.set(doc(db, `${publicPath}/${tId}/settings/core`), {
        roster: DEFAULT_ROSTER,
        savedRosters: {},
        savedLineups: {},
        teamName: name,
        coachCode,
        playerCode,
      });

      // Store codes mapping
      batch.set(doc(db, "share_codes", coachCode), {
        teamId: tId,
        role: "coach",
      });
      batch.set(doc(db, "share_codes", playerCode), {
        teamId: tId,
        role: "player",
      });

      // Save visually to user profile
      const newTeams = [...myTeams, { id: tId, name, color, role: "coach" }];
      batch.set(
        doc(db, "users", user.uid),
        { teams: newTeams },
        { merge: true },
      );

      await batch.commit();
      console.log("Team creation successful");
      alert(
        `Team created successfully!\n\nCoach Code: ${coachCode}\nPlayer Code: ${playerCode}`,
      );
    } catch (e) {
      console.error("DEBUG - Team Creation Error:", e);
      let errorMsg = e.message || "Unknown error";
      if (errorMsg.includes("permissions")) {
        errorMsg =
          "Forbidden: Your account does not have permission to create teams. This usually happens if your email is not verified or your session has expired.";
      }
      alert(`Failed to create team.\n\nDetails: ${errorMsg}`);
    }
  };

  const handleShareCode = async (code, type) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join team on UCC Volleyball`,
          text: `Use this ${type} code to join: ${code}`,
        });
      } catch (e) {
        console.log(e);
      }
    } else {
      navigator.clipboard.writeText(code);
      alert(`${type} code ${code} copied to clipboard!`);
    }
  };

  const handleJoinTeam = async () => {
    if (!user) return;
    const tIdRaw = prompt("Enter a Coach or Player Share Code:");
    if (!tIdRaw) return;
    const code = tIdRaw.toUpperCase().trim();

    try {
      let teamId = code;
      let role = "coach";

      // Try resolving via share_codes
      const codeSnap = await getDoc(doc(db, "share_codes", code));
      if (codeSnap.exists()) {
        teamId = codeSnap.data().teamId;
        role = codeSnap.data().role;
      }

      const existingTeam = myTeams.find((t) => t.id === teamId);
      if (existingTeam) {
        if (role === "coach") {
          // Upgrade player membership to Coach
          await setDoc(doc(db, `${publicPath}/${teamId}/members/${user.uid}`), {
            uid: user.uid,
            role: "coach",
            joinedAt: serverTimestamp(),
            email: user.email || "",
            displayName: user.displayName || user.email?.split("@")[0] || "Coach",
            photoURL: user.photoURL || "",
            lastActive: serverTimestamp(),
          }, { merge: true });

          localStorage.setItem(`ucc_team_role_${teamId}`, "coach");
          localStorage.setItem("ucc_current_role", "coach");
          localStorage.setItem(`ucc_coach_unlocked_${teamId}`, "true");

          const newTeams = myTeams.map((t) =>
            t.id === teamId ? { ...t, role: "coach" } : t,
          );
          setMyTeams(newTeams);
          await setDoc(
            doc(db, "users", user.uid),
            { teams: newTeams },
            { merge: true },
          );
          alert(`Successfully verified Coach access for ${existingTeam.name}! You now have full access regardless of player lock.`);
          setActiveTeam(teamId);
          localStorage.setItem("ucc_vball_active_team", teamId);
          return;
        } else {
          alert("You are already in this team.");
          return;
        }
      }

      // 1. Give Access (via permissive member creation rule)
      await setDoc(doc(db, `${publicPath}/${teamId}/members/${user.uid}`), {
        uid: user.uid,
        role,
        joinedAt: serverTimestamp(),
        email: user.email || "",
        displayName: user.displayName || user.email?.split("@")[0] || (role === "coach" ? "Coach" : "Player"),
        photoURL: user.photoURL || "",
        lastActive: serverTimestamp(),
      });

      // Persist role in local storage
      localStorage.setItem(`ucc_team_role_${teamId}`, role);
      localStorage.setItem("ucc_current_role", role);
      if (role === "coach") {
        localStorage.setItem(`ucc_coach_unlocked_${teamId}`, "true");
      }

      // 2. Fetch metadata that we now have access to read
      const snap = await getDoc(
        doc(db, `${publicPath}/${teamId}/settings/core`),
      );
      const tName =
        snap.exists() && snap.data().teamName
          ? snap.data().teamName
          : "Joined Team";
      const color = TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)];

      // 3. Update user profile
      const newTeams = [...myTeams, { id: teamId, name: tName, color, role }];
      await setDoc(
        doc(db, "users", user.uid),
        { teams: newTeams },
        { merge: true },
      );
      alert(
        `Successfully joined ${tName} as a ${role === "coach" ? "Coach" : "Player"}!`,
      );
    } catch (e) {
      console.error(e);
      alert("Failed to join. Verify the share code is correct.");
    }
  };

  const handleRenameTeam = async (teamId, currentName) => {
    const newName = prompt("Enter new team name:", currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;
    const finalName = newName.trim();
    const updatedTeams = myTeams.map((t) =>
      t.id === teamId ? { ...t, name: finalName } : t,
    );
    setMyTeams(updatedTeams);

    try {
      if (isFirebaseAvailable && user) {
        const batch = writeBatch(db);
        batch.set(
          doc(db, "users", user.uid),
          { teams: updatedTeams },
          { merge: true },
        );
        batch.set(
          doc(db, `${publicPath}/${teamId}`),
          { name: finalName },
          { merge: true },
        );
        batch.set(
          doc(db, `${publicPath}/${teamId}/settings/core`),
          { teamName: finalName },
          { merge: true },
        );
        await batch.commit();
      }
    } catch (e) {
      console.error("Failed to rename team:", e);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    const team = myTeams.find((t) => t.id === teamId);
    if (!team) return;

    const confirmMsg =
      team.role === "coach"
        ? `DISBAND / LEAVE TEAM: Are you sure you want to remove "${team.name}"?`
        : `LEAVE TEAM: Are you sure you want to remove "${team.name}" from your list?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      // 1. Remove from user profile instantly so they are unblocked
      const newTeams = myTeams.filter((t) => t.id !== teamId);
      await setDoc(
        doc(db, "users", user.uid),
        { teams: newTeams },
        { merge: true },
      );

      // Update local state immediately before attempting other risky deletes
      setMyTeams(newTeams);
      if (activeTeam === teamId) {
        setActiveTeam(null);
        localStorage.removeItem("ucc_vball_active_team");
        setView("team_select");
      }

      // 2. Try cleaning up team traces
      try {
        await deleteDoc(doc(db, `${publicPath}/${teamId}/members/${user.uid}`));
        if (team.role === "coach") {
          // Attempt root deletion just in case rules allow it
          await deleteDoc(doc(db, `${publicPath}/${teamId}`));
        }
      } catch (cleanupError) {
        console.log("Cleanup skipping due to rules (expected):", cleanupError);
      }

      alert("Team successfully removed from your account.");
    } catch (e) {
      console.error("Delete Team Profile Error:", e);
      alert("Failed to remove team from your profile.");
    }
  };

  const executeBatchedDeletions = async (docRefs) => {
    // Process in batches of 400 to stay safely under Firestore's 500 limit
    const validRefs = docRefs.filter(
      (ref) => ref && ref.id && ref.id !== "undefined",
    );
    for (let i = 0; i < validRefs.length; i += 400) {
      const batch = writeBatch(db);
      validRefs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  };

  const handleDeleteEvent = async (eventId, isPracticeSessions = false) => {
    try {
      let matchesToDelete = [];
      if (isPracticeSessions || eventId === "practice_sessions") {
        matchesToDelete = appData.matches.filter((m) => m.type === "Practice");
      } else {
        matchesToDelete = appData.matches.filter(
          (m) => getEventDetails(m).id === eventId,
        );
      }

      const matchIds = matchesToDelete.map((m) => m.id);
      if (matchIds.length === 0) return;

      if (isFirebaseAvailable && user) {
        const teamId = activeTeam;
        let refsToDelete = [];

        // 1. Collect all stats
        appData.stats
          .filter((s) => matchIds.includes(s.matchId))
          .forEach((s) => {
            refsToDelete.push(doc(db, `${publicPath}/${teamId}/stats/${s.id}`));
          });

        // 2. Collect all sets
        appData.sets
          .filter((s) => matchIds.includes(s.matchId))
          .forEach((s) => {
            refsToDelete.push(doc(db, `${publicPath}/${teamId}/sets/${s.id}`));
          });

        // 3. Collect all matches
        matchIds.forEach((id) => {
          refsToDelete.push(doc(db, `${publicPath}/${teamId}/matches/${id}`));
        });

        await executeBatchedDeletions(refsToDelete);
      } else {
        const newStats = appData.stats.filter(
          (s) => !matchIds.includes(s.matchId),
        );
        const newSets = appData.sets.filter(
          (s) => !matchIds.includes(s.matchId),
        );
        const newMatches = appData.matches.filter(
          (m) => !matchIds.includes(m.id),
        );
        writeLocalDb({
          ...appData,
          stats: newStats,
          sets: newSets,
          matches: newMatches,
        });
      }

      if (matchIds.includes(activeMatch?.id)) {
        setActiveMatch(null);
        setView("menu");
      }

      alert(
        "Day/Event and all associated games and stats deleted successfully.",
      );
    } catch (e) {
      console.error("Delete Event Error:", e);
      alert("Failed to delete event completely. " + e.message);
    }
  };

  const handleDeleteMatch = async (matchId) => {
    const match = appData.matches.find((m) => m.id === matchId);
    if (!match) return;

    if (
      !window.confirm(
        `DELETE GAME: Are you sure you want to delete the match vs ${match.opponent}?\n\nThis will permanently erase all stats and sets for this game. This cannot be undone.`,
      )
    )
      return;

    try {
      if (isFirebaseAvailable && user) {
        const teamId = activeTeam;
        let refsToDelete = [];

        // 1. Collect associated stats
        appData.stats
          .filter((s) => s.matchId === matchId)
          .forEach((s) => {
            refsToDelete.push(doc(db, `${publicPath}/${teamId}/stats/${s.id}`));
          });

        // 2. Collect associated sets
        appData.sets
          .filter((s) => s.matchId === matchId)
          .forEach((s) => {
            refsToDelete.push(doc(db, `${publicPath}/${teamId}/sets/${s.id}`));
          });

        // 3. Collect the match record itself
        refsToDelete.push(
          doc(db, `${publicPath}/${teamId}/matches/${matchId}`),
        );

        await executeBatchedDeletions(refsToDelete);
      } else {
        const newStats = appData.stats.filter((s) => s.matchId !== matchId);
        const newSets = appData.sets.filter((s) => s.matchId !== matchId);
        const newMatches = appData.matches.filter((m) => m.id !== matchId);
        writeLocalDb({
          ...appData,
          stats: newStats,
          sets: newSets,
          matches: newMatches,
        });
      }

      // If we were in this game, reset view
      if (activeMatch?.id === matchId) {
        setActiveMatch(null);
        setView("menu");
      }

      alert("Game and all associated stats deleted successfully.");
    } catch (e) {
      console.error("Delete Match Error:", e);
      alert("Failed to delete match completely. " + e.message);
    }
  };

  const handleDeleteSet = async (setId) => {
    const s = appData.sets.find((set) => set.id === setId);
    if (!s) return;
    if (
      !window.confirm(
        `DELETE SET: Are you sure you want to delete Set ${s.setNum}?\n\nAll stats recorded during this set will be permanently erased.`,
      )
    )
      return;

    try {
      if (isFirebaseAvailable && user) {
        const teamId = activeTeam;
        const statsToDelete = appData.stats.filter(
          (stat) => stat.setId === setId,
        );
        if (statsToDelete.length > 0) {
          const batch = writeBatch(db);
          statsToDelete.forEach((stat) => {
            batch.delete(doc(db, `${publicPath}/${teamId}/stats/${stat.id}`));
          });
          await batch.commit();
        }
        await deleteDoc(doc(db, `${publicPath}/${teamId}/sets/${setId}`));
      } else {
        const newStats = appData.stats.filter((stat) => stat.setId !== setId);
        const newSets = appData.sets.filter((set) => set.id !== setId);
        writeLocalDb({
          ...appData,
          stats: newStats,
          sets: newSets,
        });
      }
      alert("Set and associated stats deleted.");
    } catch (e) {
      console.error("Delete Set Error:", e);
      alert("Failed to delete set.");
    }
  };

  // -------------------------------------------------------------
  // RENDERERS
  // -------------------------------------------------------------

  const renderCoachLoginModal = () => {
    if (!showCoachLoginModal) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-[130] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 text-white relative">
            <button
              type="button"
              onClick={() => {
                setShowCoachLoginModal(false);
                setCoachLoginMsg(null);
                setCoachCodeInput("");
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="font-black text-lg sm:text-xl tracking-wider uppercase text-white">
                  Coach Login & Unlock
                </h3>
                <p className="text-slate-300 text-xs mt-0.5 font-medium">
                  Full access at all times, regardless of player lockout
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
              <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Coaches Access Guarantee:</span>{" "}
                Coaches maintain 100% full access to view stats, line-ups, and run games even when player access is disabled or locked.
              </div>
            </div>

            {/* Google Coach Sign In Option */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                Method 1: Sign in with Coach Google Account
              </label>
              {user ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="text-slate-600 font-medium truncate">{user.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut(auth);
                      setCoachLoginMsg({ text: "Signed out. Please sign in with your Coach account.", isError: false });
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-bold uppercase tracking-wider text-[10px] shrink-0 ml-2 cursor-pointer"
                  >
                    Switch Account
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleCoachSignIn}
                  disabled={isVerifyingCoach}
                  className="w-full bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-800 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google"
                    className="w-4 h-4"
                  />
                  <span>Sign In with Coach Google Account</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 my-2">
              <div className="h-px bg-slate-200 flex-1"></div>
              <span className="text-[10px] uppercase font-bold text-slate-400">OR</span>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            {/* Coach Code Option */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyCoachCode();
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Method 2: Enter Coach Share Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={coachCodeInput}
                    onChange={(e) => {
                      setCoachCodeInput(e.target.value.toUpperCase());
                      if (coachLoginMsg) setCoachLoginMsg(null);
                    }}
                    placeholder="Enter Coach Code (e.g. 6-digit code or Team ID)"
                    className="w-full uppercase font-mono tracking-widest px-4 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-bold text-slate-800 transition-all placeholder:text-slate-400 placeholder:normal-case placeholder:font-sans placeholder:tracking-normal"
                    disabled={isVerifyingCoach}
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Key size={16} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Coaches can find this code in the database menu or team settings.
                </p>
              </div>

              {coachLoginMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    coachLoginMsg.isError
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {coachLoginMsg.isError ? <AlertTriangle size={15} className="shrink-0" /> : <CheckCircle2 size={15} className="shrink-0" />}
                  <span>{coachLoginMsg.text}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCoachLoginModal(false);
                    setCoachLoginMsg(null);
                    setCoachCodeInput("");
                  }}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingCoach || !coachCodeInput.trim()}
                  className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isVerifyingCoach ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></div>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Unlock size={15} />
                      <span>Unlock Coach Access</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const renderPlayerSecurity = () => {
    if (!isShieldProtectionActive) {
      return renderCoachLoginModal();
    }
    return (
      <>
        {renderCoachLoginModal()}
        {/* Anti-screenshot & capture shield overlay */}
        {screenCaptureShieldActive && (
          <div
            onClick={() => {
              document.documentElement.classList.remove("shield-active");
              document.body.classList.remove("shield-active");
              setScreenCaptureShieldActive(false);
            }}
            className="fixed inset-0 z-[2147483647] bg-black flex flex-col items-center justify-center p-6 text-center select-none cursor-pointer"
          >
            <div className="h-16 w-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-5 text-red-500 shadow-2xl">
              <ShieldAlert size={36} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider mb-2">
              Protected Content
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-md font-medium leading-relaxed mb-6">
              Screen capture and recording are prohibited. Viewing is restricted to authorized devices.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  document.documentElement.classList.remove("shield-active");
                  document.body.classList.remove("shield-active");
                  setScreenCaptureShieldActive(false);
                }}
                className="bg-[#e50914] hover:bg-red-600 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                Tap to Resume
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  document.documentElement.classList.remove("shield-active");
                  document.body.classList.remove("shield-active");
                  setScreenCaptureShieldActive(false);
                  setShowCoachLoginModal(true);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-black font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg transition-transform active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Key size={14} />
                Coach Login / Verify
              </button>
            </div>
          </div>
        )}

        {/* Security Warning Toast */}
        {screenshotAttemptNotice && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100000] bg-red-600 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-2xl flex items-center gap-2.5 border border-red-400 animate-pulse pointer-events-none">
            <ShieldAlert size={18} className="shrink-0" />
            <span>{screenshotAttemptNotice}</span>
          </div>
        )}

        {/* Dynamic Forensic Watermark with Player Google Account */}
        <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden opacity-[0.06] select-none flex flex-wrap content-around justify-around p-4 rotate-[-12deg] scale-125">
          {Array.from({ length: 36 }).map((_, i) => (
            <div
              key={i}
              className="text-slate-900 dark:text-white font-black text-[10px] uppercase tracking-widest p-6 whitespace-nowrap"
            >
              CONFIDENTIAL • {user?.email || "PLAYER VIEW"} • {effectiveTeamName.toUpperCase()} • VIEW-ONLY ON DEVICE
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderPlayerAccessModal = () => {
    return (
      <PlayerAccessLogModal
        isOpen={showPlayerAccessModal}
        onClose={() => setShowPlayerAccessModal(false)}
        teamId={activeTeam}
        teamName={effectiveTeamName}
        playerCode={appData.playerCode}
        publicPath={publicPath}
        db={db}
      />
    );
  };

  const renderInstallModal = () => {
    if (!showInstallModal) return null;
    const ua = typeof window !== "undefined" ? window.navigator.userAgent.toLowerCase() : "";
    const isAndroidDevice = /android/.test(ua);
    const activeTab =
      installModalTab === "auto"
        ? isIOS
          ? "ios"
          : isAndroidDevice
            ? "android"
            : "desktop"
        : installModalTab;

    return (
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[99999] font-sans"
        onClick={() => setShowInstallModal(false)}
      >
        <div
          className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-400" />

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-2xl bg-blue-600/30 border border-blue-500/40 p-2 flex items-center justify-center shadow-inner">
                <img
                  src={APP_LOGO_SRC}
                  alt="Logo"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallback) {
                      target.dataset.fallback = "true";
                      target.src = FALLBACK_LOGO_SRC;
                    } else {
                      target.style.display = "none";
                    }
                  }}
                />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
                  Download & Install App
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {isAppInstalled
                    ? "App is already installed on your device"
                    : "Save Lancer Volleyball to your home screen or desktop"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowInstallModal(false)}
              className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Direct 1-Click Install if prompt available */}
          {deferredPrompt && (
            <div className="mb-5 bg-gradient-to-r from-indigo-900/60 to-blue-900/60 border border-indigo-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={16} className="text-amber-400" /> 1-Click Install Available
                </div>
                <div className="text-xs text-slate-300">
                  Click below to install directly onto your device
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === "accepted") {
                      setIsAppInstalled(true);
                      setDeferredPrompt(null);
                      setShowInstallModal(false);
                    }
                  } catch (e) {}
                }}
                className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Download size={16} /> Install Now
              </button>
            </div>
          )}

          {/* Home Screen Shortcut & App Icon Preview */}
          <div className="bg-gradient-to-r from-slate-800/90 to-[#001b5e]/40 border border-blue-500/30 rounded-2xl p-4 mb-4 flex items-center gap-4 shadow-lg">
            <div className="relative shrink-0">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-[1.25rem] bg-[#001b5e] border-2 border-white/30 p-2.5 flex items-center justify-center shadow-xl overflow-hidden ring-2 ring-blue-500/40">
                <img
                  src={APP_LOGO_SRC}
                  alt="UCC Lancers App Icon"
                  className="h-full w-full object-contain filter drop-shadow-md"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallback) {
                      target.dataset.fallback = "true";
                      target.src = FALLBACK_LOGO_SRC;
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-white text-base tracking-wide">UCC Lancers</span>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                  Home Screen Icon
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                This official logo will appear as your shortcut on Apple (iOS) and Android home screens.
              </p>
              <div className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle2 size={12} className="shrink-0" />
                <span>Offline support, fast launch, and full-screen layout</span>
              </div>
            </div>
          </div>

          {/* Platform Selector Tabs */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl mb-4 border border-slate-700/60">
            <button
              onClick={() => setInstallModalTab("ios")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "ios"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Smartphone size={14} /> Apple (iPhone / iPad)
            </button>
            <button
              onClick={() => setInstallModalTab("android")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "android"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Smartphone size={14} /> Android
            </button>
            <button
              onClick={() => setInstallModalTab("desktop")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "desktop"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Laptop size={14} /> PC / Mac
            </button>
          </div>

          {/* Tab Instructions Content */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 sm:p-5 mb-5 space-y-3">
            {activeTab === "ios" && (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div>
                    <span className="font-bold text-white">Open in Apple Safari</span>
                    <p className="text-xs text-slate-400">
                      Open this web app in Apple Safari on your iPhone or iPad.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div>
                    <span className="font-bold text-white">Tap the Share button</span>
                    <p className="text-xs text-slate-400">
                      Tap the <span className="inline-flex items-center text-blue-400 font-bold"><Share2 size={12} className="mx-1 inline" /> Share</span> icon at the bottom of Safari (or top right on iPad).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <div>
                    <span className="font-bold text-white">Select "Add to Home Screen"</span>
                    <p className="text-xs text-slate-400">
                      Scroll down the share sheet and tap <span className="inline-flex items-center text-white font-bold"><PlusCircle size={12} className="mx-1 inline text-blue-400" /> Add to Home Screen</span>.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">
                    4
                  </div>
                  <div>
                    <span className="font-bold text-white">Tap "Add"</span>
                    <p className="text-xs text-slate-400">
                      Confirm by tapping <strong>Add</strong> in the top-right corner. The UCC Lancers app shortcut with the official logo will appear right on your home screen!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "android" && (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div>
                    <span className="font-bold text-white">Open in Google Chrome</span>
                    <p className="text-xs text-slate-400">
                      Open this app in Google Chrome on your Android phone or tablet.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div>
                    <span className="font-bold text-white">Tap the 3 Dots Menu (⋮)</span>
                    <p className="text-xs text-slate-400">
                      Tap the 3 dots in the top-right corner of Google Chrome.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <div>
                    <span className="font-bold text-white">Tap "Install app" or "Add to Home screen"</span>
                    <p className="text-xs text-slate-400">
                      Tap <strong>Install app</strong> (or <em>Add to Home screen</em>), then tap <strong>Install</strong> to add the UCC Lancers app directly to your device with the official logo!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "desktop" && (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div>
                    <span className="font-bold text-white">Look for the Install Icon</span>
                    <p className="text-xs text-slate-400">
                      In Chrome, Edge, or Brave, look for the <Download size={12} className="inline mx-1 text-indigo-400" /> icon on the right side of the address/URL bar.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div>
                    <span className="font-bold text-white">Click "Install Lancer Volleyball"</span>
                    <p className="text-xs text-slate-400">
                      Click Install to run the tracker as a native standalone app with full screen capability and offline support!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer info & Done button */}
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <CheckCircle2 size={13} className="text-green-400" />
              <span>Full offline support & instant loading</span>
            </div>
            <button
              onClick={() => setShowInstallModal(false)}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderOpponentReportModal = () => {
    if (!showOpponentReportModal) return null;
    return (
      <OpponentReportModal
        isOpen={showOpponentReportModal}
        onClose={() => setShowOpponentReportModal(false)}
        initialOpponent={reportOpponentName || opponentName || ""}
        initialOpponentName={reportOpponentName || opponentName || ""}
        matches={appData.matches}
        sets={appData.sets}
        stats={appData.stats}
        opponents={appData.opponents || oppNotesMem || {}}
        oppNotesMem={oppNotesMem}
        effectiveTeamName={effectiveTeamName}
        ourTeamName={effectiveTeamName}
        onSaveOpponentNote={async (oppName, playerId, note) => {
          setOppNotesMem((prev) => ({
            ...prev,
            [oppName]: { ...(prev[oppName] || {}), [playerId]: note },
          }));
          if (isFirebaseAvailable && user && activeTeam) {
            try {
              await setDoc(
                doc(db, `${publicPath}/${activeTeam}/opponent_notes/${oppName}`),
                { [playerId]: note, updatedAt: new Date().toISOString() },
                { merge: true },
              );
            } catch (err) {
              console.error("Failed to save opp note:", err);
            }
          }
        }}
        onSaveOppNotes={async (oppName, notes) => {
          setOppNotesMem((prev) => ({ ...prev, [oppName]: notes }));
          if (isFirebaseAvailable && user && activeTeam) {
            try {
              await setDoc(
                doc(db, `${publicPath}/${activeTeam}/opponent_notes/${oppName}`),
                { notes, updatedAt: new Date().toISOString() },
                { merge: true },
              );
            } catch (err) {
              console.error("Failed to save opp notes:", err);
            }
          }
        }}
      />
    );
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans p-6 text-center">
        <div className="flex flex-col items-center max-w-sm">
          {!authTimeoutReached ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
              <p className="text-white font-bold tracking-widest uppercase opacity-50">
                Authenticating...
              </p>
            </>
          ) : (
            <div className="bg-slate-800 p-8 rounded-3xl border border-white/10 shadow-2xl animate-in fade-in zoom-in duration-500">
              <Shield className="text-amber-400 mb-4 mx-auto" size={48} />
              <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight">
                Syncing taking a while?
              </h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                We're having trouble connecting to the cloud. You can continue
                in offline mode, but changes might not sync until you reconnect.
              </p>
              <button
                onClick={() => setLoadingAuth(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
              >
                Continue Anyway
              </button>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 text-slate-500 hover:text-white text-xs uppercase tracking-widest font-bold underline transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "team_select") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans p-4 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center"></div>

        <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
          <button
            onClick={handleInstallApp}
            className="text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 p-3 rounded-full transition-colors flex items-center shadow-sm"
            title="Download App"
          >
            <Download size={20} className="sm:mr-2" />
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">
              Download App
            </span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 p-3 rounded-full transition-colors flex items-center shadow-sm"
            title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
          >
            {isFullscreen ? <Minimize size={20} className="sm:mr-2" /> : <Maximize size={20} className="sm:mr-2" />}
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">
              {isFullscreen ? "Exit Full" : "Full Screen"}
            </span>
          </button>
        </div>

        <div className="w-full max-w-3xl relative z-10 flex flex-col items-center">
          <div className="mb-8 relative flex items-center justify-center h-24 w-24 sm:h-36 sm:w-36 group">
            <img
              src={APP_LOGO_SRC}
              alt="UCC Lancers Logo"
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)]"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.fallback) {
                  target.dataset.fallback = "true";
                  target.src = FALLBACK_LOGO_SRC;
                } else {
                  target.style.display = "none";
                }
              }}
            />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-widest text-white uppercase drop-shadow-md text-center mb-2">
            UCC Lancers
          </h1>
          <h2 className="text-sm sm:text-lg font-bold text-slate-400 tracking-widest uppercase text-center mb-10">
            {user ? "Your Teams" : "Sign In to Access Teams"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full px-4 mb-6">
            {user &&
              myTeams.map((team) => (
                <div key={team.id} className="relative group">
                  <button
                    onClick={() => {
                      enforceFullscreen();
                      setActiveTeam(team.id);
                      localStorage.setItem("ucc_vball_active_team", team.id);
                      setView("menu");
                    }}
                    className={`w-full bg-gradient-to-br ${team.color} text-white p-8 rounded-3xl font-black text-2xl tracking-widest shadow-xl border border-white/20 transition-all active:scale-95 flex flex-col items-center justify-center`}
                  >
                    <Users
                      className="mb-3 opacity-50 group-hover:scale-110 transition-transform"
                      size={32}
                    />
                    {team.name}
                    <span className="text-[10px] opacity-60 mt-2 tracking-widest font-bold uppercase font-sans">
                      {team.role}
                    </span>
                  </button>
                  <div className="absolute top-4 right-4 flex items-center gap-1 transition-all group-hover:opacity-100 sm:opacity-0">
                    {team.role === "coach" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenameTeam(team.id, team.name);
                        }}
                        className="p-2 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-all"
                        title="Rename Team"
                      >
                        <Edit3 size={16} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTeam(team.id);
                      }}
                      className="p-2 text-white/40 hover:text-red-400 bg-black/20 hover:bg-black/40 rounded-full transition-all"
                      title="Delete/Leave Team"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            {user && myTeams.length === 0 && (
              <div className="col-span-1 sm:col-span-2 text-center text-slate-500 py-8">
                You aren't in any teams yet. Create or join one below.
              </div>
            )}
          </div>

          <div className="w-full px-4 flex flex-col items-center mb-8 gap-4">
            {!user ? (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={async () => {
                    const provider = new GoogleAuthProvider();
                    try {
                      await signInWithPopup(auth, provider);
                    } catch (err) {
                      console.error(err);
                      if (err.code === "auth/popup-blocked") {
                        alert(
                          "Your browser blocked the sign-in popup. Please allow popups for this site, or open it in a new tab.",
                        );
                      } else {
                        alert(`Sign-in error: ${err.message}`);
                      }
                    }
                  }}
                  className="bg-white text-slate-800 px-6 py-3 rounded-full font-bold flex items-center shadow-lg hover:bg-slate-100 transition-colors"
                >
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="G"
                    className="w-5 h-5 mr-3"
                  />
                  Sign in with Google to Sync
                </button>
                <p className="text-slate-400 text-xs max-w-sm text-center mt-2">
                  If the popup doesn't open, ensure your browser doesn't block
                  popups or Try opening the app in a new tab.
                </p>
              </div>
            ) : (
              <>
                <div className="flex gap-4 w-full justify-center">
                  <button
                    onClick={handleCreateTeam}
                    className="bg-indigo-600/50 hover:bg-indigo-500/50 border border-indigo-400/30 text-white px-6 py-3 rounded-full font-bold transition-colors w-1/2"
                  >
                    + Create Team
                  </button>
                  <button
                    onClick={handleJoinTeam}
                    className="bg-emerald-600/50 hover:bg-emerald-500/50 border border-emerald-400/30 text-white px-6 py-3 rounded-full font-bold transition-colors w-1/2"
                  >
                    Join Team (Code)
                  </button>
                </div>
                <div className="flex flex-col items-center text-slate-400 mt-4">
                  <span className="mb-2">Logged in as {user.email}</span>
                  <button
                    onClick={() => signOut(auth)}
                    className="text-sm underline hover:text-slate-200"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {renderPlayerSecurity()}
        {renderInstallModal()}
      </div>
    );
  }

  if (view === "menu") {
    const rawTeam = myTeams.find((t) => t.id === activeTeam);
    const teamInfo = {
      name: rawTeam?.name || effectiveTeamName || "Team Data",
      color: rawTeam?.color || "from-slate-600 to-slate-800",
      role: effectiveRole,
    };
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans p-4 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center"></div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] sm:rounded-[3rem] shadow-2xl p-6 sm:p-12 max-w-3xl w-full relative z-10 flex flex-col items-center">
          <div className="absolute top-6 left-6 flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 p-3 rounded-full transition-colors flex items-center shadow-sm"
              title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
            >
              {isFullscreen ? <Minimize size={20} className="sm:mr-2" /> : <Maximize size={20} className="sm:mr-2" />}
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">
                {isFullscreen ? "Exit Full" : "Full Screen"}
              </span>
            </button>
            <button
              onClick={handleInstallApp}
              className="text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 p-3 rounded-full transition-colors flex items-center shadow-sm"
              title="Download App"
            >
              <Download size={20} className="sm:mr-2" />
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">
                Download App
              </span>
            </button>
          </div>

          <button
            onClick={() => {
              setActiveTeam(null);
              localStorage.removeItem("ucc_vball_active_team");
              setView("team_select");
            }}
            className="absolute top-6 right-6 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 p-3 rounded-full transition-colors flex items-center shadow-sm"
          >
            <LogOut size={20} className="sm:mr-2" />
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">
              Switch Team
            </span>
          </button>

          <div className="text-center mb-8 sm:mb-12 flex flex-col items-center mt-6 sm:mt-0">
            <div className="mb-4 sm:mb-6 relative flex items-center justify-center h-24 w-24 sm:h-36 sm:w-36 group">
              <img
                src={APP_LOGO_SRC}
                alt="UCC Lancers Logo"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)]"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.fallback) {
                    target.dataset.fallback = "true";
                    target.src = FALLBACK_LOGO_SRC;
                  } else {
                    target.style.display = "none";
                  }
                }}
              />
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-widest text-white uppercase drop-shadow-md text-center">
              UCC Lancers
            </h1>
            <div
              className={`mt-3 inline-block px-4 py-1.5 rounded-full border border-white/30 bg-gradient-to-r ${teamInfo.color}`}
            >
              <h2 className="text-xs sm:text-sm font-black text-white tracking-[0.2em] sm:tracking-[0.3em] uppercase text-center">
                {teamInfo.name} Database
              </h2>
            </div>
            {activeTeam && (
              <div className="mt-4 flex flex-col gap-2 w-full max-w-sm mx-auto">
                <div className="text-slate-400 text-xs sm:text-sm bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={14} />
                    <span>
                      Player Code:{" "}
                      <strong className="text-white tracking-widest select-all">
                        {appData.playerCode || activeTeam}
                      </strong>
                    </span>
                  </div>
                  {(appData.playerCode || activeTeam) && (
                    <button
                      onClick={() =>
                        handleShareCode(
                          appData.playerCode || activeTeam,
                          "Player",
                        )
                      }
                      className="text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest text-[10px] ml-2"
                    >
                      Share
                    </button>
                  )}
                </div>
                {teamInfo.role === "coach" && appData.coachCode && (
                  <div className="text-slate-400 text-xs sm:text-sm bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield size={14} />
                      <span>
                        Coach Code:{" "}
                        <strong className="text-amber-400 tracking-widest select-all">
                          {appData.coachCode}
                        </strong>
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        handleShareCode(appData.coachCode, "Coach")
                      }
                      className="text-amber-400 hover:text-amber-300 font-bold uppercase tracking-widest text-[10px] ml-2"
                    >
                      Share
                    </button>
                  </div>
                )}
                {teamInfo.role === "coach" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowPlayerAccessModal(true)}
                      className="w-full mt-1 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 rounded-full text-emerald-300 font-bold text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer shadow-sm group"
                    >
                      <div className="flex items-center gap-2">
                        <Eye size={15} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span>Player Stats Access Audit</span>
                      </div>
                      <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-2.5 py-0.5 rounded-full font-black">
                        Google Accounts
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={togglePlayerAccess}
                      className={`w-full mt-1.5 px-4 py-2.5 ${
                        isPlayerAccessAllowed
                          ? "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/40 text-emerald-300"
                          : "bg-red-500/20 hover:bg-red-500/30 border-red-400/40 text-red-300"
                      } border rounded-full font-bold text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer shadow-sm group`}
                    >
                      <div className="flex items-center gap-2">
                        {isPlayerAccessAllowed ? (
                          <Unlock size={15} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                        ) : (
                          <Lock size={15} className="text-red-400 group-hover:scale-110 transition-transform" />
                        )}
                        <span>Available to Players</span>
                      </div>
                      <span className={`text-[10px] ${isPlayerAccessAllowed ? "bg-emerald-500/30 text-emerald-200" : "bg-red-500/30 text-red-200"} px-2.5 py-0.5 rounded-full font-black`}>
                        {isPlayerAccessAllowed ? "ACCESS ON" : "ACCESS OFF"}
                      </span>
                    </button>
                  </>
                )}
                {isPlayerRole && (
                  <button
                    type="button"
                    onClick={() => setShowCoachLoginModal(true)}
                    className="w-full mt-2 px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 rounded-full text-amber-300 font-bold text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer shadow-sm group"
                  >
                    <div className="flex items-center gap-2">
                      <Shield size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>Coach Login / Enter Code</span>
                    </div>
                    <span className="text-[10px] bg-amber-500/30 text-amber-200 px-2.5 py-0.5 rounded-full font-black">
                      Coach Access
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full mb-6 sm:mb-10">
            {teamInfo.role !== "player" && (
              <>
                <button
                  onClick={() => startSetup("League")}
                  className="bg-gradient-to-b from-[#0044cc] to-[#002b80] text-white p-6 sm:p-8 rounded-2xl sm:rounded-3xl font-black text-lg sm:text-xl tracking-wider hover:from-[#0055ff] hover:to-[#003399] transition-all duration-200 active:scale-95 flex flex-col items-center justify-center shadow-[0_10px_20px_rgba(0,0,0,0.3)] border border-blue-400/30"
                >
                  <Play className="mb-2 sm:mb-3" size={32} />
                  <span>LEAGUE MATCH</span>
                </button>
                <button
                  onClick={() => startSetup("Tournament")}
                  className="bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950 p-6 sm:p-8 rounded-2xl sm:rounded-3xl font-black text-lg sm:text-xl tracking-wider hover:from-amber-300 hover:to-amber-500 transition-all duration-200 active:scale-95 flex flex-col items-center justify-center shadow-[0_10px_20px_rgba(0,0,0,0.3)] border border-amber-200/50"
                >
                  <Trophy className="mb-2 sm:mb-3" size={32} />
                  <span>TOURNAMENT</span>
                </button>
                <button
                  onClick={() => startSetup("Scrimmage")}
                  className="md:col-span-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl font-bold text-sm sm:text-lg tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center"
                >
                  <Users className="mr-3 text-blue-300" size={20} /> SCRIMMAGE /
                  CUSTOM
                </button>
                <button
                  onClick={() => startSetup("Practice")}
                  className="md:col-span-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 p-4 sm:p-6 rounded-2xl sm:rounded-3xl font-bold text-sm sm:text-lg tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center"
                >
                  <Activity className="mr-3 text-slate-500" size={20} />{" "}
                  PRACTICE MODE
                </button>
                {appData.matches.filter((m) => m.isLive === true).length >
                  0 && (
                  <button
                    onClick={joinLiveMatch}
                    className="md:col-span-2 bg-gradient-to-b from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 border border-green-400 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl font-black text-sm sm:text-xl tracking-widest transition-all duration-200 active:scale-95 flex items-center justify-center uppercase shadow-lg"
                  >
                    <Activity
                      className="mr-2 sm:mr-3 text-green-100"
                      size={20}
                    />{" "}
                    Join Live Match
                  </button>
                )}
              </>
            )}
          </div>

          <div className="w-full flex flex-col gap-4 sm:gap-6">
            {teamInfo.role !== "player" && (
              <button
                onClick={() => setIsRosterModalOpen(true)}
                className="w-full bg-white text-slate-700 p-4 sm:p-6 rounded-2xl sm:rounded-3xl font-black text-lg sm:text-xl tracking-widest hover:bg-slate-100 transition-all duration-200 active:scale-95 flex items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.4)]"
              >
                <Users className="mr-2 sm:mr-3 text-slate-500" size={24} /> EDIT
                ROSTER
              </button>
            )}
            <button
              onClick={viewStatsFromMenu}
              className="w-full bg-white text-[#001b5e] p-4 sm:p-6 rounded-2xl sm:rounded-3xl font-black text-lg sm:text-xl tracking-widest hover:bg-slate-100 transition-all duration-200 active:scale-95 flex items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.4)]"
            >
              <Activity className="mr-2 sm:mr-3 text-[#0033A0]" size={24} />{" "}
              VIEW STATS
            </button>
            <button
              onClick={() => {
                setReportOpponentName("");
                setShowOpponentReportModal(true);
              }}
              className="w-full bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl font-black text-lg sm:text-xl tracking-widest hover:from-blue-800 hover:to-indigo-900 transition-all duration-200 active:scale-95 flex items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.4)] border border-blue-400/30"
            >
              <Shield className="mr-2 sm:mr-3 text-blue-400" size={24} />{" "}
              VIEW OPPONENTS
            </button>
          </div>
        </div>

        {/* ROSTER MODAL FROM MENU */}
        {isRosterModalOpen && (
          <div className="fixed inset-0 bg-slate-900/90 z-50 flex flex-col items-center justify-center p-2 sm:p-4 backdrop-blur-md">
            <div className="bg-white rounded-2xl sm:rounded-[2rem] w-full max-w-xl h-[90vh] sm:h-[85vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="bg-slate-800 p-4 sm:p-6 text-white flex justify-between items-center">
                <h3 className="font-black text-lg sm:text-xl tracking-widest uppercase flex items-center">
                  <Users className="mr-2 sm:mr-3 text-slate-400" size={20} />{" "}
                  Manage Roster
                </h3>
                <button
                  onClick={() => setIsRosterModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors bg-slate-700 p-2 rounded-full"
                >
                  <XCircle size={20} className="sm:w-6 sm:h-6" />
                </button>
              </div>

              <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 space-y-3 sm:space-y-4">
                <div className="flex items-center space-x-2 sm:space-x-3 bg-white p-1 sm:p-2 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                  <FolderOpen
                    size={16}
                    className="text-slate-400 ml-2 sm:w-5 sm:h-5"
                  />
                  <select
                    onChange={(e) => loadRosterPreset(e.target.value)}
                    className="flex-1 bg-transparent border-none text-slate-700 font-bold focus:ring-0 outline-none text-xs sm:text-base"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Load Saved Roster...
                    </option>
                    {Object.keys(appData.savedRosters || {}).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3 bg-white p-1 sm:p-2 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                  <Save
                    size={16}
                    className="text-[#0033A0] ml-2 sm:w-5 sm:h-5"
                  />
                  <input
                    placeholder="Preset Name..."
                    value={rosterPresetName}
                    onChange={(e) => setRosterPresetName(e.target.value)}
                    className="flex-1 bg-transparent border-none font-bold focus:ring-0 outline-none text-slate-700 placeholder-slate-400 text-xs sm:text-base min-w-[50px] w-12"
                  />
                  <div className="flex space-x-1 pr-1">
                    <button
                      onClick={() => saveRosterAsPreset()}
                      className="bg-[#0033A0] text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-sm text-[10px] sm:text-xs tracking-wider"
                    >
                      SAVE
                    </button>
                    <button
                      onClick={() => {
                        const newName = prompt("Save Roster As:");
                        if (newName) saveRosterAsPreset(newName);
                      }}
                      className="bg-slate-200 text-slate-800 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold hover:bg-slate-300 transition-colors shadow-sm text-[10px] sm:text-xs tracking-wider whitespace-nowrap"
                    >
                      SAVE AS
                    </button>
                  </div>
                </div>

                {myTeams.length > 1 && (
                  <div className="flex items-center space-x-2 sm:space-x-3 bg-white p-1 sm:p-2 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                    <Download
                      size={16}
                      className="text-slate-400 ml-2 sm:w-5 sm:h-5"
                    />
                    <select
                      onChange={(e) => {
                        importRosterFromTeam(e.target.value);
                        e.target.value = "";
                      }}
                      className="flex-1 bg-transparent border-none text-slate-700 font-bold focus:ring-0 outline-none text-xs sm:text-base"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Import Roster from Team...
                      </option>
                      {myTeams
                        .filter((t) => t.id !== activeTeam)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200">
                  <div className="flex gap-2">
                    <input
                      placeholder="#"
                      className="w-12 sm:w-16 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-slate-200 outline-none font-black text-center text-[#0033A0] text-sm sm:text-base"
                      value={newPlayerNum}
                      onChange={(e) => setNewPlayerNum(e.target.value)}
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </div>
                  <div className="flex flex-1 gap-2">
                    <input
                      placeholder="Player Name"
                      className="flex-1 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-slate-200 outline-none font-bold text-slate-700 text-sm sm:text-base"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                    />
                    <button
                      onClick={addPlayer}
                      className="bg-green-500 text-white px-3 sm:px-4 rounded-lg sm:rounded-xl font-black hover:bg-green-600 transition-colors shadow-sm flex items-center justify-center min-w-[3rem]"
                    >
                      <PlusCircle size={18} className="sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 bg-slate-100 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Team Players
                  </span>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRetired}
                      onChange={(e) => setShowRetired(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    Show Retired
                  </label>
                </div>
                {appData.roster
                  .filter((p) => showRetired || !p.isRetired)
                  .map((p) => (
                    <div
                      key={p.id}
                      className={`flex justify-between items-center bg-white p-2 sm:p-3 rounded-lg sm:rounded-xl shadow-sm border ${p.isRetired ? "border-amber-200 opacity-60" : "border-slate-200"}`}
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="#"
                          value={p.number ?? ""}
                          onChange={(e) =>
                            updatePlayer(p.id, { number: e.target.value })
                          }
                          title="Jersey Number (optional)"
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-50 flex items-center justify-center font-black text-[#0033A0] text-xs sm:text-base border border-blue-100 text-center outline-none focus:ring-2 focus:ring-[#0033A0] p-0 shrink-0"
                        />
                        <div className="flex items-center min-w-0 flex-1 gap-2">
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) =>
                              updatePlayer(p.id, { name: e.target.value })
                            }
                            placeholder="Player Name"
                            className="font-bold text-slate-800 text-sm sm:text-base bg-slate-50/60 hover:bg-slate-100 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-[#0033A0] rounded-lg px-2.5 py-1.5 outline-none transition-all flex-1 min-w-0"
                            title="Click to edit player name"
                          />
                          {p.isRetired && (
                            <span className="text-[10px] sm:text-xs font-black uppercase text-amber-700 bg-amber-100/80 px-2 py-1 rounded-md shrink-0 border border-amber-300">
                              Retired
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <button
                          onClick={() =>
                            updatePlayer(p.id, { isRetired: !p.isRetired })
                          }
                          className={`text-[10px] sm:text-xs ml-2 px-2 py-1 rounded font-bold uppercase tracking-widest ${p.isRetired ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-slate-200 text-slate-500 hover:bg-slate-300"}`}
                        >
                          {p.isRetired ? "Unretire" : "Retire"}
                        </button>
                        <button
                          onClick={() => removePlayer(p.id)}
                          className="text-red-400 hover:text-red-600 transition-colors p-2"
                          title="Delete permanently"
                        >
                          <XCircle size={18} className="sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* JOIN LIVE MATCH STATS MODAL */}
        {isJoinLiveModalOpen && (
          <div className="fixed inset-0 bg-slate-900/90 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-2xl sm:rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 sm:p-6 text-white flex justify-between items-center">
                <h3 className="font-black text-lg sm:text-xl tracking-widest uppercase flex items-center">
                  <Database className="mr-2" size={20} /> Stat Tracking
                </h3>
                <button
                  onClick={() => setIsJoinLiveModalOpen(false)}
                  className="text-green-100 hover:text-white transition-colors bg-green-700/50 p-2 rounded-full"
                >
                  <XCircle size={20} />
                </button>
              </div>
              <div className="p-6 bg-slate-50 flex flex-col space-y-4">
                <p className="text-sm font-bold text-slate-600">
                  Select which statistics you want to track on your device
                  before joining the live match.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(trackedCategories).map((cat) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm"
                    >
                      <label className="text-xs font-bold text-slate-700 tracking-wider">
                        {cat}
                      </label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={trackedCategories[cat]}
                          onChange={(e) =>
                            setTrackedCategories((prev) => ({
                              ...prev,
                              [cat]: e.target.checked,
                            }))
                          }
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>
                  ))}
                </div>
                <button
                  onClick={confirmJoinLiveMatch}
                  className="w-full bg-green-500 text-white p-4 rounded-xl font-black text-lg tracking-widest hover:bg-green-600 transition-all uppercase shadow-lg mt-4"
                >
                  Join Match
                </button>
              </div>
            </div>
          </div>
        )}
        {renderOpponentReportModal()}
        {renderPlayerAccessModal()}
        {renderPlayerSecurity()}
        {renderInstallModal()}
      </div>
    );
  }

  if (view === "setup") {
    const tourneys = [
      ...new Set(
        appData.matches
          .filter((m) => m.type === "Tournament" && m.title)
          .map((m) => m.title),
      ),
    ];
    const oppNames = Object.keys(appData.opponents).filter(
      (n) => n.toLowerCase() !== "practice",
    );

    return (
      <div className="min-h-screen bg-slate-50 p-2 sm:p-6 md:p-10 font-sans flex flex-col items-center justify-start sm:justify-center">
        <div className="w-full max-w-4xl bg-white rounded-2xl sm:rounded-[2rem] shadow-xl sm:shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
          <div className="bg-gradient-to-r from-[#001b5e] via-[#0033A0] to-[#001b5e] p-4 sm:p-6 text-white flex justify-between items-center shadow-md z-10 relative">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="flex items-center justify-center h-10 w-10 sm:h-16 sm:w-16 overflow-hidden relative shrink-0">
                <img
                  src={APP_LOGO_SRC}
                  alt="UCC Lancers Logo"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain absolute inset-0 z-10"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallback) {
                      target.dataset.fallback = "true";
                      target.src = FALLBACK_LOGO_SRC;
                    } else {
                      target.style.display = "none";
                    }
                  }}
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-widest uppercase text-white drop-shadow-md">
                  {matchType} SETUP
                </h1>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleInstallApp}
                className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-3 py-2 rounded-xl font-bold flex items-center transition-all active:scale-95 text-xs sm:text-sm"
                title="Download App"
              >
                <Download className="mr-1.5 sm:mr-2" size={16} />
                <span className="hidden sm:inline">DOWNLOAD APP</span>
              </button>
              <button
                onClick={toggleFullscreen}
                className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-3 py-2 rounded-xl font-bold flex items-center transition-all active:scale-95 text-xs sm:text-sm"
                title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
              >
                {isFullscreen ? <Minimize className="mr-1.5 sm:mr-2" size={16} /> : <Maximize className="mr-1.5 sm:mr-2" size={16} />}
                <span className="hidden sm:inline">{isFullscreen ? "EXIT FULL" : "FULL SCREEN"}</span>
              </button>
              <button
                onClick={() => setIsRosterModalOpen(true)}
                className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-3 py-2 rounded-xl font-bold flex items-center transition-all active:scale-95 text-xs sm:text-sm"
              >
                <Users className="mr-1.5 sm:mr-2" size={16} /> ROSTER
              </button>
              <button
                onClick={() => setView("menu")}
                className="bg-white text-[#0033A0] p-2 sm:px-4 sm:py-2 rounded-xl font-black hover:bg-slate-100 shadow-sm transition-all active:scale-95 text-xs sm:text-sm"
              >
                <Home size={18} className="sm:hidden" />
                <span className="hidden sm:inline">MENU</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-500 text-white p-3 font-bold flex items-center justify-between shadow-inner">
              <p className="flex items-center text-xs sm:text-sm">
                <XCircle className="mr-2" size={16} /> {errorMsg}
              </p>
              <button
                onClick={() => setErrorMsg("")}
                className="hover:bg-red-600 p-1 rounded-full"
              >
                <XCircle size={16} />
              </button>
            </div>
          )}

          <div className="flex flex-col p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
            <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200">
              <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-widest uppercase mb-3 sm:mb-4 flex items-center">
                <Activity className="mr-2 text-[#0033A0]" size={18} /> Match
                Config
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 flex items-center justify-between">
                    <span>Your Team Name</span>
                    <button
                      type="button"
                      onClick={() =>
                        setTeamNameModalConfig({
                          isOpen: true,
                          ourTeamName: effectiveTeamName,
                          opponentTeamName,
                          showOpponentEdit: false,
                        })
                      }
                      className="text-[#0033A0] hover:underline cursor-pointer text-[9px] font-bold"
                    >
                      Adjust Name
                    </button>
                  </label>
                  <div className="flex items-center bg-white rounded-xl sm:rounded-2xl border border-slate-200 px-3 sm:px-4 py-3 shadow-2xs">
                    <Shield className="text-[#0033A0] mr-2 flex-shrink-0" size={18} />
                    <span className="font-black text-base sm:text-lg text-slate-800 flex-1 truncate">
                      {effectiveTeamName}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setTeamNameModalConfig({
                          isOpen: true,
                          ourTeamName: effectiveTeamName,
                          opponentTeamName,
                          showOpponentEdit: false,
                        })
                      }
                      className="p-1.5 text-slate-400 hover:text-[#0033A0] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Adjust your team name"
                    >
                      <Edit3 size={15} />
                    </button>
                  </div>
                </div>

                {matchType === "Tournament" && (
                  <div className="sm:col-span-2">
                    <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1">
                      Tournament Title
                    </label>
                    <input
                      list="tourney-list"
                      className="w-full p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200 font-bold text-base sm:text-lg text-[#0033A0] focus:ring-2 focus:ring-[#0033A0] outline-none"
                      value={tourneyTitle}
                      onChange={(e) => setTourneyTitle(e.target.value)}
                      placeholder="e.g. OFSAA 2026"
                    />
                    <datalist id="tourney-list">
                      {tourneys.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between ml-2 mb-1">
                    <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Opponent Name
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setReportOpponentName(opponentName);
                        setShowOpponentReportModal(true);
                      }}
                      className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Shield size={12} />
                      <span>View Opponents</span>
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {oppNames.length > 0 && (
                      <select
                        className="w-full sm:w-1/2 p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200 font-bold text-base sm:text-lg text-[#0033A0] focus:ring-2 focus:ring-[#0033A0] outline-none cursor-pointer"
                        value={
                          Object.keys(appData.opponents).find(
                            (o) =>
                              o.toLowerCase() === opponentName.toLowerCase(),
                          ) || ""
                        }
                        onChange={(e) => handleOpponentNameChange(e)}
                      >
                        <option value="">-- Select Previous --</option>
                        {oppNames.map((o) => (
                          <option key={o} value={o}>
                            {appData.opponents[o]?.teamName || o}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      className={`p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200 font-bold text-base sm:text-lg text-[#0033A0] focus:ring-2 focus:ring-[#0033A0] outline-none ${oppNames.length > 0 ? "w-full sm:w-1/2" : "w-full"}`}
                      value={opponentName}
                      onChange={handleOpponentNameChange}
                      placeholder={
                        oppNames.length > 0 ? "Or type new..." : "Enter name..."
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1">
                    Format
                  </label>
                  <select
                    className="w-full p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200 font-bold text-base sm:text-lg text-slate-700 focus:ring-2 focus:ring-[#0033A0] outline-none cursor-pointer"
                    value={matchFormat}
                    onChange={(e) => setMatchFormat(e.target.value)}
                  >
                    <option>Best of 3</option>
                    <option>Best of 5</option>
                    <option>2 Sets</option>
                    <option>Single Set</option>
                    <option>Custom / Scrimmage</option>
                    {matchType === "Practice" && (
                      <option>Open Drill (Grid)</option>
                    )}
                  </select>
                </div>
                {matchType !== "Practice" && (
                  <div className="flex items-center justify-between bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200">
                    <label className="text-[10px] sm:text-[12px] font-black text-slate-700 uppercase tracking-widest ml-2">
                      Track Opp. Serve Receive
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={trackOppReceives}
                        onChange={(e) => setTrackOppReceives(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0033A0]"></div>
                    </label>
                  </div>
                )}
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1">
                    Score Cap
                  </label>
                  <input
                    type="number"
                    placeholder="No Cap"
                    className="w-full p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200 font-bold text-base sm:text-lg text-slate-700 focus:ring-2 focus:ring-[#0033A0] outline-none"
                    value={scoreCap}
                    onChange={(e) => setScoreCap(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1">
                    First Serve (Set 1)
                  </label>
                  <div className="flex gap-2 min-h-[46px] sm:min-h-[56px]">
                    <button
                      type="button"
                      onClick={() => setServing("ucc")}
                      className={`flex-1 rounded-xl sm:rounded-2xl font-black transition-all border text-[10px] sm:text-xs tracking-widest uppercase flex items-center justify-center gap-1.5 ${
                        serving === "ucc"
                          ? "bg-[#0033A0] text-white border-[#0033A0] shadow-md ring-2 ring-[#0033A0]/20"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase bg-amber-400/20 text-amber-950 px-1.5 py-0.5 rounded border border-amber-400/40">Serve</span>
                      <span>Lancers</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setServing("opp")}
                      className={`flex-1 rounded-xl sm:rounded-2xl font-black transition-all border text-[10px] sm:text-xs tracking-widest uppercase flex items-center justify-center gap-1.5 ${
                        serving === "opp"
                          ? "bg-slate-800 text-white border-slate-800 shadow-md ring-2 ring-slate-800/20"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase bg-amber-400/20 text-amber-950 px-1.5 py-0.5 rounded border border-amber-400/40">Serve</span>
                      <span className="truncate max-w-[110px]">{opponentName.trim() || "Opponent"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200">
              <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-widest uppercase mb-3 sm:mb-4 flex items-center">
                <Database className="mr-2 text-[#0033A0]" size={18} /> Stat
                Tracking Options
              </h2>
              <p className="text-xs text-slate-500 mb-4 font-medium">
                Select which statistics you want to track on your device during
                this match.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {Object.keys(trackedCategories).map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between bg-white p-2 sm:p-3 rounded-xl border border-slate-200 shadow-sm"
                  >
                    <label className="text-[10px] sm:text-xs font-bold text-slate-700 tracking-wider">
                      {cat}
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={trackedCategories[cat]}
                        onChange={(e) =>
                          setTrackedCategories((prev) => ({
                            ...prev,
                            [cat]: e.target.checked,
                          }))
                        }
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0033A0]"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-2">
                <label className="block font-black text-slate-800 uppercase tracking-widest text-sm sm:text-base">
                  UCC Lineup
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200 shadow-sm">
                    <select
                      onChange={(e) => loadLineupPreset(e.target.value)}
                      className="bg-transparent border-none text-slate-700 font-bold focus:ring-0 outline-none text-xs sm:text-sm pl-1"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Load Lineup...
                      </option>
                      {Object.keys(appData.savedLineups || {}).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200 shadow-sm">
                    <input
                      placeholder="Save As..."
                      value={lineupPresetName}
                      onChange={(e) => setLineupPresetName(e.target.value)}
                      className="w-24 bg-transparent border-none font-bold focus:ring-0 outline-none text-slate-700 placeholder-slate-400 text-xs sm:text-sm"
                    />
                    <button
                      onClick={saveLineupAsPreset}
                      className="bg-[#0033A0] text-white px-2 py-1 rounded md:rounded-lg font-bold hover:bg-blue-800 transition-colors text-[10px] sm:text-xs uppercase tracking-widest"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200">
                  <Shield
                    size={14}
                    className="text-[#0033A0] hidden sm:block"
                  />
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Libero:
                  </span>
                  <select
                    className="bg-transparent border-none font-black text-[#0033A0] focus:ring-0 outline-none cursor-pointer text-xs sm:text-sm"
                    value={liberoId}
                    onChange={(e) => setLiberoId(e.target.value)}
                  >
                    <option value="">None</option>
                    {sortedRoster
                      .filter((p) => showRetired || !p.isRetired)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.number ? `#${p.number} ` : ""}{p.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[4, 3, 2, 5, 6, 1].map((pos) => {
                  const arrIdx = pos - 1;
                  return (
                    <div
                      key={pos}
                      className="bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#0033A0] transition-all flex flex-col"
                    >
                      <div className="bg-slate-100 px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 flex justify-between items-center">
                        <span>Pos {pos}</span>
                        {pos === 1 && serving === "ucc" && (
                          <span className="text-xs sm:text-sm leading-none">
                            <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span>
                          </span>
                        )}
                      </div>
                      <select
                        className="p-2 sm:p-3 bg-transparent font-black text-slate-800 outline-none w-full appearance-none cursor-pointer text-center text-sm sm:text-base"
                        value={lineup[arrIdx] || ""}
                        onChange={(e) => {
                          const newLineup = [...lineup];
                          newLineup[arrIdx] = e.target.value;
                          setLineup(newLineup);
                        }}
                      >
                        <option value="">Select Player</option>
                        {sortedRoster
                          .filter(
                            (p) =>
                              (showRetired || !p.isRetired) &&
                              p.id !== liberoId,
                          )
                          .map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              disabled={
                                lineup.includes(p.id) && lineup[arrIdx] !== p.id
                              }
                            >
                              {p.number ? `#${p.number} ` : ""}{p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={startGame}
              className="w-full bg-gradient-to-b from-green-400 to-green-600 text-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] font-black text-xl sm:text-2xl hover:from-green-500 hover:to-green-700 transition-all flex justify-center items-center shadow-lg active:scale-95 tracking-widest mt-2 uppercase"
            >
              <Play className="mr-2 sm:mr-3" fill="currentColor" size={24} />{" "}
              Start Match
            </button>
          </div>
        </div>

        {/* ROSTER MODAL */}
        {isRosterModalOpen && (
          <div className="fixed inset-0 bg-slate-900/90 z-50 flex flex-col items-center justify-center p-2 sm:p-4 backdrop-blur-md">
            <div className="bg-white rounded-2xl sm:rounded-[2rem] w-full max-w-xl h-[90vh] sm:h-[85vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="bg-slate-800 p-4 sm:p-6 text-white flex justify-between items-center">
                <h3 className="font-black text-lg sm:text-xl tracking-widest uppercase flex items-center">
                  <Users className="mr-2 sm:mr-3 text-slate-400" size={20} />{" "}
                  Manage Roster
                </h3>
                <button
                  onClick={() => setIsRosterModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors bg-slate-700 p-2 rounded-full"
                >
                  <XCircle size={20} className="sm:w-6 sm:h-6" />
                </button>
              </div>

              <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 space-y-3 sm:space-y-4">
                <div className="flex items-center space-x-2 sm:space-x-3 bg-white p-1 sm:p-2 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                  <FolderOpen
                    size={16}
                    className="text-slate-400 ml-2 sm:w-5 sm:h-5"
                  />
                  <select
                    onChange={(e) => loadRosterPreset(e.target.value)}
                    className="flex-1 bg-transparent border-none text-slate-700 font-bold focus:ring-0 outline-none text-xs sm:text-base"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Load Saved Roster...
                    </option>
                    {Object.keys(appData.savedRosters || {}).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3 bg-white p-1 sm:p-2 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                  <Save
                    size={16}
                    className="text-[#0033A0] ml-2 sm:w-5 sm:h-5"
                  />
                  <input
                    placeholder="Preset Name..."
                    value={rosterPresetName}
                    onChange={(e) => setRosterPresetName(e.target.value)}
                    className="flex-1 bg-transparent border-none font-bold focus:ring-0 outline-none text-slate-700 placeholder-slate-400 text-xs sm:text-base min-w-[50px] w-12"
                  />
                  <div className="flex space-x-1 pr-1">
                    <button
                      onClick={() => saveRosterAsPreset()}
                      className="bg-[#0033A0] text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-sm text-[10px] sm:text-xs tracking-wider"
                    >
                      SAVE
                    </button>
                    <button
                      onClick={() => {
                        const newName = prompt("Save Roster As:");
                        if (newName) saveRosterAsPreset(newName);
                      }}
                      className="bg-slate-200 text-slate-800 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold hover:bg-slate-300 transition-colors shadow-sm text-[10px] sm:text-xs tracking-wider whitespace-nowrap"
                    >
                      SAVE AS
                    </button>
                  </div>
                </div>

                {myTeams.length > 1 && (
                  <div className="flex items-center space-x-2 sm:space-x-3 bg-white p-1 sm:p-2 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                    <Download
                      size={16}
                      className="text-slate-400 ml-2 sm:w-5 sm:h-5"
                    />
                    <select
                      onChange={(e) => {
                        importRosterFromTeam(e.target.value);
                        e.target.value = "";
                      }}
                      className="flex-1 bg-transparent border-none text-slate-700 font-bold focus:ring-0 outline-none text-xs sm:text-base"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Import Roster from Team...
                      </option>
                      {myTeams
                        .filter((t) => t.id !== activeTeam)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200">
                  <div className="flex gap-2">
                    <input
                      placeholder="#"
                      className="w-12 sm:w-16 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-slate-200 outline-none font-black text-center text-[#0033A0] text-sm sm:text-base"
                      value={newPlayerNum}
                      onChange={(e) => setNewPlayerNum(e.target.value)}
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </div>
                  <div className="flex flex-1 gap-2">
                    <input
                      placeholder="Player Name"
                      className="flex-1 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-slate-200 outline-none font-bold text-slate-700 text-sm sm:text-base"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                    />
                    <button
                      onClick={addPlayer}
                      className="bg-green-500 text-white px-3 sm:px-4 rounded-lg sm:rounded-xl font-black hover:bg-green-600 transition-colors shadow-sm flex items-center justify-center min-w-[3rem]"
                    >
                      <PlusCircle size={18} className="sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 bg-slate-100 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Team Players
                  </span>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRetired}
                      onChange={(e) => setShowRetired(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    Show Retired
                  </label>
                </div>
                {appData.roster
                  .filter((p) => showRetired || !p.isRetired)
                  .map((p) => (
                    <div
                      key={p.id}
                      className={`flex justify-between items-center bg-white p-2 sm:p-3 rounded-lg sm:rounded-xl shadow-sm border ${p.isRetired ? "border-amber-200 opacity-60" : "border-slate-200"}`}
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="#"
                          value={p.number ?? ""}
                          onChange={(e) =>
                            updatePlayer(p.id, { number: e.target.value })
                          }
                          title="Jersey Number (optional)"
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-50 flex items-center justify-center font-black text-[#0033A0] text-xs sm:text-base border border-blue-100 text-center outline-none focus:ring-2 focus:ring-[#0033A0] p-0 shrink-0"
                        />
                        <div className="flex items-center min-w-0 flex-1 gap-2">
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) =>
                              updatePlayer(p.id, { name: e.target.value })
                            }
                            placeholder="Player Name"
                            className="font-bold text-slate-800 text-sm sm:text-base bg-slate-50/60 hover:bg-slate-100 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-[#0033A0] rounded-lg px-2.5 py-1.5 outline-none transition-all flex-1 min-w-0"
                            title="Click to edit player name"
                          />
                          {p.isRetired && (
                            <span className="text-[10px] sm:text-xs font-black uppercase text-amber-700 bg-amber-100/80 px-2 py-1 rounded-md shrink-0 border border-amber-300">
                              Retired
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <button
                          onClick={() =>
                            updatePlayer(p.id, { isRetired: !p.isRetired })
                          }
                          className={`text-[10px] sm:text-xs ml-2 px-2 py-1 rounded font-bold uppercase tracking-widest ${p.isRetired ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-slate-200 text-slate-500 hover:bg-slate-300"}`}
                        >
                          {p.isRetired ? "Unretire" : "Retire"}
                        </button>
                        <button
                          onClick={() => removePlayer(p.id)}
                          className="text-red-400 hover:text-red-600 transition-colors p-2"
                          title="Delete permanently"
                        >
                          <XCircle size={18} className="sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* OPPONENT LINEUP MODAL */}
        {showOppLineupPrompt && (
          <div className="fixed inset-0 bg-slate-900/90 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-2xl sm:rounded-[2rem] w-full max-w-xl overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 sm:p-6 text-white text-center relative border-b border-slate-700">
                <h3 className="font-black text-xl sm:text-2xl tracking-widest uppercase">
                  {opponentName} Lineup
                </h3>
                <p className="text-slate-400 mt-1 text-xs sm:text-sm font-bold">
                  Lineups & notes auto-save.
                </p>
              </div>
              <div className="p-4 sm:p-6 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 bg-slate-50 border-b border-slate-200">
                {[4, 3, 2, 5, 6, 1].map((pos) => {
                  const arrIdx = pos - 1;
                  return (
                    <div
                      key={pos}
                      className="flex flex-col bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 focus-within:border-slate-400 transition-colors"
                    >
                      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest text-center">
                        Pos {pos}{" "}
                        {pos === 1 && serving === "opp" ? (
                          <span className="text-[9px] font-black uppercase text-amber-600 ml-1">Serve</span>
                        ) : (
                          ""
                        )}
                      </label>
                      <input
                        placeholder={`Opp ${pos}`}
                        value={tempOppLineup[arrIdx]}
                        onChange={(e) => {
                          const newArr = [...tempOppLineup];
                          newArr[arrIdx] = e.target.value;
                          setTempOppLineup(newArr);
                        }}
                        className="w-full bg-transparent border-none focus:ring-0 outline-none text-base sm:text-xl font-black text-slate-700 text-center uppercase p-0"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="p-4 sm:p-6 bg-white flex flex-col gap-3 sm:gap-4">
                {/* First Serve for Set 1 */}
                <div className="flex items-center justify-between bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-slate-200">
                  <label className="font-black text-slate-600 uppercase tracking-widest text-xs flex items-center">
                    First Serve
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setServing("ucc")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                        serving === "ucc"
                          ? "bg-[#0033A0] text-white shadow-sm ring-2 ring-[#0033A0]/30"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      
                      <span>Lancers</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setServing("opp")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                        serving === "opp"
                          ? "bg-slate-800 text-white shadow-sm ring-2 ring-slate-800/30"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      
                      <span className="truncate max-w-[110px]">{opponentName.trim() || "Opponent"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-slate-200">
                  <label className="font-black text-slate-500 uppercase tracking-widest text-xs sm:text-sm flex items-center">
                    <Shield size={16} className="mr-2 text-slate-400" />
                    Opp. Libero
                  </label>
                  <input
                    placeholder="#"
                    value={oppLiberoId}
                    onChange={(e) => setOppLiberoId(e.target.value)}
                    className="w-12 sm:w-16 bg-white p-1.5 sm:p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-400 outline-none text-center font-black text-slate-700 uppercase shadow-sm text-sm sm:text-base"
                  />
                </div>
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowOppLineupPrompt(false)}
                    className="px-4 sm:px-6 py-3 sm:py-4 text-slate-500 font-black tracking-widest hover:bg-slate-100 rounded-xl sm:rounded-2xl transition-colors uppercase text-xs sm:text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={finalizeStartGame}
                    className="flex-1 bg-gradient-to-b from-[#0033A0] to-[#001b5e] hover:from-[#0044cc] hover:to-[#002277] text-white rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl shadow-lg active:scale-95 transition-all uppercase tracking-widest"
                  >
                    Play Ball
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <TeamNameEditModal
          isOpen={teamNameModalConfig.isOpen}
          onClose={() =>
            setTeamNameModalConfig((prev) => ({ ...prev, isOpen: false }))
          }
          ourTeamName={teamNameModalConfig.ourTeamName || effectiveTeamName}
          opponentTeamName={teamNameModalConfig.opponentTeamName}
          targetMatchTitle={teamNameModalConfig.targetMatchTitle}
          showOpponentEdit={teamNameModalConfig.showOpponentEdit}
          onSave={(newOur, newOpp) =>
            handleSaveTeamNames(
              newOur,
              newOpp,
              teamNameModalConfig.targetMatchId,
            )
          }
        />
        {renderOpponentReportModal()}
        {renderPlayerSecurity()}
        {renderInstallModal()}
      </div>
    );
  }

  if (view === "game") {
    const handleGameStat = (playerId, category, metric, value = 1) => {
      if (statPrompt?.isOpp) {
        // use recordOppStatAndCheckPoint for opponents
        // Opponent categories are mostly Attack & Serve errors previously, but we can log anything via standard func
        recordOppStatAndCheckPoint(playerId, category, metric);
      } else {
        recordStatAndCheckPoint(playerId, category, metric, value);
      }
    };

    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col landscape:flex-row font-sans select-none overflow-hidden">
        {/* HEADER / SCOREBOARD */}
        <header className="bg-gradient-to-r landscape:bg-gradient-to-b from-slate-900 via-[#001b5e] to-slate-900 text-white shadow-md z-10 border-b landscape:border-b-0 landscape:border-r border-white/10 shrink-0 landscape:w-48 xl:landscape:w-64">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 py-1.5 sm:py-2.5 landscape:py-6 flex flex-wrap sm:flex-nowrap landscape:flex-col items-center justify-between gap-1 sm:gap-4 landscape:h-full landscape:justify-around">
            <div className="flex items-center landscape:flex-col space-x-2 sm:space-x-4 landscape:space-x-0 landscape:space-y-4 order-1 sm:order-none">
              <div className="flex items-center justify-center h-8 w-8 sm:h-12 sm:w-12 overflow-hidden relative shrink-0">
                <img
                  src={APP_LOGO_SRC}
                  alt="UCC Lancers Logo"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain absolute inset-0 z-10"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallback) {
                      target.dataset.fallback = "true";
                      target.src = FALLBACK_LOGO_SRC;
                    } else {
                      target.style.display = "none";
                    }
                  }}
                />
              </div>

              <div
                className={`py-1 sm:py-2 px-2 sm:px-4 rounded-xl sm:rounded-3xl flex items-center gap-2 transition-all duration-300 ${
                  serving === "ucc"
                    ? "bg-white/15 border border-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.1)]"
                    : "bg-transparent border border-transparent"
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setTeamNameModalConfig({
                          isOpen: true,
                          ourTeamName: effectiveTeamName,
                          opponentTeamName,
                          targetMatchId: activeMatch?.id,
                          showOpponentEdit: true,
                        })
                      }
                      className="group flex items-center gap-1 text-left cursor-pointer"
                      title="Adjust team names"
                    >
                      <h2 className="text-[8px] sm:text-xs font-black leading-tight tracking-[0.1em] uppercase text-blue-200 group-hover:text-amber-300 transition-colors">
                        {effectiveTeamName}
                      </h2>
                      <Edit3
                        size={10}
                        className="text-blue-300/60 group-hover:text-amber-300 transition-colors"
                      />
                    </button>
                    <span className="text-[8px] sm:text-[9px] font-black text-amber-300 bg-amber-400/20 px-1.5 py-0.2 rounded border border-amber-400/30 whitespace-nowrap" title="Official team substitutions (Libero swaps excluded)">
                      Subs: {teamStats.uccSubs}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <button
                      onClick={() => manualScoreAdjust("ucc", -1)}
                      className="text-white/40 hover:text-white p-1 active:scale-90"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <p className="text-3xl sm:text-4xl font-black tabular-nums tracking-tighter drop-shadow-md">
                      {score.ucc}
                    </p>
                    <button
                      onClick={() => manualScoreAdjust("ucc", 1)}
                      className="text-white/40 hover:text-white p-1 active:scale-90"
                    >
                      <ChevronUp size={14} />
                    </button>
                  </div>
                </div>
                {serving === "ucc" && (
                  <div className="text-xl sm:text-2xl animate-bounce drop-shadow-md">
                    <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-row sm:flex-col items-center justify-center px-1 sm:px-2 order-3 sm:order-none w-full sm:w-auto mt-1 sm:mt-0 pt-1 sm:pt-0 border-t border-white/5 sm:border-none relative">
              <button
                onClick={toggleFullscreen}
                className="absolute left-2 sm:-left-8 landscape:absolute landscape:top-0 landscape:left-0 text-white/50 hover:text-white p-1"
                title={isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen"}
              >
                {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
              </button>
              <span className="text-[7px] sm:text-[9px] font-black text-amber-400 tracking-[0.1em] sm:tracking-[0.2em] uppercase bg-amber-400/10 px-1.5 sm:px-2 py-0.5 rounded-full text-center flex items-center sm:flex-col whitespace-nowrap ml-6 sm:ml-0">
                <span className="mr-2 sm:mr-0">
                  {matchFormat === "Best of 3"
                    ? "BO3"
                    : matchFormat === "Best of 5"
                      ? "BO5"
                      : matchFormat}{" "}
                  • S{currentSetNum}
                </span>
                {isFirebaseAvailable && user ? (
                  <span className="text-[5px] sm:text-[6px] tracking-widest text-emerald-400 opacity-80 border-l sm:border-none border-white/20 pl-2 sm:pl-0">
                    LIVE SYNC
                  </span>
                ) : (
                  <span className="text-[5px] sm:text-[6px] tracking-widest text-amber-500 opacity-80 uppercase border-l sm:border-none border-white/20 pl-2 sm:pl-0">
                    {isFirebaseAvailable ? "Sync Delayed" : "Local Mode"}
                  </span>
                )}
              </span>
              <div className="flex items-center space-x-1.5 sm:space-x-3 bg-white/5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-2xl border border-white/10 ml-2 sm:ml-0 sm:mt-1">
                <span className="text-lg sm:text-xl font-black text-blue-400">
                  {setsWon.ucc}
                </span>
                <span className="text-[7px] sm:text-[9px] font-black text-white/30 uppercase">
                  Sets
                </span>
                <span className="text-lg sm:text-xl font-black text-white">
                  {setsWon.opp}
                </span>
              </div>
              <button
                type="button"
                onClick={viewStatsWithCurrentMatch}
                className="mt-1 px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-transform active:scale-95 cursor-pointer ring-1 ring-amber-300"
                title="View Live Match Stats"
              >
                <Activity size={11} className="shrink-0" />
                <span>Stats</span>
              </button>
              {score.ucc === 0 && score.opp === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const newServing = serving === "ucc" ? "opp" : "ucc";
                    setServing(newServing);
                    updateSetState({ serving: newServing });
                  }}
                  className="mt-1 px-2 py-0.5 rounded-full bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-[7px] sm:text-[8px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap"
                  title="Switch first serve team for this set"
                >
                  <span><span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span> Serve: {serving === "ucc" ? effectiveTeamName : (opponentName.substring(0, 6) || "Opp")}</span>
                  <ArrowRightLeft size={9} />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 landscape:space-x-0 landscape:space-y-4 order-2 sm:order-none">
              <div
                className={`py-1 sm:py-2 px-2 sm:px-4 landscape:px-2 rounded-xl sm:rounded-3xl flex items-center landscape:flex-col gap-2 transition-all duration-300 ${
                  serving === "opp"
                    ? "bg-white/15 border border-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.1)]"
                    : "bg-transparent border border-transparent"
                }`}
              >
                {serving === "opp" && (
                  <div className="text-xl sm:text-2xl animate-bounce drop-shadow-md">
                    <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span>
                  </div>
                )}
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] sm:text-[9px] font-black text-slate-300 bg-white/10 px-1.5 py-0.2 rounded border border-white/20 whitespace-nowrap" title="Opponent team substitutions">
                      Subs: {teamStats.oppSubs}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setTeamNameModalConfig({
                          isOpen: true,
                          ourTeamName: effectiveTeamName,
                          opponentTeamName,
                          targetMatchId: activeMatch?.id,
                          showOpponentEdit: true,
                        })
                      }
                      className="group flex items-center gap-1 text-right cursor-pointer"
                      title="Adjust opponent name"
                    >
                      <Edit3
                        size={10}
                        className="text-slate-400/60 group-hover:text-amber-300 transition-colors"
                      />
                      <h2 className="text-[8px] sm:text-xs font-black leading-tight tracking-[0.1em] uppercase text-slate-300 truncate max-w-[60px] sm:max-w-[100px] group-hover:text-amber-300 transition-colors">
                        {opponentName || "Opponent"}
                      </h2>
                    </button>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <button
                      onClick={() => manualScoreAdjust("opp", -1)}
                      className="text-white/40 hover:text-white p-1 active:scale-90"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <p className="text-3xl sm:text-4xl font-black tabular-nums tracking-tighter drop-shadow-md">
                      {score.opp}
                    </p>
                    <button
                      onClick={() => manualScoreAdjust("opp", 1)}
                      className="text-white/40 hover:text-white p-1 active:scale-90"
                    >
                      <ChevronUp size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* NEW COLLAPSIBLE COURT AND TABLE VIEW */}
        <div className="flex-1 flex flex-col relative bg-slate-100 overflow-hidden min-h-0 landscape:min-w-0">
          <div className="p-2 sm:p-4 flex items-center justify-between bg-white border-b border-slate-200 shrink-0 gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPositioning(true)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-200 text-slate-800 rounded-lg font-bold text-xs sm:text-sm tracking-widest uppercase hover:bg-slate-300 transition-colors"
              >
                Show Court
              </button>
              <button
                onClick={() => {
                  setReportOpponentName(opponentName);
                  setShowOpponentReportModal(true);
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-50 text-blue-800 rounded-lg font-bold text-xs sm:text-sm tracking-wider uppercase hover:bg-blue-100 transition-colors flex items-center gap-1.5 border border-blue-200 shadow-xs cursor-pointer"
                title="View Opponent Scouting & History"
              >
                <Shield size={14} className="text-blue-600" />
                <span className="hidden sm:inline">Opponents</span>
                <span className="sm:hidden">Opp</span>
              </button>
              <button
                type="button"
                onClick={viewStatsWithCurrentMatch}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg font-black text-xs sm:text-sm tracking-wider uppercase flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="View Live Match Stats"
              >
                <Activity size={14} className="text-slate-950" />
                <span className="hidden sm:inline">Live Stats</span>
                <span className="sm:hidden">Stats</span>
              </button>
              <div
                className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700"
                title="Official Team Substitutions (Libero replacements are free and do not count toward this total)"
              >
                <Users size={13} className="text-[#0033A0]" />
                <span className="hidden md:inline">Team Subs:</span>
                <span className="md:hidden">Subs:</span>
                <span className="font-black text-[#0033A0] tabular-nums">
                  {!viewOppStats ? teamStats.uccSubs : teamStats.oppSubs}
                </span>
                <div className="flex items-center space-x-0.5 ml-0.5">
                  <button
                    onClick={() => {
                      if (!viewOppStats) {
                        setTeamStats((s) => ({ ...s, uccSubs: Math.max(0, s.uccSubs - 1) }));
                      } else {
                        setTeamStats((s) => ({ ...s, oppSubs: Math.max(0, s.oppSubs - 1) }));
                      }
                    }}
                    className="p-0.5 text-slate-400 hover:text-slate-800 active:scale-90"
                    title="Manual sub adjust: minus 1"
                  >
                    <Minus size={11} />
                  </button>
                  <button
                    onClick={() => {
                      if (!viewOppStats) {
                        setTeamStats((s) => ({ ...s, uccSubs: s.uccSubs + 1 }));
                      } else {
                        setTeamStats((s) => ({ ...s, oppSubs: s.oppSubs + 1 }));
                      }
                    }}
                    className="p-0.5 text-slate-400 hover:text-slate-800 active:scale-90"
                    title="Manual sub adjust: plus 1"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
              <button
                onClick={() => setViewOppStats(false)}
                className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-md font-bold text-xs sm:text-sm transition-all ${!viewOppStats ? "bg-white shadow-sm text-blue-700" : "text-slate-500 hover:text-slate-700"}`}
              >
                Lancers
              </button>
              <button
                onClick={() => setViewOppStats(true)}
                className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-md font-bold text-xs sm:text-sm transition-all ${viewOppStats ? "bg-white shadow-sm text-blue-700" : "text-slate-500 hover:text-slate-700"}`}
              >
                {opponentName}
              </button>
            </div>
          </div>

          {showPositioning && (
            <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex flex-col justify-center items-center p-4">
              <div className="bg-slate-100 p-4 rounded-[2rem] shadow-2xl relative w-full h-[90vh] max-w-[600px] flex flex-col">
                <button
                  type="button"
                  onClick={() => {
                    setShowPositioning(false);
                    viewStatsWithCurrentMatch();
                  }}
                  className="absolute top-2 left-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1 shadow-sm z-10 cursor-pointer"
                  title="View Live Stats"
                >
                  <Activity size={13} />
                  <span>Stats</span>
                </button>
                <button
                  onClick={() => setShowPositioning(false)}
                  className="absolute top-2 right-2 text-slate-500 hover:text-slate-800 shrink-0 p-2 z-10 bg-white rounded-full shadow-sm"
                >
                  <X size={20} />
                </button>
                <div className="text-center font-black uppercase text-slate-500 mb-2 tracking-widest text-sm shrink-0">
                  Court Positioning
                </div>
                {/* COURT CONTAINER */}
                <div className="w-full flex-1 bg-[#c28e60] p-2 sm:p-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] relative rounded-xl sm:rounded-3xl flex flex-col border-4 sm:border-[8px] border-slate-800 mx-auto min-h-0 min-w-0 max-w-[500px]">
                  <div className="flex-1 bg-gradient-to-b from-[#e3b587] to-[#d6a575] border-4 sm:border-8 border-white relative flex flex-col shadow-inner min-h-0">
                    {/* OPPONENT SIDE */}
                    <div className="flex-1 relative flex flex-col justify-between p-1 sm:p-4 border-b-2 sm:border-b-4 border-white/80">
                      <div className="absolute bottom-[33.33%] left-0 w-full border-t-[2px] sm:border-t-[3px] border-white/60 shadow-[0_2px_4px_rgba(0,0,0,0.1)]"></div>
                      <div className="w-full text-center text-[#8a5a2b]/20 font-black text-3xl sm:text-6xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none tracking-widest uppercase">
                        {opponentName.substring(0, 8)}
                      </div>

                      <div className="flex justify-around items-center w-full mt-4 sm:mt-8 relative z-10">
                        {[0, 5, 4].map((idx) => {
                          const oppId = oppLineup[idx];
                          const hasNote =
                            oppNotesMem[oppId] &&
                            oppNotesMem[oppId].trim() !== "";
                          const isSetter = oppId === oppSetterId;
                          const isLibero = oppId === oppLiberoId;
                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedOppId(oppId)}
                              className={`relative w-[max(2.5rem,10vh)] h-[max(2.5rem,10vh)] landscape:w-[12vh] landscape:h-[12vh] sm:w-16 sm:h-16 landscape:max-w-16 landscape:max-h-16 rounded-full flex flex-col items-center justify-center text-white font-black shadow-md sm:shadow-[0_5px_10px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all border-2 border-white/50 ${
                                isSetter
                                  ? "bg-gradient-to-br from-green-400 to-green-600"
                                  : isLibero
                                    ? "bg-gradient-to-br from-slate-700 to-slate-900"
                                    : "bg-gradient-to-br from-slate-500 to-slate-600"
                              }`}
                            >
                              {hasNote && (
                                <FileText
                                  className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 text-amber-300 bg-slate-900 rounded-full p-0.5 sm:p-1 shadow-md border border-amber-500/30 w-3 h-3 sm:w-auto sm:h-auto"
                                  size={12}
                                />
                              )}
                              <span className="text-sm sm:text-xl drop-shadow-md">
                                {oppId}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex justify-around items-center w-full mb-4 sm:mb-8 relative z-10 mt-auto">
                        {[1, 2, 3].map((idx) => {
                          const oppId = oppLineup[idx];
                          const hasNote =
                            oppNotesMem[oppId] &&
                            oppNotesMem[oppId].trim() !== "";
                          const isSetter = oppId === oppSetterId;
                          const isLibero = oppId === oppLiberoId;
                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedOppId(oppId)}
                              className={`relative w-[max(2.5rem,10vh)] h-[max(2.5rem,10vh)] landscape:w-[12vh] landscape:h-[12vh] sm:w-16 sm:h-16 landscape:max-w-16 landscape:max-h-16 rounded-full flex flex-col items-center justify-center text-white font-black shadow-md sm:shadow-[0_5px_10px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all border-2 border-white/50 ${
                                isSetter
                                  ? "bg-gradient-to-br from-green-400 to-green-600"
                                  : isLibero
                                    ? "bg-gradient-to-br from-slate-700 to-slate-900"
                                    : "bg-gradient-to-br from-slate-500 to-slate-600"
                              }`}
                            >
                              {hasNote && (
                                <FileText
                                  className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 text-amber-300 bg-slate-900 rounded-full p-0.5 sm:p-1 shadow-md border border-amber-500/30 w-3 h-3 sm:w-auto sm:h-auto"
                                  size={12}
                                />
                              )}
                              <span className="text-sm sm:text-xl drop-shadow-md">
                                {oppId}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* NET */}
                    <div className="absolute top-1/2 left-0 w-full h-2 sm:h-4 -mt-1 sm:-mt-2 bg-gradient-to-b from-slate-800 to-slate-950 shadow-xl z-30 flex items-center justify-center">
                      <div className="w-full h-[1px] sm:h-[2px] bg-white/40"></div>
                      <div className="absolute -left-1 sm:-left-2 w-1 sm:w-2 h-6 sm:h-12 bg-[repeating-linear-gradient(45deg,#ef4444,#ef4444_4px,#ffffff_4px,#ffffff_8px)] shadow-lg rounded-sm bottom-0 border border-slate-900/50"></div>
                      <div className="absolute -right-1 sm:-right-2 w-1 sm:w-2 h-6 sm:h-12 bg-[repeating-linear-gradient(45deg,#ef4444,#ef4444_4px,#ffffff_4px,#ffffff_8px)] shadow-lg rounded-sm bottom-0 border border-slate-900/50"></div>
                    </div>

                    {/* UCC SIDE */}
                    <div className="flex-1 relative flex flex-col justify-between p-1 sm:p-4 bg-[#0033A0]/10">
                      <div className="absolute top-[33.33%] left-0 w-full border-t-[2px] sm:border-t-[3px] border-white/60 shadow-[0_-2px_4px_rgba(0,0,0,0.1)]"></div>
                      <div className="w-full text-center text-[#0033A0]/15 font-black text-5xl sm:text-7xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none tracking-widest uppercase">
                        Lancers
                      </div>

                      <div className="flex justify-around items-center w-full mt-4 sm:mt-8 relative z-10 mb-auto">
                        {[3, 2, 1].map((idx) => {
                          const p = appData.roster.find(
                            (r) => r.id === lineup[idx],
                          );
                          const isLibero = p?.id === liberoId;
                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedPlayerId(p?.id)}
                              className={`relative w-[max(3rem,12vh)] h-[max(3rem,12vh)] landscape:w-[16vh] landscape:h-[16vh] sm:w-20 sm:h-20 landscape:max-w-20 landscape:max-h-20 rounded-full flex flex-col items-center justify-center text-white shadow-lg sm:shadow-xl transition-all active:scale-95 border-2 sm:border-[3px] border-white/30 hover:scale-105 ${
                                isLibero
                                  ? "bg-gradient-to-br from-slate-700 to-slate-900"
                                  : "bg-gradient-to-br from-[#0044cc] to-[#001b5e]"
                              }`}
                            >
                              <span className="text-xl sm:text-3xl font-black drop-shadow-md leading-none">
                                {p?.number}
                              </span>
                              <span className="text-[7px] sm:text-[10px] font-bold leading-tight truncate w-10 sm:w-16 text-center uppercase tracking-wider text-white/80">
                                {p?.name?.split(" ")[0]}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex justify-around items-center w-full mb-4 sm:mb-8 relative z-10 mt-auto">
                        {[4, 5, 0].map((idx) => {
                          const p = appData.roster.find(
                            (r) => r.id === lineup[idx],
                          );
                          const isServer = idx === 0 && serving === "ucc";
                          const isLibero = p?.id === liberoId;
                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedPlayerId(p?.id)}
                              className={`relative w-[max(3rem,12vh)] h-[max(3rem,12vh)] landscape:w-[16vh] landscape:h-[16vh] sm:w-20 sm:h-20 landscape:max-w-20 landscape:max-h-20 rounded-full flex flex-col items-center justify-center text-white shadow-lg sm:shadow-xl transition-all active:scale-95 border-2 sm:border-[3px] border-white/30 hover:scale-105 ${
                                isLibero
                                  ? "bg-gradient-to-br from-slate-700 to-slate-900"
                                  : "bg-gradient-to-br from-[#0044cc] to-[#001b5e]"
                              }`}
                            >
                              {isServer && (
                                <div className="absolute -bottom-1 -right-1 sm:-bottom-3 sm:-right-3 text-lg sm:text-3xl drop-shadow-md animate-bounce z-30">
                                  <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span>
                                </div>
                              )}
                              <span className="text-xl sm:text-3xl font-black drop-shadow-md leading-none">
                                {p?.number}
                              </span>
                              <span className="text-[7px] sm:text-[10px] font-bold leading-tight truncate w-10 sm:w-16 text-center uppercase tracking-wider text-white/80">
                                {p?.name?.split(" ")[0]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Awaiting Receive Pulse Indicators */}
                    {rallyPhase === "receive" && (
                      <div className="absolute inset-x-2 sm:inset-x-4 bottom-[20%] sm:bottom-1/3 flex justify-center z-20">
                        <button
                          onClick={() =>
                            setOppServeReceivePrompt({ passerId: null })
                          }
                          className="bg-[#0033A0]/90 hover:bg-[#0033A0] backdrop-blur-sm text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full border border-white/30 shadow-lg animate-pulse flex items-center space-x-2 cursor-pointer pointer-events-auto"
                        >
                          <Activity size={14} className="text-amber-300" />
                          <div className="flex flex-col items-center">
                            <span className="font-black text-[10px] sm:text-xs tracking-widest uppercase">
                              Opponent Served
                            </span>
                            <span className="text-[8px] sm:text-[9px] font-bold text-amber-200">
                              Tap to Record Who Passed & Rating
                            </span>
                          </div>
                        </button>
                      </div>
                    )}

                    {rallyPhase === "opp_receive" && (
                      <div className="absolute inset-x-2 sm:inset-x-4 top-[20%] sm:top-1/3 flex justify-center pointer-events-none z-20">
                        <div className="bg-slate-800/80 backdrop-blur-sm text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full border border-white/20 shadow-lg animate-pulse flex flex-col items-center">
                          <span className="font-black text-[10px] sm:text-sm tracking-widest uppercase text-amber-400">
                            Opponent Receive
                          </span>
                          <span className="text-[8px] sm:text-[10px] font-medium opacity-80 text-white">
                            Tap opponent passer
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto p-2 sm:p-4 w-full">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-5xl mx-auto overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-3 text-xs uppercase tracking-widest text-slate-500 font-black text-center w-36 sm:w-44">
                      Sub / Lib
                    </th>
                    <th className="p-3 text-xs uppercase tracking-widest text-slate-500 font-black">
                      Players on Court (6)
                    </th>
                    {trackedCategories.Pass && viewOppStats && (
                      <th className="p-3 text-xs uppercase tracking-widest text-slate-500 font-black text-center w-24">
                        Pass
                      </th>
                    )}
                    {trackedCategories.Serve && (
                      <th className="p-3 text-xs uppercase tracking-widest text-slate-500 font-black text-center w-24">
                        Serve
                      </th>
                    )}
                    {trackedCategories.Attack && (
                      <th className="p-3 text-xs uppercase tracking-widest text-slate-500 font-black text-center w-24">
                        Attack
                      </th>
                    )}
                    {trackedCategories.Block && (
                      <th className="p-3 text-xs uppercase tracking-widest text-slate-500 font-black text-center w-24">
                        Block
                      </th>
                    )}
                    {trackedCategories.Dig && (
                      <th className="p-3 text-xs uppercase tracking-widest text-slate-500 font-black text-center w-24">
                        Dig
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const currentLineupList = (!viewOppStats ? lineup : oppLineup).filter(
                      (id): id is string => Boolean(id),
                    );
                    const sortedCourtPlayers = [...currentLineupList].sort((idA, idB) => {
                      if (!viewOppStats) {
                        const pA = appData.roster.find((r) => r.id === idA);
                        const pB = appData.roster.find((r) => r.id === idB);
                        return sortPlayersByNumberThenAlpha(
                          pA || { name: idA, id: idA },
                          pB || { name: idB, id: idB },
                        );
                      } else {
                        return sortPlayersByNumberThenAlpha(
                          { number: idA, name: idA, id: idA },
                          { number: idB, name: idB, id: idB },
                        );
                      }
                    });

                    return sortedCourtPlayers.map((id, index) => {
                      const posIndex = !viewOppStats ? lineup.indexOf(id) : oppLineup.indexOf(id);
                      const courtPosNum = posIndex !== -1 ? posIndex + 1 : index + 1;
                      // Back-row ("background") players in standard rotation are indices 0, 4, 5 (Positions 1, 5, 6)
                      const isBackRow = [0, 4, 5].includes(posIndex);
                      const isLibero = !viewOppStats ? id === liberoId : id === oppLiberoId;
                      const isServer = !viewOppStats
                        ? posIndex === 0 && serving === "ucc"
                        : posIndex === 0 && serving === "opp";

                      const pName = !viewOppStats
                        ? appData.roster.find((r) => r.id === id)?.name || id
                        : id;
                      const pNum = !viewOppStats
                        ? appData.roster.find((r) => r.id === id)?.number || "-"
                        : id.replace(/\D/g, "") || id;
                      return (
                        <tr
                          key={index}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="p-1.5 pt-2">
                            {!viewOppStats ? (
                              <div className="flex items-center justify-center gap-1">
                                {isLibero ? (
                                  <>
                                    <button
                                      onClick={() => handleLiberoSwap(id)}
                                      className="flex-1 py-2 px-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white transition-all rounded-lg font-black text-[10px] sm:text-xs uppercase flex items-center justify-center gap-1 shadow-sm active:scale-95 border border-amber-600"
                                      title="Swap Libero out for original player (Does not count toward sub total)"
                                    >
                                      <ArrowRightLeft size={12} />
                                      Lib Out
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedPlayerId(id);
                                        setSubModalVisible(true);
                                      }}
                                      className="py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors rounded-lg font-bold text-[10px] sm:text-xs uppercase border border-slate-200"
                                      title="Regular substitution"
                                    >
                                      Sub
                                    </button>
                                  </>
                                ) : isBackRow ? (
                                  <>
                                    <button
                                      onClick={() => handleLiberoSwap(id)}
                                      className="flex-1 py-2 px-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 transition-all rounded-lg font-black text-[10px] sm:text-xs uppercase flex items-center justify-center gap-1 border border-amber-300 active:scale-95 shadow-xs"
                                      title="Swap Libero in for this back row player (Does not count toward sub total)"
                                    >
                                      <ArrowRightLeft size={12} className="text-amber-700" />
                                      Lib In
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (subPairs[id]) {
                                          setPendingAutoSub({
                                            outId: id,
                                            inId: subPairs[id],
                                          });
                                        } else {
                                          setSelectedPlayerId(id);
                                          setSubModalVisible(true);
                                        }
                                      }}
                                      className="py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors rounded-lg font-bold text-[10px] sm:text-xs uppercase flex items-center justify-center border border-slate-200"
                                      title="Regular substitution"
                                    >
                                      Sub
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => {
                                      if (subPairs[id]) {
                                        setPendingAutoSub({
                                          outId: id,
                                          inId: subPairs[id],
                                        });
                                      } else {
                                        setSelectedPlayerId(id);
                                        setSubModalVisible(true);
                                      }
                                    }}
                                    className="w-full py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors rounded-lg font-bold text-[10px] sm:text-xs uppercase flex items-center justify-center gap-1 border border-slate-200 shadow-xs active:scale-95"
                                    title="Front row player substitution"
                                  >
                                    <ArrowRightLeft size={12} />
                                    Sub
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                {isLibero ? (
                                  <button
                                    onClick={() => handleOppLiberoToggle(id)}
                                    className="flex-1 py-2 px-1.5 bg-amber-500 hover:bg-amber-600 text-white transition-all rounded-lg font-black text-[10px] sm:text-xs uppercase flex items-center justify-center gap-1 shadow-sm active:scale-95 border border-amber-600"
                                    title="Opponent Libero Out"
                                  >
                                    <ArrowRightLeft size={12} />
                                    Lib Out
                                  </button>
                                ) : isBackRow && oppLiberoId ? (
                                  <button
                                    onClick={() => handleOppLiberoToggle(id)}
                                    className="flex-1 py-2 px-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 transition-all rounded-lg font-black text-[10px] sm:text-xs uppercase flex items-center justify-center gap-1 border border-amber-300 active:scale-95"
                                    title="Opponent Libero In"
                                  >
                                    <ArrowRightLeft size={12} />
                                    Lib In
                                  </button>
                                ) : null}
                                <button
                                  onClick={() => {
                                    setSelectedOppId(id);
                                    setShowOppSubModal(true);
                                  }}
                                  className="flex-1 py-2 px-2 bg-blue-50 hover:bg-blue-100 text-blue-800 transition-colors rounded-lg font-bold text-[10px] sm:text-xs uppercase border border-blue-200 active:scale-95"
                                  title="Quick Opponent substitution"
                                >
                                  Sub
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-700 capitalize flex items-center gap-2">
                              {!viewOppStats ? (
                                <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs shrink-0 font-black">
                                  {pNum}
                                </span>
                              ) : (
                                <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs shrink-0 font-black">
                                  #{id}
                                </span>
                              )}
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate font-black text-slate-800 text-sm">
                                    {!viewOppStats ? pName : `Opponent #${id}`}
                                  </span>
                                  {isLibero && (
                                    <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded text-[9px] font-black uppercase tracking-wider">
                                      LIBERO
                                    </span>
                                  )}
                                  {isServer && (
                                    <span className="text-xs" title="Currently Serving">
                                      <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span>
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                  <span>Pos {courtPosNum}</span>
                                  <span>•</span>
                                  <span className={isBackRow ? "text-amber-600 font-black" : "text-blue-600 font-black"}>
                                    {isBackRow ? "Back Row" : "Front Row"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          {trackedCategories.Pass && viewOppStats && (
                            <td className="p-1.5">
                              <button
                                onClick={() =>
                                  setStatPrompt({
                                    playerId: id,
                                    type: "Pass",
                                    isOpp: viewOppStats,
                                  })
                                }
                                className="w-full py-2 px-1 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors rounded-lg font-bold text-xs sm:text-sm border border-blue-100"
                              >
                                Pass
                              </button>
                            </td>
                          )}
                          {trackedCategories.Serve && (
                            <td className="p-1.5">
                              <button
                                onClick={() => {
                                  if (viewOppStats) {
                                    setOppServeReceivePrompt({
                                      passerId: null,
                                      serverId: id,
                                    });
                                  } else {
                                    setStatPrompt({
                                      playerId: id,
                                      type: "Serve",
                                      isOpp: false,
                                    });
                                  }
                                }}
                                className="w-full py-2 px-1 bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors rounded-lg font-bold text-xs sm:text-sm border border-purple-100 cursor-pointer"
                              >
                                Serve
                              </button>
                            </td>
                          )}
                          {trackedCategories.Attack && (
                            <td className="p-1.5">
                              <button
                                onClick={() =>
                                  setStatPrompt({
                                    playerId: id,
                                    type: "Attack",
                                    isOpp: viewOppStats,
                                  })
                                }
                                className="w-full py-2 px-1 bg-green-50 hover:bg-green-100 text-green-700 transition-colors rounded-lg font-bold text-xs sm:text-sm border border-green-100"
                              >
                                Attack
                              </button>
                            </td>
                          )}
                          {trackedCategories.Block && (
                            <td className="p-1.5">
                              <button
                                onClick={() =>
                                  setStatPrompt({
                                    playerId: id,
                                    type: "Block",
                                    isOpp: viewOppStats,
                                  })
                                }
                                className="w-full py-2 px-1 bg-orange-50 hover:bg-orange-100 text-orange-700 transition-colors rounded-lg font-bold text-xs sm:text-sm border border-orange-100"
                              >
                                Block
                              </button>
                            </td>
                          )}
                          {trackedCategories.Dig && (
                            <td className="p-1.5">
                              <button
                                onClick={() =>
                                  setStatPrompt({
                                    playerId: id,
                                    type: "Dig",
                                    isOpp: viewOppStats,
                                  })
                                }
                                className="w-full py-2 px-1 bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors rounded-lg font-bold text-xs sm:text-sm border border-amber-100"
                              >
                                Dig
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* STICKY BOTTOM BAR (Controls) */}
        <div className="bg-slate-900 border-t landscape:border-t-0 landscape:border-l border-white/10 px-2 sm:px-4 py-2 sm:py-3 landscape:py-4 z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] shrink-0 landscape:w-32 xl:landscape:w-48 flex items-center">
          <div className="max-w-5xl mx-auto flex landscape:flex-col gap-2 sm:gap-3 landscape:gap-4 w-full h-full justify-center landscape:items-stretch">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className={`px-3 sm:px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black flex items-center justify-center shadow-md transition-all active:scale-95 text-xs sm:text-sm ${
                history.length === 0
                  ? "bg-white/5 text-white/20"
                  : "bg-slate-700 text-white hover:bg-slate-600"
              }`}
            >
              <Undo className="sm:mr-1.5" size={16} />{" "}
              <span className="hidden sm:inline">UNDO</span>
            </button>
            {rallyPhase === "serve" && !servePromptVisible ? (
              <button
                onClick={() => {
                  if (serving === "opp") {
                    setOppServeReceivePrompt({
                      passerId: null,
                      serverId: oppLineup[0],
                    });
                  } else {
                    setServePromptVisible(true);
                  }
                }}
                className={`flex-1 bg-gradient-to-b ${
                  serving === "opp"
                    ? "from-purple-600 to-indigo-800 hover:from-purple-500 hover:to-indigo-700 shadow-[0_5px_15px_rgba(147,51,234,0.4)] border-t border-purple-400/30"
                    : "from-green-500 to-green-700 hover:from-green-400 hover:to-green-600 shadow-[0_5px_15px_rgba(34,197,94,0.4)] border-t border-green-400/30"
                } text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-sm sm:text-xl transition-all active:scale-95 tracking-widest uppercase animate-pulse flex flex-col items-center justify-center leading-none cursor-pointer`}
              >
                <span>{serving === "opp" ? "OPP SERVE" : "SERVE"}</span>
                <span className="text-[8px] sm:text-[10px] tracking-widest opacity-80 mt-1">
                  {serving === "opp"
                    ? "TAP TO RECORD PASS / OUTCOME"
                    : "TAP WHEN SERVED"}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setEndRallyVisible(true)}
                className="flex-1 bg-gradient-to-b from-[#0044cc] to-[#001b5e] hover:from-[#0055ff] hover:to-[#002277] text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-sm sm:text-xl shadow-[0_5px_15px_rgba(0,51,160,0.4)] border-t border-blue-400/30 transition-all active:scale-95 tracking-widest uppercase"
              >
                End Rally
              </button>
            )}
            <button
              onClick={viewStatsWithCurrentMatch}
              className="px-3 sm:px-4 py-3 sm:py-4 bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950 rounded-xl sm:rounded-2xl font-black tracking-widest flex items-center justify-center hover:from-amber-300 hover:to-amber-500 shadow-md border-t border-amber-300 transition-all active:scale-95 text-xs sm:text-sm uppercase gap-1.5 shrink-0"
              title="View Live Stats"
            >
              <Activity size={18} />
              <span className="hidden sm:inline font-black text-xs">STATS</span>
            </button>
            <button
              onClick={() => setShowStatCorrectionModal(true)}
              className="px-3 sm:px-4 py-3 sm:py-4 bg-gradient-to-b from-indigo-600 to-indigo-800 text-white rounded-xl sm:rounded-2xl font-black tracking-widest flex items-center justify-center hover:from-indigo-500 hover:to-indigo-700 shadow-md border-t border-indigo-400 transition-all active:scale-95 text-xs sm:text-sm uppercase"
              title="Data Correction & Stat Log"
            >
              <Edit3 size={18} />
            </button>
            <button
              onClick={openInGameLineupEdit}
              className="px-3 sm:px-4 py-3 sm:py-4 bg-gradient-to-b from-slate-700 to-slate-900 text-white rounded-xl sm:rounded-2xl font-black tracking-widest flex items-center justify-center hover:from-slate-600 hover:to-slate-800 shadow-md border-t border-slate-600 transition-all active:scale-95 text-xs sm:text-sm uppercase"
              title="Switch / Adjust Court Lineup"
            >
              <Users size={18} />
            </button>
            {appData.matches.find((m) => m.id === activeMatch?.id)?.isLive !==
            false ? (
              <button
                onClick={handleEndGameLive}
                className="px-3 sm:px-4 py-3 sm:py-4 bg-gradient-to-b from-red-600 to-red-800 text-white rounded-xl sm:rounded-2xl font-black tracking-widest flex items-center justify-center hover:from-red-500 hover:to-red-700 shadow-md border-t border-red-500 transition-all active:scale-95 text-xs sm:text-sm uppercase whitespace-nowrap"
              >
                End Game
              </button>
            ) : (
              <button
                onClick={() => {
                  setActiveMatch(null);
                  setActiveSetId(null);
                  setView("menu");
                }}
                className="px-3 sm:px-4 py-3 sm:py-4 bg-gradient-to-b from-slate-600 to-slate-800 text-white rounded-xl sm:rounded-2xl font-black tracking-widest flex items-center justify-center hover:from-slate-500 hover:to-slate-700 shadow-md border-t border-slate-500 transition-all active:scale-95 text-xs sm:text-sm uppercase whitespace-nowrap"
              >
                Exit Match
              </button>
            )}
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* POPUPS (MODALS) */}
        {/* --------------------------------------------------------- */}

        {statPrompt && (
          <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md animate-in fade-in overflow-hidden">
            <div className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-[#0033A0]/20 max-h-[90vh]">
              <div className="bg-gradient-to-r from-[#001b5e] to-[#0033A0] p-4 sm:p-5 flex justify-between items-center text-white shrink-0">
                <div className="font-black text-xl tracking-widest uppercase flex items-center">
                  <Activity size={20} className="mr-2" />
                  {statPrompt.type}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStatPrompt(null);
                      viewStatsWithCurrentMatch();
                    }}
                    className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-lg text-xs uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                    title="View stats"
                  >
                    <Activity size={13} />
                    <span>Stats</span>
                  </button>
                  <button
                    onClick={() => setStatPrompt(null)}
                    className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4 bg-slate-50 space-y-4 overflow-y-auto">
                {/* Always Visible Score Banner */}
                <div className="bg-slate-900 text-white rounded-xl p-2.5 flex items-center justify-between shadow-sm">
                  <div className="text-left">
                    <span className="text-[10px] font-black uppercase text-blue-400 block">{effectiveTeamName}</span>
                    <span className="text-xl font-black">{score.ucc}</span>
                  </div>
                  <div className="text-center px-2">
                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest block">SET {currentSetNum}</span>
                    <span className="text-[10px] font-black text-white/70">SETS {setsWon.ucc}-{setsWon.opp}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-slate-300 block truncate max-w-[100px]">{opponentName || "Opp"}</span>
                    <span className="text-xl font-black">{score.opp}</span>
                  </div>
                </div>

                <div className="text-center font-bold text-slate-700 text-lg mb-2">
                  {(!statPrompt.isOpp
                    ? appData.roster.find((r) => r.id === statPrompt.playerId)
                        ?.name
                    : statPrompt.playerId) || "Unknown Player"}
                </div>
                {statPrompt.type === "Pass" && (
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 2, 1, 0].map((val) => (
                      <button
                        key={val}
                        onClick={() => {
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            "Rating",
                            val,
                          );
                          setStatPrompt(null);
                        }}
                        className={`p-4 rounded-xl font-black text-2xl shadow-sm active:scale-95 transition-all ${val === 3 ? "bg-gradient-to-b from-green-400 to-green-500 text-white border border-green-500" : val === 0 ? "bg-gradient-to-b from-red-400 to-red-500 text-white border border-red-500" : "bg-white text-slate-700 border border-slate-200"}`}
                      >
                        {val}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        handleGameStat(
                          statPrompt.playerId,
                          statPrompt.type,
                          "Error",
                          1,
                        );
                        setStatPrompt(null);
                      }}
                      className="col-span-4 bg-slate-200 text-slate-600 p-4 rounded-xl font-black text-sm uppercase shadow-sm border border-slate-300 active:scale-95 flex items-center justify-center"
                    >
                      ERROR
                    </button>
                  </div>
                )}
                {statPrompt.type === "Serve" && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        handleGameStat(
                          statPrompt.playerId,
                          statPrompt.type,
                          "Ace",
                        );
                        setStatPrompt(null);
                      }}
                      className="bg-gradient-to-b from-green-500 to-green-600 text-white p-4 rounded-xl font-black text-xl shadow-sm active:scale-95 border-t border-white/20"
                    >
                      ACE
                    </button>
                    <button
                      onClick={() => {
                        const wasOpp = statPrompt.isOpp;
                        handleGameStat(
                          statPrompt.playerId,
                          statPrompt.type,
                          "Attempt",
                        );
                        setStatPrompt(null);
                        if (wasOpp) {
                          changeRallyPhase("receive");
                          setOppServeReceivePrompt({ passerId: null });
                        }
                      }}
                      className="bg-gradient-to-b from-blue-500 to-blue-600 text-white p-4 rounded-xl font-black text-xl shadow-sm active:scale-95 border-t border-white/20"
                    >
                      IN PLAY
                    </button>
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2 mb-1 flex items-center justify-center">
                      <span className="h-px bg-slate-200 flex-1 mr-2"></span>{" "}
                      ERROR TYPE{" "}
                      <span className="h-px bg-slate-200 flex-1 ml-2"></span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            "Miss - Net",
                          );
                          setStatPrompt(null);
                        }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl font-bold border border-red-100 shadow-sm active:scale-95 uppercase text-sm"
                      >
                        Net
                      </button>
                      <button
                        onClick={() => {
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            "Miss - Long",
                          );
                          setStatPrompt(null);
                        }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl font-bold border border-red-100 shadow-sm active:scale-95 uppercase text-sm"
                      >
                        Long
                      </button>
                      <button
                        onClick={() => {
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            "Miss - Wide",
                          );
                          setStatPrompt(null);
                        }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl font-bold border border-red-100 shadow-sm active:scale-95 uppercase text-sm"
                      >
                        Wide
                      </button>
                    </div>
                  </div>
                )}
                {statPrompt.type === "Attack" && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        handleGameStat(
                          statPrompt.playerId,
                          statPrompt.type,
                          "Kill",
                        );
                        setStatPrompt(null);
                      }}
                      className="bg-gradient-to-b from-green-500 to-green-600 text-white p-4 rounded-xl font-black text-xl shadow-sm active:scale-95 border-t border-white/20"
                    >
                      KILL
                    </button>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={() => {
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            "Swing",
                          );
                          setStatPrompt(null);
                        }}
                        className="bg-gradient-to-b from-blue-500 to-blue-600 text-white p-4 rounded-xl font-black text-sm sm:text-base shadow-sm active:scale-95 border-t border-white/20"
                      >
                        IN PLAY
                      </button>
                      <button
                        onClick={() => {
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            "Blocked",
                          );
                          setStatPrompt(null);
                        }}
                        className="bg-blue-50 text-blue-700 p-4 rounded-xl font-black text-sm sm:text-base border border-blue-200 shadow-sm active:scale-95 uppercase"
                      >
                        COVERED
                      </button>
                    </div>
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2 mb-1 flex items-center justify-center">
                      <span className="h-px bg-slate-200 flex-1 mr-2"></span>{" "}
                      ERRORS{" "}
                      <span className="h-px bg-slate-200 flex-1 ml-2"></span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            "Out",
                          );
                          setStatPrompt(null);
                        }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl font-bold text-sm border border-red-100 shadow-sm active:scale-95 flex flex-col items-center justify-center uppercase"
                      >
                        <span className="text-xl mb-1">↗️</span>Out
                      </button>
                      <button
                        onClick={() => {
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            "Net",
                          );
                          setStatPrompt(null);
                        }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl font-bold text-sm border border-red-100 shadow-sm active:scale-95 flex flex-col items-center justify-center uppercase"
                      >
                        Net
                      </button>
                      <button
                        onClick={() => {
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            "Stuffed",
                          );
                          setStatPrompt(null);
                        }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl font-bold text-sm border border-red-100 shadow-sm active:scale-95 flex flex-col items-center justify-center uppercase"
                      >
                        Stuffed
                      </button>
                    </div>
                  </div>
                )}
                {statPrompt.type === "Dig" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        handleGameStat(
                          statPrompt.playerId,
                          statPrompt.type,
                          "Dig",
                        );
                        setStatPrompt(null);
                      }}
                      className="bg-gradient-to-b from-blue-500 to-blue-600 text-white p-4 rounded-xl font-black text-xl shadow-sm active:scale-95 border-t border-white/20"
                    >
                      DIG
                    </button>
                    <button
                      onClick={() => {
                        handleGameStat(
                          statPrompt.playerId,
                          statPrompt.type,
                          "Error",
                        );
                        setStatPrompt(null);
                      }}
                      className="bg-slate-200 text-slate-600 p-4 rounded-xl font-black text-sm uppercase shadow-sm border border-slate-300 active:scale-95 flex items-center justify-center"
                    >
                      TOUCH
                    </button>
                  </div>
                )}
                {statPrompt.type === "Block" && !statPrompt.step && (
                  <div className="flex flex-col gap-2.5">
                    {/* Late controls: Just Late or Combined */}
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStatPrompt({
                            ...statPrompt,
                            latePressed: !statPrompt.latePressed,
                          });
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                          statPrompt.latePressed
                            ? "bg-amber-500 text-white shadow-sm ring-2 ring-amber-400"
                            : "bg-white text-amber-900 border border-amber-300 hover:bg-amber-100"
                        }`}
                        title="Toggle Late to combine with Stuff, Touch, Used, or Net Violation"
                      >
                        <Check size={14} className={statPrompt.latePressed ? "opacity-100" : "opacity-30"} />
                        <span>Late Block {statPrompt.latePressed ? "(Active)" : "(Toggle)"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            "Late",
                          );
                          setStatPrompt(null);
                        }}
                        className="py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-black text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                        title="Record Late as a standalone stat"
                      >
                        Just Late
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          setStatPrompt({ ...statPrompt, step: "Stuff" })
                        }
                        className="bg-gradient-to-b from-green-500 to-green-600 text-white p-3 sm:p-4 rounded-xl font-black text-sm sm:text-lg shadow-sm active:scale-95 border-t border-white/20 flex flex-col items-center justify-center cursor-pointer"
                      >
                        <span>STUFF</span>
                        {statPrompt.latePressed && (
                          <span className="text-[10px] font-bold text-green-100 uppercase tracking-wider">
                            + LATE
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setStatPrompt({ ...statPrompt, step: "Touch" })
                        }
                        className="bg-gradient-to-b from-blue-500 to-blue-600 text-white p-3 sm:p-4 rounded-xl font-black text-sm sm:text-lg shadow-sm active:scale-95 border-t border-white/20 flex flex-col items-center justify-center cursor-pointer"
                      >
                        <span>TOUCH</span>
                        {statPrompt.latePressed && (
                          <span className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">
                            + LATE
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1 mb-0.5 flex items-center justify-center">
                      <span className="h-px bg-slate-200 flex-1 mr-2"></span>
                      ERRORS & NOTES
                      <span className="h-px bg-slate-200 flex-1 ml-2"></span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          if (statPrompt.latePressed)
                            handleGameStat(
                              statPrompt.playerId,
                              statPrompt.type,
                              "Late",
                            );
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            "Used",
                          );
                          setStatPrompt(null);
                        }}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-700 p-3 rounded-xl font-black border border-slate-300 shadow-sm active:scale-95 flex flex-col items-center justify-center text-xs sm:text-sm cursor-pointer"
                      >
                        <span>USED / TOOL</span>
                        {statPrompt.latePressed && (
                          <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">
                            + LATE
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (statPrompt.latePressed)
                            handleGameStat(
                              statPrompt.playerId,
                              statPrompt.type,
                              "Late",
                            );
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            "Net Viol",
                          );
                          setStatPrompt(null);
                        }}
                        className="bg-red-50 hover:bg-red-100 text-red-600 p-3 rounded-xl font-black border border-red-200 shadow-sm active:scale-95 flex flex-col items-center justify-center text-xs sm:text-sm cursor-pointer"
                      >
                        <span>NET VIOLATION</span>
                        {statPrompt.latePressed && (
                          <span className="text-[9px] font-bold text-red-700 uppercase tracking-wider">
                            + LATE
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                {statPrompt.type === "Block" && statPrompt.step && (
                  <div className="flex flex-col gap-2">
                    <div className="font-bold text-center text-slate-500 uppercase tracking-widest">
                      {statPrompt.step}: Solo or Half?
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          if (statPrompt.latePressed)
                            handleGameStat(
                              statPrompt.playerId,
                              statPrompt.type,
                              "Late",
                            );
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            statPrompt.step,
                            1,
                          );
                          setStatPrompt(null);
                        }}
                        className="bg-gradient-to-b from-indigo-500 to-indigo-600 text-white p-3 sm:p-4 rounded-xl font-black text-sm sm:text-lg shadow-sm active:scale-95 border-t border-white/20"
                      >
                        SOLO
                      </button>
                      <button
                        onClick={() => {
                          if (statPrompt.latePressed)
                            handleGameStat(
                              statPrompt.playerId,
                              statPrompt.type,
                              "Late",
                            );
                          handleGameStat(
                            statPrompt.playerId,
                            statPrompt.type,
                            statPrompt.step,
                            0.5,
                          );
                          setStatPrompt(null);
                        }}
                        className="bg-gradient-to-b from-teal-500 to-teal-600 text-white p-3 sm:p-4 rounded-xl font-black text-sm sm:text-lg shadow-sm active:scale-95 border-t border-white/20"
                      >
                        HALF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* UCC PLAYER ACTION MODAL */}
        {selectedPlayerId && selectedPlayerObj && (
          <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-150 overflow-hidden">
            <div className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col scale-in-center border border-[#0033A0]/20 max-h-[90vh]">
              <div className="bg-gradient-to-r from-[#001b5e] to-[#0033A0] p-4 sm:p-5 flex justify-between items-center text-white shrink-0">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white text-[#0033A0] rounded-full flex items-center justify-center text-xl sm:text-2xl font-black shadow-inner">
                    {selectedPlayerObj.number}
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black tracking-widest">
                      {selectedPlayerObj.name}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlayerId(null)}
                  className="text-white/50 hover:text-white p-1 sm:p-2 rounded-full transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 bg-slate-50 overflow-y-auto w-full">
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <button
                    onClick={() =>
                      recordStatAndCheckPoint(selectedPlayerId, "Dig", "Dig")
                    }
                    className="bg-gradient-to-b from-blue-500 to-blue-600 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl shadow-sm active:scale-95 border-t border-white/20"
                  >
                    DIG
                  </button>
                  <button
                    onClick={() =>
                      recordStatAndCheckPoint(
                        selectedPlayerId,
                        "Dig",
                        "Error",
                      )
                    }
                    className="bg-slate-200 text-slate-600 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm shadow-sm active:scale-95 border border-slate-300 uppercase"
                  >
                    Touch
                  </button>
                </div>

                <div className="bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                      <h4 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center">
                        <Crosshair size={12} className="mr-1 text-red-500" />{" "}
                        Attack
                      </h4>
                      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                        <button
                          onClick={() =>
                            recordStatAndCheckPoint(
                              selectedPlayerId,
                              "Attack",
                              "Kill",
                            )
                          }
                          className="col-span-2 bg-gradient-to-b from-green-500 to-green-600 text-white py-2.5 sm:py-4 rounded-lg sm:rounded-xl font-black text-lg sm:text-xl shadow-sm active:scale-95 border-t border-white/20"
                        >
                          KILL
                        </button>
                        <button
                          onClick={() =>
                            recordStatAndCheckPoint(
                              selectedPlayerId,
                              "Attack",
                              "Swing",
                            )
                          }
                          className="col-span-2 bg-gradient-to-b from-slate-600 to-slate-700 text-white py-2.5 sm:py-4 rounded-lg sm:rounded-xl font-black text-lg sm:text-xl shadow-sm active:scale-95 border-t border-white/20"
                        >
                          SWING
                        </button>
                        <button
                          onClick={() =>
                            recordStatAndCheckPoint(
                              selectedPlayerId,
                              "Attack",
                              "Out",
                            )
                          }
                          className="col-span-1 bg-slate-100 text-slate-600 py-2 sm:py-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm border border-slate-200 active:scale-95 uppercase tracking-wider"
                        >
                          Out
                        </button>
                        <button
                          onClick={() =>
                            recordStatAndCheckPoint(
                              selectedPlayerId,
                              "Attack",
                              "Net",
                            )
                          }
                          className="col-span-1 bg-slate-100 text-slate-600 py-2 sm:py-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm border border-slate-200 active:scale-95 uppercase tracking-wider"
                        >
                          Net
                        </button>
                        <button
                          onClick={() => {
                            recordStatAndCheckPoint(
                              selectedPlayerId,
                              "Attack",
                              "Blocked",
                            );
                          }}
                          className="bg-gradient-to-b from-amber-500 to-amber-600 text-white py-2.5 sm:py-4 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs border border-white/20 shadow-sm active:scale-95 uppercase tracking-wider flex flex-col items-center justify-center leading-tight"
                        >
                          <span className="text-xs sm:text-sm">BLOCKED</span>
                          <span className="text-[8px] sm:text-[9px] opacity-75">
                            (Play On)
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            recordStatAndCheckPoint(
                              selectedPlayerId,
                              "Attack",
                              "Stuffed",
                            );
                          }}
                          className="bg-gradient-to-b from-red-500 to-red-600 text-white py-2.5 sm:py-4 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs border border-white/20 shadow-sm active:scale-95 uppercase tracking-wider flex flex-col items-center justify-center leading-tight"
                        >
                          <span className="text-xs sm:text-sm">STUFFED</span>
                          <span className="text-[8px] sm:text-[9px] opacity-75">
                            (Point)
                          </span>
                        </button>
                      </div>
                    </div>

                    {!(
                      [0, 4, 5].includes(lineup.indexOf(selectedPlayerId)) ||
                      selectedPlayerId === liberoId
                    ) && (
                      <div className="bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                        <h4 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center">
                          <Shield size={12} className="mr-1 text-slate-500" />{" "}
                          Block
                        </h4>
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                          <button
                            onClick={() =>
                              handleBlockAction(selectedPlayerId, "Stuff")
                            }
                            className="bg-gradient-to-b from-green-500 to-green-600 text-white py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs shadow-sm active:scale-95 flex flex-col items-center justify-center leading-tight"
                          >
                            <span className="text-xs sm:text-sm">STUFF</span>
                            <span className="text-[8px] sm:text-[9px] opacity-75">
                              (Point)
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleBlockAction(selectedPlayerId, "Play On")
                            }
                            className="bg-gradient-to-b from-teal-500 to-teal-600 text-white py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs shadow-sm active:scale-95 flex flex-col items-center justify-center leading-tight"
                          >
                            <span className="text-xs sm:text-sm">BLOCK</span>
                            <span className="text-[8px] sm:text-[9px] opacity-75">
                              (Play On)
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleBlockAction(selectedPlayerId, "Used")
                            }
                            className="bg-gradient-to-b from-slate-400 to-slate-500 text-white py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm shadow-sm active:scale-95"
                          >
                            USED
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                          <button
                            onClick={() =>
                              handleBlockAction(selectedPlayerId, "Late")
                            }
                            className={
                              lateBlockPlayerId === selectedPlayerId
                                ? "bg-amber-400 text-amber-950 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs border border-amber-500 active:scale-95 uppercase tracking-wider transition-colors shadow-inner"
                                : "bg-slate-100 text-slate-600 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs border border-slate-200 active:scale-95 uppercase tracking-wider transition-colors"
                            }
                          >
                            Late
                          </button>
                          <button
                            onClick={() =>
                              handleBlockAction(selectedPlayerId, "Net Viol")
                            }
                            className="bg-slate-100 text-slate-600 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs border border-slate-200 active:scale-95 uppercase tracking-wider"
                          >
                            Net Viol
                          </button>
                        </div>
                      </div>
                    )}
              </div>

              <div className="bg-slate-200 p-2 sm:p-3 flex gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setSubModalVisible(true)}
                    className="flex-1 bg-white text-slate-700 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm uppercase flex justify-center items-center shadow-sm active:scale-95 border border-slate-300"
                  >
                    <Users size={14} className="mr-1 sm:mr-1.5" /> Sub
                  </button>
                  {(lineup.indexOf(selectedPlayerId) === 0 ||
                    lineup.indexOf(selectedPlayerId) === 4 ||
                    lineup.indexOf(selectedPlayerId) === 5 ||
                    selectedPlayerId === liberoId) && (
                    <button
                      onClick={() => handleLiberoSwap(selectedPlayerId)}
                      className="flex-1 bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm uppercase flex justify-center items-center shadow-sm active:scale-95 border border-amber-500/50"
                      title={selectedPlayerId === liberoId ? "Swap Libero Out (Does not count toward sub total)" : "Swap Libero In (Does not count toward sub total)"}
                    >
                      <ArrowRightLeft size={14} className="mr-1 sm:mr-1.5" />{" "}
                      {selectedPlayerId === liberoId ? "Lib Out" : "Lib In"}
                    </button>
                  )}
                </div>
            </div>
          </div>
        )}

        {/* OPPONENT PLAYER ACTION MODAL */}
        {selectedOppId && (
          <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-150 overflow-hidden">
            <div className="bg-slate-100 w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col scale-in-center border border-slate-700/50 max-h-[90vh]">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 sm:p-5 flex justify-between items-center text-white shrink-0">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-600 rounded-full flex items-center justify-center text-xl sm:text-2xl font-black shadow-inner border border-white/20">
                    {selectedOppId}
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black tracking-widest uppercase">
                      {opponentName.substring(0, 10)}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOppId(null)}
                  className="text-white/50 hover:text-white p-1 sm:p-2 rounded-full transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto w-full">
                {rallyPhase === "opp_receive" ? (
                  <div className="bg-amber-50 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-amber-200 relative mb-4">
                    <span className="absolute -top-2.5 right-4 bg-amber-500 text-white text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                      Opp. First Touch
                    </span>
                    <h4 className="text-[10px] sm:text-xs font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center">
                      <Activity size={12} className="mr-1" /> Opp. Serve Receive
                    </h4>
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                      {[3, 2, 1, 0].map((val) => (
                        <button
                          key={val}
                          onClick={() => {
                            recordOppStatAndCheckPoint(
                              selectedOppId,
                              "Pass",
                              "Rating",
                              val,
                            );
                            setSelectedOppId(null);
                          }}
                          className={`p-3 sm:p-4 rounded-lg sm:rounded-xl font-black text-xl sm:text-2xl shadow-sm active:scale-95 transition-all ${
                            val === 3
                              ? "bg-gradient-to-b from-green-400 to-green-500 text-white border border-green-500"
                              : val === 0
                                ? "bg-gradient-to-b from-red-400 to-red-500 text-white border border-red-500"
                                : "bg-white text-slate-700 border border-slate-200"
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-3">
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                      <button
                        onClick={() =>
                          recordOppStatAndCheckPoint(
                            selectedOppId,
                            "Attack",
                            "Kill",
                          )
                        }
                        className="bg-gradient-to-b from-red-500 to-red-600 text-white py-3 sm:py-5 rounded-xl sm:rounded-2xl font-black text-lg sm:text-2xl shadow-sm active:scale-95 flex flex-col items-center border-t border-white/20"
                      >
                        KILL{" "}
                        <span className="text-[8px] sm:text-[9px] opacity-80 uppercase tracking-widest font-bold mt-0.5">
                          (Ends Rally)
                        </span>
                      </button>
                      <button
                        onClick={() =>
                          recordOppStatAndCheckPoint(
                            selectedOppId,
                            "Attack",
                            "Swing",
                          )
                        }
                        className="bg-gradient-to-b from-slate-600 to-slate-700 text-white py-3 sm:py-5 rounded-xl sm:rounded-2xl font-black text-lg sm:text-2xl shadow-sm active:scale-95 border-t border-white/20"
                      >
                        SWING
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                      <button
                        onClick={() =>
                          recordOppStatAndCheckPoint(
                            selectedOppId,
                            "Attack",
                            "Out",
                          )
                        }
                        className="bg-slate-200 text-slate-700 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm shadow-sm active:scale-95 uppercase tracking-widest border border-slate-300"
                      >
                        Attack Out
                      </button>
                      <button
                        onClick={() =>
                          recordOppStatAndCheckPoint(
                            selectedOppId,
                            "Attack",
                            "Net",
                          )
                        }
                        className="bg-slate-200 text-slate-700 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm shadow-sm active:scale-95 uppercase tracking-widest border border-slate-300"
                      >
                        Attack Net
                      </button>
                      <button
                        onClick={() =>
                          recordOppStatAndCheckPoint(
                            selectedOppId,
                            "Attack",
                            "Blocked",
                          )
                        }
                        className="bg-gradient-to-b from-amber-500 to-amber-600 text-white py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs shadow-sm active:scale-95 uppercase tracking-widest border border-white/20 flex flex-col items-center justify-center leading-tight"
                      >
                        <span className="text-xs sm:text-sm">BLOCKED</span>
                        <span className="text-[8px] sm:text-[9px] opacity-75">
                          (Play On)
                        </span>
                      </button>
                      <button
                        onClick={() =>
                          recordOppStatAndCheckPoint(
                            selectedOppId,
                            "Attack",
                            "Stuffed",
                          )
                        }
                        className="bg-gradient-to-b from-red-500 to-red-600 text-white py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs shadow-sm active:scale-95 uppercase tracking-widest border border-white/20 flex flex-col items-center justify-center leading-tight"
                      >
                        <span className="text-xs sm:text-sm">STUFFED</span>
                        <span className="text-[8px] sm:text-[9px] opacity-75">
                          (Point)
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {!rallyPhase.includes("receive") && (
                  <>
                    <div className="bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                      <h4 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center">
                        <Activity size={12} className="mr-1 text-blue-500" />{" "}
                        Passing
                      </h4>
                      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                        {[3, 2, 1, 0].map((val) => (
                          <button
                            key={val}
                            onClick={() => {
                              recordOppStatAndCheckPoint(
                                selectedOppId,
                                "Pass",
                                "Rating",
                                val,
                              );
                              setSelectedOppId(null);
                            }}
                            className={`p-2 sm:p-3 rounded-lg sm:rounded-xl font-black text-lg sm:text-xl shadow-sm active:scale-95 transition-all ${
                              val === 3
                                ? "bg-green-100 text-green-700 border border-green-200"
                                : val === 0
                                  ? "bg-red-100 text-red-700 border border-red-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                      <textarea
                        className="w-full h-12 sm:h-16 p-2 sm:p-3 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl outline-none resize-none font-bold text-xs sm:text-sm text-slate-700 placeholder-slate-400 mb-1.5 sm:mb-2 transition-all focus:ring-2 focus:ring-blue-400"
                        placeholder="Scouting notes..."
                        value={tempNote || oppNotesMem[selectedOppId] || ""}
                        onChange={(e) => setTempNote(e.target.value)}
                        onBlur={() => {
                          if (tempNote) saveOppNote();
                        }}
                      />
                      <div className="flex gap-1.5 sm:gap-2">
                        <button
                          onClick={handleOppSetterSwap}
                          className={`flex-1 text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl shadow-sm uppercase ${
                            oppSetterId === selectedOppId
                              ? "bg-gradient-to-b from-green-500 to-green-600 text-white"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {oppSetterId === selectedOppId
                            ? "Setter"
                            : "Mark Setter"}
                        </button>
                        {oppLiberoId &&
                          (oppLineup.indexOf(selectedOppId) === 0 ||
                            oppLineup.indexOf(selectedOppId) === 4 ||
                            oppLineup.indexOf(selectedOppId) === 5 ||
                            selectedOppId === oppLiberoId) && (
                            <button
                              onClick={() => handleOppLiberoToggle(selectedOppId)}
                              className="flex-1 bg-gradient-to-b from-amber-100 to-amber-200 text-amber-800 text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl border border-amber-300 uppercase shadow-sm"
                            >
                              {selectedOppId === oppLiberoId
                                ? "Lib Out"
                                : "Lib In"}
                            </button>
                          )}
                      </div>
                    </div>

                    <div className="flex gap-1.5 sm:gap-2 items-center bg-slate-200 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl">
                      {subPairs[selectedOppId] ? (
                        <button
                          onClick={handleOppSub}
                          className="flex-1 bg-gradient-to-b from-slate-700 to-slate-800 text-white p-2 sm:p-3 rounded-lg sm:rounded-xl font-black uppercase text-xs sm:text-sm tracking-widest active:scale-95 shadow-sm"
                        >
                          Auto Sub #{subPairs[selectedOppId]} In
                        </button>
                      ) : (
                        <>
                          <input
                            placeholder="New#"
                            value={newOppNumber}
                            onChange={(e) => setNewOppNumber(e.target.value)}
                            className="w-12 sm:w-16 p-2 sm:p-3 bg-white border border-slate-300 rounded-lg sm:rounded-xl outline-none text-center font-black text-slate-800 uppercase text-xs sm:text-base"
                          />
                          <button
                            onClick={handleOppSub}
                            className="flex-1 bg-gradient-to-b from-slate-700 to-slate-800 text-white p-2 sm:p-3 rounded-lg sm:rounded-xl font-black uppercase text-xs sm:text-sm tracking-widest active:scale-95 shadow-sm"
                          >
                            Sub In
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* OVERLAYS (Serve / Rally Winner) */}
        {servePromptVisible && !setWinnerModal && (
          <div
            className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-6 text-white backdrop-blur-xl ${
              serving === "ucc" ? "bg-[#001b5e]/90" : "bg-slate-900/90"
            }`}
          >
            {/* Top Navigation Bar while Waiting for Serve */}
            <div className="absolute top-4 inset-x-4 sm:inset-x-8 flex items-center justify-between z-10">
              <button
                type="button"
                onClick={() => setServePromptVisible(false)}
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-white/20 transition-colors cursor-pointer"
                title="Return to court view"
              >
                <X size={15} />
                <span>Court</span>
              </button>
              <button
                type="button"
                onClick={viewStatsWithCurrentMatch}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 cursor-pointer ring-2 ring-amber-300/60"
                title="Access stats while waiting for serve"
              >
                <Activity size={16} className="text-slate-950 shrink-0" />
                <span>View Stats</span>
              </button>
            </div>
            <div className="text-6xl sm:text-8xl mb-4 sm:mb-6 animate-bounce drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
              <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-2 sm:mb-3 text-center tracking-widest text-shadow-lg uppercase">
              {serving === "ucc" ? "LANCERS TO SERVE" : `${opponentName.trim() || "OPPONENT"} TO SERVE`}
            </h2>

            {/* Live Score Display */}
            <div className="mb-4 flex items-center justify-between gap-4 bg-white/10 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-white/20 shadow-xl min-w-[280px]">
              <div className="text-left">
                <span className="text-[10px] font-black uppercase text-blue-300 block">{effectiveTeamName}</span>
                <span className="text-3xl font-black text-white">{score.ucc}</span>
              </div>
              <div className="text-center px-3 border-x border-white/20">
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest block">SET {currentSetNum}</span>
                <span className="text-[11px] font-black text-white/70">SETS {setsWon.ucc}-{setsWon.opp}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase text-slate-300 block truncate max-w-[110px]">{opponentName || "Opponent"}</span>
                <span className="text-3xl font-black text-white">{score.opp}</span>
              </div>
            </div>

            {/* Quick Serving Team Toggle */}
            <div className="mb-4 flex items-center bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-lg">
              <span className="text-[10px] sm:text-xs font-black uppercase text-white/60 tracking-wider px-2">
                Serving:
              </span>
              <button
                type="button"
                onClick={() => {
                  if (serving !== "ucc") {
                    setServing("ucc");
                    updateSetState({ serving: "ucc" });
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  serving === "ucc"
                    ? "bg-[#0033A0] text-white shadow-md ring-1 ring-white/50"
                    : "text-white/70 hover:text-white"
                }`}
              >
                
                <span>Lancers</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setServing("opp");
                  updateSetState({ serving: "opp" });
                  setServePromptVisible(false);
                  setOppServeReceivePrompt({
                    passerId: null,
                    serverId: oppLineup[0],
                  });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  serving === "opp"
                    ? "bg-slate-700 text-white shadow-md ring-1 ring-white/50"
                    : "text-white/70 hover:text-white"
                }`}
              >
                
                <span className="truncate max-w-[120px]">{opponentName.trim() || "Opponent"}</span>
              </button>
            </div>

            <div className="mb-6 sm:mb-8 text-center bg-white/10 backdrop-blur-md px-4 sm:px-6 py-2 sm:py-3 rounded-2xl sm:rounded-3xl border border-white/20 shadow-xl">
              <span className="text-[10px] sm:text-xs font-bold text-white/50 tracking-widest uppercase block mb-0.5 sm:mb-1">
                Server
              </span>
              <span className="font-black text-white text-xl sm:text-3xl">
                {serving === "ucc"
                  ? `#${
                      appData.roster.find((r) => r.id === lineup[0])?.number
                    } ${appData.roster.find((r) => r.id === lineup[0])?.name}`
                  : oppLineup[0]}
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-sm">
              <button
                onClick={() => handleServeStat("Ace", serving)}
                className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl font-black text-xl sm:text-2xl flex justify-between items-center shadow-lg active:scale-95 border-t border-white/20"
              >
                ACE <CheckCircle2 size={28} />
              </button>
              <button
                onClick={() => handleServeStat("In Play", serving)}
                className="bg-gradient-to-r from-slate-600 to-slate-700 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl font-black text-xl sm:text-2xl flex justify-between items-center shadow-lg active:scale-95 border-t border-white/20"
              >
                IN PLAY <Play fill="currentColor" size={28} />
              </button>
              <button
                onClick={() => handleServeStat("Error", serving)}
                className="bg-gradient-to-r from-red-500 to-red-600 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl font-black text-xl sm:text-2xl flex justify-between items-center shadow-lg active:scale-95 border-t border-white/20"
              >
                ERROR <XCircle size={28} />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={viewStatsWithCurrentMatch}
                className="text-amber-300 hover:text-amber-200 text-xs font-black uppercase tracking-widest flex items-center gap-1.5 underline underline-offset-4 cursor-pointer"
              >
                <Activity size={14} />
                <span>Open Stats Database</span>
              </button>
            </div>
          </div>
        )}

        {serveErrorPrompt && !setWinnerModal && (
          <div className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-4 sm:p-6 text-white backdrop-blur-xl">
            {/* Top Navigation Bar while selecting serve error */}
            <div className="absolute top-4 inset-x-4 sm:inset-x-8 flex items-center justify-between z-10">
              <button
                type="button"
                onClick={() => setServeErrorPrompt(null)}
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-white/20 transition-colors cursor-pointer"
                title="Cancel serve error selection"
              >
                <X size={15} />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={viewStatsWithCurrentMatch}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 cursor-pointer ring-2 ring-amber-300/60"
                title="View live stats"
              >
                <Activity size={16} className="text-slate-950 shrink-0" />
                <span>View Stats</span>
              </button>
            </div>
            {/* Live Score Display */}
            <div className="mb-4 flex items-center justify-between gap-4 bg-white/10 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/20 shadow-xl min-w-[280px]">
              <div className="text-left">
                <span className="text-[10px] font-black uppercase text-blue-300 block">{effectiveTeamName}</span>
                <span className="text-2xl font-black text-white">{score.ucc}</span>
              </div>
              <div className="text-center px-3 border-x border-white/20">
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest block">SET {currentSetNum}</span>
                <span className="text-[10px] font-black text-white/70">SETS {setsWon.ucc}-{setsWon.opp}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase text-slate-300 block truncate max-w-[110px]">{opponentName || "Opponent"}</span>
                <span className="text-2xl font-black text-white">{score.opp}</span>
              </div>
            </div>

            <XCircle
              size={60}
              className="text-red-500 mb-3 sm:mb-4 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)] sm:w-16 sm:h-16"
            />
            <h2 className="text-xl sm:text-3xl font-black mb-6 sm:mb-8 text-center tracking-widest uppercase">
              Select Serve Error Type
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-md">
              <button
                onClick={() => handleServeErrorChoice("Net")}
                className="bg-slate-800 hover:bg-slate-700 text-white py-5 sm:py-7 rounded-2xl font-black text-lg sm:text-2xl shadow-xl active:scale-95 border-b-4 border-slate-950 flex flex-col items-center justify-center transition-all"
              >
                <span>NET</span>
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium">In the Net</span>
              </button>
              <button
                onClick={() => handleServeErrorChoice("Wide")}
                className="bg-amber-600 hover:bg-amber-500 text-white py-5 sm:py-7 rounded-2xl font-black text-lg sm:text-2xl shadow-xl active:scale-95 border-b-4 border-amber-800 flex flex-col items-center justify-center transition-all"
              >
                <span>WIDE</span>
                <span className="text-[10px] sm:text-xs text-amber-200 font-medium">Out Sideline</span>
              </button>
              <button
                onClick={() => handleServeErrorChoice("Long")}
                className="bg-red-600 hover:bg-red-500 text-white py-5 sm:py-7 rounded-2xl font-black text-lg sm:text-2xl shadow-xl active:scale-95 border-b-4 border-red-800 flex flex-col items-center justify-center transition-all"
              >
                <span>LONG</span>
                <span className="text-[10px] sm:text-xs text-red-200 font-medium">Out Baseline</span>
              </button>
              <button
                onClick={() => handleServeErrorChoice("Foot Fault")}
                className="bg-purple-700 hover:bg-purple-600 text-white py-5 sm:py-7 rounded-2xl font-black text-lg sm:text-2xl shadow-xl active:scale-95 border-b-4 border-purple-900 flex flex-col items-center justify-center transition-all"
              >
                <span>FOOT FAULT</span>
                <span className="text-[10px] sm:text-xs text-purple-200 font-medium">Line Violation</span>
              </button>
            </div>
            <button
              onClick={() => setServeErrorPrompt(null)}
              className="mt-6 sm:mt-8 text-slate-400 font-bold text-sm sm:text-base hover:text-white px-6 py-2 rounded-full hover:bg-white/10 uppercase tracking-widest transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {blockAssistPrompt && !setWinnerModal && (
          <div className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-4 sm:p-6 text-white backdrop-blur-xl">
            <Shield
              size={60}
              className="text-green-500 mb-4 sm:mb-6 drop-shadow-[0_0_30px_rgba(34,197,94,0.5)] sm:w-20 sm:h-20"
            />
            <h2 className="text-2xl sm:text-4xl font-black mb-8 sm:mb-10 text-center tracking-widest uppercase">
              Who Assisted?
            </h2>
            <div className="flex flex-col w-full max-w-sm gap-3 sm:gap-4">
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => handleBlockAssistChoice(null)}
                  className="flex-1 bg-gradient-to-b from-green-500 to-green-700 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl shadow-xl active:scale-95 border-t border-green-400/30"
                >
                  SOLO BLOCK
                </button>
              </div>
              <p className="text-center font-bold text-slate-400 mt-2 mb-1 text-xs sm:text-sm uppercase tracking-widest border-b border-white/10 pb-2">
                Or select assist:
              </p>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {lineup
                  .filter(
                    (id, i) =>
                      [1, 2, 3].includes(i) &&
                      id !== blockAssistPrompt.playerId,
                  )
                  .map((id) => {
                    const pInfo = appData.roster.find((p) => p.id === id);
                    if (!pInfo) return null;
                    return (
                      <button
                        key={id}
                        onClick={() => handleBlockAssistChoice(id)}
                        className="bg-slate-800 hover:bg-slate-700 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-sm sm:text-base border border-slate-700 shadow-sm flex flex-col items-center active:scale-95"
                      >
                        <span className="opacity-60 text-[10px] sm:text-xs">
                          #{pInfo.number}
                        </span>
                        <span>{pInfo.name.substring(0, 6)}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <button
              onClick={() => setBlockAssistPrompt(null)}
              className="mt-6 sm:mt-8 text-slate-400 font-bold text-sm sm:text-lg hover:text-white px-6 py-2 sm:py-3 rounded-full hover:bg-white/10 uppercase tracking-widest transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {aceReceiverPrompt && !setWinnerModal && (
          <div className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-3 sm:p-6 text-white backdrop-blur-xl animate-in fade-in zoom-in-95 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-4 sm:p-6 max-w-md w-full shadow-2xl flex flex-col items-center my-auto">
              <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mb-2.5 border border-amber-500/30">
                <Activity size={26} />
              </div>
              <h2 className="text-xl sm:text-2xl font-black mb-1 text-center tracking-wider uppercase">
                {aceReceiverPrompt === "opp" ? "Who Got Aced?" : "Who Passed 0?"}
              </h2>
              <p className="text-slate-400 font-bold mb-3.5 text-center text-xs uppercase tracking-wider">
                {selectedAceReceivers.length > 0
                  ? `Selected: ${selectedAceReceivers.length}/2 player(s)`
                  : "Select up to 2 players (All 7 active numbers)"}
              </p>

              {(() => {
                const receivingTeam = aceReceiverPrompt === "opp" ? "ucc" : "opp";
                const candidates = getSevenReceivers(receivingTeam);
                return (
                  <div className="w-full space-y-2.5 mb-4">
                    {/* Front Row (3 players) */}
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1 flex items-center justify-between px-0.5">
                        <span>Front Row (Net)</span>
                        <span className="text-[9px] text-slate-400 font-bold">
                          Positions 4, 3, 2
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        {candidates.slice(0, 3).map((item) => {
                          const isSelected = selectedAceReceivers.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleAceReceiver(item.id)}
                              className={`p-2 sm:p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all active:scale-95 ${
                                isSelected
                                  ? "bg-amber-500 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-[1.02]"
                                  : item.isLibero
                                  ? "bg-amber-500/15 border-amber-400/40 text-white hover:bg-amber-500/25"
                                  : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                              }`}
                            >
                              <span className="text-2xl sm:text-3xl font-black leading-tight">
                                #{item.number}
                              </span>
                              <span className="text-[11px] font-bold truncate max-w-full">
                                {item.name}
                              </span>
                              <span
                                className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 ${
                                  isSelected
                                    ? "bg-black/20 text-white"
                                    : item.isLibero
                                    ? "bg-amber-400 text-amber-950 font-black"
                                    : "bg-slate-700 text-slate-400"
                                }`}
                              >
                                {item.posLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Back Row (3 players) */}
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-between px-0.5">
                        <span>Back Row</span>
                        <span className="text-[9px] text-slate-500 font-bold">
                          Positions 5, 6, 1
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        {candidates.slice(3, 6).map((item) => {
                          const isSelected = selectedAceReceivers.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleAceReceiver(item.id)}
                              className={`p-2 sm:p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all active:scale-95 ${
                                isSelected
                                  ? "bg-amber-500 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-[1.02]"
                                  : item.isLibero
                                  ? "bg-amber-500/15 border-amber-400/40 text-white hover:bg-amber-500/25"
                                  : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                              }`}
                            >
                              <span className="text-2xl sm:text-3xl font-black leading-tight">
                                #{item.number}
                              </span>
                              <span className="text-[11px] font-bold truncate max-w-full">
                                {item.name}
                              </span>
                              <span
                                className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 ${
                                  isSelected
                                    ? "bg-black/20 text-white"
                                    : item.isLibero
                                    ? "bg-amber-400 text-amber-950 font-black"
                                    : "bg-slate-700 text-slate-400"
                                }`}
                              >
                                {item.posLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 7th Player (Libero / Specialist) */}
                    {candidates[6] && (
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1 flex items-center justify-between px-0.5">
                          <span>
                            {candidates[6].isLibero
                              ? "Libero"
                              : "7th Player / Rotation"}
                          </span>
                          <span className="text-[9px] text-slate-500 font-bold">
                            Defensive Specialist
                          </span>
                        </div>
                        {(() => {
                          const item = candidates[6];
                          const isSelected = selectedAceReceivers.includes(item.id);
                          return (
                            <button
                              type="button"
                              onClick={() => toggleAceReceiver(item.id)}
                              className={`w-full p-2 sm:p-2.5 rounded-xl border flex items-center justify-between px-3.5 transition-all active:scale-95 ${
                                isSelected
                                  ? "bg-amber-500 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                                  : item.isLibero
                                  ? "bg-amber-500/15 border-amber-400/50 text-white hover:bg-amber-500/25"
                                  : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <span className="text-2xl sm:text-3xl font-black leading-tight">
                                  #{item.number}
                                </span>
                                <div className="text-left">
                                  <span className="text-xs sm:text-sm font-bold block leading-snug">
                                    {item.name}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block">
                                    {item.posLabel}
                                  </span>
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                  isSelected
                                    ? "bg-black/20 text-white"
                                    : item.isLibero
                                    ? "bg-amber-400 text-amber-950 font-black"
                                    : "bg-slate-700 text-slate-400"
                                }`}
                              >
                                {item.isLibero ? "LIBERO" : item.posLabel}
                              </span>
                            </button>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex flex-col w-full gap-2">
                <button
                  onClick={confirmAceReceivers}
                  disabled={selectedAceReceivers.length === 0}
                  className="bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-500 text-white py-3 rounded-xl font-black text-sm sm:text-base border-t border-white/20 shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-2"
                >
                  <span>CONFIRM SELECTION</span>
                  {selectedAceReceivers.length > 0 && (
                    <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">
                      {selectedAceReceivers.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={skipAceReceivers}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-xl font-bold text-xs sm:text-sm border border-slate-600 shadow-sm active:scale-95 transition-colors"
                >
                  SKIP / UNKNOWN RECEIVER
                </button>
                <button
                  onClick={() => {
                    setAceReceiverPrompt(null);
                    setPendingAceData(null);
                    setSelectedAceReceivers([]);
                  }}
                  className="text-slate-400 font-bold text-xs hover:text-white py-1.5 uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {endRallyVisible && !setWinnerModal && (
          <div className="fixed inset-0 bg-slate-900/95 z-40 flex flex-col items-center justify-center p-4 sm:p-6 text-white backdrop-blur-xl">
            {/* Top Navigation Bar */}
            <div className="absolute top-4 inset-x-4 sm:inset-x-8 flex items-center justify-between z-10">
              <button
                type="button"
                onClick={() => setEndRallyVisible(false)}
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-white/20 transition-colors cursor-pointer"
                title="Return to court"
              >
                <X size={15} />
                <span>Court</span>
              </button>
              <button
                type="button"
                onClick={viewStatsWithCurrentMatch}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 cursor-pointer ring-2 ring-amber-300/60"
                title="View live stats"
              >
                <Activity size={16} className="text-slate-950 shrink-0" />
                <span>View Stats</span>
              </button>
            </div>
            <div className="text-6xl sm:text-8xl mb-4 sm:mb-6 animate-pulse drop-shadow-[0_0_30px_rgba(251,191,36,0.4)]">
              Trophy
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-8 sm:mb-10 text-center tracking-widest uppercase">
              Who Scored?
            </h2>

            <div className="flex w-full max-w-sm gap-3 sm:gap-4">
              <button
                onClick={() => handlePoint("ucc")}
                className="flex-1 bg-[#0033A0] text-white py-6 sm:py-8 rounded-2xl sm:rounded-3xl font-black text-xl sm:text-3xl flex flex-col items-center shadow-[0_15px_30px_rgba(0,51,160,0.5)] active:scale-95 border-t border-white/20"
              >
                <Shield size={40} className="mb-2 opacity-80 sm:w-12 sm:h-12" />
                Lancers
              </button>
              <button
                onClick={() => handlePoint("opp")}
                className="flex-1 bg-slate-700 text-white py-6 sm:py-8 rounded-2xl sm:rounded-3xl font-black text-xl sm:text-3xl flex flex-col items-center shadow-[0_15px_30px_rgba(0,0,0,0.5)] active:scale-95 border-t border-white/10"
              >
                <Users size={40} className="mb-2 opacity-80 sm:w-12 sm:h-12" />
                {opponentName.substring(0, 6)}
              </button>
            </div>
            <button
              onClick={() => setEndRallyVisible(false)}
              className="mt-6 sm:mt-8 text-slate-400 font-bold text-sm sm:text-lg hover:text-white px-6 py-2 sm:py-3 rounded-full hover:bg-white/10 uppercase tracking-widest transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {setWinnerModal && (
          <div className="fixed inset-0 bg-slate-900/95 z-[60] flex flex-col items-center justify-center p-4 sm:p-6 text-white backdrop-blur-2xl">
            {/* Top Navigation Bar */}
            <div className="absolute top-4 inset-x-4 sm:inset-x-8 flex items-center justify-between z-10">
              <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-400/20 px-3 py-1.5 rounded-full border border-amber-400/30">
                Set Finished
              </span>
              <button
                type="button"
                onClick={viewStatsWithCurrentMatch}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 cursor-pointer ring-2 ring-amber-300/60"
                title="View full set & match stats"
              >
                <Activity size={16} className="text-slate-950 shrink-0" />
                <span>View Set Stats</span>
              </button>
            </div>
            <Trophy
              size={80}
              className={`mb-3 sm:mb-4 drop-shadow-[0_0_50px_rgba(255,255,255,0.2)] sm:w-[100px] sm:h-[100px] ${
                setWinnerModal === "ucc" ? "text-amber-400" : "text-slate-400"
              }`}
            />
            <h2 className="text-3xl sm:text-5xl font-black mt-2 mb-6 sm:mb-8 tracking-[0.2em] uppercase text-center">
              Set {currentSetNum} Final
            </h2>

            <div className="flex gap-3 sm:gap-6 items-center bg-black/40 p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] border border-white/10 mb-8 sm:mb-10 shadow-inner w-full max-w-sm justify-center">
              <div className="text-center">
                <p className="text-[10px] sm:text-xs font-black text-blue-300/70 uppercase tracking-widest mb-1 truncate max-w-[120px]">
                  {effectiveTeamName}
                </p>
                <p className="text-5xl sm:text-6xl font-black text-white">
                  {score.ucc}
                </p>
              </div>
              <div className="text-3xl sm:text-4xl text-white/20 font-black px-1 sm:px-2">
                -
              </div>
              <div className="text-center">
                <p className="text-[10px] sm:text-xs font-black text-slate-400/70 uppercase tracking-widest mb-1 truncate max-w-[120px]">
                  {opponentName || "Opponent"}
                </p>
                <p className="text-5xl sm:text-6xl font-black text-white">
                  {score.opp}
                </p>
              </div>
            </div>

            {/* Serving Team Selector for Next Set */}
            <div className="w-full max-w-sm bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-white/15 mb-4 sm:mb-6 shadow-lg">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-amber-300 block text-center mb-2.5">
                First Serve for Set {currentSetNum + 1}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNextSetServing("ucc")}
                  className={`py-3 px-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    nextSetServing === "ucc"
                      ? "bg-[#0033A0] text-white ring-2 ring-amber-400 shadow-[0_0_15px_rgba(0,51,160,0.5)] scale-[1.02]"
                      : "bg-white/10 text-white/70 hover:bg-white/20 border border-white/10"
                  }`}
                >
                  <span className="text-base"><span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span></span>
                  <span className="truncate max-w-[110px]">{effectiveTeamName}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNextSetServing("opp")}
                  className={`py-3 px-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    nextSetServing === "opp"
                      ? "bg-slate-700 text-white ring-2 ring-amber-400 shadow-[0_0_15px_rgba(51,65,85,0.5)] scale-[1.02]"
                      : "bg-white/10 text-white/70 hover:bg-white/20 border border-white/10"
                  }`}
                >
                  <span className="text-base"><span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span></span>
                  <span className="truncate max-w-[110px]">{opponentName.trim() || "Opponent"}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 w-full max-w-sm">
              <button
                onClick={() => handleSetFinishContinue(true, nextSetServing, "ucc")}
                className="bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white w-full py-4 sm:py-4.5 rounded-xl sm:rounded-2xl font-black text-sm sm:text-base shadow-[0_10px_20px_rgba(37,99,235,0.3)] active:scale-95 border-t border-white/20 uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              >
                <Users size={18} />
                Adjust Lineups for Set {currentSetNum + 1}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSetFinishContinue(true, nextSetServing, "opp")}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-300 py-3 px-2 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-wider border border-white/10 shadow-sm active:scale-95 flex items-center justify-center gap-1.5 transition-all"
                >
                  <ArrowRightLeft size={13} />
                  <span className="truncate">Opponent Lineup</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFinishContinue(false, nextSetServing)}
                  className="bg-gradient-to-b from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white py-3 px-2 rounded-xl sm:rounded-2xl font-bold text-xs uppercase tracking-wider border-t border-white/20 shadow-sm active:scale-95 transition-all truncate"
                >
                  Quick Start
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                <button
                  type="button"
                  onClick={() =>
                    setStatCorrectionConfig({
                      isOpen: true,
                      initialMatchId: activeMatch?.id,
                      initialSetId: activeSetId,
                    })
                  }
                  className="bg-indigo-600/90 hover:bg-indigo-500 text-white py-2.5 px-2 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-wider border border-indigo-400/30 shadow-sm active:scale-95 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Review and edit recorded stats for this set"
                >
                  <Edit3 size={13} className="text-amber-300" />
                  <span className="truncate">Edit Set Stats</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTeamNameModalConfig({
                      isOpen: true,
                      ourTeamName: effectiveTeamName,
                      opponentTeamName,
                      targetMatchId: activeMatch?.id,
                      showOpponentEdit: true,
                    })
                  }
                  className="bg-slate-800/90 hover:bg-slate-700 text-slate-200 py-2.5 px-2 rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-wider border border-white/10 shadow-sm active:scale-95 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Adjust team names"
                >
                  <Shield size={13} className="text-blue-400" />
                  <span className="truncate">Adjust Names</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OPPONENT SERVE RECEIVE PROMPT (WHO PASSED & RATING / ACE / ERROR) */}
        {oppServeReceivePrompt && !setWinnerModal && (
          <div className="fixed inset-0 bg-slate-900/85 z-[110] flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-150">
            <div className="bg-white rounded-[2rem] p-4 sm:p-6 max-w-md w-full shadow-2xl flex flex-col items-center border border-slate-200">
              {/* Always Visible Score Banner */}
              <div className="w-full bg-slate-900 text-white rounded-2xl p-3 mb-3 flex items-center justify-between shadow-md">
                <div className="text-left">
                  <span className="text-[10px] font-black uppercase text-blue-400 block">{effectiveTeamName}</span>
                  <span className="text-2xl font-black">{score.ucc}</span>
                </div>
                <div className="text-center px-2">
                  <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest block">SET {currentSetNum}</span>
                  <span className="text-[10px] font-black text-white/70">SETS {setsWon.ucc}-{setsWon.opp}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-slate-300 block truncate max-w-[100px]">{opponentName || "Opp"}</span>
                  <span className="text-2xl font-black">{score.opp}</span>
                </div>
              </div>

              {/* Title and Server Indicator + Stats & Dismiss */}
              <div className="w-full flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-widest">
                    Opponent Serve
                  </h2>
                  <span className="text-[10px] font-black uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200 shadow-xs">
                    #{oppServeReceivePrompt.serverId || oppLineup[0] || "?"} Serving
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={viewStatsWithCurrentMatch}
                    className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-lg text-xs uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                    title="View match stats"
                  >
                    <Activity size={13} />
                    <span>Stats</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOppServeReceivePrompt(null)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                    title="Dismiss"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <p className="text-xs sm:text-sm font-bold text-slate-500 mb-3 text-center">
                {oppServeReceivePrompt.selectingAce
                  ? "Who was aced? Tap player to log reception error (0 pass):"
                  : oppServeReceivePrompt.passerId
                  ? "Record pass rating for this serve:"
                  : "Who passed the ball, or did the serve end?"}
              </p>

              {oppServeReceivePrompt.selectingAce ? (
                /* WHO GOT ACED SELECTION */
                <div className="w-full space-y-3">
                  <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase text-emerald-900 tracking-wider">
                          Opponent Ace (+1 Pt Opp)
                        </div>
                        <div className="text-[10px] font-bold text-emerald-700">
                          Select receiver who got aced:
                        </div>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const uccCandidates = getSevenReceivers("ucc");
                    const sortedReceivers = [...uccCandidates].sort(sortPlayersByNumberThenAlpha);

                    return (
                      <div className="space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-between px-1">
                          <span>All Passers (Sorted by Number)</span>
                          <span className="text-[9px] text-slate-500 font-bold">Tap who got aced</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {sortedReceivers.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                const sId = oppServeReceivePrompt.serverId || oppLineup[0] || "Opponent";
                                logStat(item.id, "Pass", "Rating", 0, false);
                                logStat(sId, "Serve", "Ace", 1, true);
                                handlePoint("opp", true);
                                setOppServeReceivePrompt(null);
                              }}
                              className={`p-2.5 rounded-xl border-2 flex flex-col items-center justify-center transition-all active:scale-95 shadow-xs cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 ${
                                item.isLibero
                                  ? "bg-amber-50/80 border-amber-300 text-amber-900"
                                  : "bg-slate-50 border-slate-200 text-slate-800"
                              }`}
                            >
                              <span className="text-xl sm:text-2xl font-black leading-tight text-emerald-700">
                                #{item.number}
                              </span>
                              <span className="text-[11px] font-bold truncate max-w-full">
                                {item.name}
                              </span>
                              <span className="text-[8px] font-black uppercase mt-0.5 text-slate-400">
                                {item.isLibero ? "Libero" : item.posLabel}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const sId = oppServeReceivePrompt.serverId || oppLineup[0] || "Opponent";
                        logStat(sId, "Serve", "Ace", 1, true);
                        handlePoint("opp", true);
                        setOppServeReceivePrompt(null);
                      }}
                      className="flex-1 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl font-black text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
                    >
                      Unassigned Ace (Nobody Touched)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOppServeReceivePrompt((prev) =>
                          prev ? { ...prev, selectingAce: false } : null,
                        )
                      }
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : !oppServeReceivePrompt.passerId ? (
                <div className="w-full space-y-2.5">
                  {/* Quick outcome buttons: ERROR (RED) and ACE (GREEN) */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Error button: RED */}
                    <button
                      type="button"
                      onClick={() => {
                        const sId = oppServeReceivePrompt.serverId || oppLineup[0] || "Opponent";
                        logStat(sId, "Serve", "Miss", 1, true);
                        handlePoint("ucc");
                        setOppServeReceivePrompt(null);
                      }}
                      className="py-3 px-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-red-500/40"
                      title="Opponent Missed Serve (Net/Out) -> Point for Lancers"
                    >
                      <XCircle size={18} />
                      <span>Error (+Pt)</span>
                    </button>

                    {/* Ace button: GREEN */}
                    <button
                      type="button"
                      onClick={() => {
                        setOppServeReceivePrompt((prev) => ({
                          ...(prev || { passerId: null }),
                          selectingAce: true,
                        }));
                      }}
                      className="py-3 px-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-green-500/40"
                      title="Opponent Aced UCC -> Choose who got aced -> Point for Opponent"
                    >
                      <CheckCircle2 size={18} />
                      <span>Ace (+Pt)</span>
                    </button>
                  </div>

                  {(() => {
                    const uccCandidates = getSevenReceivers("ucc");
                    const sortedReceivers = [...uccCandidates].sort(sortPlayersByNumberThenAlpha);

                    return (
                      <div className="space-y-2 pt-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-between px-1">
                          <span>Passers (Sorted by Number)</span>
                          <span className="text-[9px] text-slate-500 font-bold">7 Active Players</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {sortedReceivers.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                setOppServeReceivePrompt((prev) => ({
                                  ...(prev || {}),
                                  passerId: item.id,
                                  selectingAce: false,
                                }))
                              }
                              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all active:scale-95 shadow-xs cursor-pointer ${
                                item.isLibero
                                  ? "bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-900 ring-1 ring-amber-300/50"
                                  : "bg-slate-50 border-slate-200 hover:bg-blue-50 hover:border-blue-300 text-slate-800"
                              }`}
                            >
                              <span className="text-xl sm:text-2xl font-black leading-tight">
                                #{item.number}
                              </span>
                              <span className="text-[11px] font-bold truncate max-w-full">
                                {item.name}
                              </span>
                              <span className="text-[8px] font-black uppercase mt-0.5 text-slate-400">
                                {item.isLibero ? "Libero" : item.posLabel}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOppServeReceivePrompt(null);
                        changeRallyPhase("play");
                      }}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Skip / Play On
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-3">
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-black text-[#0033A0]">
                        #
                        {
                          appData.roster.find(
                            (r) => r.id === oppServeReceivePrompt.passerId,
                          )?.number
                        }
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {
                          appData.roster.find(
                            (r) => r.id === oppServeReceivePrompt.passerId,
                          )?.name
                        }
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setOppServeReceivePrompt((prev) => ({
                          ...(prev || {}),
                          passerId: null,
                          selectingAce: false,
                        }))
                      }
                      className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      Change Passer
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { val: 3, label: "Perfect (3)", desc: "All options", color: "from-green-500 to-green-600" },
                      { val: 2, label: "Good (2)", desc: "Medium", color: "from-teal-500 to-teal-600" },
                      { val: 1, label: "Poor (1)", desc: "Out of sys", color: "from-amber-500 to-amber-600" },
                      { val: 0, label: "Aced (0)", desc: "Aced / Err", color: "from-red-500 to-red-600" },
                    ].map(({ val, label, desc, color }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          if (val === 0) {
                            // Recording rating 0 also logs that this receiver got aced and awards point to opponent
                            const sId = oppServeReceivePrompt.serverId || oppLineup[0] || "Opponent";
                            logStat(
                              oppServeReceivePrompt.passerId,
                              "Pass",
                              "Rating",
                              0,
                              false,
                            );
                            logStat(sId, "Serve", "Ace", 1, true);
                            handlePoint("opp", true);
                            setOppServeReceivePrompt(null);
                          } else {
                            recordStatAndCheckPoint(
                              oppServeReceivePrompt.passerId,
                              "Pass",
                              "Rating",
                              val,
                            );
                            setOppServeReceivePrompt(null);
                          }
                        }}
                        className={`bg-gradient-to-b ${color} text-white p-3 rounded-xl font-black shadow-sm active:scale-95 flex flex-col items-center justify-center transition-all cursor-pointer`}
                      >
                        <span className="text-2xl sm:text-3xl leading-none">{val}</span>
                        <span className="text-[9px] uppercase tracking-wider opacity-90 mt-1 text-center font-bold">
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOppServeReceivePrompt(null);
                        changeRallyPhase("play");
                      }}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Skip Pass Rating (Play On)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BETWEEN SETS LINEUP SWITCHER MODAL */}
        {betweenSetsModal && (
          <div className="fixed inset-0 bg-slate-900/90 z-[115] flex items-center justify-center p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
            <div className="bg-white rounded-[2rem] p-4 sm:p-6 max-w-xl w-full shadow-2xl flex flex-col my-auto border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 bg-blue-50 text-[#0033A0] rounded-xl flex items-center justify-center">
                    <Users size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-wider">
                      Set {betweenSetsModal.nextSetNum} Lineup Setup
                    </h2>
                    <p className="text-[11px] font-bold text-slate-500">
                      Match: Lancers {betweenSetsModal.newSetsWon.ucc} - {betweenSetsModal.newSetsWon.opp} {opponentName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={viewStatsWithCurrentMatch}
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    title="View match and player stats before next set"
                  >
                    <Activity size={13} />
                    <span>View Stats</span>
                  </button>
                  <span className="text-[10px] uppercase font-black tracking-wider bg-blue-50 text-[#0033A0] px-2.5 py-1 rounded-full border border-blue-200">
                    Switch Lineup
                  </span>
                </div>
              </div>

              {/* Lineup Switcher Tabs: Lancers vs Opponent */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-4 border border-slate-200">
                <button
                  type="button"
                  onClick={() =>
                    setBetweenSetsModal((prev) =>
                      prev ? { ...prev, activeTab: "ucc" } : null,
                    )
                  }
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                    (betweenSetsModal.activeTab || "ucc") === "ucc"
                      ? "bg-[#0033A0] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  
                  <span>Lancers Lineup</span>
                  <span className="text-[10px] opacity-80 font-bold ml-1">
                    ({betweenSetsModal.tempLineup.filter(Boolean).length}/6)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setBetweenSetsModal((prev) =>
                      prev ? { ...prev, activeTab: "opp" } : null,
                    )
                  }
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                    betweenSetsModal.activeTab === "opp"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Shield size={12} className="inline text-amber-600" />
                  <span className="truncate max-w-[120px]">
                    {opponentName.trim() || "Opponent"}
                  </span>
                  <span className="text-[10px] opacity-80 font-bold ml-1">
                    {(betweenSetsModal.tempOppLineup || []).filter(
                      (x) => x && !x.startsWith("O"),
                    ).length > 0
                      ? `${(betweenSetsModal.tempOppLineup || []).filter((x) => x && !x.startsWith("O")).length} set`
                      : "Default"}
                  </span>
                </button>
              </div>

              {(betweenSetsModal.activeTab || "ucc") === "ucc" ? (
                <>
                  {/* Preset Loader & Libero */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        Load Lineup Preset
                      </label>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const name = e.target.value;
                          if (name && appData.savedLineups?.[name]) {
                            const p = appData.savedLineups[name];
                            setBetweenSetsModal((prev) => ({
                              ...prev,
                              tempLineup: p.lineup || [null, null, null, null, null, null],
                              tempLibero: p.liberoId || "",
                            }));
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                      >
                        <option value="">Choose a preset...</option>
                        {Object.keys(appData.savedLineups || {}).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 flex items-center justify-between">
                        <span>Libero</span>
                        <Shield size={12} className="text-[#0033A0]" />
                      </label>
                      <select
                        value={betweenSetsModal.tempLibero}
                        onChange={(e) =>
                          setBetweenSetsModal((prev) => ({
                            ...prev,
                            tempLibero: e.target.value,
                          }))
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                      >
                        <option value="">No Libero Designated</option>
                        {sortedRoster.map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.number} {p.name} {p.position ? `(${p.position})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Court Lineup Grid */}
                  <div className="bg-slate-900 rounded-2xl p-3 sm:p-4 text-white mb-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[10px] font-black tracking-widest uppercase text-amber-400">
                        Front Row (Net Side)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setBetweenSetsModal((prev) => {
                            const cur = [...prev.tempLineup];
                            const rotated = [cur[1], cur[2], cur[3], cur[4], cur[5], cur[0]];
                            return { ...prev, tempLineup: rotated };
                          });
                        }}
                        className="text-[9px] font-black uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg border border-white/20 flex items-center gap-1 transition-colors"
                      >
                        <ArrowRightLeft size={10} /> Rotate Clockwise
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-2.5">
                      {[
                        { idx: 3, label: "Pos 4 • LF (Left Front)" },
                        { idx: 2, label: "Pos 3 • MF (Middle Front)" },
                        { idx: 1, label: "Pos 2 • RF (Right Front)" },
                      ].map(({ idx, label }) => (
                        <div key={idx} className="bg-white/10 rounded-xl p-2 border border-white/10">
                          <div className="text-[9px] font-black text-blue-300 uppercase tracking-wider mb-1 truncate">
                            {label}
                          </div>
                          <select
                            value={betweenSetsModal.tempLineup[idx] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBetweenSetsModal((prev) => {
                                const nextL = [...prev.tempLineup];
                                nextL[idx] = val;
                                return { ...prev, tempLineup: nextL };
                              });
                            }}
                            className="w-full bg-slate-800 text-white border border-white/20 rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                          >
                            <option value="">Select Player...</option>
                            {sortedRoster.map((p) => (
                              <option key={p.id} value={p.id}>
                                #{p.number} {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    <div className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2">
                      Back Row
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { idx: 4, label: "Pos 5 • LB (Left Back)" },
                        { idx: 5, label: "Pos 6 • MB (Middle Back)" },
                        { idx: 0, label: "Pos 1 • RB (Server)" },
                      ].map(({ idx, label }) => (
                        <div
                          key={idx}
                          className={`rounded-xl p-2 border ${
                            idx === 0
                              ? "bg-amber-500/15 border-amber-400/40"
                              : "bg-white/10 border-white/10"
                          }`}
                        >
                          <div className="text-[9px] font-black text-amber-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                            <span className="truncate">{label}</span>
                            {idx === 0 && <span className="text-[9px] font-black uppercase text-amber-400">Serve</span>}
                          </div>
                          <select
                            value={betweenSetsModal.tempLineup[idx] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBetweenSetsModal((prev) => {
                                const nextL = [...prev.tempLineup];
                                nextL[idx] = val;
                                return { ...prev, tempLineup: nextL };
                              });
                            }}
                            className="w-full bg-slate-800 text-white border border-white/20 rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                          >
                            <option value="">Select Player...</option>
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
                </>
              ) : (
                <>
                  {/* Opponent Libero & Lineup Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 flex items-center justify-between">
                        <span>Opponent Libero #</span>
                        <Shield size={12} className="text-slate-700" />
                      </label>
                      <input
                        type="text"
                        placeholder="Jersey # (e.g. 5)"
                        value={betweenSetsModal.tempOppLibero || ""}
                        onChange={(e) =>
                          setBetweenSetsModal((prev) =>
                            prev ? { ...prev, tempOppLibero: e.target.value } : null,
                          )
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none uppercase"
                      />
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        Opponent Lineup Actions
                      </label>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setBetweenSetsModal((prev) => {
                              if (!prev) return null;
                              const cur = [...prev.tempOppLineup];
                              const rotated = [cur[1], cur[2], cur[3], cur[4], cur[5], cur[0]];
                              return { ...prev, tempOppLineup: rotated };
                            });
                          }}
                          className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-center gap-1 transition-all active:scale-95"
                          title="Rotate opponent rotation 1 step clockwise"
                        >
                          <ArrowRightLeft size={11} /> Rotate CW
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const defaultL =
                              appData.opponents?.[opponentName]?.defaultLineup || [
                                "O1",
                                "O2",
                                "O3",
                                "O4",
                                "O5",
                                "O6",
                              ];
                            setBetweenSetsModal((prev) =>
                              prev ? { ...prev, tempOppLineup: [...defaultL] } : null,
                            );
                          }}
                          className="py-1.5 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-600 transition-all active:scale-95"
                          title="Reset to default lineup"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBetweenSetsModal((prev) =>
                              prev
                                ? { ...prev, tempOppLineup: ["", "", "", "", "", ""] }
                                : null,
                            );
                          }}
                          className="py-1.5 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-red-500 transition-all active:scale-95"
                          title="Clear all opponent positions"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Opponent Court Lineup Grid */}
                  <div className="bg-slate-900 rounded-2xl p-3 sm:p-4 text-white mb-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[10px] font-black tracking-widest uppercase text-amber-400">
                        Front Row (Net Side)
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        LF • MF • RF
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-2.5">
                      {[
                        { idx: 3, label: "Pos 4 • LF" },
                        { idx: 2, label: "Pos 3 • MF" },
                        { idx: 1, label: "Pos 2 • RF" },
                      ].map(({ idx, label }) => {
                        const currentVal = betweenSetsModal.tempOppLineup[idx] || "";
                        const hasNote =
                          currentVal &&
                          oppNotesMem[currentVal] &&
                          oppNotesMem[currentVal].trim() !== "";
                        return (
                          <div
                            key={idx}
                            className="bg-white/10 rounded-xl p-2 border border-white/10 flex flex-col"
                          >
                            <div className="text-[9px] font-black text-amber-300 uppercase tracking-wider mb-1 truncate flex items-center justify-between">
                              <span>{label}</span>
                              {hasNote && <FileText size={10} className="text-amber-300" />}
                            </div>
                            <input
                              type="text"
                              placeholder={`Opp ${idx === 0 ? 1 : idx === 1 ? 2 : idx === 2 ? 3 : idx === 3 ? 4 : idx === 4 ? 5 : 6}`}
                              value={currentVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBetweenSetsModal((prev) => {
                                  if (!prev) return null;
                                  const nextL = [...prev.tempOppLineup];
                                  nextL[idx] = val;
                                  return { ...prev, tempOppLineup: nextL };
                                });
                              }}
                              className="w-full bg-slate-800 text-white border border-white/20 rounded-lg px-2 py-1.5 text-sm font-black text-center uppercase outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2">
                      Back Row
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { idx: 4, label: "Pos 5 • LB" },
                        { idx: 5, label: "Pos 6 • MB" },
                        { idx: 0, label: "Pos 1 • RB (Server)" },
                      ].map(({ idx, label }) => {
                        const currentVal = betweenSetsModal.tempOppLineup[idx] || "";
                        const isServer =
                          idx === 0 && betweenSetsModal.tempServing === "opp";
                        const hasNote =
                          currentVal &&
                          oppNotesMem[currentVal] &&
                          oppNotesMem[currentVal].trim() !== "";
                        return (
                          <div
                            key={idx}
                            className={`rounded-xl p-2 border flex flex-col ${
                              isServer
                                ? "bg-amber-500/15 border-amber-400/40"
                                : "bg-white/10 border-white/10"
                            }`}
                          >
                            <div className="text-[9px] font-black text-amber-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                              <span className="truncate">{label}</span>
                              <div className="flex items-center gap-1">
                                {hasNote && <FileText size={10} className="text-amber-300" />}
                                {idx === 0 && <span className="text-[9px] font-black uppercase text-amber-400">Serve</span>}
                              </div>
                            </div>
                            <input
                              type="text"
                              placeholder={`Opp ${idx === 0 ? 1 : idx === 4 ? 5 : 6}`}
                              value={currentVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBetweenSetsModal((prev) => {
                                  if (!prev) return null;
                                  const nextL = [...prev.tempOppLineup];
                                  nextL[idx] = val;
                                  return { ...prev, tempOppLineup: nextL };
                                });
                              }}
                              className={`w-full bg-slate-800 text-white border rounded-lg px-2 py-1.5 text-sm font-black text-center uppercase outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 ${
                                isServer ? "border-amber-400/50" : "border-white/20"
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Known Opponent Numbers Chips */}
                    {(() => {
                      const knownNums = Array.from(
                        new Set([
                          ...(betweenSetsModal.tempOppLineup || []),
                          ...(oppLineup || []),
                          ...((opponentName &&
                            appData.opponents?.[opponentName]?.defaultLineup) ||
                            []),
                          ...Object.keys(oppNotesMem || {}),
                        ]),
                      )
                        .map((n) => String(n).trim())
                        .filter((n) => n && n !== "" && !n.startsWith("O"));
                      if (knownNums.length === 0) return null;
                      return (
                        <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center gap-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                            Known Numbers:
                          </span>
                          {knownNums.map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => {
                                setBetweenSetsModal((prev) => {
                                  if (!prev) return null;
                                  const nextL = [...prev.tempOppLineup];
                                  const emptyIdx = nextL.findIndex(
                                    (v) => !v || v.trim() === "" || v.startsWith("O"),
                                  );
                                  if (emptyIdx !== -1) {
                                    nextL[emptyIdx] = num;
                                  }
                                  return { ...prev, tempOppLineup: nextL };
                                });
                              }}
                              className="px-2 py-0.5 rounded-md bg-white/15 hover:bg-amber-400 hover:text-slate-900 text-white font-black text-[10px] uppercase border border-white/10 transition-colors"
                              title={`Click to place #${num} into next open slot`}
                            >
                              #{num}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}

              {/* First Serve Option */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-700">
                  First Serve for Set {betweenSetsModal.nextSetNum}:
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setBetweenSetsModal((prev) => ({
                        ...prev,
                        tempServing: "ucc",
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      betweenSetsModal.tempServing === "ucc"
                        ? "bg-[#0033A0] text-white shadow-sm ring-2 ring-[#0033A0]/30"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    
                    <span>Lancers</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBetweenSetsModal((prev) => ({
                        ...prev,
                        tempServing: "opp",
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      betweenSetsModal.tempServing === "opp"
                        ? "bg-slate-800 text-white shadow-sm ring-2 ring-slate-800/30"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    
                    <span className="truncate max-w-[120px]">{opponentName.trim() || "Opponent"}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const filledCount = betweenSetsModal.tempLineup.filter(Boolean).length;
                    if (filledCount < 6) {
                      alert("Please select players for all 6 Lancers court positions before starting the set.");
                      setBetweenSetsModal((prev) =>
                        prev ? { ...prev, activeTab: "ucc" } : null,
                      );
                      return;
                    }
                    const finalOppLineup = betweenSetsModal.tempOppLineup.map((val, idx) =>
                      val && val.trim() !== "" ? val.trim() : `O${idx + 1}`,
                    );

                    // Persist opponent lineup & libero in DB for memory
                    if (opponentName && opponentName.trim()) {
                      const safeOppName = opponentName.trim().replace(/\//g, "-");
                      if (isFirebaseAvailable && user) {
                        setDoc(
                          doc(db, `${publicPath}/${activeTeam}/opponents/${safeOppName}`),
                          {
                            defaultLineup: finalOppLineup,
                            liberoId: betweenSetsModal.tempOppLibero || "",
                            updatedAt: serverTimestamp(),
                          },
                          { merge: true },
                        ).catch(() => {});
                      } else {
                        const existingOpp = appData.opponents?.[safeOppName] || {};
                        writeLocalDb({
                          ...appData,
                          opponents: {
                            ...appData.opponents,
                            [safeOppName]: {
                              ...existingOpp,
                              teamName: opponentName,
                              defaultLineup: finalOppLineup,
                              liberoId: betweenSetsModal.tempOppLibero || "",
                            },
                          },
                        });
                      }
                    }

                    executeStartNextSet({
                      nextSetNum: betweenSetsModal.nextSetNum,
                      selectedLineup: betweenSetsModal.tempLineup,
                      selectedLibero: betweenSetsModal.tempLibero,
                      selectedServing: betweenSetsModal.tempServing,
                      selectedOppLineup: finalOppLineup,
                      selectedOppLibero: betweenSetsModal.tempOppLibero,
                    });
                  }}
                  className="w-full py-4 bg-gradient-to-b from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white rounded-xl sm:rounded-2xl font-black text-base uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={20} />
                  Confirm Lineups & Start Set {betweenSetsModal.nextSetNum}
                </button>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <input
                    type="text"
                    placeholder="Save this lineup as preset name..."
                    value={betweenSetsPresetName}
                    onChange={(e) => setBetweenSetsPresetName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!betweenSetsPresetName.trim()) {
                        alert("Please enter a name for this preset");
                        return;
                      }
                      const updated = {
                        ...appData.savedLineups,
                        [betweenSetsPresetName.trim()]: {
                          lineup: betweenSetsModal.tempLineup,
                          liberoId: betweenSetsModal.tempLibero,
                        },
                      };
                      if (isFirebaseAvailable && user) {
                        await setDoc(
                          doc(db, `${publicPath}/${activeTeam}/settings/core`),
                          { savedLineups: updated },
                          { merge: true },
                        );
                      } else if (!isFirebaseAvailable) {
                        writeLocalDb({ ...appData, savedLineups: updated });
                      }
                      alert(`Preset "${betweenSetsPresetName.trim()}" saved!`);
                      setBetweenSetsPresetName("");
                    }}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-xs rounded-lg uppercase tracking-wider transition-colors whitespace-nowrap"
                  >
                    Save Preset
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setStatCorrectionConfig({
                        isOpen: true,
                        initialMatchId: activeMatch?.id,
                        initialSetId: activeSetId,
                      });
                    }}
                    className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-xs rounded-lg uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Edit Stats</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTeamNameModalConfig({
                        isOpen: true,
                        ourTeamName: effectiveTeamName,
                        opponentTeamName,
                        targetMatchId: activeMatch?.id,
                        showOpponentEdit: true,
                      });
                    }}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-lg uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Shield size={13} />
                    <span>Adjust Team Names</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* IN-GAME LINEUP ADJUSTMENT MODAL */}
        {showLineupEditModal && (
          <div className="fixed inset-0 bg-slate-900/90 z-[115] flex items-center justify-center p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
            <div className="bg-white rounded-[2rem] p-4 sm:p-6 max-w-xl w-full shadow-2xl flex flex-col my-auto border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 bg-blue-50 text-[#0033A0] rounded-xl flex items-center justify-center">
                    <Users size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-wider">
                      Adjust Court Lineup (Set {currentSetNum})
                    </h2>
                    <p className="text-[11px] font-bold text-slate-500">
                      Switch court positions or change designated Libero
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLineupEditModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs: Lancers vs Opponent */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-4 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setInGameLineupTab("ucc")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                    inGameLineupTab === "ucc"
                      ? "bg-[#0033A0] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  
                  <span>Lancers Lineup</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInGameLineupTab("opp")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                    inGameLineupTab === "opp"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Shield size={12} className="inline text-amber-600" />
                  <span className="truncate max-w-[140px]">
                    {opponentName.trim() || "Opponent"} Lineup
                  </span>
                </button>
              </div>

              {inGameLineupTab === "ucc" ? (
                <>
                  {/* Libero selector */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-4">
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 flex items-center justify-between">
                      <span>Designated Libero</span>
                      <Shield size={12} className="text-[#0033A0]" />
                    </label>
                    <select
                      value={tempInGameLibero}
                      onChange={(e) => setTempInGameLibero(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                    >
                      <option value="">No Libero</option>
                      {sortedRoster.map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.number} {p.name} {p.position ? `(${p.position})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Court positions */}
                  <div className="bg-slate-900 rounded-2xl p-3 sm:p-4 text-white mb-4">
                    <div className="text-[10px] font-black tracking-widest uppercase text-amber-400 mb-2">
                      Front Row (Net Side)
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { idx: 3, label: "Pos 4 • LF" },
                        { idx: 2, label: "Pos 3 • MF" },
                        { idx: 1, label: "Pos 2 • RF" },
                      ].map(({ idx, label }) => (
                        <div key={idx} className="bg-white/10 rounded-xl p-2 border border-white/10">
                          <div className="text-[9px] font-black text-blue-300 uppercase tracking-wider mb-1 truncate">
                            {label}
                          </div>
                          <select
                            value={tempInGameLineup[idx] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempInGameLineup((prev) => {
                                const nextL = [...prev];
                                nextL[idx] = val;
                                return nextL;
                              });
                            }}
                            className="w-full bg-slate-800 text-white border border-white/20 rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                          >
                            <option value="">Select Player...</option>
                            {sortedRoster.map((p) => (
                              <option key={p.id} value={p.id}>
                                #{p.number} {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    <div className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2">
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
                          className={`rounded-xl p-2 border ${
                            idx === 0
                              ? "bg-amber-500/15 border-amber-400/40"
                              : "bg-white/10 border-white/10"
                          }`}
                        >
                          <div className="text-[9px] font-black text-amber-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                            <span className="truncate">{label}</span>
                            {idx === 0 && <span className="text-[9px] font-black uppercase text-amber-400">Serve</span>}
                          </div>
                          <select
                            value={tempInGameLineup[idx] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempInGameLineup((prev) => {
                                const nextL = [...prev];
                                nextL[idx] = val;
                                return nextL;
                              });
                            }}
                            className="w-full bg-slate-800 text-white border border-white/20 rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                          >
                            <option value="">Select Player...</option>
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
                </>
              ) : (
                <>
                  {/* Opponent Libero & Rotation Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 flex items-center justify-between">
                        <span>Opponent Libero #</span>
                        <Shield size={12} className="text-slate-700" />
                      </label>
                      <input
                        type="text"
                        placeholder="Jersey # (e.g. 5)"
                        value={tempInGameOppLibero}
                        onChange={(e) => setTempInGameOppLibero(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none uppercase"
                      />
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        Opponent Lineup Actions
                      </label>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTempInGameOppLineup((prev) => {
                              const cur = [...prev];
                              return [cur[1], cur[2], cur[3], cur[4], cur[5], cur[0]];
                            });
                          }}
                          className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-center gap-1 transition-all active:scale-95"
                          title="Rotate opponent rotation 1 step clockwise"
                        >
                          <ArrowRightLeft size={11} /> Rotate CW
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const defaultL =
                              appData.opponents?.[opponentName]?.defaultLineup || [
                                "O1",
                                "O2",
                                "O3",
                                "O4",
                                "O5",
                                "O6",
                              ];
                            setTempInGameOppLineup([...defaultL]);
                          }}
                          className="py-1.5 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-600 transition-all active:scale-95"
                          title="Reset to default lineup"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Opponent Court Lineup Grid */}
                  <div className="bg-slate-900 rounded-2xl p-3 sm:p-4 text-white mb-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[10px] font-black tracking-widest uppercase text-amber-400">
                        Front Row (Net Side)
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        LF • MF • RF
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-2.5">
                      {[
                        { idx: 3, label: "Pos 4 • LF" },
                        { idx: 2, label: "Pos 3 • MF" },
                        { idx: 1, label: "Pos 2 • RF" },
                      ].map(({ idx, label }) => (
                        <div
                          key={idx}
                          className="bg-white/10 rounded-xl p-2 border border-white/10 flex flex-col"
                        >
                          <div className="text-[9px] font-black text-amber-300 uppercase tracking-wider mb-1 truncate">
                            {label}
                          </div>
                          <input
                            type="text"
                            placeholder={`Opp ${idx === 0 ? 1 : idx === 1 ? 2 : idx === 2 ? 3 : idx === 3 ? 4 : idx === 4 ? 5 : 6}`}
                            value={tempInGameOppLineup[idx] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempInGameOppLineup((prev) => {
                                const nextL = [...prev];
                                nextL[idx] = val;
                                return nextL;
                              });
                            }}
                            className="w-full bg-slate-800 text-white border border-white/20 rounded-lg px-2 py-1.5 text-sm font-black text-center uppercase outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2">
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
                          className={`rounded-xl p-2 border flex flex-col ${
                            idx === 0 && serving === "opp"
                              ? "bg-amber-500/15 border-amber-400/40"
                              : "bg-white/10 border-white/10"
                          }`}
                        >
                          <div className="text-[9px] font-black text-amber-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                            <span className="truncate">{label}</span>
                            {idx === 0 && serving === "opp" && <span className="text-[9px] font-black uppercase text-amber-400">Serve</span>}
                          </div>
                          <input
                            type="text"
                            placeholder={`Opp ${idx === 0 ? 1 : idx === 4 ? 5 : 6}`}
                            value={tempInGameOppLineup[idx] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempInGameOppLineup((prev) => {
                                const nextL = [...prev];
                                nextL[idx] = val;
                                return nextL;
                              });
                            }}
                            className="w-full bg-slate-800 text-white border border-white/20 rounded-lg px-2 py-1.5 text-sm font-black text-center uppercase outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLineupEditModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveInGameLineupEdit}
                  className="flex-1 py-3 bg-[#0033A0] hover:bg-blue-800 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Check size={16} /> Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PENDING AUTO SUB MODAL */}
        {pendingAutoSub && (
          <div className="fixed inset-0 bg-slate-900/80 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
              <ArrowRightLeft className="w-16 h-16 text-indigo-500 mb-4 bg-indigo-50 rounded-full p-3" />
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-2 uppercase tracking-widest">
                Confirm Sub
              </h2>
              <p className="text-slate-600 font-bold mb-6">
                Switch{" "}
                <span className="text-indigo-600">
                  {appData.roster.find((r) => r.id === pendingAutoSub.outId)
                    ?.name || pendingAutoSub.outId}
                </span>{" "}
                for{" "}
                <span className="text-indigo-600">
                  {appData.roster.find((r) => r.id === pendingAutoSub.inId)
                    ?.name || pendingAutoSub.inId}
                </span>
                ?
              </p>
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={() => {
                    const { outId, inId } = pendingAutoSub;
                    pushToHistory();
                    const ldx = lineup.indexOf(outId);
                    if (ldx !== -1) {
                      const newLineup = [...lineup];
                      newLineup[ldx] = inId;
                      setLineup(newLineup);
                      updateSetState({ lineup: newLineup });
                      const isLibSub = inId === liberoId || outId === liberoId;
                      if (!isLibSub) {
                        setTeamStats((s) => ({ ...s, uccSubs: s.uccSubs + 1 }));
                      }
                      if (inId === liberoId) {
                        setLiberoSwappedOutId(outId);
                      } else if (outId === liberoId) {
                        setLiberoSwappedOutId(null);
                      }
                    } else if (outId === liberoId && liberoSwappedOutId) {
                      const libIdx = lineup.indexOf(liberoId);
                      if (libIdx !== -1) {
                        const newLineup = [...lineup];
                        newLineup[libIdx] = inId;
                        setLineup(newLineup);
                        updateSetState({ lineup: newLineup });
                        setLiberoSwappedOutId(null);
                      }
                    }
                    setPendingAutoSub(null);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all uppercase tracking-widest text-lg w-full"
                >
                  Yes
                </button>
                <button
                  onClick={() => {
                    setSelectedPlayerId(pendingAutoSub.outId);
                    setPendingAutoSub(null);
                    setSubModalVisible(true);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl transition-all uppercase tracking-widest text-sm w-full"
                >
                  Different Player
                </button>
                <button
                  onClick={() => setPendingAutoSub(null)}
                  className="mt-2 text-slate-400 font-bold text-sm hover:text-slate-600 uppercase tracking-widest transition-colors w-full py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* UCC SUB MODAL */}
        {subModalVisible && selectedPlayerObj && (
          <div className="fixed inset-0 bg-slate-900/95 z-[110] flex flex-col p-4 sm:p-8 backdrop-blur-xl animate-in fade-in duration-200 justify-center">
            <div className="bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-full max-w-md w-full mx-auto">
              <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-slate-50">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-widest uppercase">
                    Substitute
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-slate-400 font-bold text-xs tracking-widest uppercase">
                      Going in for #{selectedPlayerObj.number}
                    </p>
                    <span className="text-[10px] font-black text-[#0033A0] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Team Subs: {teamStats.uccSubs}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSubModalVisible(false)}
                  className="text-slate-400 hover:text-slate-800 p-2 rounded-full transition-colors"
                >
                  <XCircle size={28} />
                </button>
              </div>
              <div className="overflow-y-auto p-4 space-y-3 bg-slate-100 flex-1">
                {benchPlayers.length === 0 ? (
                  <div className="text-slate-400 text-center mt-8 p-8 border-2 border-slate-200 rounded-[2rem] border-dashed font-black text-sm tracking-wider uppercase">
                    Bench is Empty
                  </div>
                ) : (
                  benchPlayers.map((p) => {
                    const isLib = p.id === liberoId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSub(p.id)}
                        className="w-full bg-white p-5 rounded-2xl flex items-center justify-between text-slate-800 shadow-sm border border-slate-200 active:scale-95 transition-all hover:border-slate-300"
                      >
                        <div className="flex items-center space-x-4">
                          <span className="text-2xl font-black text-[#0033A0]">
                            {p.number ? `#${p.number}` : ""}
                          </span>
                          <div className="flex flex-col text-left">
                            <span className="text-lg font-black">{p.name}</span>
                            {isLib && (
                              <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">
                                Libero (No sub charged)
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRightLeft className="text-slate-300" size={24} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* DESIGNATE LIBERO MODAL */}
        {showLiberoDesignateModal && (
          <div className="fixed inset-0 bg-slate-900/90 z-[120] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-150">
            <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden max-w-md w-full border border-slate-200 flex flex-col">
              <div className="p-5 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-black text-lg uppercase tracking-wider">Designate Libero</h3>
                  <p className="text-xs text-amber-100">Select player to swap in as Libero (No sub charged)</p>
                </div>
                <button
                  onClick={() => {
                    setShowLiberoDesignateModal(false);
                    setLiberoPromptPlayerId(null);
                  }}
                  className="p-1 rounded-full text-white/80 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-80 space-y-2 bg-slate-50">
                {sortedRoster
                  .filter((p) => (showRetired || !p.isRetired) && !lineup.includes(p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setLiberoId(p.id);
                        setShowLiberoDesignateModal(false);
                        if (liberoPromptPlayerId) {
                          pushToHistory();
                          const idx = lineup.indexOf(liberoPromptPlayerId);
                          if (idx !== -1) {
                            const newLineup = [...lineup];
                            setLiberoSwappedOutId(liberoPromptPlayerId);
                            newLineup[idx] = p.id;
                            setLineup(newLineup);
                            updateSetState({ lineup: newLineup });
                          }
                          setLiberoPromptPlayerId(null);
                        }
                      }}
                      className="w-full bg-white p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 flex items-center justify-between text-left font-bold transition-all shadow-xs active:scale-98"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-black text-sm">
                          {p.number ? `#${p.number}` : "-"}
                        </span>
                        <span className="text-slate-800 font-black">{p.name}</span>
                      </div>
                      <span className="text-xs font-black text-amber-600 uppercase">Set as Libero</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* LIBERO OUT (SELECT BENCH REPLACEMENT) MODAL */}
        {showLiberoOutModal && (
          <div className="fixed inset-0 bg-slate-900/90 z-[120] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-150">
            <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden max-w-md w-full border border-slate-200 flex flex-col">
              <div className="p-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-black text-lg uppercase tracking-wider">Libero Exiting Court</h3>
                  <p className="text-xs text-slate-300">Select player returning to court (No sub charged)</p>
                </div>
                <button
                  onClick={() => {
                    setShowLiberoOutModal(false);
                    setLiberoPromptPlayerId(null);
                  }}
                  className="p-1 rounded-full text-white/80 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-80 space-y-2 bg-slate-50">
                {sortedRoster
                  .filter((p) => (showRetired || !p.isRetired) && !lineup.includes(p.id) && p.id !== liberoId)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setShowLiberoOutModal(false);
                        pushToHistory();
                        const libIdx = lineup.indexOf(liberoId);
                        if (libIdx !== -1) {
                          const newLineup = [...lineup];
                          newLineup[libIdx] = p.id;
                          setLiberoSwappedOutId(null);
                          setLineup(newLineup);
                          updateSetState({ lineup: newLineup });
                        }
                        setLiberoPromptPlayerId(null);
                      }}
                      className="w-full bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-between text-left font-bold transition-all shadow-xs active:scale-98"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-black text-sm">
                          {p.number ? `#${p.number}` : "-"}
                        </span>
                        <span className="text-slate-800 font-black">{p.name}</span>
                      </div>
                      <span className="text-xs font-black text-blue-600 uppercase">Return to Court</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
        {(showStatCorrectionModal || statCorrectionConfig.isOpen) && (
          <StatCorrectionModal
            isOpen={showStatCorrectionModal || statCorrectionConfig.isOpen}
            onClose={() => {
              setShowStatCorrectionModal(false);
              setStatCorrectionConfig((prev) => ({ ...prev, isOpen: false }));
            }}
            stats={appData.stats}
            roster={sortedRoster}
            activeSetId={activeSetId}
            activeMatch={activeMatch}
            matches={appData.matches}
            sets={appData.sets}
            initialMatchId={statCorrectionConfig.initialMatchId}
            initialSetId={statCorrectionConfig.initialSetId}
            initialPlayerId={statCorrectionConfig.initialPlayerId}
            onDeleteStat={handleDeleteStat}
            onUpdateStat={handleUpdateStat}
            onAddStat={handleAddManualStat}
            ourTeamName={effectiveTeamName}
            isReadOnly={isPlayerRole}
          />
        )}
        <TeamNameEditModal
          isOpen={teamNameModalConfig.isOpen}
          onClose={() =>
            setTeamNameModalConfig((prev) => ({ ...prev, isOpen: false }))
          }
          ourTeamName={teamNameModalConfig.ourTeamName || effectiveTeamName}
          opponentTeamName={teamNameModalConfig.opponentTeamName}
          targetMatchTitle={teamNameModalConfig.targetMatchTitle}
          showOpponentEdit={teamNameModalConfig.showOpponentEdit}
          onSave={(newOur, newOpp) =>
            handleSaveTeamNames(
              newOur,
              newOpp,
              teamNameModalConfig.targetMatchId,
            )
          }
        />
        <SetScoreEditModal
          isOpen={setScoreModalConfig.isOpen}
          onClose={() =>
            setSetScoreModalConfig((prev) => ({ ...prev, isOpen: false }))
          }
          set={setScoreModalConfig.set}
          matchTitle={setScoreModalConfig.matchTitle}
          ourTeamName={effectiveTeamName}
          opponentName={opponentName || "Opponent"}
          onSave={handleSaveSetScore}
        />
        {renderOpponentReportModal()}
        {renderPlayerSecurity()}
        {renderInstallModal()}
      </div>
    );
  }

  if (view === "open_practice") {
    const handlePracticeStat = (pId, category, metric, value = 1) => {
      pushToHistory();
      logStat(pId, category, metric, value, false);
    };

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans relative">
        <div className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-50 flex justify-between items-center">
          <div className="flex items-center">
            <div className="mr-2 sm:mr-3 flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 overflow-hidden relative shrink-0">
              <img
                src={APP_LOGO_SRC}
                alt="UCC Lancers Logo"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.fallback) {
                    target.dataset.fallback = "true";
                    target.src = FALLBACK_LOGO_SRC;
                  }
                }}
              />
            </div>
            <h1 className="text-xl font-black uppercase tracking-widest flex items-center">
              <Activity className="mr-2 text-blue-400" size={24} /> Open Practice
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowPracticeStats(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 sm:px-4 py-2 rounded-lg font-bold transition-all flex items-center shadow-sm active:scale-95 border border-indigo-400/30"
              title="View Practice Stats"
            >
              <Activity size={18} className="mr-1.5 text-amber-300" />
              <span>VIEW STATS</span>
            </button>
            <button
              onClick={() => setShowStatCorrectionModal(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-3 sm:px-4 py-2 rounded-lg font-bold transition-all flex items-center shadow-sm active:scale-95 border border-white/10"
              title="Data Correction & Log"
            >
              <Edit3 size={18} className="sm:mr-1 text-indigo-300" />
              <span className="hidden sm:inline">CORRECT</span>
            </button>
            <button
              onClick={handleInstallApp}
              className="bg-slate-800 text-white px-3 sm:px-4 py-2 rounded-lg font-bold hover:bg-slate-700 transition-colors flex items-center border border-white/10"
              title="Download App"
            >
              <Download size={18} className="sm:mr-1" />
              <span className="hidden sm:inline">DOWNLOAD</span>
            </button>
            <button
              onClick={toggleFullscreen}
              className="bg-slate-800 text-white px-3 sm:px-4 py-2 rounded-lg font-bold hover:bg-slate-700 transition-colors flex items-center border border-white/10"
              title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
            >
              {isFullscreen ? <Minimize size={18} className="sm:mr-1" /> : <Maximize size={18} className="sm:mr-1" />}
              <span className="hidden sm:inline">{isFullscreen ? "EXIT FULL" : "FULL SCREEN"}</span>
            </button>
            <button
              onClick={handleUndo}
              className="bg-slate-700 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-600 transition-colors flex items-center"
            >
              <Undo size={18} className="mr-1 hidden sm:block" /> UNDO
            </button>
            <button
              onClick={async () => {
                if (confirm("End open practice?")) {
                  if (isFirebaseAvailable && user && activeTeam) {
                    try {
                      await setDoc(
                        doc(
                          db,
                          `${publicPath}/${activeTeam}/matches/${activeMatch.id}`,
                        ),
                        { isLive: false },
                        { merge: true },
                      );
                    } catch (e) {
                      console.error("Failed to mark match complete", e);
                    }
                  }
                  const newMatches = appData.matches.map((m) =>
                    m.id === activeMatch.id ? { ...m, isLive: false } : m,
                  );
                  if (!isFirebaseAvailable) {
                    writeLocalDb({ ...appData, matches: newMatches });
                  } else {
                    setAppData((prev) => ({ ...prev, matches: newMatches }));
                  }
                  setView("stats");
                  setActiveMatch(null);
                  setActiveSetId(null);
                }
              }}
              className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-600 transition-colors"
            >
              END
            </button>
          </div>
        </div>

        {/* Practice Drill Switcher & Adder Bar */}
        <div className="bg-slate-800 text-white px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
              <Target size={14} /> Current Drill:
            </span>
            <select
              value={activeSetId || ""}
              onChange={(e) => setActiveSetId(e.target.value)}
              className="bg-slate-900 text-white text-xs font-bold border border-slate-600 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-blue-400 cursor-pointer shadow-inner"
            >
              {appData.sets
                .filter((s) => s.matchId === activeMatch?.id)
                .sort((a, b) => a.setNum - b.setNum)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    Drill {s.setNum}{s.title ? `: ${s.title}` : ""}
                  </option>
                ))}
            </select>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!activeMatch) return;
              const currentSets = appData.sets
                .filter((s) => s.matchId === activeMatch.id)
                .sort((a, b) => a.setNum - b.setNum);
              const nextNum = currentSets.length + 1;
              const drillName = prompt(
                `Enter name for Drill #${nextNum} (e.g. Serve Receive, Hitting Lines):`,
                `Drill ${nextNum}`,
              );
              if (drillName === null) return;
              const newSetId = Date.now().toString() + "_set";
              const newSet = {
                id: newSetId,
                matchId: activeMatch.id,
                setNum: nextNum,
                title: drillName.trim() || `Drill ${nextNum}`,
                scoreUcc: 0,
                scoreOpp: 0,
              };
              if (isFirebaseAvailable && user && activeTeam) {
                try {
                  await setDoc(
                    doc(db, `${publicPath}/${activeTeam}/sets/${newSetId}`),
                    newSet,
                  );
                } catch (err) {
                  console.error("Error creating practice drill set:", err);
                }
              } else if (!isFirebaseAvailable) {
                writeLocalDb({
                  ...appData,
                  sets: [...appData.sets, newSet],
                });
              }
              setAppData((prev) => ({
                ...prev,
                sets: [...prev.sets, newSet],
              }));
              setActiveSetId(newSetId);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer border border-emerald-400/30"
          >
            <Plus size={14} /> + New Drill
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
          {sortedRoster
            .filter((p) => !p.isRetired && !hiddenPracticePlayers.includes(p.id))
            .map((p) => {
              // Compute quick stats for this player in this practice session
              let pCount = 0,
                pSum = 0,
                pErr = 0;
              let aCount = 0,
                aKill = 0,
                aErr = 0;
              let sCount = 0,
                sAce = 0,
                sErr = 0;
              let dCount = 0,
                dErr = 0;
              let blkCount = 0;

              appData.stats.forEach((s) => {
                if (s.setId === activeSetId && s.playerId === p.id) {
                  if (s.category === "Pass") {
                    pCount++;
                    pSum += s.value;
                    if (s.value === 0) pErr++;
                  } else if (s.category === "Attack") {
                    if (
                      [
                        "Swing",
                        "Swing Front",
                        "Swing Back",
                        "Blocked",
                        "Stuffed",
                        "Out",
                        "Net",
                        "Out/Net",
                        "Kill",
                      ].includes(s.metric)
                    ) {
                      aCount++;
                    }
                    if (s.metric === "Kill") aKill++;
                    else if (
                      ["Out", "Net", "Out/Net", "Stuffed"].includes(s.metric)
                    )
                      aErr++;
                  } else if (s.category === "Serve") {
                    if (
                      s.metric === "Attempt" ||
                      s.metric === "Ace" ||
                      s.metric?.includes("Miss") ||
                      s.metric === "Error"
                    ) {
                      sCount++;
                    }
                    if (s.metric === "Ace") sAce++;
                    else if (s.metric?.includes("Miss") || s.metric === "Error")
                      sErr++;
                  } else if (s.category === "Dig") {
                    dCount++;
                    if (s.metric === "Error") dErr++;
                  } else if (
                    s.category === "Block" &&
                    (s.metric === "Block" ||
                      s.metric === "Play On" ||
                      s.metric === "Stuffed" ||
                      s.metric === "Stuff" ||
                      s.metric === "Touch")
                  ) {
                    blkCount += s.value || 1;
                  }
                }
              });

              const passAvg = pCount > 0 ? (pSum / pCount).toFixed(2) : "-";
              const hitRate =
                aCount > 0 ? ((aKill - aErr) / aCount).toFixed(3) : "-";

              return (
                <div
                  key={p.id}
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                    <div className="flex items-center space-x-3 w-full sm:w-auto">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0033A0] font-black flex items-center justify-center text-lg shrink-0">
                        {p.number || "-"}
                      </div>
                      <span className="font-bold text-slate-800 text-lg leading-tight flex-1">
                        {p.name}
                      </span>
                      <button
                        onClick={() => setHiddenPracticePlayers(prev => [...prev, p.id])}
                        className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full active:scale-95 transition-all ml-auto sm:ml-0"
                        title="Hide Player"
                      >
                        <EyeOff size={18} />
                      </button>
                    </div>
                    <div className="flex bg-slate-50 p-2 rounded-lg text-xs font-mono text-slate-600 gap-3 border border-slate-100 overflow-x-auto whitespace-nowrap scrollbar-hide shrink-0">
                      <div>
                        <span className="font-bold text-slate-400">P:</span>{" "}
                        {passAvg} ({pCount})
                      </div>
                      <div>
                        <span className="font-bold text-slate-400">A:</span>{" "}
                        {hitRate} ({aKill}K/{aErr}E)
                      </div>
                      <div>
                        <span className="font-bold text-slate-400">S:</span>{" "}
                        {sAce}A/{sErr}E
                      </div>
                      <div>
                        <span className="font-bold text-slate-400">D:</span>{" "}
                        {dCount} ({dErr}E)
                      </div>
                      <div>
                        <span className="font-bold text-slate-400">B:</span>{" "}
                        {blkCount}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <button
                      onClick={() =>
                        setPracticeStatPrompt({ playerId: p.id, type: "Pass" })
                      }
                      className="flex-1 bg-blue-100 text-blue-800 font-bold py-2 pb-1.5 sm:py-3 rounded-lg text-xs sm:text-sm active:scale-95 transition-all outline-none min-w-[60px]"
                    >
                      Pass
                    </button>
                    <button
                      onClick={() =>
                        setPracticeStatPrompt({ playerId: p.id, type: "Serve" })
                      }
                      className="flex-1 bg-emerald-100 text-emerald-800 font-bold py-2 pb-1.5 sm:py-3 rounded-lg text-xs sm:text-sm active:scale-95 transition-all outline-none min-w-[60px]"
                    >
                      Serve
                    </button>
                    <button
                      onClick={() =>
                        setPracticeStatPrompt({
                          playerId: p.id,
                          type: "Attack",
                        })
                      }
                      className="flex-1 bg-green-100 text-green-800 font-bold py-2 pb-1.5 sm:py-3 rounded-lg text-xs sm:text-sm active:scale-95 transition-all outline-none min-w-[60px]"
                    >
                      Attack
                    </button>
                    <button
                      onClick={() =>
                        setPracticeStatPrompt({ playerId: p.id, type: "Dig" })
                      }
                      className="flex-1 bg-indigo-100 text-indigo-800 font-bold py-2 pb-1.5 sm:py-3 rounded-lg text-xs sm:text-sm active:scale-95 transition-all outline-none min-w-[60px]"
                    >
                      Dig
                    </button>
                    <button
                      onClick={() =>
                        setPracticeStatPrompt({ playerId: p.id, type: "Block" })
                      }
                      className="flex-1 bg-teal-100 text-teal-800 font-bold py-2 pb-1.5 sm:py-3 rounded-lg text-xs sm:text-sm active:scale-95 transition-all outline-none min-w-[60px]"
                    >
                      Block
                    </button>
                  </div>
                </div>
              );
            })}

          {hiddenPracticePlayers.length > 0 && (
            <div className="mt-8 border-t border-slate-200 pt-6">
              <h3 className="font-bold text-slate-500 mb-3 uppercase tracking-widest text-xs flex items-center">
                <EyeOff className="mr-2 text-slate-400" size={14} /> Hidden Players
              </h3>
              <div className="flex flex-wrap gap-2">
                {sortedRoster
                  .filter((p) => hiddenPracticePlayers.includes(p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        setHiddenPracticePlayers((prev) =>
                          prev.filter((id) => id !== p.id)
                        )
                      }
                      className="bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center hover:bg-slate-300 transition-colors"
                    >
                      {p.number ? `#${p.number} ` : ""}{p.name}
                      <Eye className="ml-2" size={14} />
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {practiceStatPrompt && (
          <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md animate-in fade-in overflow-hidden">
            <div className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-[#0033A0]/20 max-h-[90vh]">
              <div className="bg-gradient-to-r from-[#001b5e] to-[#0033A0] p-4 sm:p-5 flex justify-between items-center text-white shrink-0">
                <div className="font-black text-xl tracking-widest uppercase flex items-center">
                  <Activity size={20} className="mr-2" />
                  {practiceStatPrompt.type}
                </div>
                <button
                  onClick={() => setPracticeStatPrompt(null)}
                  className="text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-4 bg-slate-50 space-y-4 overflow-y-auto">
                <div className="text-center font-bold text-slate-700 text-lg mb-2">
                  {appData.roster.find(
                    (r) => r.id === practiceStatPrompt.playerId,
                  )?.name || "Unknown Player"}
                </div>
                {practiceStatPrompt.type === "Pass" && (
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 2, 1, 0].map((val) => (
                      <button
                        key={val}
                        onClick={() => {
                          handlePracticeStat(
                            practiceStatPrompt.playerId,
                            practiceStatPrompt.type,
                            "Rating",
                            val,
                          );
                          setPracticeStatPrompt(null);
                        }}
                        className={`p-4 rounded-xl font-black text-2xl shadow-sm active:scale-95 transition-all ${val === 3 ? "bg-gradient-to-b from-green-400 to-green-500 text-white border border-green-500" : val === 0 ? "bg-gradient-to-b from-red-400 to-red-500 text-white border border-red-500" : "bg-white text-slate-700 border border-slate-200"}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                )}
                {practiceStatPrompt.type === "Serve" && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        handlePracticeStat(
                          practiceStatPrompt.playerId,
                          practiceStatPrompt.type,
                          "Ace",
                        );
                        setPracticeStatPrompt(null);
                      }}
                      className="bg-gradient-to-b from-green-500 to-green-600 text-white p-4 rounded-xl font-black text-xl shadow-sm active:scale-95 border-t border-white/20"
                    >
                      ACE
                    </button>
                    <button
                      onClick={() => {
                        handlePracticeStat(
                          practiceStatPrompt.playerId,
                          practiceStatPrompt.type,
                          "Attempt",
                        );
                        setPracticeStatPrompt(null);
                      }}
                      className="bg-gradient-to-b from-blue-500 to-blue-600 text-white p-4 rounded-xl font-black text-xl shadow-sm active:scale-95 border-t border-white/20"
                    >
                      IN PLAY
                    </button>
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2 mb-1 flex items-center justify-center">
                      <span className="h-px bg-slate-200 flex-1 mr-2"></span>{" "}
                      ERROR TYPE{" "}
                      <span className="h-px bg-slate-200 flex-1 ml-2"></span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          handlePracticeStat(
                            practiceStatPrompt.playerId,
                            practiceStatPrompt.type,
                            "Miss - Net",
                          );
                          setPracticeStatPrompt(null);
                        }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl font-bold border border-red-100 shadow-sm active:scale-95 uppercase text-sm"
                      >
                        Net
                      </button>
                      <button
                        onClick={() => {
                          handlePracticeStat(
                            practiceStatPrompt.playerId,
                            practiceStatPrompt.type,
                            "Miss - Long",
                          );
                          setPracticeStatPrompt(null);
                        }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl font-bold border border-red-100 shadow-sm active:scale-95 uppercase text-sm"
                      >
                        Long
                      </button>
                      <button
                        onClick={() => {
                          handlePracticeStat(
                            practiceStatPrompt.playerId,
                            practiceStatPrompt.type,
                            "Miss - Wide",
                          );
                          setPracticeStatPrompt(null);
                        }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl font-bold border border-red-100 shadow-sm active:scale-95 uppercase text-sm"
                      >
                        Wide
                      </button>
                    </div>
                  </div>
                )}
                {practiceStatPrompt.type === "Attack" && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        handlePracticeStat(
                          practiceStatPrompt.playerId,
                          practiceStatPrompt.type,
                          "Kill",
                        );
                        setPracticeStatPrompt(null);
                      }}
                      className="bg-gradient-to-b from-green-500 to-green-600 text-white p-4 rounded-xl font-black text-xl shadow-sm active:scale-95 border-t border-white/20"
                    >
                      KILL
                    </button>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={() => {
                          handlePracticeStat(
                            practiceStatPrompt.playerId,
                            practiceStatPrompt.type,
                            "Swing",
                          );
                          setPracticeStatPrompt(null);
                        }}
                        className="bg-gradient-to-b from-blue-500 to-blue-600 text-white p-4 rounded-xl font-black text-sm sm:text-base shadow-sm active:scale-95 border-t border-white/20"
                      >
                        IN PLAY
                      </button>
                      <button
                        onClick={() => {
                          handlePracticeStat(
                            practiceStatPrompt.playerId,
                            practiceStatPrompt.type,
                            "Blocked",
                          );
                          setPracticeStatPrompt(null);
                        }}
                        className="bg-blue-50 text-blue-700 p-4 rounded-xl font-black text-sm sm:text-base border border-blue-200 shadow-sm active:scale-95 uppercase"
                      >
                        COVERED
                      </button>
                    </div>
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2 mb-1 flex items-center justify-center">
                      <span className="h-px bg-slate-200 flex-1 mr-2"></span>{" "}
                      ERRORS{" "}
                      <span className="h-px bg-slate-200 flex-1 ml-2"></span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          handlePracticeStat(
                            practiceStatPrompt.playerId,
                            practiceStatPrompt.type,
                            "Out",
                          );
                          setPracticeStatPrompt(null);
                        }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl font-bold text-sm border border-red-100 shadow-sm active:scale-95 flex flex-col items-center justify-center uppercase"
                      >
                        <span className="text-xl mb-1">↗️</span>Out
                      </button>
                      <button
                        onClick={() => {
                          handlePracticeStat(
                            practiceStatPrompt.playerId,
                            practiceStatPrompt.type,
                            "Net",
                          );
                          setPracticeStatPrompt(null);
                        }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl font-bold text-sm border border-red-100 shadow-sm active:scale-95 flex flex-col items-center justify-center uppercase"
                      >
                        Net
                      </button>
                      <button
                        onClick={() => {
                          handlePracticeStat(
                            practiceStatPrompt.playerId,
                            practiceStatPrompt.type,
                            "Stuffed",
                          );
                          setPracticeStatPrompt(null);
                        }}
                        className="bg-red-50 text-red-600 p-3 rounded-xl font-bold text-sm border border-red-100 shadow-sm active:scale-95 flex flex-col items-center justify-center uppercase"
                      >
                        Stuffed
                      </button>
                    </div>
                  </div>
                )}
                {practiceStatPrompt.type === "Dig" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        handlePracticeStat(
                          practiceStatPrompt.playerId,
                          practiceStatPrompt.type,
                          "Dig",
                        );
                        setPracticeStatPrompt(null);
                      }}
                      className="bg-gradient-to-b from-blue-500 to-blue-600 text-white p-4 rounded-xl font-black text-xl shadow-sm active:scale-95 border-t border-white/20"
                    >
                      DIG
                    </button>
                    <button
                      onClick={() => {
                        handlePracticeStat(
                          practiceStatPrompt.playerId,
                          practiceStatPrompt.type,
                          "Error",
                        );
                        setPracticeStatPrompt(null);
                      }}
                      className="bg-slate-200 text-slate-600 p-4 rounded-xl font-black text-sm uppercase shadow-sm border border-slate-300 active:scale-95 flex items-center justify-center"
                    >
                      TOUCH
                    </button>
                  </div>
                )}
                {practiceStatPrompt.type === "Block" &&
                  !practiceStatPrompt.step && (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() =>
                            setPracticeStatPrompt({
                              ...practiceStatPrompt,
                              step: "Stuff",
                            })
                          }
                          className="bg-gradient-to-b from-green-500 to-green-600 text-white p-3 sm:p-4 rounded-xl font-black text-sm sm:text-lg shadow-sm active:scale-95 border-t border-white/20"
                        >
                          STUFF
                        </button>
                        <button
                          onClick={() =>
                            setPracticeStatPrompt({
                              ...practiceStatPrompt,
                              step: "Touch",
                            })
                          }
                          className="bg-gradient-to-b from-blue-500 to-blue-600 text-white p-3 sm:p-4 rounded-xl font-black text-sm sm:text-lg shadow-sm active:scale-95 border-t border-white/20"
                        >
                          TOUCH
                        </button>
                      </div>
                      <div className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2 mb-1 flex items-center justify-center">
                        <span className="h-px bg-slate-200 flex-1 mr-2"></span>{" "}
                        ERRORS & NOTES{" "}
                        <span className="h-px bg-slate-200 flex-1 ml-2"></span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            if (practiceStatPrompt.latePressed) {
                              handlePracticeStat(
                                practiceStatPrompt.playerId,
                                practiceStatPrompt.type,
                                "Late",
                              );
                              setPracticeStatPrompt(null);
                            } else {
                              setPracticeStatPrompt({
                                ...practiceStatPrompt,
                                latePressed: true,
                              });
                            }
                          }}
                          className={
                            practiceStatPrompt.latePressed
                              ? "bg-amber-400 text-amber-950 p-3 rounded-xl font-bold uppercase shadow-inner active:scale-95 flex items-center justify-center text-sm border-2 border-amber-500"
                              : "bg-slate-50 text-slate-600 p-3 rounded-xl font-bold uppercase border border-slate-200 shadow-sm active:scale-95 flex items-center justify-center text-sm"
                          }
                        >
                          LATE
                        </button>
                        <button
                          onClick={() => {
                            if (practiceStatPrompt.latePressed)
                              handlePracticeStat(
                                practiceStatPrompt.playerId,
                                practiceStatPrompt.type,
                                "Late",
                              );
                            handlePracticeStat(
                              practiceStatPrompt.playerId,
                              practiceStatPrompt.type,
                              "Used",
                            );
                            setPracticeStatPrompt(null);
                          }}
                          className="bg-slate-50 text-slate-600 p-3 rounded-xl font-bold border border-slate-200 shadow-sm active:scale-95 flex items-center justify-center text-sm"
                        >
                          USED
                        </button>
                        <button
                          onClick={() => {
                            if (practiceStatPrompt.latePressed)
                              handlePracticeStat(
                                practiceStatPrompt.playerId,
                                practiceStatPrompt.type,
                                "Late",
                              );
                            handlePracticeStat(
                              practiceStatPrompt.playerId,
                              practiceStatPrompt.type,
                              "Net Viol",
                            );
                            setPracticeStatPrompt(null);
                          }}
                          className="bg-red-50 text-red-600 p-3 rounded-xl font-bold uppercase border border-red-100 shadow-sm active:scale-95 flex items-center justify-center text-sm overflow-hidden whitespace-nowrap overflow-ellipsis"
                        >
                          NET VIOL
                        </button>
                      </div>
                    </div>
                  )}
                {practiceStatPrompt.type === "Block" &&
                  practiceStatPrompt.step && (
                    <div className="flex flex-col gap-2">
                      <div className="font-bold text-center text-slate-500 uppercase tracking-widest">
                        {practiceStatPrompt.step}: Solo or Half?
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            if (practiceStatPrompt.latePressed)
                              handlePracticeStat(
                                practiceStatPrompt.playerId,
                                practiceStatPrompt.type,
                                "Late",
                              );
                            handlePracticeStat(
                              practiceStatPrompt.playerId,
                              practiceStatPrompt.type,
                              practiceStatPrompt.step,
                              1,
                            );
                            setPracticeStatPrompt(null);
                          }}
                          className="bg-gradient-to-b from-indigo-500 to-indigo-600 text-white p-3 sm:p-4 rounded-xl font-black text-sm sm:text-lg shadow-sm active:scale-95 border-t border-white/20"
                        >
                          SOLO
                        </button>
                        <button
                          onClick={() => {
                            if (practiceStatPrompt.latePressed)
                              handlePracticeStat(
                                practiceStatPrompt.playerId,
                                practiceStatPrompt.type,
                                "Late",
                              );
                            handlePracticeStat(
                              practiceStatPrompt.playerId,
                              practiceStatPrompt.type,
                              practiceStatPrompt.step,
                              0.5,
                            );
                            setPracticeStatPrompt(null);
                          }}
                          className="bg-gradient-to-b from-teal-500 to-teal-600 text-white p-3 sm:p-4 rounded-xl font-black text-sm sm:text-lg shadow-sm active:scale-95 border-t border-white/20"
                        >
                          HALF
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {showPracticeStats && (
          <PracticeStatsModal
            isOpen={showPracticeStats}
            onClose={() => setShowPracticeStats(false)}
            roster={sortedRoster}
            stats={appData.stats}
            activeSetId={activeSetId}
            activeMatch={activeMatch}
            onOpenDatabase={() => {
              setShowPracticeStats(false);
              viewStatsWithCurrentMatch();
            }}
            onOpenCorrection={() => {
              setShowPracticeStats(false);
              setShowStatCorrectionModal(true);
            }}
          />
        )}

        {showStatCorrectionModal && (
          <StatCorrectionModal
            isOpen={showStatCorrectionModal}
            onClose={() => setShowStatCorrectionModal(false)}
            stats={appData.stats}
            roster={sortedRoster}
            activeSetId={activeSetId}
            activeMatch={activeMatch}
            onDeleteStat={handleDeleteStat}
            onUpdateStat={handleUpdateStat}
            onAddStat={handleAddManualStat}
            isReadOnly={isPlayerRole}
          />
        )}
        {renderPlayerSecurity()}
        {renderInstallModal()}
      </div>
    );
  }

  // -------------------------------------------------------------
  // STATS VIEW (Hierarchical Drill-Down)
  // -------------------------------------------------------------
  if (view === "compare") {
    // Collect all contexts
    const contexts = [
      { id: "season", name: "Season Totals (No Practice)" },
      { id: "practice_sessions", name: "All Practice Sessions" },
    ];
    appData.matches.forEach((m) => {
      const detail = getEventDetails(m);
      if (!contexts.find((c) => c.id === detail.id)) {
        contexts.push({ id: detail.id, name: detail.name });
      }
      if (m.type !== "Practice") {
        contexts.push({ id: m.id, name: `${detail.name} - vs ${m.opponent}` }); // Matches
      }
    });

    const getStatsForContextAndPlayer = (contextId, playerId) => {
      let filteredStats = appData.stats;
      if (contextId === "season") {
        const nonPracticeMatchIds = appData.matches
          .filter((m) => m.type !== "Practice")
          .map((m) => m.id);
        filteredStats = appData.stats.filter((s) =>
          nonPracticeMatchIds.includes(s.matchId),
        );
      } else if (contextId === "practice_sessions") {
        const practiceMatchIds = appData.matches
          .filter((m) => m.type === "Practice")
          .map((m) => m.id);
        filteredStats = appData.stats.filter((s) =>
          practiceMatchIds.includes(s.matchId),
        );
      } else if (
        contextId.startsWith("day_") ||
        contextId.startsWith("tourney_") ||
        contextId.startsWith("practice_")
      ) {
        const matchIds = appData.matches
          .filter((m) => getEventDetails(m).id === contextId)
          .map((m) => m.id);
        filteredStats = appData.stats.filter((s) =>
          matchIds.includes(s.matchId),
        );
      } else {
        // match
        filteredStats = appData.stats.filter((s) => s.matchId === contextId);
      }
      const playerStats = filteredStats.filter((s) => s.playerId === playerId);
      let pSum = 0;
      let pCount = 0;
      let aCount = 0;
      let aKill = 0;
      let aErr = 0;
      let dCount = 0;
      let dErr = 0;
      let sCount = 0;
      let sAce = 0;
      let sErr = 0;
      let bTot = 0;
      playerStats.forEach((s) => {
        if (s.category === "Pass") {
          pCount++;
          pSum += s.value || 0;
        } else if (s.category === "Attack") {
          if (
            [
              "Swing",
              "Swing Front",
              "Swing Back",
              "Blocked",
              "Stuffed",
              "Out",
              "Net",
              "Out/Net",
              "Kill",
            ].includes(s.metric)
          )
            aCount++;
          if (s.metric === "Kill") aKill++;
          if (["Out", "Net", "Out/Net", "Stuffed"].includes(s.metric)) aErr++;
        } else if (s.category === "Dig") {
          if (s.metric === "Dig") dCount++;
          if (s.metric === "Error") dErr++;
        } else if (s.category === "Serve") {
          if (
            s.metric === "Attempt" ||
            s.metric === "Ace" ||
            s.metric?.includes("Miss")
          )
            sCount++;
          if (s.metric === "Ace") sAce++;
          if (s.metric?.includes("Miss")) sErr++;
        } else if (
          s.category === "Block" &&
          (s.metric === "Block" ||
            s.metric === "Play On" ||
            s.metric === "Stuffed" ||
            s.metric === "Stuff" ||
            s.metric === "Touch")
        ) {
          bTot += s.value || 1;
        }
      });
      return {
        passAvg: pCount > 0 ? (pSum / pCount).toFixed(2) : "-",
        passCount: pCount,
        attPct: aCount > 0 ? (((aKill - aErr) / aCount) * 100).toFixed(0) : "0",
        aKill,
        aErr,
        aCount,
        dCount,
        dErr,
        sAce,
        sErr,
        sCount,
        bTot,
      };
    };

    const s1 =
      compareMode === "players" && comparePlayer1
        ? getStatsForContextAndPlayer(compareEvent1, comparePlayer1)
        : null;
    const s2 =
      compareMode === "players" && comparePlayer2
        ? getStatsForContextAndPlayer(compareEvent1, comparePlayer2)
        : null;
    const s1e =
      compareMode === "events" && comparePlayer1 && compareEvent1
        ? getStatsForContextAndPlayer(compareEvent1, comparePlayer1)
        : null;
    const s2e =
      compareMode === "events" && comparePlayer1 && compareEvent2
        ? getStatsForContextAndPlayer(compareEvent2, comparePlayer1)
        : null;

    return (
      <div className="min-h-screen bg-slate-100 p-2 sm:p-8 font-sans flex flex-col">
        <div className="max-w-4xl w-full mx-auto">
          <div className="bg-slate-900 text-white rounded-t-2xl sm:rounded-t-3xl p-4 sm:p-6 shadow-xl flex justify-between items-center z-10 relative">
            <div className="flex items-center">
              <div className="mr-2 sm:mr-3 flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 overflow-hidden relative shrink-0">
                <img
                  src={APP_LOGO_SRC}
                  alt="UCC Lancers Logo"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallback) {
                      target.dataset.fallback = "true";
                      target.src = FALLBACK_LOGO_SRC;
                    }
                  }}
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-widest flex items-center">
                <ArrowRightLeft
                  className="mr-2 sm:mr-3 text-indigo-400"
                  size={24}
                />{" "}
                Compare Stats
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleInstallApp}
                className="bg-white/10 hover:bg-white/20 text-white px-3 sm:px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-xs flex items-center border border-white/20"
                title="Download App"
              >
                <Download size={14} className="sm:mr-1" />
                <span className="hidden sm:inline">App</span>
              </button>
              <button
                onClick={toggleFullscreen}
                className="bg-white/10 hover:bg-white/20 text-white px-3 sm:px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-xs flex items-center border border-white/20"
                title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
              >
                {isFullscreen ? <Minimize size={14} className="sm:mr-1" /> : <Maximize size={14} className="sm:mr-1" />}
                <span className="hidden sm:inline">{isFullscreen ? "Exit Full" : "Full Screen"}</span>
              </button>
              <button
                onClick={() => setView("stats")}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-xs"
              >
                Back
              </button>
            </div>
          </div>

          {isPlayerRole && !isPlayerAccessAllowed ? (
            <div className="bg-white shadow-xl p-8 sm:p-12 border-x border-b border-slate-200 text-center select-none rounded-b-2xl sm:rounded-b-3xl">
              <div className="h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-500">
                <Lock size={32} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-wider text-slate-800 mb-2">
                Player Access Currently Closed
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6 max-w-md mx-auto">
                Your coaching staff has temporarily disabled player access to stats and comparisons.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => setView("stats")}
                  className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Return to Stats
                </button>
                <button
                  type="button"
                  onClick={() => setShowCoachLoginModal(true)}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <Shield size={16} />
                  <span>Coach Login / Enter Code</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow-xl p-4 sm:p-6 border-x border-b border-slate-200">
              <div className="flex space-x-2 border-b border-slate-200 mb-4 pb-2">
              <button
                onClick={() => setCompareMode("players")}
                className={`px-4 py-2 font-bold text-sm uppercase tracking-widest border-b-4 ${compareMode === "players" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-400"}`}
              >
                Compare Players
              </button>
              <button
                onClick={() => setCompareMode("events")}
                className={`px-4 py-2 font-bold text-sm uppercase tracking-widest border-b-4 ${compareMode === "events" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-400"}`}
              >
                Compare Events
              </button>
            </div>

            {compareMode === "players" && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
                  <div className="w-full">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Context
                    </label>
                    <select
                      value={compareEvent1}
                      onChange={(e) => setCompareEvent1(e.target.value)}
                      className="w-full mt-1 p-2 border rounded-lg"
                    >
                      {contexts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="hidden md:block w-px h-12 bg-slate-200 mx-2"></div>
                  <div className="w-full flex space-x-2">
                    <div className="w-1/2">
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        Player A
                      </label>
                      <select
                        value={comparePlayer1}
                        onChange={(e) => setComparePlayer1(e.target.value)}
                        className="w-full mt-1 p-2 border rounded-lg"
                      >
                        <option value="">Select...</option>
                        {appData.roster.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-1/2">
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        Player B
                      </label>
                      <select
                        value={comparePlayer2}
                        onChange={(e) => setComparePlayer2(e.target.value)}
                        className="w-full mt-1 p-2 border rounded-lg"
                      >
                        <option value="">Select...</option>
                        {appData.roster.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {s1 && s2 && (
                  <div className="grid grid-cols-3 gap-2 text-center items-center py-4 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
                    <div className="font-black text-slate-800 border-b pb-2 col-span-3 mb-2 uppercase text-xs tracking-wider">
                      Comparison Stats
                    </div>
                    <div className="font-black text-indigo-700">
                      {
                        appData.roster.find((p) => p.id === comparePlayer1)
                          ?.name
                      }
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Metric
                    </div>
                    <div className="font-black text-amber-600">
                      {
                        appData.roster.find((p) => p.id === comparePlayer2)
                          ?.name
                      }
                    </div>

                    <div className="font-bold">
                      {s1.passAvg}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({s1.passCount})
                      </span>
                    </div>
                    <div className="text-xs uppercase text-slate-500 font-bold">
                      Passing Avg
                    </div>
                    <div className="font-bold">
                      {s2.passAvg}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({s2.passCount})
                      </span>
                    </div>

                    <div className="font-bold">
                      {s1.aKill}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({s1.attPct}%)
                      </span>
                    </div>
                    <div className="text-xs uppercase text-slate-500 font-bold">
                      Kills (Pct)
                    </div>
                    <div className="font-bold">
                      {s2.aKill}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({s2.attPct}%)
                      </span>
                    </div>

                    <div className="font-bold">
                      {s1.sAce} / {s1.sErr}
                    </div>
                    <div className="text-xs uppercase text-slate-500 font-bold">
                      Aces / Errors
                    </div>
                    <div className="font-bold">
                      {s2.sAce} / {s2.sErr}
                    </div>

                    <div className="font-bold">
                      {s1.dCount}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({s1.dErr} err)
                      </span>
                    </div>
                    <div className="text-xs uppercase text-slate-500 font-bold">
                      Digs
                    </div>
                    <div className="font-bold">
                      {s2.dCount}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({s2.dErr} err)
                      </span>
                    </div>

                    <div className="font-bold">{s1.bTot}</div>
                    <div className="text-xs uppercase text-slate-500 font-bold">
                      Blocks
                    </div>
                    <div className="font-bold">{s2.bTot}</div>
                  </div>
                )}
              </div>
            )}

            {compareMode === "events" && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
                  <div className="w-full">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Player
                    </label>
                    <select
                      value={comparePlayer1}
                      onChange={(e) => setComparePlayer1(e.target.value)}
                      className="w-full mt-1 p-2 border rounded-lg"
                    >
                      <option value="">Select...</option>
                      {appData.roster.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="hidden md:block w-px h-12 bg-slate-200 mx-2"></div>
                  <div className="w-full flex space-x-2">
                    <div className="w-1/2">
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        Context A
                      </label>
                      <select
                        value={compareEvent1}
                        onChange={(e) => setCompareEvent1(e.target.value)}
                        className="w-full mt-1 p-2 border rounded-lg"
                      >
                        <option value="">Select...</option>
                        {contexts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-1/2">
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        Context B
                      </label>
                      <select
                        value={compareEvent2}
                        onChange={(e) => setCompareEvent2(e.target.value)}
                        className="w-full mt-1 p-2 border rounded-lg"
                      >
                        <option value="">Select...</option>
                        {contexts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {s1e && s2e && (
                  <div className="grid grid-cols-3 gap-2 text-center items-center py-4 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
                    <div className="font-black text-slate-800 border-b pb-2 col-span-3 mb-2 uppercase text-xs tracking-wider">
                      Comparison Stats
                    </div>
                    <div className="font-black text-indigo-700 truncate px-2 text-xs">
                      {contexts.find((c) => c.id === compareEvent1)?.name}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Metric
                    </div>
                    <div className="font-black text-amber-600 truncate px-2 text-xs">
                      {contexts.find((c) => c.id === compareEvent2)?.name}
                    </div>

                    <div className="font-bold">
                      {s1e.passAvg}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({s1e.passCount})
                      </span>
                    </div>
                    <div className="text-xs uppercase text-slate-500 font-bold">
                      Passing Avg
                    </div>
                    <div className="font-bold">
                      {s2e.passAvg}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({s2e.passCount})
                      </span>
                    </div>

                    <div className="font-bold">
                      {s1e.aKill}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({s1e.attPct}%)
                      </span>
                    </div>
                    <div className="text-xs uppercase text-slate-500 font-bold">
                      Kills (Pct)
                    </div>
                    <div className="font-bold">
                      {s2e.aKill}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({s2e.attPct}%)
                      </span>
                    </div>

                    <div className="font-bold">
                      {s1e.sAce} / {s1e.sErr}
                    </div>
                    <div className="text-xs uppercase text-slate-500 font-bold">
                      Aces / Errors
                    </div>
                    <div className="font-bold">
                      {s2e.sAce} / {s2e.sErr}
                    </div>

                    <div className="font-bold">
                      {s1e.dCount}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({s1e.dErr} err)
                      </span>
                    </div>
                    <div className="text-xs uppercase text-slate-500 font-bold">
                      Digs
                    </div>
                    <div className="font-bold">
                      {s2e.dCount}{" "}
                      <span className="text-[10px] text-slate-400">
                        ({s2e.dErr} err)
                      </span>
                    </div>

                    <div className="font-bold">{s1e.bTot}</div>
                    <div className="text-xs uppercase text-slate-500 font-bold">
                      Blocks
                    </div>
                    <div className="font-bold">{s2e.bTot}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
        {renderOpponentReportModal()}
        {renderPlayerSecurity()}
        {renderInstallModal()}
      </div>
    );
  }

  if (view === "stats") {
    const rawTeam = myTeams.find((t) => t.id === activeTeam);
    const teamInfo = {
      name: rawTeam?.name || effectiveTeamName || "Team Data",
      color: rawTeam?.color || "from-slate-600 to-slate-800",
      role: effectiveRole,
    };
    return (
      <div className="min-h-screen bg-slate-100 p-2 sm:p-8 font-sans flex flex-col relative z-50">
        <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-slate-200 flex-1 flex flex-col overflow-hidden max-w-[1400px] mx-auto w-full">
          <div className="bg-gradient-to-r from-[#001b5e] via-[#0033A0] to-[#001b5e] p-4 sm:p-6 text-white shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="mr-1 sm:mr-2 flex items-center justify-center h-10 w-10 sm:h-16 sm:w-16 overflow-hidden relative shrink-0">
                  <img
                    src={APP_LOGO_SRC}
                    alt="UCC Lancers Logo"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-contain absolute inset-0 z-10"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.fallback) {
                        target.dataset.fallback = "true";
                        target.src = FALLBACK_LOGO_SRC;
                      } else {
                        target.style.display = "none";
                      }
                    }}
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black tracking-widest uppercase drop-shadow-md">
                      Database Stats
                    </h1>
                    {isPlayerRole && (
                      <span className="bg-amber-400/20 border border-amber-300/40 text-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm backdrop-blur-sm">
                        <ShieldAlert size={12} className="text-amber-300" />
                        Player View (Device Only)
                      </span>
                    )}
                    {isCoachRole && (
                      <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                        <Shield size={12} className="text-emerald-400" />
                        <span>Coach Mode</span>
                      </div>
                    )}
                  </div>
                  {activeMatch && (
                    <div className="text-[11px] font-semibold text-blue-200 flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>
                        Match in Session: <strong className="text-white">{activeMatch.opponent ? `vs ${activeMatch.opponent}` : activeMatch.title || "Match"}</strong> (Set {currentSetNum}, {score.ucc}-{score.opp})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION TOOLBAR & NAVIGATION */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
                {/* 1. PRIMARY GAME & MENU BUTTONS - ALWAYS PROMINENT AND VISIBLE */}
                {(activeMatch || (appData.matches && appData.matches.some((m: any) => m.isLive === true)) || lastActiveMatchRef.current) && (
                  <button
                    type="button"
                    onClick={returnToActiveGame}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 sm:py-2.5 rounded-xl font-black flex items-center justify-center shadow-lg text-xs sm:text-sm uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer ring-2 ring-emerald-300"
                    title="Return directly back into the live game or practice"
                  >
                    <Play className="mr-1.5 fill-current shrink-0" size={15} />
                    <span>
                      {activeMatch?.type === "Practice" || lastActiveMatchRef.current?.type === "Practice"
                        ? "Return to Practice"
                        : "Return to Game"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setView("menu")}
                  className="bg-white/15 hover:bg-white/25 text-white px-3.5 py-2 sm:py-2.5 rounded-xl font-black flex items-center justify-center shadow-sm text-[11px] sm:text-xs uppercase tracking-wider border border-white/20 transition-colors cursor-pointer active:scale-95"
                  title="Main Menu"
                >
                  <Home className="mr-1.5 shrink-0" size={14} />
                  <span>Menu</span>
                </button>

                <button
                  type="button"
                  onClick={runDebugDiagnostics}
                  className="bg-indigo-600/80 hover:bg-indigo-600 text-white px-3 py-2 sm:py-2.5 rounded-xl font-black flex items-center justify-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider border border-indigo-400/30 transition-colors cursor-pointer active:scale-95"
                  title="Run state & session diagnostics"
                >
                  <Activity className="mr-1 sm:mr-1.5 shrink-0" size={13} />
                  <span>Debug</span>
                </button>

                {/* 2. SECONDARY TOOLS */}
                <button
                  onClick={() => setView("compare")}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 sm:py-2.5 rounded-xl font-black flex items-center justify-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <ArrowRightLeft className="mr-1 sm:mr-1.5" size={13} /> Compare
                </button>

                {isPlayerRole && (
                  <button
                    type="button"
                    onClick={() => setShowCoachLoginModal(true)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-2 sm:py-2.5 rounded-xl font-black flex items-center justify-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    title="Sign in with Coach account or enter Coach Code"
                  >
                    <Shield className="mr-1 sm:mr-1.5" size={13} /> Coach Login
                  </button>
                )}

                {teamInfo.role !== "player" && (
                  <>
                    <button
                      onClick={() => setShowPlayerAccessModal(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 sm:py-2.5 rounded-xl font-black flex items-center justify-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider transition-colors cursor-pointer"
                      title="View which players & Google accounts have accessed stats"
                    >
                      <Eye className="mr-1 sm:mr-1.5" size={13} /> Player Access
                    </button>
                    <button
                      type="button"
                      onClick={togglePlayerAccess}
                      className={`flex-none ${
                        isPlayerAccessAllowed
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                          : "bg-red-600 hover:bg-red-700 text-white shadow-red-500/20"
                      } px-3 py-2 sm:py-2.5 rounded-xl font-black flex items-center justify-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider transition-colors cursor-pointer`}
                      title={
                        isPlayerAccessAllowed
                          ? "Player access to stats is currently OPEN. Click to lock/disable."
                          : "Player access to stats is currently LOCKED. Click to unlock/allow."
                      }
                    >
                      {isPlayerAccessAllowed ? (
                        <>
                          <Unlock className="mr-1 sm:mr-1.5" size={13} /> Players: ON
                        </>
                      ) : (
                        <>
                          <Lock className="mr-1 sm:mr-1.5" size={13} /> Players: OFF
                        </>
                      )}
                    </button>
                    <button
                      onClick={exportCSV}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 sm:py-2.5 rounded-xl font-black flex items-center justify-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <Download className="mr-1 sm:mr-1.5" size={13} /> CSV
                    </button>
                    <button
                      onClick={exportPDF}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 sm:py-2.5 rounded-xl font-black flex items-center justify-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <FileText className="mr-1 sm:mr-1.5" size={13} /> PDF
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    const currentMatchNav = statsPath.find((p) => p.level === "match");
                    const currentSetNav = statsPath.find((p) => p.level === "set");
                    setStatCorrectionConfig({
                      isOpen: true,
                      initialMatchId: currentMatchNav?.id || activeMatch?.id || null,
                      initialSetId: currentSetNav?.id || activeSetId || null,
                    });
                  }}
                  className="bg-amber-400 hover:bg-amber-500 text-slate-950 px-3 py-2 sm:py-2.5 rounded-xl font-black flex items-center justify-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider cursor-pointer transition-colors"
                  title={teamInfo.role === "player" ? "View recorded stats" : "Edit recorded stats"}
                >
                  <Edit3 className="mr-1 sm:mr-1.5" size={13} /> {teamInfo.role === "player" ? "Stat Log" : "Edit Stats"}
                </button>

                <button
                  onClick={toggleFullscreen}
                  className="bg-white/10 hover:bg-white/20 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl font-black flex items-center justify-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider border border-white/20 transition-colors"
                  title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
                >
                  {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
                </button>

                <button
                  onClick={handleInstallApp}
                  className="bg-white/10 hover:bg-white/20 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl font-black flex items-center justify-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider border border-white/20 transition-colors"
                  title="Download App"
                >
                  <Download size={13} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-3 sm:p-4 text-white overflow-x-auto whitespace-nowrap shadow-inner border-b border-slate-700 scrollbar-hide">
            <div className="flex items-center space-x-2 text-[10px] sm:text-xs font-bold tracking-widest uppercase">
              {statsPath.map((nav, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <ChevronRight
                      size={14}
                      className="text-slate-500 flex-shrink-0"
                    />
                  )}
                  <button
                    onClick={() => popStatsTo(idx)}
                    className={`flex-shrink-0 hover:text-white transition-colors cursor-pointer ${
                      idx === statsPath.length - 1
                        ? "text-white bg-white/20 px-3 py-1 rounded-full font-black"
                        : "text-slate-400"
                    }`}
                  >
                    {idx === 0 ? (
                      <span className="flex items-center gap-1.5">
                        <BarChart3 size={13} className="text-[#0033A0]" />
                        <span>{nav.name}</span>
                      </span>
                    ) : (
                      nav.name
                    )}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Enhanced Hierarchical Scope & Cascading Drill-Down Filter Bar */}
          <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 shadow-2xs flex flex-col gap-3">
            {/* Tier 1: Main Scope Modes */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider mr-1 flex-shrink-0">
                  Mode:
                </span>
                <button
                  type="button"
                  onClick={() => setSeasonScope("games")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
                    isGamesBranch
                      ? "bg-[#0033A0] text-white shadow-sm ring-2 ring-[#0033A0]/20"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                  }`}
                  title="Games: All Games -> Day / Tournament -> Specific Game -> Set"
                >
                  <span><span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span> Games</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isGamesBranch
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {gameCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSeasonScope("practice")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
                    isPracticeBranch
                      ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-600/20"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                  }`}
                  title="Practices: All Practices -> Practice Day -> Drill"
                >
                  <span>Practices</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isPracticeBranch
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {practiceDaysList.length > 0 ? practiceDaysList.length : practiceCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSeasonScope("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
                    isCombinedBranch
                      ? "bg-slate-800 text-white shadow-sm ring-2 ring-slate-800/20"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                  }`}
                  title="Combined season totals across all matches and practice sessions"
                >
                  <span>Season Totals</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isCombinedBranch
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {gameCount + practiceCount}
                  </span>
                </button>
              </div>

              {/* Quick Jump Selector */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <label
                  htmlFor="quick-stats-nav"
                  className="text-[11px] font-bold text-slate-500 whitespace-nowrap hidden sm:inline"
                >
                  Jump To:
                </label>
                <select
                  id="quick-stats-nav"
                  value={currentQuickSelectValue}
                  onChange={(e) => handleQuickSelect(e.target.value)}
                  className="w-full sm:w-auto bg-slate-50 hover:bg-white text-slate-800 text-xs font-bold border border-slate-300 rounded-lg px-3 py-1.5 shadow-2xs focus:ring-2 focus:ring-[#0033A0] focus:border-[#0033A0] transition-colors cursor-pointer"
                >
                  <optgroup label="── SEASON TOTALS ──">
                    <option value="season_all">
                      Season Totals
                    </option>
                    <option value="season_games">
                      <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span> All Games (Season)
                    </option>
                    <option value="season_practice">
                      All Practices (Season)
                    </option>
                  </optgroup>
                  {tournamentsList.length > 0 && (
                    <optgroup label="── TOURNAMENTS ──">
                      {tournamentsList.map((t: any) => (
                        <option key={t.id} value={`event_${t.id}`}>
                          Tourney: {t.name} ({t.count} game{t.count !== 1 ? "s" : ""})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {gameMatchesList.length > 0 && (
                    <optgroup label="── SPECIFIC GAMES ──">
                      {gameMatchesList.map((m: any) => (
                        <option key={m.id} value={`match_${m.id}`}>
                          <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span> vs {m.opponent} ({m.dateStr})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {practiceDaysList.length > 0 && (
                    <optgroup label="── PRACTICE DAYS ──">
                      {practiceDaysList.map((p: any) => (
                        <option key={p.id} value={`event_${p.id}`}>
                          {p.name} ({p.drillCount} drill{p.drillCount !== 1 ? "s" : ""})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            {/* Tier 2: Cascading Filter Drill-Down Pipeline Bar */}
            {isGamesBranch && (
              <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 overflow-x-auto">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 tracking-wider">
                    Games Filter:
                  </span>
                  <button
                    type="button"
                    onClick={() => selectGameEvent("all_events")}
                    className={`text-xs font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer flex-shrink-0 ${
                      !activeEventNav && !activeMatchNav && !activeSetNav
                        ? "bg-[#0033A0] text-white shadow-xs"
                        : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-300"
                    }`}
                  >
                    All Games (Season)
                  </button>
                </div>

                <ChevronRight size={14} className="text-slate-400 hidden sm:block flex-shrink-0" />

                {/* Day / Tournament Dropdown */}
                <div className="flex items-center gap-1.5 flex-1 min-w-[170px]">
                  <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Day / Tourney:</span>
                  <select
                    value={activeEventNav ? activeEventNav.id : "all_events"}
                    onChange={(e) => selectGameEvent(e.target.value)}
                    className={`w-full text-xs font-bold rounded-lg px-2.5 py-1 transition-colors cursor-pointer border ${
                      activeEventNav
                        ? "bg-blue-50 border-blue-400 text-blue-900 font-black shadow-2xs"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    <option value="all_events">── All Days & Tournaments ──</option>
                    {gameEventsList.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.isTournament ? "Tourney: " : "Date: "} {e.name} ({e.matchCount} game{e.matchCount !== 1 ? "s" : ""})
                      </option>
                    ))}
                  </select>
                </div>

                <ChevronRight size={14} className="text-slate-400 hidden sm:block flex-shrink-0" />

                {/* Specific Game Dropdown */}
                <div className="flex items-center gap-1.5 flex-1 min-w-[170px]">
                  <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Game:</span>
                  <select
                    value={activeMatchNav ? activeMatchNav.id : "all_games_in_event"}
                    onChange={(e) => selectSpecificGame(e.target.value)}
                    className={`w-full text-xs font-bold rounded-lg px-2.5 py-1 transition-colors cursor-pointer border ${
                      activeMatchNav
                        ? "bg-blue-50 border-blue-400 text-blue-900 font-black shadow-2xs"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    <option value="all_games_in_event">
                      {activeEventNav ? "── All Games in Event ──" : "── Pick Specific Game ──"}
                    </option>
                    {(activeEventNav
                      ? appData.matches.filter(
                          (m) => m.type !== "Practice" && getEventDetails(m).id === activeEventNav.id
                        )
                      : gameMatchesList
                    ).map((m) => (
                      <option key={m.id} value={m.id}>
                        <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded shadow-xs">SRV</span> vs {m.opponent} {m.dateStr ? `(${m.dateStr})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <ChevronRight size={14} className="text-slate-400 hidden sm:block flex-shrink-0" />

                {/* Set Dropdown */}
                <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                  <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Set:</span>
                  <select
                    value={activeSetNav ? activeSetNav.id : "all_sets"}
                    onChange={(e) => selectGameSet(e.target.value)}
                    disabled={!activeMatchNav}
                    className={`w-full text-xs font-bold rounded-lg px-2.5 py-1 transition-colors cursor-pointer border ${
                      activeSetNav
                        ? "bg-blue-50 border-blue-400 text-blue-900 font-black shadow-2xs"
                        : !activeMatchNav
                        ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    <option value="all_sets">
                      {activeMatchNav ? "── All Sets (Full Game) ──" : "(Select Game First)"}
                    </option>
                    {activeMatchNav &&
                      appData.sets
                        .filter((s) => s.matchId === activeMatchNav.id)
                        .sort((a, b) => a.setNum - b.setNum)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            Set {s.setNum} ({s.scoreUcc || 0}-{s.scoreOpp || 0})
                          </option>
                        ))}
                  </select>
                </div>
              </div>
            )}

            {isPracticeBranch && (
              <div className="bg-amber-50/60 rounded-xl p-2.5 sm:p-3 border border-amber-200/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 overflow-x-auto">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 tracking-wider">
                    Practice Filter:
                  </span>
                  <button
                    type="button"
                    onClick={() => selectPracticeDay("all_practice_days")}
                    className={`text-xs font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer flex-shrink-0 ${
                      !activeEventNav && !activeDrillNav
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-white text-slate-700 hover:bg-amber-100 border border-slate-300"
                    }`}
                  >
                    All Practices (Season)
                  </button>
                </div>

                <ChevronRight size={14} className="text-amber-500 hidden sm:block flex-shrink-0" />

                {/* Practice Day Dropdown */}
                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                  <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">Practice Day:</span>
                  <select
                    value={activeEventNav ? activeEventNav.id : "all_practice_days"}
                    onChange={(e) => selectPracticeDay(e.target.value)}
                    className={`w-full text-xs font-bold rounded-lg px-2.5 py-1 transition-colors cursor-pointer border ${
                      activeEventNav
                        ? "bg-white border-amber-500 text-amber-900 font-black shadow-2xs"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    <option value="all_practice_days">── All Practice Days ──</option>
                    {practiceDaysList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.drillCount} drill{p.drillCount !== 1 ? "s" : ""})
                      </option>
                    ))}
                  </select>
                </div>

                <ChevronRight size={14} className="text-amber-500 hidden sm:block flex-shrink-0" />

                {/* Drill Dropdown */}
                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                  <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">Drill:</span>
                  <select
                    value={activeDrillNav ? activeDrillNav.id : "all_drills_in_day"}
                    onChange={(e) => selectPracticeDrill(e.target.value)}
                    disabled={!activeEventNav}
                    className={`w-full text-xs font-bold rounded-lg px-2.5 py-1 transition-colors cursor-pointer border ${
                      activeDrillNav
                        ? "bg-white border-amber-500 text-amber-900 font-black shadow-2xs"
                        : !activeEventNav
                        ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    <option value="all_drills_in_day">
                      {activeEventNav ? "── All Drills Today (Day Total) ──" : "(Select Practice Day First)"}
                    </option>
                    {activeEventNav &&
                      getDrillsForPracticeEvent(activeEventNav.id).map((d) => (
                        <option key={d.id} value={d.id}>
                          Drill: {d.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Drill-down Sub-navigation Cards */}
          {subNavOptions.length > 0 && (
            <div className="bg-slate-100 p-3 sm:p-4 border-b border-slate-200 shadow-sm">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ListFilter size={13} className="text-[#0033A0]" />
                    {currentNav.level === "season"
                      ? isPracticeBranch
                        ? "Select Practice Day:"
                        : isGamesBranch
                        ? "Select Tournament or Game Day:"
                        : "Select Event to View:"
                      : currentNav.level === "event"
                      ? isPracticeBranch
                        ? "Select Drill on This Day:"
                        : "Select Specific Game:"
                      : currentNav.level === "match"
                      ? "Select Set:"
                      : currentNav.level === "drill"
                      ? "Jump to Another Drill on This Day:"
                      : currentNav.level === "set"
                      ? "Jump to Another Set in This Game:"
                      : "Available Sub-Sections:"}
                  </span>

                  {currentNav.level === "season" && currentNav.id === "all" && (
                    <div className="flex items-center gap-1 pb-1 overflow-x-auto scrollbar-hide">
                      <button
                        type="button"
                        onClick={() => setSubnavCategoryFilter("all")}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer flex-shrink-0 ${
                          subnavCategoryFilter === "all"
                            ? "bg-slate-800 text-white shadow-xs"
                            : "bg-white text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        All ({subNavOptions.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubnavCategoryFilter("games")}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer flex-shrink-0 ${
                          subnavCategoryFilter === "games"
                            ? "bg-blue-700 text-white shadow-xs"
                            : "bg-white text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Games ({subNavOptions.filter((o) => !o.isPractice).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubnavCategoryFilter("practices")}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer flex-shrink-0 ${
                          subnavCategoryFilter === "practices"
                            ? "bg-amber-700 text-white shadow-xs"
                            : "bg-white text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Practices ({subNavOptions.filter((o) => o.isPractice).length})
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex overflow-x-auto gap-2 sm:gap-3 pb-1 scrollbar-hide items-center">
                  {subNavOptions
                    .filter((opt) => {
                      if (
                        currentNav.level !== "season" ||
                        currentNav.id !== "all"
                      ) {
                        return true;
                      }
                      if (subnavCategoryFilter === "games")
                        return !opt.isPractice;
                      if (subnavCategoryFilter === "practices")
                        return opt.isPractice;
                      return true;
                    })
                    .map((opt) => (
                      <div
                        key={opt.id}
                        className={`flex-shrink-0 flex items-center bg-white border rounded-xl overflow-hidden shadow-xs transition-all group ${
                          opt.isActive
                            ? "border-[#0033A0] ring-2 ring-[#0033A0]/25 bg-blue-50/30"
                            : "border-slate-300 hover:border-[#0033A0]"
                        }`}
                      >
                        <button
                          onClick={() =>
                            navigateStats(opt.level, opt.id, opt.name)
                          }
                          className={`px-3 sm:px-4 py-2 font-bold text-xs sm:text-sm whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                            opt.isActive
                              ? "bg-[#0033A0] text-white"
                              : "text-slate-700 hover:bg-[#0033A0] hover:text-white"
                          }`}
                        >
                          {opt.level === "drill" || opt.isDrill ? (
                            <span className="bg-emerald-100 text-emerald-800 group-hover:bg-white/20 group-hover:text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                              <Target size={11} /> Drill
                            </span>
                          ) : opt.level === "set" ? (
                            <span className="bg-violet-100 text-violet-800 group-hover:bg-white/20 group-hover:text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                              <Layers size={11} /> Set
                            </span>
                          ) : opt.isPractice ? (
                            <span className="bg-amber-100 text-amber-800 group-hover:bg-white/20 group-hover:text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                              <Activity size={11} /> Practice Day
                            </span>
                          ) : opt.isTournament ? (
                            <span className="bg-indigo-100 text-indigo-800 group-hover:bg-white/20 group-hover:text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                              <Trophy size={11} /> Tournament
                            </span>
                          ) : (
                            <span className="bg-blue-100 text-blue-800 group-hover:bg-white/20 group-hover:text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                              <Calendar size={11} /> Game Day
                            </span>
                          )}

                          <span>{opt.name}</span>
                          {opt.score && (
                            <span className="text-[10px] opacity-85 font-mono ml-0.5">
                              [{opt.score}]
                            </span>
                          )}
                          {opt.matchCount && opt.matchCount > 1 && (
                            <span className="text-[10px] opacity-75 font-normal">
                              ({opt.matchCount} {opt.isPractice ? "drills" : "games"})
                            </span>
                          )}
                        </button>
                        {teamInfo.role !== "player" && opt.level === "match" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const matchObj = appData.matches.find((m) => m.id === opt.id);
                              setTeamNameModalConfig({
                                isOpen: true,
                                ourTeamName: effectiveTeamName,
                                opponentTeamName: matchObj?.opponent || "",
                                targetMatchId: opt.id,
                                targetMatchTitle: opt.name,
                                showOpponentEdit: true,
                              });
                            }}
                            className="px-2.5 py-2 text-slate-400 hover:text-[#0033A0] hover:bg-blue-50 transition-colors border-l border-slate-200 cursor-pointer"
                            title="Adjust Team & Opponent Names"
                          >
                            <Edit3 size={13} />
                          </button>
                        )}
                        {teamInfo.role !== "player" && opt.level === "set" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const setObj = appData.sets.find((s) => s.id === opt.id);
                              if (setObj) {
                                setSetScoreModalConfig({
                                  isOpen: true,
                                  set: setObj,
                                  matchTitle: currentNav.name,
                                });
                              }
                            }}
                            className="px-2.5 py-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border-l border-slate-200 cursor-pointer"
                            title="Adjust Set Score"
                          >
                            <Edit3 size={13} />
                          </button>
                        )}
                        {teamInfo.role === "coach" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (opt.level === "drill") {
                                if (
                                  window.confirm(
                                    `DELETE DRILL: Are you sure you want to delete "${opt.name}"? All stats recorded during this drill will be permanently erased.`,
                                  )
                                ) {
                                  if (opt.setId) handleDeleteSet(opt.setId);
                                  else if (opt.matchId) handleDeleteMatch(opt.matchId);
                                }
                                return;
                              }
                              if (opt.level === "match")
                                handleDeleteMatch(opt.id);
                              if (opt.level === "set") handleDeleteSet(opt.id);
                              if (opt.level === "event") {
                                if (
                                  window.confirm(
                                    `DELETE DAY: Are you sure you want to delete this entire day/event "${opt.name}"? This will permanently erase all games and stats within it.`,
                                  )
                                ) {
                                  handleDeleteEvent(
                                    opt.id,
                                    opt.id === "practice_sessions" ||
                                      opt.isPractice,
                                  );
                                }
                              }
                            }}
                            className="px-2.5 py-2 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-slate-200 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          <div className="p-3 sm:p-8 flex-1 overflow-y-auto bg-slate-50/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-widest uppercase flex items-center">
                    <Shield className="mr-2 text-[#0033A0]" size={18} /> {effectiveTeamName}
                  </h2>
                  <span className="bg-[#0033A0]/10 text-[#0033A0] text-xs font-black px-2.5 py-0.5 rounded-full border border-[#0033A0]/20">
                    {currentNav.name}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500">
                  {currentNav.level === "season" && currentNav.id === "all" && (
                    <span>
                      Combined season totals across all {gameCount} game
                      {gameCount !== 1 ? "s" : ""} & tournament
                      {gameCount !== 1 ? "s" : ""} and {practiceCount} practice session
                      {practiceCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {currentNav.level === "season" && currentNav.id === "games" && (
                    <span>
                      Season totals for {gameCount} game
                      {gameCount !== 1 ? "s" : ""} & tournament
                      {gameCount !== 1 ? "s" : ""} (practices excluded)
                    </span>
                  )}
                  {currentNav.level === "season" && currentNav.id === "practice" && (
                    <span>
                      Season totals for {practiceCount} practice session
                      {practiceCount !== 1 ? "s" : ""} only
                    </span>
                  )}
                  {currentNav.level === "event" && (
                    <span>Filtered to event: {currentNav.name}</span>
                  )}
                  {currentNav.level === "match" && (
                    <span>Filtered to match: {currentNav.name}</span>
                  )}
                  {currentNav.level === "set" && (
                    <span>Filtered to {currentNav.name}</span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowPlayerFilterModal(true)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-black flex items-center gap-1.5 transition-all shadow-sm ${
                    hiddenPlayerIds.length > 0
                      ? "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                  title="Filter visible players in Stats Table and PDF export"
                >
                  {hiddenPlayerIds.length > 0 ? (
                    <EyeOff size={14} className="text-amber-600 shrink-0" />
                  ) : (
                    <Eye size={14} className="text-slate-500 shrink-0" />
                  )}
                  <span>
                    Players (
                    {
                      Object.values(uccStats).filter(
                        (p) =>
                          !isPlayerHidden(p) &&
                          (showRetired || !p.isRetired)
                      ).length
                    }
                    /
                    {
                      Object.values(uccStats).filter(
                        (p) => showRetired || !p.isRetired
                      ).length
                    }
                    )
                  </span>
                  {hiddenPlayerIds.length > 0 && (
                    <span className="bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-[9px] font-black">
                      {
                        Object.values(uccStats).filter(
                          (p) =>
                            isPlayerHidden(p) &&
                            (showRetired || !p.isRetired)
                        ).length
                      }{" "}
                      hidden
                    </span>
                  )}
                </button>

                <label className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <input
                    type="checkbox"
                    checked={showRetired}
                    onChange={(e) => setShowRetired(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  Retired
                </label>

                <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 flex items-center shadow-sm flex-1 sm:w-56">
                  <span className="text-slate-400 font-bold mr-2 text-xs">
                    Search
                  </span>
                  <input
                    type="text"
                    placeholder="Player / #"
                    value={statFilter === "all" ? "" : statFilter}
                    onChange={(e) => setStatFilter(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm font-bold text-slate-700 w-full"
                  />
                  {statFilter !== "all" && statFilter !== "" && (
                    <button
                      onClick={() => setStatFilter("all")}
                      className="text-slate-400 hover:text-slate-600 ml-2"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const activeMatchNav = statsPath.find((p) => p.level === "match");
                    const matchObj = activeMatchNav
                      ? appData.matches.find((m) => m.id === activeMatchNav.id)
                      : activeMatch;
                    setTeamNameModalConfig({
                      isOpen: true,
                      ourTeamName: effectiveTeamName,
                      opponentTeamName: matchObj?.opponent || "",
                      targetMatchId: matchObj?.id,
                      targetMatchTitle: matchObj ? `vs ${matchObj.opponent}` : undefined,
                      showOpponentEdit: !!matchObj,
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                  title="Adjust team or opponent names"
                >
                  <Shield size={13} className="text-[#0033A0]" />
                  <span>Adjust Names</span>
                </button>

                {currentNav.level === "set" && (
                  <button
                    type="button"
                    onClick={() => {
                      const setObj = appData.sets.find((s) => s.id === currentNav.id);
                      if (setObj) {
                        setSetScoreModalConfig({
                          isOpen: true,
                          set: setObj,
                          matchTitle: statsPath.find((p) => p.level === "match")?.name,
                        });
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                    title="Adjust set score"
                  >
                    <Edit3 size={13} className="text-indigo-600" />
                    <span>Adjust Score</span>
                  </button>
                )}
              </div>
            </div>

            {/* Main Lancers Stats Table */}
            {(() => {
              const allUccPlayers = Object.values(uccStats).filter((p) => {
                if (!showRetired && p.isRetired) return false;
                return true;
              });

              const visibleUccPlayers = allUccPlayers.filter((p) => {
                if (isPlayerHidden(p)) return false;
                if (statFilter !== "all" && statFilter !== "") {
                  const searchLower = statFilter.toLowerCase();
                  return (
                    p.name.toLowerCase().includes(searchLower) ||
                    (p.number || "").toString().includes(searchLower)
                  );
                }
                return true;
              });

              const hasHiddenPlayers = allUccPlayers.some((p) => isPlayerHidden(p));
              const hiddenCount = allUccPlayers.filter((p) => isPlayerHidden(p)).length;

              // Whole Team Totals & Averages
              const teamTot = allUccPlayers.reduce(
                (acc, p) => {
                  acc.passCount += p.passCount || 0;
                  acc.passSum += p.passSum || 0;
                  acc.pass3 += p.pass3 || 0;
                  acc.pass2 += p.pass2 || 0;
                  acc.pass1 += p.pass1 || 0;
                  acc.pass0 += p.pass0 || 0;
                  acc.digCount += p.digCount || 0;
                  acc.digErr += p.digErr || 0;
                  acc.attCount += p.attCount || 0;
                  acc.attCountFront += p.attCountFront || 0;
                  acc.attCountBack += p.attCountBack || 0;
                  acc.attKill += p.attKill || 0;
                  acc.attErr += p.attErr || 0;
                  acc.attErrNet += p.attErrNet || 0;
                  acc.attErrOut += p.attErrOut || 0;
                  acc.attErrStuffed += p.attErrStuffed || 0;
                  acc.attBlk += p.attBlk || 0;
                  acc.blkCount += p.blkCount || 0;
                  acc.blkStuff += p.blkStuff || 0;
                  acc.blkLate += p.blkLate || 0;
                  acc.blkNet += p.blkNet || 0;
                  acc.blkUsed += p.blkUsed || 0;
                  acc.srvCount += p.srvCount || 0;
                  acc.srvAce += p.srvAce || 0;
                  acc.srvErr += p.srvErr || 0;
                  acc.srvErrNet += p.srvErrNet || 0;
                  acc.srvErrWide += p.srvErrWide || 0;
                  acc.srvErrLong += p.srvErrLong || 0;
                  acc.srvErrFoot += p.srvErrFoot || 0;
                  acc.srvErrOther += p.srvErrOther || 0;
                  return acc;
                },
                {
                  id: "TEAM_TOTALS",
                  name: "Team Totals (Whole Team)",
                  number: "ALL",
                  passCount: 0,
                  passSum: 0,
                  pass3: 0,
                  pass2: 0,
                  pass1: 0,
                  pass0: 0,
                  digCount: 0,
                  digErr: 0,
                  attCount: 0,
                  attCountFront: 0,
                  attCountBack: 0,
                  attKill: 0,
                  attErr: 0,
                  attErrNet: 0,
                  attErrOut: 0,
                  attErrStuffed: 0,
                  attBlk: 0,
                  blkCount: 0,
                  blkStuff: 0,
                  blkLate: 0,
                  blkNet: 0,
                  blkUsed: 0,
                  srvCount: 0,
                  srvAce: 0,
                  srvErr: 0,
                  srvErrNet: 0,
                  srvErrWide: 0,
                  srvErrLong: 0,
                  srvErrFoot: 0,
                  srvErrOther: 0,
                }
              );

              const teamPassAvg =
                teamTot.passCount > 0
                  ? (teamTot.passSum / teamTot.passCount).toFixed(2)
                  : "-";
              const teamBlkTot = teamTot.blkCount + teamTot.blkStuff;
              const teamSrvTot =
                teamTot.srvCount + teamTot.srvAce + teamTot.srvErr;
              const teamKillPct =
                teamTot.attCount > 0
                  ? ((teamTot.attKill / teamTot.attCount) * 100).toFixed(1) +
                    "%"
                  : "0.0%";
              const teamSrvPlusMinus = teamTot.srvAce - teamTot.srvErr;

              // Shown Players Totals & Averages (Visible Subset)
              const shownTot = visibleUccPlayers.reduce(
                (acc, p) => {
                  acc.passCount += p.passCount || 0;
                  acc.passSum += p.passSum || 0;
                  acc.pass3 += p.pass3 || 0;
                  acc.pass2 += p.pass2 || 0;
                  acc.pass1 += p.pass1 || 0;
                  acc.pass0 += p.pass0 || 0;
                  acc.digCount += p.digCount || 0;
                  acc.digErr += p.digErr || 0;
                  acc.attCount += p.attCount || 0;
                  acc.attCountFront += p.attCountFront || 0;
                  acc.attCountBack += p.attCountBack || 0;
                  acc.attKill += p.attKill || 0;
                  acc.attErr += p.attErr || 0;
                  acc.attErrNet += p.attErrNet || 0;
                  acc.attErrOut += p.attErrOut || 0;
                  acc.attErrStuffed += p.attErrStuffed || 0;
                  acc.attBlk += p.attBlk || 0;
                  acc.blkCount += p.blkCount || 0;
                  acc.blkStuff += p.blkStuff || 0;
                  acc.blkLate += p.blkLate || 0;
                  acc.blkNet += p.blkNet || 0;
                  acc.blkUsed += p.blkUsed || 0;
                  acc.srvCount += p.srvCount || 0;
                  acc.srvAce += p.srvAce || 0;
                  acc.srvErr += p.srvErr || 0;
                  acc.srvErrNet += p.srvErrNet || 0;
                  acc.srvErrWide += p.srvErrWide || 0;
                  acc.srvErrLong += p.srvErrLong || 0;
                  acc.srvErrFoot += p.srvErrFoot || 0;
                  acc.srvErrOther += p.srvErrOther || 0;
                  return acc;
                },
                {
                  id: "SHOWN_PLAYERS",
                  name: "Shown Players (Avg & Tot)",
                  number: "SHOWN",
                  passCount: 0,
                  passSum: 0,
                  pass3: 0,
                  pass2: 0,
                  pass1: 0,
                  pass0: 0,
                  digCount: 0,
                  digErr: 0,
                  attCount: 0,
                  attCountFront: 0,
                  attCountBack: 0,
                  attKill: 0,
                  attErr: 0,
                  attErrNet: 0,
                  attErrOut: 0,
                  attErrStuffed: 0,
                  attBlk: 0,
                  blkCount: 0,
                  blkStuff: 0,
                  blkLate: 0,
                  blkNet: 0,
                  blkUsed: 0,
                  srvCount: 0,
                  srvAce: 0,
                  srvErr: 0,
                  srvErrNet: 0,
                  srvErrWide: 0,
                  srvErrLong: 0,
                  srvErrFoot: 0,
                  srvErrOther: 0,
                }
              );

              const shownPassAvg =
                shownTot.passCount > 0
                  ? (shownTot.passSum / shownTot.passCount).toFixed(2)
                  : "-";
              const shownBlkTot = shownTot.blkCount + shownTot.blkStuff;
              const shownSrvTot =
                shownTot.srvCount + shownTot.srvAce + shownTot.srvErr;
              const shownKillPct =
                shownTot.attCount > 0
                  ? ((shownTot.attKill / shownTot.attCount) * 100).toFixed(1) +
                    "%"
                  : "0.0%";
              const shownSrvPlusMinus = shownTot.srvAce - shownTot.srvErr;

              const isTeamTotConcealed = isPlayerRole && !isFullTableRevealed && revealedPlayerId !== "TEAM_TOTALS";
              const isShownTotConcealed = isPlayerRole && !isFullTableRevealed && revealedPlayerId !== "SHOWN_PLAYERS";

              return (
                <div className="flex flex-col">
                  {/* Hidden players alert banner with interactive unhide chips */}
                  {hasHiddenPlayers && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-3.5 mb-4 flex flex-col gap-2.5 text-xs text-amber-900 font-bold shadow-sm">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <EyeOff size={16} className="text-amber-600 shrink-0" />
                          <span>
                            <strong>{hiddenCount}</strong> player{hiddenCount !== 1 ? "s" : ""} hidden. Hidden player rows are removed from table & PDF. <strong>Team Totals</strong> reflect the whole team average, while <strong>Shown Players (Avg)</strong> reflects only visible players.
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setHiddenPlayerIds([])}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer"
                          >
                            Show All
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPlayerFilterModal(true)}
                            className="bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 px-2.5 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer"
                          >
                            Manage
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-amber-200/70">
                        <span className="text-[10px] uppercase font-black tracking-wider text-amber-800 mr-1">
                          Click to restore row:
                        </span>
                        {allUccPlayers
                          .filter((p) => isPlayerHidden(p))
                          .map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleHidePlayer(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-amber-300 text-amber-900 text-xs hover:bg-amber-100 hover:border-amber-400 transition-colors font-semibold shadow-2xs group cursor-pointer"
                              title={`Click to show ${p.name}'s row in stats table`}
                            >
                              <span className="font-black text-[10px] text-amber-700">
                                #{p.number || "-"}
                              </span>
                              <span>{p.name}</span>
                              <span className="text-amber-500 group-hover:text-amber-800 font-bold ml-1 text-xs">
                                X
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Player Access Closed Notice */}
                  {isPlayerRole && !isPlayerAccessAllowed && (
                    <div className="bg-slate-900 border-2 border-red-500/40 rounded-3xl p-8 sm:p-12 my-6 text-white text-center shadow-2xl max-w-xl mx-auto select-none">
                      <div className="h-20 w-20 rounded-3xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-5 text-red-400 shadow-inner">
                        <Lock size={40} />
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white mb-2">
                        Player Access Currently Closed
                      </h2>
                      <p className="text-slate-300 text-sm leading-relaxed mb-6 max-w-md mx-auto">
                        Your coaching staff has temporarily closed player access to team statistics. Check back later or contact your coach.
                      </p>
                      <div className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-800/90 py-2 px-4 rounded-xl border border-slate-700 mb-6">
                        <span>Account:</span>
                        <span className="text-amber-400 font-bold">{user?.email || "Guest / Google Account"}</span>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowCoachLoginModal(true)}
                          className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl mx-auto transition-transform active:scale-95 cursor-pointer"
                        >
                          <Shield size={18} />
                          <span>Coach Login / Enter Coach Code</span>
                        </button>
                        <p className="text-slate-400 text-[11px] mt-2.5">
                          Are you a coach? Log in or enter your coach code to access all stats regardless of lock.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Player Confidential View Banner & Hold-to-Reveal Control */}
                  {isPlayerRole && isPlayerAccessAllowed && (
                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-500/40 rounded-2xl p-4 mb-4 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
                          <Shield size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-xs uppercase tracking-wider text-amber-300">
                              Player View-Only Mode
                            </span>
                            <span className="text-[10px] bg-red-950/90 text-red-300 px-2.5 py-0.5 rounded-full font-bold border border-red-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                              Screenshot Shield Active
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-mono border border-slate-700">
                              {user?.email || "Google Account"}
                            </span>
                          </div>
                          <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">
                            Press & hold any player row or use the button to reveal numbers. Taking screenshots or screen recordings produces a solid black screen and is audited to your coach.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                        <button
                          type="button"
                          onMouseDown={() => setIsFullTableRevealed(true)}
                          onMouseUp={() => setIsFullTableRevealed(false)}
                          onTouchStart={() => setIsFullTableRevealed(true)}
                          onTouchEnd={() => setIsFullTableRevealed(false)}
                          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all select-none cursor-pointer"
                        >
                          <Eye size={16} />
                          <span>Hold to Reveal All</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Coach Player Access Control Bar */}
                  {!isPlayerRole && (
                    <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 mb-4 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-xl ${
                            isPlayerAccessAllowed
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-red-500/20 text-red-400 border-red-500/30"
                          } border flex items-center justify-center shrink-0`}
                        >
                          {isPlayerAccessAllowed ? <Unlock size={20} /> : <Lock size={20} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-xs uppercase tracking-wider text-white">
                              Player Access Control
                            </span>
                            <span
                              className={`text-[10px] ${
                                isPlayerAccessAllowed
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                  : "bg-red-950 text-red-300 border-red-800"
                              } px-2.5 py-0.5 rounded-full font-black border`}
                            >
                              {isPlayerAccessAllowed ? "AVAILABLE TO PLAYERS" : "ACCESS CLOSED"}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold border border-slate-700">
                              Anti-Screenshot Always Active
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5">
                            {isPlayerAccessAllowed
                              ? "Players with the team code can log in and view stats on personal devices (with screenshot prevention)."
                              : "Players are locked out. Stats are hidden from all player accounts until you re-enable access."}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                        <button
                          type="button"
                          onClick={togglePlayerAccess}
                          className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 ${
                            isPlayerAccessAllowed
                              ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                              : "bg-red-600 hover:bg-red-500 text-white shadow-red-500/20"
                          }`}
                        >
                          {isPlayerAccessAllowed ? (
                            <>
                              <Unlock size={15} />
                              <span>Available to Players: ON</span>
                            </>
                          ) : (
                            <>
                              <Lock size={15} />
                              <span>Available to Players: OFF</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {(!isPlayerRole || isPlayerAccessAllowed) && (
                    <div className={`bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8 relative ${isPlayerRole ? "select-none" : ""}`}>
                    {/* Scroll indicator for mobile */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden"></div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-500 text-[9px] sm:text-[10px] tracking-widest uppercase border-b-2 border-slate-200">
                            <th className="p-2 sm:p-3 font-black w-40 sm:w-48 sticky left-0 bg-slate-100 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                              <div className="flex items-center justify-between gap-1">
                                <span>PLAYER</span>
                                <button
                                  type="button"
                                  onClick={() => setShowPlayerFilterModal(true)}
                                  className="text-[9px] font-bold text-slate-400 hover:text-indigo-600 tracking-normal normal-case flex items-center gap-0.5 cursor-pointer"
                                  title="Manage visible players"
                                >
                                  <Filter size={10} />
                                  <span>Filter</span>
                                </button>
                              </div>
                            </th>
                          <th
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "pass",
                                titleContext: "Team Passing Breakdown",
                              })
                            }
                            className="p-2 sm:p-3 font-black text-center border-l border-slate-200 bg-blue-50/40 text-blue-900 cursor-pointer hover:bg-blue-100/60 transition-colors"
                            title="Click to view Team Passing Breakdown"
                          >
                            PASSING ▾
                            <br />
                            <span className="opacity-70 font-bold tracking-normal">
                              Avg(Tot)
                            </span>
                          </th>
                          <th
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "dig",
                                titleContext: "Team Dig Breakdown",
                              })
                            }
                            className="p-2 sm:p-3 font-black text-center border-l border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-200/60 transition-colors"
                            title="Click to view Team Dig Breakdown"
                          >
                            DIGS ▾
                            <br />
                            <span className="opacity-70 font-bold tracking-normal">
                              (D-Err)
                            </span>
                          </th>
                          <th
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "attack",
                                titleContext: "Team Attack Breakdown",
                              })
                            }
                            className="p-2 sm:p-3 font-black text-center border-l border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                            title="Click to view Team Attack Breakdown"
                          >
                            SWINGS ▾
                            <br />
                            <span className="opacity-70 font-bold tracking-normal text-[8px] sm:text-[9px]">
                              Tot(F/B) K-E-B
                            </span>
                          </th>
                          <th
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "attack",
                                titleContext: "Team Attack Breakdown",
                              })
                            }
                            className="p-2 sm:p-3 font-black text-center border-l border-slate-200 text-green-600 cursor-pointer hover:bg-green-50 transition-colors"
                            title="Click to view Team Attack Breakdown"
                          >
                            KILL % ▾
                          </th>
                          <th
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "block",
                                titleContext: "Team Block Breakdown",
                              })
                            }
                            className="p-2 sm:p-3 font-black text-center border-l border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-200/60 transition-colors"
                            title="Click to view Team Block Breakdown"
                          >
                            BLOCKS ▾
                            <br />
                            <span className="opacity-70 font-bold tracking-normal">
                              (Tot(Stf)-Lt-Net-Usd)
                            </span>
                          </th>
                          <th
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "serve",
                                titleContext: "Team Serve Breakdown",
                              })
                            }
                            className="p-2 sm:p-3 font-black text-center border-l border-slate-200 bg-purple-50/40 text-purple-900 cursor-pointer hover:bg-purple-100/60 transition-colors"
                            title="Click to view Team Serve Breakdown"
                          >
                            SERVES ▾
                            <br />
                            <span className="opacity-70 font-bold tracking-normal">
                              (Att-Ace-Err)
                            </span>
                          </th>
                          <th
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "serve",
                                titleContext: "Team Serve Breakdown",
                              })
                            }
                            className="p-2 sm:p-3 font-black text-center border-l border-slate-200 text-blue-600 bg-blue-50/50 cursor-pointer hover:bg-blue-100/60 transition-colors"
                            title="Click to view Team Serve Breakdown"
                          >
                            SRV +/- ▾
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {/* TOP STICKY TEAM TOTALS ROW (WHOLE TEAM) */}
                        <tr
                          onMouseDown={() => isPlayerRole && setRevealedPlayerId("TEAM_TOTALS")}
                          onMouseUp={() => isPlayerRole && setRevealedPlayerId(null)}
                          onTouchStart={() => isPlayerRole && setRevealedPlayerId("TEAM_TOTALS")}
                          onTouchEnd={() => isPlayerRole && setRevealedPlayerId(null)}
                          className={`bg-gradient-to-r from-blue-950 via-[#002B7A] to-blue-950 text-white font-bold text-[10px] sm:text-xs tracking-wider border-b-2 border-blue-400 ${isPlayerRole ? "cursor-pointer select-none" : ""}`}
                        >
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "pass",
                                titleContext: "Team Impact & Breakdown",
                              })
                            }
                            className="p-2 sm:p-3 sticky left-0 bg-[#001f5c] text-white shadow-[2px_0_5px_rgba(0,0,0,0.2)] z-10 border-r-2 border-amber-400 cursor-pointer hover:bg-[#002b7a] transition-colors"
                            title="Click for full Team Breakdown modal"
                          >
                            <div className="flex items-center space-x-1.5 sm:space-x-2">
                              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-[9px] sm:text-[10px] shadow-sm">
                                ALL
                              </span>
                              <div className="flex flex-col">
                                <span className="font-black text-amber-300 uppercase tracking-widest text-xs">
                                  TEAM TOTALS
                                </span>
                                <span className="text-[9px] text-blue-200 font-medium">
                                  {allUccPlayers.length} total roster player{allUccPlayers.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                          </td>
                          {/* PASSING */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "pass",
                                titleContext: "Team Passing Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 font-black text-white text-center border-l border-white/10 bg-blue-900/40 cursor-pointer hover:bg-blue-800/50 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Passing breakdown (3/2/1/0 scores)"
                          >
                            <span className="text-sm sm:text-base text-amber-300">
                              {teamPassAvg}
                            </span>{" "}
                            <span className="text-[9px] sm:text-[10px] text-blue-200 font-bold ml-0.5 sm:ml-1">
                              ({teamTot.passCount})
                            </span>
                          </td>
                          {/* DIGS */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "dig",
                                titleContext: "Team Dig Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 border-l border-white/10 text-center bg-white/5 cursor-pointer hover:bg-white/15 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Dig breakdown"
                          >
                            <span className="text-blue-300 font-black text-sm">
                              {teamTot.digCount}
                            </span>{" "}
                            <span className="text-blue-300 mx-0.5">-</span>{" "}
                            <span className="text-red-300 font-bold">
                              {teamTot.digErr}
                            </span>
                          </td>
                          {/* SWINGS */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "attack",
                                titleContext: "Team Attack Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 border-l border-white/10 text-center cursor-pointer hover:bg-white/15 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Attack breakdown"
                          >
                            <span className="font-black text-white">
                              {teamTot.attCount}
                            </span>{" "}
                            <span className="text-[9px] text-blue-200 font-medium">
                              ({teamTot.attCountFront}/{teamTot.attCountBack})
                            </span>
                            <br />
                            <span className="text-emerald-300 font-black text-sm">
                              {teamTot.attKill}
                            </span>{" "}
                            <span className="text-blue-300 mx-0.5">-</span>{" "}
                            <span className="text-red-300 font-bold text-xs">
                              {teamTot.attErr}
                            </span>{" "}
                            <span className="text-blue-300 mx-0.5">-</span>{" "}
                            <span className="text-amber-300 font-bold text-xs">
                              {teamTot.attBlk}
                            </span>
                          </td>
                          {/* KILL % */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "attack",
                                titleContext: "Team Attack Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 font-black text-center border-l border-white/10 text-emerald-300 bg-emerald-950/40 text-xs sm:text-sm cursor-pointer hover:bg-emerald-900/50 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Attack breakdown"
                          >
                            {teamKillPct}
                          </td>
                          {/* BLOCKS */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "block",
                                titleContext: "Team Block Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 border-l border-white/10 bg-white/5 text-center whitespace-nowrap cursor-pointer hover:bg-white/15 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Block breakdown"
                          >
                            <span className="font-black text-white">
                              {teamBlkTot}
                            </span>
                            <span className="text-blue-200 font-bold">
                              ({teamTot.blkStuff})
                            </span>{" "}
                            -{" "}
                            <span className="text-amber-300">
                              {teamTot.blkLate}
                            </span>{" "}
                            -{" "}
                            <span className="text-white">
                              {teamTot.blkNet}
                            </span>{" "}
                            -{" "}
                            <span className="text-white">
                              {teamTot.blkUsed}
                            </span>
                          </td>
                          {/* SERVES */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "serve",
                                titleContext: "Team Serve Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 text-center border-l border-white/10 bg-purple-950/30 cursor-pointer hover:bg-purple-900/40 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Serve breakdown"
                          >
                            <span className="font-black text-white">
                              {teamSrvTot}
                            </span>{" "}
                            <span className="text-blue-300 mx-0.5">-</span>{" "}
                            <span className="text-emerald-300 font-black text-sm">
                              {teamTot.srvAce}
                            </span>{" "}
                            <span className="text-blue-300 mx-0.5">-</span>{" "}
                            <span className="text-red-300 font-bold">
                              {teamTot.srvErr}
                            </span>
                          </td>
                          {/* SRV +/- */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "serve",
                                titleContext: "Team Serve Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 font-black text-center border-l border-white/10 bg-white/10 text-xs sm:text-sm cursor-pointer hover:bg-white/20 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Serve breakdown"
                          >
                            <span
                              className={
                                teamSrvPlusMinus > 0
                                  ? "text-emerald-300"
                                  : teamSrvPlusMinus < 0
                                    ? "text-red-300"
                                    : "text-slate-300"
                              }
                            >
                              {teamSrvPlusMinus > 0
                                ? `+${teamSrvPlusMinus}`
                                : teamSrvPlusMinus}
                            </span>
                          </td>
                        </tr>

                        {/* TOP STICKY SHOWN PLAYERS ROW (IF PLAYERS HIDDEN) */}
                        {hasHiddenPlayers && (
                          <tr
                            onMouseDown={() => isPlayerRole && setRevealedPlayerId("SHOWN_PLAYERS")}
                            onMouseUp={() => isPlayerRole && setRevealedPlayerId(null)}
                            onTouchStart={() => isPlayerRole && setRevealedPlayerId("SHOWN_PLAYERS")}
                            onTouchEnd={() => isPlayerRole && setRevealedPlayerId(null)}
                            className={`bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white font-bold text-[10px] sm:text-xs tracking-wider border-b-2 border-indigo-400 ${isPlayerRole ? "cursor-pointer select-none" : ""}`}
                          >
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "pass",
                                  titleContext: "Shown Players Breakdown",
                                })
                              }
                              className="p-2 sm:p-3 sticky left-0 bg-slate-900 text-white shadow-[2px_0_5px_rgba(0,0,0,0.2)] z-10 border-r-2 border-indigo-400 cursor-pointer hover:bg-slate-800 transition-colors"
                              title="Click for Shown Players breakdown"
                            >
                              <div className="flex items-center space-x-1.5 sm:space-x-2">
                                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-400 text-slate-950 font-black flex items-center justify-center text-[9px] sm:text-[10px] shadow-sm">
                                  <Eye size={11} className="text-slate-950" />
                                </span>
                                <div className="flex flex-col">
                                  <span className="font-black text-indigo-300 uppercase tracking-widest text-xs">
                                    SHOWN PLAYERS (AVG)
                                  </span>
                                  <span className="text-[9px] text-indigo-200 font-medium">
                                    {visibleUccPlayers.length} of {allUccPlayers.length} visible
                                  </span>
                                </div>
                              </div>
                            </td>
                            {/* PASSING */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "pass",
                                  titleContext: "Shown Players Passing Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 font-black text-white text-center border-l border-white/10 bg-indigo-900/40 cursor-pointer hover:bg-indigo-800/50 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Passing breakdown"
                            >
                              <span className="text-sm sm:text-base text-indigo-300">
                                {shownPassAvg}
                              </span>{" "}
                              <span className="text-[9px] sm:text-[10px] text-indigo-200 font-bold ml-0.5 sm:ml-1">
                                ({shownTot.passCount})
                              </span>
                            </td>
                            {/* DIGS */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "dig",
                                  titleContext: "Shown Players Dig Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 border-l border-white/10 text-center bg-white/5 cursor-pointer hover:bg-white/15 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Dig breakdown"
                            >
                              <span className="text-indigo-300 font-black text-sm">
                                {shownTot.digCount}
                              </span>{" "}
                              <span className="text-indigo-300 mx-0.5">-</span>{" "}
                              <span className="text-red-300 font-bold">
                                {shownTot.digErr}
                              </span>
                            </td>
                            {/* SWINGS */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "attack",
                                  titleContext: "Shown Players Attack Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 border-l border-white/10 text-center cursor-pointer hover:bg-white/15 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Attack breakdown"
                            >
                              <span className="font-black text-white">
                                {shownTot.attCount}
                              </span>{" "}
                              <span className="text-[9px] text-indigo-200 font-medium">
                                ({shownTot.attCountFront}/{shownTot.attCountBack})
                              </span>
                              <br />
                              <span className="text-emerald-300 font-black text-sm">
                                {shownTot.attKill}
                              </span>{" "}
                              <span className="text-indigo-300 mx-0.5">-</span>{" "}
                              <span className="text-red-300 font-bold text-xs">
                                {shownTot.attErr}
                              </span>{" "}
                              <span className="text-indigo-300 mx-0.5">-</span>{" "}
                              <span className="text-amber-300 font-bold text-xs">
                                {shownTot.attBlk}
                              </span>
                            </td>
                            {/* KILL % */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "attack",
                                  titleContext: "Shown Players Attack Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 font-black text-center border-l border-white/10 text-emerald-300 bg-emerald-950/40 text-xs sm:text-sm cursor-pointer hover:bg-emerald-900/50 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Attack breakdown"
                            >
                              {shownKillPct}
                            </td>
                            {/* BLOCKS */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "block",
                                  titleContext: "Shown Players Block Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 border-l border-white/10 bg-white/5 text-center whitespace-nowrap cursor-pointer hover:bg-white/15 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Block breakdown"
                            >
                              <span className="font-black text-white">
                                {shownBlkTot}
                              </span>
                              <span className="text-indigo-200 font-bold">
                                ({shownTot.blkStuff})
                              </span>{" "}
                              -{" "}
                              <span className="text-amber-300">
                                {shownTot.blkLate}
                              </span>{" "}
                              -{" "}
                              <span className="text-white">
                                {shownTot.blkNet}
                              </span>{" "}
                              -{" "}
                              <span className="text-white">
                                {shownTot.blkUsed}
                              </span>
                            </td>
                            {/* SERVES */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "serve",
                                  titleContext: "Shown Players Serve Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 text-center border-l border-white/10 bg-purple-950/30 cursor-pointer hover:bg-purple-900/40 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Serve breakdown"
                            >
                              <span className="font-black text-white">
                                {shownSrvTot}
                              </span>{" "}
                              <span className="text-indigo-300 mx-0.5">-</span>{" "}
                              <span className="text-emerald-300 font-black text-sm">
                                {shownTot.srvAce}
                              </span>{" "}
                              <span className="text-indigo-300 mx-0.5">-</span>{" "}
                              <span className="text-red-300 font-bold">
                                {shownTot.srvErr}
                              </span>
                            </td>
                            {/* SRV +/- */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "serve",
                                  titleContext: "Shown Players Serve Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 font-black text-center border-l border-white/10 bg-white/10 text-xs sm:text-sm cursor-pointer hover:bg-white/20 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Serve breakdown"
                            >
                              <span
                                className={
                                  shownSrvPlusMinus > 0
                                    ? "text-emerald-300"
                                    : shownSrvPlusMinus < 0
                                      ? "text-red-300"
                                      : "text-slate-300"
                                }
                              >
                                {shownSrvPlusMinus > 0
                                  ? `+${shownSrvPlusMinus}`
                                  : shownSrvPlusMinus}
                              </span>
                            </td>
                          </tr>
                        )}

                        {visibleUccPlayers.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="p-8 text-center text-slate-400 font-bold tracking-wider text-xs"
                            >
                              No players visible. (Check filters or hidden
                              players)
                            </td>
                          </tr>
                        ) : (
                          visibleUccPlayers.map((p) => {
                            const isConcealed = isPlayerRole && !isFullTableRevealed && revealedPlayerId !== p.id;
                            const passAvg =
                              p.passCount > 0
                                ? (p.passSum / p.passCount).toFixed(2)
                                : "-";
                            const blkTot = p.blkCount + p.blkStuff;
                            const srvTot = p.srvCount + p.srvAce + p.srvErr;
                            const killPct =
                              p.attCount > 0
                                ? ((p.attKill / p.attCount) * 100).toFixed(1) +
                                  "%"
                                : "0.0%";
                            const srvPlusMinus = p.srvAce - p.srvErr;

                            return (
                              <tr
                                key={p.id}
                                onMouseDown={() => isPlayerRole && setRevealedPlayerId(p.id)}
                                onMouseUp={() => isPlayerRole && setRevealedPlayerId(null)}
                                touch-action="manipulation"
                                onTouchStart={() => isPlayerRole && setRevealedPlayerId(p.id)}
                                onTouchEnd={() => isPlayerRole && setRevealedPlayerId(null)}
                                className={`hover:bg-blue-50/30 text-[10px] sm:text-xs transition-colors group ${isPlayerRole ? "cursor-pointer select-none" : ""}`}
                              >
                                <td className="p-2 sm:p-3 sticky left-0 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)] border-r-2 border-transparent group-hover:border-indigo-400">
                                  <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                                    <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
                                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#0033A0]/10 text-[#0033A0] font-black flex items-center justify-center text-[9px] sm:text-[10px] shrink-0">
                                        {p.number || "-"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setCareerPlayerName(p.name)}
                                        className="font-bold text-indigo-700 hover:underline hover:text-indigo-950 truncate text-left cursor-pointer"
                                        title={`Click to view ${p.name}'s Career Profile`}
                                      >
                                        {p.name}
                                      </button>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleHidePlayer(p);
                                      }}
                                      className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 border border-slate-200 hover:border-amber-300 transition-all flex items-center gap-1 text-[10px] font-bold shrink-0 shadow-2xs group/btn cursor-pointer"
                                      title={`Hide ${p.name}'s row from stats`}
                                    >
                                      <EyeOff
                                        size={12}
                                        className="text-slate-400 group-hover/btn:text-amber-600 shrink-0"
                                      />
                                      <span className="hidden sm:inline">Hide</span>
                                    </button>
                                  </div>
                                </td>
                                {/* PASSING */}
                                <td
                                  onClick={() =>
                                    setStatBreakdownModal({
                                      isOpen: true,
                                      selectedPlayer: p,
                                      category: "pass",
                                      titleContext: `${p.name} (#${p.number || "-"})`,
                                    })
                                  }
                                  className={`p-2 sm:p-3 font-bold text-slate-700 text-center border-l border-slate-100 bg-blue-50/20 cursor-pointer hover:bg-blue-100/50 transition-colors ${isConcealed ? "secure-stat-concealed" : ""}`}
                                  title={`Click to view ${p.name}'s Passing breakdown (3/2/1/0 scores)`}
                                >
                                  {passAvg}{" "}
                                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold ml-0.5 sm:ml-1">
                                    ({p.passCount})
                                  </span>
                                </td>
                                {/* DIGS */}
                                <td
                                  onClick={() =>
                                    setStatBreakdownModal({
                                      isOpen: true,
                                      selectedPlayer: p,
                                      category: "dig",
                                      titleContext: `${p.name} (#${p.number || "-"})`,
                                    })
                                  }
                                  className={`p-2 sm:p-3 border-l border-slate-100 text-center bg-slate-50/50 cursor-pointer hover:bg-slate-200/50 transition-colors ${isConcealed ? "secure-stat-concealed" : ""}`}
                                  title={`Click to view ${p.name}'s Dig breakdown`}
                                >
                                  <span className="text-blue-600 font-black text-sm">
                                    {p.digCount}
                                  </span>{" "}
                                  <span className="text-slate-300 mx-0.5">
                                    -
                                  </span>{" "}
                                  <span className="text-red-500 font-bold">
                                    {p.digErr}
                                  </span>
                                </td>
                                {/* SWINGS */}
                                <td
                                  onClick={() =>
                                    setStatBreakdownModal({
                                      isOpen: true,
                                      selectedPlayer: p,
                                      category: "attack",
                                      titleContext: `${p.name} (#${p.number || "-"})`,
                                    })
                                  }
                                  className={`p-2 sm:p-3 border-l border-slate-100 text-center cursor-pointer hover:bg-amber-50/50 transition-colors ${isConcealed ? "secure-stat-concealed" : ""}`}
                                  title={`Click to view ${p.name}'s Attack breakdown (Front/Back, Net, Out, Stuffed)`}
                                >
                                  <span className="font-bold text-slate-600">
                                    {p.attCount}
                                  </span>{" "}
                                  <span className="text-[9px] text-slate-400 font-medium">
                                    ({p.attCountFront}/{p.attCountBack})
                                  </span>
                                  <br />
                                  <span className="text-green-600 font-black text-sm">
                                    {p.attKill}
                                  </span>{" "}
                                  <span className="text-slate-300 mx-0.5">
                                    -
                                  </span>{" "}
                                  <span className="text-red-500 font-bold text-xs">
                                    {p.attErr}
                                  </span>{" "}
                                  <span className="text-slate-300 mx-0.5">
                                    -
                                  </span>{" "}
                                  <span className="text-amber-600 font-bold text-xs">
                                    {p.attBlk}
                                  </span>
                                </td>
                                {/* KILL % */}
                                <td
                                  onClick={() =>
                                    setStatBreakdownModal({
                                      isOpen: true,
                                      selectedPlayer: p,
                                      category: "attack",
                                      titleContext: `${p.name} (#${p.number || "-"})`,
                                    })
                                  }
                                  className={`p-2 sm:p-3 font-black text-center border-l border-slate-100 text-green-600 bg-green-50/30 cursor-pointer hover:bg-green-100/50 transition-colors ${isConcealed ? "secure-stat-concealed" : ""}`}
                                  title={`Click to view ${p.name}'s Attack breakdown`}
                                >
                                  {killPct}
                                </td>
                                {/* BLOCKS */}
                                <td
                                  onClick={() =>
                                    setStatBreakdownModal({
                                      isOpen: true,
                                      selectedPlayer: p,
                                      category: "block",
                                      titleContext: `${p.name} (#${p.number || "-"})`,
                                    })
                                  }
                                  className={`p-2 sm:p-3 border-l border-slate-100 bg-slate-50/50 text-center whitespace-nowrap hidden lg:table-cell cursor-pointer hover:bg-slate-200/50 transition-colors ${isConcealed ? "secure-stat-concealed" : ""}`}
                                  title={`Click to view ${p.name}'s Block breakdown`}
                                >
                                  <span className="font-bold">{blkTot}</span>(
                                  <strong className="text-indigo-600">
                                    {p.blkStuff}
                                  </strong>
                                  ) -{" "}
                                  <span className="text-amber-600">
                                    {p.blkLate}
                                  </span>{" "}
                                  - {p.blkNet} - {p.blkUsed}
                                </td>
                                <td
                                  onClick={() =>
                                    setStatBreakdownModal({
                                      isOpen: true,
                                      selectedPlayer: p,
                                      category: "block",
                                      titleContext: `${p.name} (#${p.number || "-"})`,
                                    })
                                  }
                                  className={`p-2 sm:p-3 border-l border-slate-100 bg-slate-50/50 text-center lg:hidden cursor-pointer hover:bg-slate-200/50 transition-colors ${isConcealed ? "secure-stat-concealed" : ""}`}
                                  title={`Click to view ${p.name}'s Block breakdown`}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold whitespace-nowrap bg-white px-1 py-0.5 rounded border border-slate-200 mt-1">
                                      <span className="font-bold text-slate-700">
                                        {blkTot}
                                      </span>
                                      ({p.blkStuff}){" "}
                                      <span className="text-slate-300 mx-0.5">
                                        •
                                      </span>{" "}
                                      <span className="text-amber-600">
                                        {p.blkLate}
                                      </span>{" "}
                                      <span className="text-slate-300 mx-0.5">
                                        •
                                      </span>{" "}
                                      {p.blkNet}{" "}
                                      <span className="text-slate-300 mx-0.5">
                                        •
                                      </span>{" "}
                                      {p.blkUsed}
                                    </span>
                                  </div>
                                </td>
                                {/* SERVES */}
                                <td
                                  onClick={() =>
                                    setStatBreakdownModal({
                                      isOpen: true,
                                      selectedPlayer: p,
                                      category: "serve",
                                      titleContext: `${p.name} (#${p.number || "-"})`,
                                    })
                                  }
                                  className={`p-2 sm:p-3 border-l border-slate-100 text-center bg-purple-50/20 cursor-pointer hover:bg-purple-100/50 transition-colors ${isConcealed ? "secure-stat-concealed" : ""}`}
                                  title={`Click to view ${p.name}'s Serve breakdown (Net, Wide, Long, Foot Fault)`}
                                >
                                  <span className="font-bold text-slate-600">
                                    {srvTot}
                                  </span>{" "}
                                  <span className="text-slate-300 mx-0.5">
                                    -
                                  </span>{" "}
                                  <span className="text-emerald-600 font-black text-sm">
                                    {p.srvAce}
                                  </span>{" "}
                                  <span className="text-slate-300 mx-0.5">
                                    -
                                  </span>{" "}
                                  <span className="text-red-500 font-bold">
                                    {p.srvErr}
                                  </span>
                                </td>
                                {/* SRV +/- */}
                                <td
                                  onClick={() =>
                                    setStatBreakdownModal({
                                      isOpen: true,
                                      selectedPlayer: p,
                                      category: "serve",
                                      titleContext: `${p.name} (#${p.number || "-"})`,
                                    })
                                  }
                                  className={`p-2 sm:p-3 font-black text-center border-l border-slate-100 bg-blue-50/50 text-xs sm:text-sm cursor-pointer hover:bg-blue-100/60 transition-colors ${isConcealed ? "secure-stat-concealed" : ""}`}
                                  title={`Click to view ${p.name}'s Serve breakdown`}
                                >
                                  <span
                                    className={
                                      srvPlusMinus > 0
                                        ? "text-green-600"
                                        : srvPlusMinus < 0
                                          ? "text-red-500"
                                          : "text-slate-400"
                                    }
                                  >
                                    {srvPlusMinus > 0
                                      ? `+${srvPlusMinus}`
                                      : srvPlusMinus}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>

                      {/* TEAM TOTALS & SHOWN PLAYERS FOOTER */}
                      <tfoot className="border-t-2 border-[#0033A0] shadow-md">
                        {/* SHOWN PLAYERS ROW (IF PLAYERS ARE HIDDEN) */}
                        {hasHiddenPlayers && (
                          <tr
                            onMouseDown={() => isPlayerRole && setRevealedPlayerId("SHOWN_PLAYERS")}
                            onMouseUp={() => isPlayerRole && setRevealedPlayerId(null)}
                            onTouchStart={() => isPlayerRole && setRevealedPlayerId("SHOWN_PLAYERS")}
                            onTouchEnd={() => isPlayerRole && setRevealedPlayerId(null)}
                            className={`bg-slate-900 text-white font-bold text-[10px] sm:text-xs tracking-wider border-b border-indigo-500/30 ${isPlayerRole ? "cursor-pointer select-none" : ""}`}
                          >
                            <td className="p-2.5 sm:p-3 sticky left-0 bg-slate-900 text-white shadow-[2px_0_5px_rgba(0,0,0,0.2)] z-10 border-r-2 border-indigo-400">
                              <div className="flex items-center space-x-1.5 sm:space-x-2">
                                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-400 text-slate-950 font-black flex items-center justify-center text-[9px] sm:text-[10px] shadow-sm">
                                  <Eye size={11} className="text-slate-950" />
                                </span>
                                <div className="flex flex-col">
                                  <span className="font-black text-indigo-300 uppercase tracking-widest text-xs">
                                    SHOWN PLAYERS (AVG)
                                  </span>
                                  <span className="text-[9px] text-indigo-200 font-medium">
                                    {visibleUccPlayers.length} shown
                                  </span>
                                </div>
                              </div>
                            </td>
                            {/* PASSING */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "pass",
                                  titleContext: "Shown Players Passing Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 font-black text-white text-center border-l border-white/10 bg-indigo-900/30 cursor-pointer hover:bg-indigo-800/40 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Passing breakdown"
                            >
                              <span className="text-sm sm:text-base text-indigo-300">
                                {shownPassAvg}
                              </span>{" "}
                              <span className="text-[9px] sm:text-[10px] text-indigo-200 font-bold ml-0.5 sm:ml-1">
                                ({shownTot.passCount})
                              </span>
                            </td>
                            {/* DIGS */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "dig",
                                  titleContext: "Shown Players Dig Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 border-l border-white/10 text-center bg-white/5 cursor-pointer hover:bg-white/15 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Dig breakdown"
                            >
                              <span className="text-indigo-300 font-black text-sm">
                                {shownTot.digCount}
                              </span>{" "}
                              <span className="text-indigo-300 mx-0.5">-</span>{" "}
                              <span className="text-red-300 font-bold">
                                {shownTot.digErr}
                              </span>
                            </td>
                            {/* SWINGS */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "attack",
                                  titleContext: "Shown Players Attack Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 border-l border-white/10 text-center cursor-pointer hover:bg-white/15 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Attack breakdown"
                            >
                              <span className="font-black text-white">
                                {shownTot.attCount}
                              </span>{" "}
                              <span className="text-[9px] text-indigo-200 font-medium">
                                ({shownTot.attCountFront}/{shownTot.attCountBack})
                              </span>
                              <br />
                              <span className="text-emerald-300 font-black text-sm">
                                {shownTot.attKill}
                              </span>{" "}
                              <span className="text-indigo-300 mx-0.5">-</span>{" "}
                              <span className="text-red-300 font-bold text-xs">
                                {shownTot.attErr}
                              </span>{" "}
                              <span className="text-indigo-300 mx-0.5">-</span>{" "}
                              <span className="text-amber-300 font-bold text-xs">
                                {shownTot.attBlk}
                              </span>
                            </td>
                            {/* KILL % */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "attack",
                                  titleContext: "Shown Players Attack Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 font-black text-center border-l border-white/10 text-emerald-300 bg-emerald-950/40 text-xs sm:text-sm cursor-pointer hover:bg-emerald-900/50 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Attack breakdown"
                            >
                              {shownKillPct}
                            </td>
                            {/* BLOCKS */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "block",
                                  titleContext: "Shown Players Block Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 border-l border-white/10 bg-white/5 text-center whitespace-nowrap cursor-pointer hover:bg-white/15 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Block breakdown"
                            >
                              <span className="font-black text-white">
                                {shownBlkTot}
                              </span>
                              <span className="text-indigo-200 font-bold">
                                ({shownTot.blkStuff})
                              </span>{" "}
                              -{" "}
                              <span className="text-amber-300">
                                {shownTot.blkLate}
                              </span>{" "}
                              -{" "}
                              <span className="text-white">
                                {shownTot.blkNet}
                              </span>{" "}
                              -{" "}
                              <span className="text-white">
                                {shownTot.blkUsed}
                              </span>
                            </td>
                            {/* SERVES */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "serve",
                                  titleContext: "Shown Players Serve Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 text-center border-l border-white/10 bg-white/5 cursor-pointer hover:bg-white/15 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Serve breakdown"
                            >
                              <span className="font-black text-white">
                                {shownSrvTot}
                              </span>{" "}
                              <span className="text-indigo-300 mx-0.5">-</span>{" "}
                              <span className="text-emerald-300 font-black text-sm">
                                {shownTot.srvAce}
                              </span>{" "}
                              <span className="text-indigo-300 mx-0.5">-</span>{" "}
                              <span className="text-red-300 font-bold">
                                {shownTot.srvErr}
                              </span>
                            </td>
                            {/* SRV +/- */}
                            <td
                              onClick={() =>
                                setStatBreakdownModal({
                                  isOpen: true,
                                  selectedPlayer: shownTot,
                                  category: "serve",
                                  titleContext: "Shown Players Serve Breakdown",
                                })
                              }
                              className={`p-2 sm:p-3 font-black text-center border-l border-white/10 bg-white/10 text-xs sm:text-sm cursor-pointer hover:bg-white/20 transition-colors ${isShownTotConcealed ? "secure-stat-concealed" : ""}`}
                              title="Click to view Shown Players Serve breakdown"
                            >
                              <span
                                className={
                                  shownSrvPlusMinus > 0
                                    ? "text-emerald-300"
                                    : shownSrvPlusMinus < 0
                                      ? "text-red-300"
                                      : "text-slate-300"
                                }
                              >
                                {shownSrvPlusMinus > 0
                                  ? `+${shownSrvPlusMinus}`
                                  : shownSrvPlusMinus}
                              </span>
                            </td>
                          </tr>
                        )}

                        {/* WHOLE TEAM TOTALS ROW */}
                        <tr
                          onMouseDown={() => isPlayerRole && setRevealedPlayerId("TEAM_TOTALS")}
                          onMouseUp={() => isPlayerRole && setRevealedPlayerId(null)}
                          onTouchStart={() => isPlayerRole && setRevealedPlayerId("TEAM_TOTALS")}
                          onTouchEnd={() => isPlayerRole && setRevealedPlayerId(null)}
                          className={`bg-[#001f5c] text-white font-bold text-[10px] sm:text-xs tracking-wider ${isPlayerRole ? "cursor-pointer select-none" : ""}`}
                        >
                          <td className="p-2.5 sm:p-3 sticky left-0 bg-[#001f5c] text-white shadow-[2px_0_5px_rgba(0,0,0,0.2)] z-10 border-r-2 border-blue-400">
                            <div className="flex items-center space-x-1.5 sm:space-x-2">
                              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-[9px] sm:text-[10px] shadow-sm">
                                ALL
                              </span>
                              <div className="flex flex-col">
                                <span className="font-black text-amber-300 uppercase tracking-widest text-xs sm:text-sm">
                                  TEAM TOTALS
                                </span>
                                <span className="text-[9px] text-blue-200 font-medium">
                                  {allUccPlayers.length} total roster player
                                  {allUccPlayers.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                          </td>
                          {/* PASSING */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "pass",
                                titleContext: "Team Passing Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 font-black text-white text-center border-l border-white/10 bg-blue-900/30 cursor-pointer hover:bg-blue-800/40 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Passing breakdown"
                          >
                            <span className="text-sm sm:text-base text-amber-300">
                              {teamPassAvg}
                            </span>{" "}
                            <span className="text-[9px] sm:text-[10px] text-blue-200 font-bold ml-0.5 sm:ml-1">
                              ({teamTot.passCount})
                            </span>
                          </td>
                          {/* DIGS */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "dig",
                                titleContext: "Team Dig Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 border-l border-white/10 text-center bg-white/5 cursor-pointer hover:bg-white/15 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Dig breakdown"
                          >
                            <span className="text-blue-300 font-black text-sm">
                              {teamTot.digCount}
                            </span>{" "}
                            <span className="text-blue-300 mx-0.5">-</span>{" "}
                            <span className="text-red-300 font-bold">
                              {teamTot.digErr}
                            </span>
                          </td>
                          {/* SWINGS */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "attack",
                                titleContext: "Team Attack Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 border-l border-white/10 text-center cursor-pointer hover:bg-white/15 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Attack breakdown"
                          >
                            <span className="font-black text-white">
                              {teamTot.attCount}
                            </span>{" "}
                            <span className="text-[9px] text-blue-200 font-medium">
                              ({teamTot.attCountFront}/{teamTot.attCountBack})
                            </span>
                            <br />
                            <span className="text-emerald-300 font-black text-sm">
                              {teamTot.attKill}
                            </span>{" "}
                            <span className="text-blue-300 mx-0.5">-</span>{" "}
                            <span className="text-red-300 font-bold text-xs">
                              {teamTot.attErr}
                            </span>{" "}
                            <span className="text-blue-300 mx-0.5">-</span>{" "}
                            <span className="text-amber-300 font-bold text-xs">
                              {teamTot.attBlk}
                            </span>
                          </td>
                          {/* KILL % */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "attack",
                                titleContext: "Team Attack Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 font-black text-center border-l border-white/10 text-emerald-300 bg-emerald-950/40 text-xs sm:text-sm cursor-pointer hover:bg-emerald-900/50 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Attack breakdown"
                          >
                            {teamKillPct}
                          </td>
                          {/* BLOCKS */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "block",
                                titleContext: "Team Block Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 border-l border-white/10 bg-white/5 text-center whitespace-nowrap cursor-pointer hover:bg-white/15 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Block breakdown"
                          >
                            <span className="font-black text-white">
                              {teamBlkTot}
                            </span>
                            <span className="text-blue-200 font-bold">
                              ({teamTot.blkStuff})
                            </span>{" "}
                            -{" "}
                            <span className="text-amber-300">
                              {teamTot.blkLate}
                            </span>{" "}
                            -{" "}
                            <span className="text-white">
                              {teamTot.blkNet}
                            </span>{" "}
                            -{" "}
                            <span className="text-white">
                              {teamTot.blkUsed}
                            </span>
                          </td>
                          {/* SERVES */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "serve",
                                titleContext: "Team Serve Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 text-center border-l border-white/10 bg-white/5 cursor-pointer hover:bg-white/15 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Serve breakdown"
                          >
                            <span className="font-black text-white">
                              {teamSrvTot}
                            </span>{" "}
                            <span className="text-blue-300 mx-0.5">-</span>{" "}
                            <span className="text-emerald-300 font-black text-sm">
                              {teamTot.srvAce}
                            </span>{" "}
                            <span className="text-blue-300 mx-0.5">-</span>{" "}
                            <span className="text-red-300 font-bold">
                              {teamTot.srvErr}
                            </span>
                          </td>
                          {/* SRV +/- */}
                          <td
                            onClick={() =>
                              setStatBreakdownModal({
                                isOpen: true,
                                selectedPlayer: teamTot,
                                category: "serve",
                                titleContext: "Team Serve Breakdown",
                              })
                            }
                            className={`p-2 sm:p-3 font-black text-center border-l border-white/10 bg-white/10 text-xs sm:text-sm cursor-pointer hover:bg-white/20 transition-colors ${isTeamTotConcealed ? "secure-stat-concealed" : ""}`}
                            title="Click to view Team Serve breakdown"
                          >
                            <span
                              className={
                                teamSrvPlusMinus > 0
                                  ? "text-emerald-300"
                                  : teamSrvPlusMinus < 0
                                    ? "text-red-300"
                                    : "text-slate-300"
                              }
                            >
                              {teamSrvPlusMinus > 0
                                ? `+${teamSrvPlusMinus}`
                                : teamSrvPlusMinus}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
              </div>
            );
            })()}

            {(!isPlayerRole || isPlayerAccessAllowed) && (
              <>
                <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-3 sm:mb-4 tracking-widest uppercase flex items-center">
                  <Users className="mr-2 text-slate-500" size={18} /> Opponents
                </h2>
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-4xl mb-8 relative">
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden"></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-800 text-slate-300 text-[9px] sm:text-[10px] tracking-widest uppercase border-b border-slate-900">
                      <th className="p-2 sm:p-3 font-black w-24 sm:w-32">ID</th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-700 bg-slate-900">
                        ACES
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-700 bg-slate-900">
                        SRV ERR
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-700 text-blue-400 bg-slate-900">
                        +/-
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-700">
                        SWINGS
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-700">
                        KILLS
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-700 text-green-400">
                        KILL %
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-700 bg-slate-900">
                        PASS
                        <br />
                        <span className="opacity-70 font-bold tracking-normal">
                          Avg(Tot)
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.keys(opponentStats).length === 0 ? (
                      <tr>
                        <td
                          colSpan="8"
                          className="p-6 sm:p-8 text-center text-slate-400 font-bold tracking-widest uppercase text-[10px] sm:text-xs"
                        >
                          No opponent data available.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(opponentStats).map(
                        ([teamName, players]) => {
                          const isExpanded =
                            expandedOppTeams[teamName] || false;

                          const oppPlayerList = Object.values(players);
                          const oppTeamTot = oppPlayerList.reduce(
                            (acc: any, p: any) => {
                              acc.passCount += p.passCount || 0;
                              acc.passSum += p.passSum || 0;
                              acc.attCount += p.attCount || 0;
                              acc.attKill += p.attKill || 0;
                              acc.srvAce += p.srvAce || 0;
                              acc.srvErr += p.srvErr || 0;
                              return acc;
                            },
                            {
                              passCount: 0,
                              passSum: 0,
                              attCount: 0,
                              attKill: 0,
                              srvAce: 0,
                              srvErr: 0,
                            }
                          );
                          const oppTeamPassAvg =
                            oppTeamTot.passCount > 0
                              ? (
                                  oppTeamTot.passSum / oppTeamTot.passCount
                                ).toFixed(2)
                              : "-";
                          const oppTeamKillPct =
                            oppTeamTot.attCount > 0
                              ? (
                                  (oppTeamTot.attKill /
                                    oppTeamTot.attCount) *
                                  100
                                ).toFixed(1) + "%"
                              : "0.0%";
                          const oppTeamSrvPlusMinus =
                            oppTeamTot.srvAce - oppTeamTot.srvErr;

                          return (
                            <React.Fragment key={teamName}>
                              <tr
                                className="bg-slate-200/50 cursor-pointer hover:bg-slate-300/50 transition-colors"
                                onClick={() =>
                                  setExpandedOppTeams((prev) => ({
                                    ...prev,
                                    [teamName]: !prev[teamName],
                                  }))
                                }
                              >
                                <td
                                  colSpan="8"
                                  className="p-2 sm:p-3 font-black text-slate-700 text-xs sm:text-sm uppercase tracking-widest"
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center">
                                      <Shield
                                        size={14}
                                        className="mr-2 text-slate-500"
                                      />
                                      {teamName}
                                    </div>
                                    <div className="text-slate-400">
                                      {isExpanded ? (
                                        <ChevronDown size={16} />
                                      ) : (
                                        <ChevronRight size={16} />
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (
                                <>
                                  {Object.entries(players).map(([id, p]) => {
                                    const passAvg =
                                      p.passCount > 0
                                        ? (p.passSum / p.passCount).toFixed(2)
                                        : "-";
                                    const killPct =
                                      p.attCount > 0
                                        ? (
                                            (p.attKill / p.attCount) *
                                            100
                                          ).toFixed(1) + "%"
                                        : "0.0%";
                                    const srvPlusMinus = p.srvAce - p.srvErr;
                                    return (
                                      <tr
                                        key={id}
                                        className="hover:bg-slate-50 text-[10px] sm:text-xs"
                                      >
                                        <td className="p-2 sm:p-3">
                                          <span className="bg-white border border-slate-200 text-slate-600 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-black text-xs sm:text-sm ml-2 shadow-sm">
                                            {id}
                                          </span>
                                        </td>
                                        <td className="p-2 sm:p-3 font-black text-blue-600 text-center border-l border-slate-100 bg-slate-50 text-sm">
                                          {p.srvAce}
                                        </td>
                                        <td className="p-2 sm:p-3 font-bold text-red-500 text-center border-l border-slate-100 bg-slate-50 text-sm">
                                          {p.srvErr}
                                        </td>
                                        <td className="p-2 sm:p-3 font-black text-center border-l border-slate-100 bg-slate-50 text-sm">
                                          <span
                                            className={
                                              srvPlusMinus > 0
                                                ? "text-green-600"
                                                : srvPlusMinus < 0
                                                  ? "text-red-500"
                                                  : "text-slate-400"
                                            }
                                          >
                                            {srvPlusMinus > 0
                                              ? `+${srvPlusMinus}`
                                              : srvPlusMinus}
                                          </span>
                                        </td>
                                        <td className="p-2 sm:p-3 font-bold text-center border-l border-slate-100 text-slate-600">
                                          {p.attCount}
                                        </td>
                                        <td className="p-2 sm:p-3 font-black text-green-600 text-center border-l border-slate-100 text-sm">
                                          {p.attKill}
                                        </td>
                                        <td className="p-2 sm:p-3 font-black text-green-600 bg-green-50/50 text-center border-l border-slate-100">
                                          {killPct}
                                        </td>
                                        <td className="p-2 sm:p-3 font-bold text-center border-l border-slate-100 bg-slate-50 text-slate-700">
                                          {passAvg}{" "}
                                          <span className="text-[9px] sm:text-[10px] text-slate-400 ml-0.5 sm:ml-1">
                                            ({p.passCount})
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}

                                  {/* Opponent Team Total Subtotal */}
                                  {oppPlayerList.length > 1 && (
                                    <tr className="bg-slate-700 text-white font-bold text-[10px] sm:text-xs">
                                      <td className="p-2 sm:p-2.5 uppercase tracking-wider text-slate-200">
                                        TEAM TOTAL
                                      </td>
                                      <td className="p-2 sm:p-2.5 text-center border-l border-slate-600 text-blue-300 font-black">
                                        {oppTeamTot.srvAce}
                                      </td>
                                      <td className="p-2 sm:p-2.5 text-center border-l border-slate-600 text-red-300 font-bold">
                                        {oppTeamTot.srvErr}
                                      </td>
                                      <td className="p-2 sm:p-2.5 text-center border-l border-slate-600 font-black">
                                        <span
                                          className={
                                            oppTeamSrvPlusMinus > 0
                                              ? "text-green-300"
                                              : oppTeamSrvPlusMinus < 0
                                                ? "text-red-300"
                                                : "text-slate-300"
                                          }
                                        >
                                          {oppTeamSrvPlusMinus > 0
                                            ? `+${oppTeamSrvPlusMinus}`
                                            : oppTeamSrvPlusMinus}
                                        </span>
                                      </td>
                                      <td className="p-2 sm:p-2.5 text-center border-l border-slate-600 text-slate-200">
                                        {oppTeamTot.attCount}
                                      </td>
                                      <td className="p-2 sm:p-2.5 text-center border-l border-slate-600 text-emerald-300 font-black">
                                        {oppTeamTot.attKill}
                                      </td>
                                      <td className="p-2 sm:p-2.5 text-center border-l border-slate-600 text-emerald-300 font-bold">
                                        {oppTeamKillPct}
                                      </td>
                                      <td className="p-2 sm:p-2.5 text-center border-l border-slate-600 text-amber-300 font-black">
                                        {oppTeamPassAvg} ({oppTeamTot.passCount}
                                        )
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )}
                            </React.Fragment>
                          );
                        }
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
              </>
            )}
          </div>
        </div>

        {/* PLAYER VISIBILITY MODAL */}
        {showPlayerFilterModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-150">
              <div className="bg-[#0033A0] text-white p-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ListFilter size={18} className="text-blue-200" />
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider">
                      Select Visible Players
                    </h3>
                    <p className="text-[11px] text-blue-200">
                      Choose which players appear in the Stats table and PDF
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPlayerFilterModal(false)}
                  className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-600">
                  Visible:{" "}
                  <strong className="text-blue-700 font-black">
                    {
                      appData.roster.filter(
                        (p) =>
                          !isPlayerHidden(p) &&
                          (showRetired || !p.isRetired)
                      ).length
                    }
                  </strong>{" "}
                  /{" "}
                  {
                    appData.roster.filter(
                      (p) => showRetired || !p.isRetired
                    ).length
                  }{" "}
                  players
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHiddenPlayerIds([])}
                    className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHiddenPlayerIds(
                        appData.roster
                          .filter((p) => showRetired || !p.isRetired)
                          .map((p) => String(p.id ?? p.name))
                      )
                    }
                    className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Hide All
                  </button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100">
                {appData.roster
                  .filter((p) => showRetired || !p.isRetired)
                  .map((player) => {
                    const isHidden = isPlayerHidden(player);
                    return (
                      <div
                        key={player.id}
                        onClick={() => toggleHidePlayer(player)}
                        className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center ${
                              !isHidden
                                ? "bg-[#0033A0] text-white"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {player.number || "-"}
                          </span>
                          <div>
                            <span
                              className={`font-bold text-sm ${
                                !isHidden ? "text-slate-900" : "text-slate-400"
                              }`}
                            >
                              {player.name}
                            </span>
                            {player.isRetired && (
                              <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">
                                Retired
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {!isHidden ? (
                            <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                              <Check size={14} className="mr-1" /> Visible
                            </span>
                          ) : (
                            <span className="flex items-center text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                              <EyeOff size={14} className="mr-1" /> Hidden
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
                {!isPlayerRole ? (
                  <button
                    type="button"
                    onClick={() => {
                      exportPDF();
                      setShowPlayerFilterModal(false);
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center shadow-sm transition-colors"
                  >
                    <FileText size={14} className="mr-1.5" /> Export PDF
                  </button>
                ) : (
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-amber-500" /> View Only On Device
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowPlayerFilterModal(false)}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-black px-5 py-2 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-colors ml-auto"
                >
                  Apply & Done
                </button>
              </div>
            </div>
          </div>
        )}
        {careerPlayerName && (
          <CareerStatsModal
            playerName={careerPlayerName}
            myTeams={myTeams}
            onClose={() => setCareerPlayerName(null)}
          />
        )}
        <StatBreakdownModal
          isOpen={statBreakdownModal.isOpen}
          onClose={() =>
            setStatBreakdownModal((prev) => ({ ...prev, isOpen: false }))
          }
          selectedPlayer={statBreakdownModal.selectedPlayer}
          initialCategory={statBreakdownModal.category}
          titleContext={statBreakdownModal.titleContext}
          onOpenCorrection={(playerId) => {
            setStatBreakdownModal((prev) => ({ ...prev, isOpen: false }));
            const currentMatchNav = statsPath.find((p) => p.level === "match");
            const currentSetNav = statsPath.find((p) => p.level === "set");
            setStatCorrectionConfig({
              isOpen: true,
              initialPlayerId: playerId,
              initialMatchId: currentMatchNav?.id || activeMatch?.id || null,
              initialSetId: currentSetNav?.id || activeSetId || null,
            });
          }}
        />
        {(showStatCorrectionModal || statCorrectionConfig.isOpen) && (
          <StatCorrectionModal
            isOpen={showStatCorrectionModal || statCorrectionConfig.isOpen}
            onClose={() => {
              setShowStatCorrectionModal(false);
              setStatCorrectionConfig((prev) => ({ ...prev, isOpen: false }));
            }}
            stats={appData.stats}
            roster={sortedRoster}
            activeSetId={activeSetId}
            activeMatch={activeMatch}
            matches={appData.matches}
            sets={appData.sets}
            initialMatchId={statCorrectionConfig.initialMatchId}
            initialSetId={statCorrectionConfig.initialSetId}
            initialPlayerId={statCorrectionConfig.initialPlayerId}
            onDeleteStat={handleDeleteStat}
            onUpdateStat={handleUpdateStat}
            onAddStat={handleAddManualStat}
            ourTeamName={effectiveTeamName}
            isReadOnly={isPlayerRole}
          />
        )}
        <TeamNameEditModal
          isOpen={teamNameModalConfig.isOpen}
          onClose={() =>
            setTeamNameModalConfig((prev) => ({ ...prev, isOpen: false }))
          }
          ourTeamName={teamNameModalConfig.ourTeamName || effectiveTeamName}
          opponentTeamName={teamNameModalConfig.opponentTeamName}
          targetMatchTitle={teamNameModalConfig.targetMatchTitle}
          showOpponentEdit={teamNameModalConfig.showOpponentEdit}
          onSave={(newOur, newOpp) =>
            handleSaveTeamNames(
              newOur,
              newOpp,
              teamNameModalConfig.targetMatchId,
            )
          }
        />
        <SetScoreEditModal
          isOpen={setScoreModalConfig.isOpen}
          onClose={() =>
            setSetScoreModalConfig((prev) => ({ ...prev, isOpen: false }))
          }
          set={setScoreModalConfig.set}
          matchTitle={setScoreModalConfig.matchTitle}
          ourTeamName={effectiveTeamName}
          opponentName={
            (setScoreModalConfig.set &&
              appData.matches.find(
                (m) => m.id === setScoreModalConfig.set.matchId,
              )?.opponent) ||
            opponentName ||
            "Opponent"
          }
          onSave={handleSaveSetScore}
        />
        {renderOpponentReportModal()}
        <OpponentSubModal
          isOpen={showOppSubModal}
          onClose={() => setShowOppSubModal(false)}
          oppLineup={oppLineup}
          opponentName={opponentName}
          subPairs={subPairs || {}}
          oppLiberoId={oppLiberoId}
          oppSetterId={oppSetterId}
          knownOppNumbers={(() => {
            const oppSet = new Set<string>();
            appData.stats.forEach((s) => {
              if (s.isOpp && s.playerId) oppSet.add(s.playerId);
            });
            oppLineup.forEach((p) => p && oppSet.add(p));
            return Array.from(oppSet);
          })()}
          onConfirmSub={(outPlayer, inPlayer) => {
            pushToHistory();
            const index = oppLineup.indexOf(outPlayer);
            if (index !== -1) {
              const newLineup = [...oppLineup];
              newLineup[index] = inPlayer;
              setOppLineup(newLineup);
              updateSetState({ oppLineup: newLineup });
              const isOppLibSub = inPlayer === oppLiberoId || outPlayer === oppLiberoId;
              if (!isOppLibSub) {
                setTeamStats((s) => ({ ...s, oppSubs: s.oppSubs + 1 }));
              }
              const newPairs = { ...subPairs };
              newPairs[outPlayer] = inPlayer;
              newPairs[inPlayer] = outPlayer;
              setSubPairs(newPairs);
              setSelectedOppId(null);
            }
          }}
        />
        {renderPlayerAccessModal()}
        {renderPlayerSecurity()}
        {renderInstallModal()}

        {/* Floating Persistent Return-to-Game Action Bar for Stats */}
        {(activeMatch || (appData.matches && appData.matches.some((m: any) => m.isLive === true)) || lastActiveMatchRef.current) && (
          <aside
            aria-label="Active Match Return Bar"
            className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-lg w-[calc(100%-1.5rem)] bg-slate-950/95 text-white px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.65)] border border-emerald-500/50 backdrop-blur-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 ring-1 ring-emerald-400/30"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                  {activeMatch?.type === "Practice" || lastActiveMatchRef.current?.type === "Practice"
                    ? "Practice Session Active"
                    : "Live Game In Progress"}
                </div>
                <div className="text-xs font-bold text-slate-100 truncate">
                  {activeMatch
                    ? `${activeMatch.opponent ? `vs ${activeMatch.opponent}` : activeMatch.title || "Match"} • Set ${currentSetNum} (${score.ucc}-${score.opp})`
                    : "Active match ready to resume"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setView("menu")}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 sm:px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer border border-slate-700"
                title="Go to Menu"
              >
                <Home size={14} />
              </button>
              <button
                type="button"
                onClick={returnToActiveGame}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3.5 sm:px-4 py-2 rounded-xl text-xs uppercase tracking-widest flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer ring-2 ring-emerald-300"
              >
                <Play size={13} className="fill-current shrink-0" />
                <span>Return to Game</span>
              </button>
            </div>
          </aside>
        )}

        {/* Debug Diagnostics Toast / Notice */}
        {debugNotice && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[calc(100%-2rem)] bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-indigo-500/50 backdrop-blur-md flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 min-w-0">
              <Activity size={16} className="text-indigo-400 shrink-0" />
              <p className="text-xs font-semibold text-slate-200 leading-tight">
                {debugNotice}
              </p>
            </div>
            <button
              onClick={() => setDebugNotice(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
