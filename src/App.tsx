// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import {
  Download,
  Users,
  Play,
  CheckCircle2,
  XCircle,
  Menu,
  Activity,
  Shield,
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
} from "lucide-react";

// Firebase Imports
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
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
  enableIndexedDbPersistence
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
  "from-slate-600 to-gray-800"
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
  return {
    id: `day_${match.type}_${dateStr}`,
    name: `${match.type} Day - ${dateStr}`,
  };
};

const CareerStatsModal = ({ playerName, playerBirthYear, myTeams, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [careerList, setCareerList] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let teamResults = [];
      let tot = {
        name: "CAREER TOTAL",
        teamColor: "bg-slate-800",
        passCount: 0, passSum: 0,
        attCount: 0, attKill: 0, attErr: 0,
        blkCount: 0, blkStuff: 0, blkLate: 0, blkNet: 0, blkUsed: 0,
        srvCount: 0, srvAce: 0, srvErr: 0,
        digCount: 0, digErr: 0
      };

      for (let team of myTeams) {
        try {
          const setSnap = await getDoc(doc(db, `teams/${team.id}/settings/core`));
          if (!setSnap.exists()) continue;
          const r = setSnap.data().roster || [];
          
          // Match by name AND birthYear (if both have birthYear)
          const playerMatch = r.find(p => {
             const nameMatch = p.name.toLowerCase() === playerName.toLowerCase();
             // Only enforce birthYear match if both the incoming player and the roster player have it defined
             const birthMatch = (!playerBirthYear || !p.birthYear) ? true : p.birthYear === playerBirthYear;
             return nameMatch && birthMatch;
          });
          
          if (!playerMatch) continue;

          let pTeam = {
            name: team.name,
            teamColor: team.color,
            passCount: 0, passSum: 0,
            attCount: 0, attKill: 0, attErr: 0,
            blkCount: 0, blkStuff: 0, blkLate: 0, blkNet: 0, blkUsed: 0,
            srvCount: 0, srvAce: 0, srvErr: 0,
            digCount: 0, digErr: 0
          };

          const q = query(
            collection(db, `teams/${team.id}/stats`),
            where("playerId", "==", playerMatch.id)
          );
          const statsSnap = await getDocs(q);
          
          statsSnap.forEach(docSnap => {
            const s = docSnap.data();
            if (s.isOpponent) return;

            if (s.category === "Pass") {
              pTeam.passCount += 1;
              pTeam.passSum += s.value;
            } else if (s.category === "Dig") {
              if (s.metric === "Dig") pTeam.digCount += 1;
              if (s.metric === "Error") pTeam.digErr += 1;
            } else if (s.category === "Attack") {
              if (s.metric === "Swing") pTeam.attCount += 1;
              if (s.metric === "Kill") pTeam.attKill += 1;
              if (s.metric === "Out" || s.metric === "Net" || s.metric === "Out/Net") pTeam.attErr += 1;
            } else if (s.category === "Block") {
              if (s.metric === "Attempt") pTeam.blkCount += 1;
              if (s.metric === "Block") pTeam.blkStuff += 1;
              if (s.metric === "Late") pTeam.blkLate += 1;
              if (s.metric === "Net Viol") pTeam.blkNet += 1;
              if (s.metric === "Used") pTeam.blkUsed += 1;
            } else if (s.category === "Serve") {
              if (s.metric === "Attempt") pTeam.srvCount += 1;
              if (s.metric === "Ace") pTeam.srvAce += 1;
              if (s.metric?.includes("Miss")) pTeam.srvErr += 1;
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
        } catch(e) {
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
  }, [playerName, playerBirthYear, myTeams]);

  return (
    <div className="absolute inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex flex-col p-4 sm:p-12 overflow-hidden items-center justify-center">
      <div className="bg-white max-w-5xl w-full rounded-3xl sm:rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] border border-white/20">
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 p-6 sm:p-10 rounded-t-3xl sm:rounded-t-[3rem] text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-widest uppercase flex items-center">
               PROFILE: {playerName} {playerBirthYear ? `(${playerBirthYear})` : ''}
            </h2>
            <p className="text-indigo-200 mt-2 font-bold tracking-widest text-sm uppercase">Global Career Stats</p>
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
             <div className="text-center text-slate-500 py-10 font-bold tracking-widest uppercase">No stats recorded yet across your teams.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl shadow-sm border border-slate-200 bg-white">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 text-xs tracking-widest uppercase border-b-2 border-slate-200">
                    <th className="p-3 sm:p-4 font-black bg-slate-100 sticky left-0 z-10 w-48 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">TEAM</th>
                    <th className="p-3 font-black text-center border-l bg-slate-50">PASS Avg(Tot)</th>
                    <th className="p-3 font-black text-center border-l">DIGS (D-Err)</th>
                    <th className="p-3 font-black text-center border-l bg-slate-50">SWINGS (Att-K-Err)</th>
                    <th className="p-3 font-black text-center border-l text-green-600">KILL %</th>
                    <th className="p-3 font-black text-center border-l bg-slate-50">BLOCKS (A-S-L-N-U)</th>
                    <th className="p-3 font-black text-center border-l">SERVES (Tot-A-Err)</th>
                  </tr>
                </thead>
                <tbody>
                  {careerList.map((p, i) => {
                    const isTotal = p.name === "CAREER TOTAL";
                    const passAvg = p.passCount > 0 ? (p.passSum / p.passCount).toFixed(2) : "-";
                    const killPct = p.attCount > 0 ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%" : "0.0%";
                    const blkTot = p.blkCount + p.blkStuff + p.blkLate + p.blkNet + p.blkUsed;
                    const srvTot = p.srvCount + p.srvAce + p.srvErr;

                    return (
                      <tr key={i} className={`text-xs sm:text-sm ${isTotal ? 'bg-indigo-50/80 border-t-[3px] border-indigo-200' : 'hover:bg-slate-50 border-b border-slate-100'}`}>
                         <td className={`p-3 font-black ${isTotal ? 'text-indigo-900 bg-indigo-50/80' : 'text-slate-800 bg-white'} sticky left-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)] flex items-center gap-2 h-full min-h-[50px]`}>
                            {!isTotal && <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${p.teamColor} shadow`}></span>}
                            {p.name}
                         </td>
                         <td className="p-3 text-center border-l bg-slate-50/30">
                            <strong>{passAvg}</strong> <span className="opacity-50">({p.passCount})</span>
                         </td>
                         <td className="p-3 text-center border-l">
                            <strong className="text-blue-600 text-base">{p.digCount}</strong> - <span className="text-red-500">{p.digErr}</span>
                         </td>
                         <td className="p-3 text-center border-l bg-slate-50/30">
                            {p.attCount} - <strong className="text-green-600 text-base">{p.attKill}</strong> - <span className="text-red-500">{p.attErr}</span>
                         </td>
                         <td className="p-3 text-center border-l text-green-700 font-black tracking-wider">
                            {killPct}
                         </td>
                         <td className="p-3 text-center border-l bg-slate-50/30 relative group whitespace-nowrap">
                            <span className="font-bold">{blkTot}</span> - 
                            <strong className="text-indigo-600 text-base mx-1">{p.blkStuff}</strong> - 
                            <span>{p.blkLate}</span> - <span>{p.blkNet}</span> - <span>{p.blkUsed}</span>
                         </td>
                         <td className="p-3 text-center border-l whitespace-nowrap">
                            <strong className="mr-1">{srvTot}</strong>
                            <span className="text-orange-500 mx-1 font-bold text-base">{p.srvAce}</span>
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
  const enforceFullscreen = () => {
    try {
      const docElm = document.documentElement as any;
      if (!document.fullscreenElement && !docElm.webkitFullscreenElement) {
        if (docElm.requestFullscreen) {
          docElm.requestFullscreen().catch(() => {});
        } else if (docElm.webkitRequestFullscreen) {
          docElm.webkitRequestFullscreen();
        }
      }
    } catch(e) {}
  };

  const toggleFullscreen = () => {
    try {
      const docElm = document.documentElement as any;
      if (!document.fullscreenElement && !docElm.webkitFullscreenElement) {
        if (docElm.requestFullscreen) {
          docElm.requestFullscreen().catch(() => {});
        } else if (docElm.webkitRequestFullscreen) {
          docElm.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
    } catch(e) {}
  };

  const [view, setView] = useState(() =>
    localStorage.getItem("ucc_vball_active_team") ? "menu" : "team_select"
  );
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authTimeoutReached, setAuthTimeoutReached] = useState(false);
  const [myTeams, setMyTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(
    () => localStorage.getItem("ucc_vball_active_team") || null
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
  const [newPlayerBirthYear, setNewPlayerBirthYear] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [rosterPresetName, setRosterPresetName] = useState("");
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
  const [endRallyVisible, setEndRallyVisible] = useState(false);
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [showOppLineupPrompt, setShowOppLineupPrompt] = useState(false);
  const [tempOppLineup, setTempOppLineup] = useState(["", "", "", "", "", ""]);
  const [newOppNumber, setNewOppNumber] = useState("");
  const [selectedOppId, setSelectedOppId] = useState(null);
  const [lateBlockPlayerId, setLateBlockPlayerId] = useState(null);
  const [tempNote, setTempNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [setWinnerModal, setSetWinnerModal] = useState(null);
  const [careerPlayerName, setCareerPlayerName] = useState(null);
  const [careerPlayerBirthYear, setCareerPlayerBirthYear] = useState(null);
  const [statFilter, setStatFilter] = useState("all");
  const [trackOppReceives, setTrackOppReceives] = useState(() => localStorage.getItem("ucc_track_opp_receives") !== "false");

  useEffect(() => {
    localStorage.setItem("ucc_track_opp_receives", trackOppReceives);
  }, [trackOppReceives]);

  // Hierarchical Stats Navigation State
  const [statsPath, setStatsPath] = useState([
    { level: "season", id: "all", name: "Season Totals" },
  ]);

  // -------------------------------------------------------------
  // INITIALIZATION (APP ICON & FIREBASE OR LOCAL FALLBACK)
  // -------------------------------------------------------------

  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = "/unamed.jpg";
    let appleLink = document.querySelector("link[rel~='apple-touch-icon']");
    if (!appleLink) {
      appleLink = document.createElement("link");
      appleLink.rel = "apple-touch-icon";
      document.head.appendChild(appleLink);
    }
    appleLink.href = "/unamed.jpg";
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
        if (!u && view !== "team_select") {
          setView("team_select");
        }
      });
    } catch (err) {
      console.error("Auth Listener Error:", err);
      setLoadingAuth(false);
    }

    // Also verify connection in background
    if (db) {
      getDocFromServer(doc(db, 'test', 'connection')).catch(e => {
          if (e.message?.includes('insufficient permissions')) {
              console.log("Firebase connection verified.");
          }
      });
    }

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [view]);

  useEffect(() => {
    if (!user || !db || !isFirebaseAvailable) {
      setMyTeams([]);
      return;
    }
    let unsub = () => {};
    try {
      unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (docSnap.exists() && docSnap.data().teams) {
          setMyTeams(docSnap.data().teams);
        } else {
          setMyTeams([]);
        }
      }, (err) => {
        console.error("Teams Sync Error:", err);
      });
    } catch (err) {
      console.error("Teams Listener Setup Error:", err);
    }
    return () => unsub();
  }, [user]);

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

    // Join the team for Auth access (Ensure role is set for Security Rules)
    const existingTeam = myTeams.find(t => t.id === activeTeam);
    const roleToSet = existingTeam?.role || 'player';
    
    setDoc(
      doc(db, `${publicPath}/${activeTeam}/members/${user.uid}`),
      { uid: user.uid, joinedAt: serverTimestamp(), role: roleToSet },
      { merge: true }
    ).catch(err => {
      // If we get a permission error here, it's likely fine as we might already be a member
      if (!err.message?.includes('insufficient permissions')) {
        console.error("Background join failed:", err);
      }
    });

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
      (err) => console.error("Firebase settings error:", err)
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
      (err) => console.error("Firebase opponents error:", err)
    );

    const unsubMatches = onSnapshot(
      collection(db, `${publicPath}/${activeTeam}/matches`),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push(d.data()));
        setAppData((prev) => ({ ...prev, matches: arr }));
      },
      (err) => console.error("Firebase matches error:", err)
    );

    const unsubSets = onSnapshot(
      collection(db, `${publicPath}/${activeTeam}/sets`),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push(d.data()));
        setAppData((prev) => ({ ...prev, sets: arr }));
      },
      (err) => console.error("Firebase sets error:", err)
    );

    const unsubStats = onSnapshot(
      collection(db, `${publicPath}/${activeTeam}/stats`),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push(d.data()));
        setAppData((prev) => ({ ...prev, stats: arr }));
      },
      (err) => console.error("Firebase stats error:", err)
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
    if (activeSetId && appData.sets.length > 0) {
      const currentSet = appData.sets.find((s) => s.id === activeSetId);
      if (currentSet) {
        if (score.ucc !== currentSet.scoreUcc || score.opp !== currentSet.scoreOpp) {
          setScore({ ucc: currentSet.scoreUcc || 0, opp: currentSet.scoreOpp || 0 });
        }
        if (currentSet.lineup && JSON.stringify(lineup) !== JSON.stringify(currentSet.lineup)) {
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

  // -------------------------------------------------------------
  // HELPER FUNCTIONS & DUAL-MODE DATA WRITES
  // -------------------------------------------------------------

  const writeLocalDb = (updatedData) => {
    setAppData(updatedData);
    if (!isFirebaseAvailable)
      localStorage.setItem(
        `ucc_vball_db_${activeTeam}`,
        JSON.stringify(updatedData)
      );
  };

  const updateSetState = async (updates) => {
    if (isFirebaseAvailable && user && activeSetId) {
      try {
        await setDoc(doc(db, `${publicPath}/${activeTeam}/sets/${activeSetId}`), updates, { merge: true });
      } catch (e) {
        console.error("Failed to sync set state:", e);
      }
    }
  };

  const rotateUCC = () => {
    setLineup((prev) => {
      const newLineup = [...prev.slice(1), prev[0]];
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
    if (newPlayerName && newPlayerNum && newPlayerBirthYear) {
      if (!/^\d{4}$/.test(newPlayerBirthYear)) {
          alert("Please enter a valid 4-digit birth year.");
          return;
      }
      const newPlayer = {
        id: Date.now().toString(),
        name: newPlayerName,
        number: newPlayerNum,
        birthYear: newPlayerBirthYear,
      };
      if (isFirebaseAvailable && user) {
        const newRoster = [...appData.roster, newPlayer];
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/settings/core`),
          { roster: newRoster },
          { merge: true }
        );
      } else if (!isFirebaseAvailable) {
        writeLocalDb({ ...appData, roster: [...appData.roster, newPlayer] });
      }
      setNewPlayerName("");
      setNewPlayerNum("");
      setNewPlayerBirthYear("");
    } else {
        alert("Please fill in Name, Number, and Birth Year (YYYY).");
    }
  };

  const removePlayer = async (id) => {
    const p = appData.roster.find(player => player.id === id);
    if (p && !confirm(`Are you sure you want to remove ${p.name} from the roster?`)) return;

    const newRoster = appData.roster.filter((p) => p.id !== id);
    if (isFirebaseAvailable && user) {
      await setDoc(
        doc(db, `${publicPath}/${activeTeam}/settings/core`),
        { roster: newRoster },
        { merge: true }
      );
    } else if (!isFirebaseAvailable) {
      writeLocalDb({ ...appData, roster: newRoster });
    }
    if (lineup.includes(id))
      setLineup(lineup.map((p) => (p === id ? null : p)));
  };

  const saveRosterAsPreset = async () => {
    if (!rosterPresetName.trim()) {
      setErrorMsg("Please enter a name for the roster preset.");
      return;
    }
    const updatedRosters = {
      ...appData.savedRosters,
      [rosterPresetName]: appData.roster,
    };
    if (isFirebaseAvailable && user) {
      await setDoc(
        doc(db, `${publicPath}/${activeTeam}/settings/core`),
        { savedRosters: updatedRosters },
        { merge: true }
      );
    } else if (!isFirebaseAvailable) {
      writeLocalDb({ ...appData, savedRosters: updatedRosters });
    }
    setRosterPresetName("");
    setErrorMsg("");
  };

  const loadRosterPreset = async (name) => {
    if (name && appData.savedRosters[name]) {
      const loadedRoster = appData.savedRosters[name];
      if (isFirebaseAvailable && user) {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/settings/core`),
          { roster: loadedRoster },
          { merge: true }
        );
      } else if (!isFirebaseAvailable) {
        writeLocalDb({ ...appData, roster: loadedRoster });
      }
      const currentIds = loadedRoster.map((p) => p.id);
      setLineup((prev) =>
        prev.map((id) => (currentIds.includes(id) ? id : null))
      );
    }
  };

  const handleOpponentNameChange = (e) => {
    const val = e.target.value.replace(/\//g, "-");
    setOpponentName(val);
    const existingKey = Object.keys(appData.opponents).find(
      (o) => o.toLowerCase() === val.toLowerCase()
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

  const startSetup = (type) => {
    enforceFullscreen();
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

  const joinLiveMatch = () => {
    enforceFullscreen();
    const sortedMatches = [...appData.matches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const liveMatches = sortedMatches.filter(m => m.isLive !== false);
    const latestMatch =
      liveMatches.length > 0 ? liveMatches[liveMatches.length - 1] : (sortedMatches.length > 0 ? sortedMatches[sortedMatches.length - 1] : null);
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
    if (window.confirm("Are you sure you want to end this game and leave? It will be marked as complete.")) {
      if (isFirebaseAvailable && user && activeTeam) {
        try {
          await setDoc(doc(db, `${publicPath}/${activeTeam}/matches/${activeMatch.id}`), { isLive: false }, { merge: true });
        } catch (e) {
          console.error("Failed to mark match complete", e);
        }
      }
      
      // Update local state proactively
      setAppData(prev => ({
        ...prev,
        matches: prev.matches.map(m => m.id === activeMatch.id ? { ...m, isLive: false } : m)
      }));

      setActiveMatch(null);
      setActiveSetId(null);
      setView("menu");
    }
  };

  const startGame = () => {
    enforceFullscreen();
    if (lineup.some((p) => p === null)) {
      setErrorMsg("Assign a player to all 6 starting positions.");
      return;
    }
    if (!opponentName.trim()) {
      setErrorMsg("Enter an opponent name.");
      return;
    }
    setErrorMsg("");
    setShowOppLineupPrompt(true);
  };

  const finalizeStartGame = async () => {
    const finalOppLineup = tempOppLineup.map((val, idx) =>
      val.trim() !== "" ? val : `O${idx + 1}`
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
      rallyPhase: serving === "ucc" ? "serve" : "receive"
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
          }
        );
        batch.set(
          doc(db, `${publicPath}/${activeTeam}/matches/${matchId}`),
          newMatch
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
      setHistory([]);
      setShowOppLineupPrompt(false);
      setView("game");
      setRallyPhase(serving === "ucc" ? "serve" : "receive");
      setServePromptVisible(true);
    } catch (err) {
      console.error("Start Game Error:", err);
      alert("❌ Failed to start game. Check your connection or verified email status. Details: " + err.message);
    }
  };

  const pushToHistory = () => {
    const snapshot = {
      score: { ...score },
      lineup: [...lineup],
      oppLineup: [...oppLineup],
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
        (id) => !lastStatIds.includes(id)
      );

      const batch = writeBatch(db);
      statsToDelete.forEach((id) =>
        batch.delete(doc(db, `${publicPath}/${activeTeam}/stats/${id}`))
      );
      lastState.sets.forEach((s) =>
        batch.set(doc(db, `${publicPath}/${activeTeam}/sets/${s.id}`), s)
      );
      await batch.commit();
    } else if (!isFirebaseAvailable) {
      writeLocalDb({
        ...appData,
        stats: lastState.stats,
        sets: lastState.sets,
      });
    }

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
    isOpponent = false
  ) => {
    if (!activeMatch || !activeSetId) {
      console.error("Attempted to log stat without active match/set context.");
      alert("⚠️ Error: Game context lost. Please restart the match from the menu.");
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
      timestamp: new Date().toISOString(),
    };

    // Late block UI feedback
    if (category === "Block" && metric === "Late") {
      setLateBlockPlayerId(playerId);
      setTimeout(() => setLateBlockPlayerId(null), 1000);
    }

    // Optimistic local update for responsiveness
    setAppData(prev => ({
      ...prev,
      stats: [...prev.stats, newStat]
    }));

    if (isFirebaseAvailable && user) {
      try {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/stats/${statId}`),
          newStat
        );
      } catch (err) {
        console.error("Failed to save stat to cloud:", err);
        alert(`❌ Cloud Save Failed: ${err.message}. The stat was recorded locally but may not sync until connection is restored.`);
      }
    } else if (!isFirebaseAvailable) {
      writeLocalDb({ ...appData, stats: [...appData.stats, newStat] });
    }
  };

  const recordStatAndCheckPoint = (playerId, category, metric, value = 1) => {
    pushToHistory();
    logStat(playerId, category, metric, value);
    
    // Only close modal if it's NOT a 'Late' block
    if (!(category === "Block" && metric === "Late")) {
      setSelectedPlayerId(null);
    }

    if (category === "Attack") {
      if (metric === "Kill") {
        logStat(playerId, "Attack", "Swing", 1);
        handlePoint("ucc", true);
      } else if (metric === "Out" || metric === "Net") {
        logStat(playerId, "Attack", "Swing", 1);
        handlePoint("opp", true);
      }
    }
    if (category === "Block") {
      if (metric === "Block") handlePoint("ucc", true);
      else if (metric === "Net Viol") handlePoint("opp", true);
    }
    
    // ANY stat recorded during receive phase satisfies the "first touch", so we transition to PLAY.
    if (rallyPhase === "receive" || rallyPhase === "opp_receive" || category === "Pass") {
      changeRallyPhase("play");
    }
  };

  const recordOppStatAndCheckPoint = (oppId, category, metric, value = 1) => {
    pushToHistory();
    logStat(oppId, category, metric, value, true);
    
    // Only close modal if it's NOT a 'Late' block (for symmetry)
    if (!(category === "Block" && metric === "Late")) {
      setSelectedOppId(null);
    }

    if (category === "Attack") {
      if (metric === "Kill") {
        logStat(oppId, "Attack", "Swing", 1, true);
        handlePoint("opp", true);
      } else if (metric === "Out" || metric === "Net") {
        logStat(oppId, "Attack", "Swing", 1, true);
        handlePoint("ucc", true);
      }
    }
    
    // ANY stat recorded during receive phase satisfies the "first touch", so we transition to PLAY.
    if (rallyPhase === "receive" || rallyPhase === "opp_receive" || category === "Pass") {
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
      updateSetState({ scoreUcc: newUcc, scoreOpp: newOpp, serving: serving === "opp" && team === "ucc" ? "ucc" : (serving === "ucc" && team !== "ucc" ? "opp" : serving) });
    } else if (!isFirebaseAvailable) {
      writeLocalDb({
        ...appData,
        sets: appData.sets.map((s) =>
          s.id === activeSetId
            ? { ...s, scoreUcc: newUcc, scoreOpp: newOpp }
            : s
        ),
      });
    }

    const winner = checkSetWin(newUcc, newOpp);
    if (winner) setSetWinnerModal(winner);
    else {
      changeRallyPhase("serve");
    }
  };

  const startNextSet = async () => {
    const newSetsWon = { ...setsWon };
    if (setWinnerModal === "ucc") newSetsWon.ucc += 1;
    else newSetsWon.opp += 1;
    setSetsWon(newSetsWon);

    const nextSetNum = currentSetNum + 1;
    setCurrentSetNum(nextSetNum);

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
      setSetWinnerModal(null);
      viewStatsWithCurrentMatch();
      return;
    }

    const setId = Date.now().toString() + "_set";
    const newSet = {
      id: setId,
      matchId: activeMatch.id,
      setNum: nextSetNum,
      scoreUcc: 0,
      scoreOpp: 0,
      lineup: lineup,
      oppLineup: oppLineup,
      serving: serving,
      rallyPhase: "serve"
    };

    if (isFirebaseAvailable && user) {
     await setDoc(
        doc(db, `${publicPath}/${activeTeam}/sets/${setId}`),
        newSet
      );
    } else if (!isFirebaseAvailable)
      writeLocalDb({ ...appData, sets: [...appData.sets, newSet] });

    setActiveSetId(setId);
    setScore({ ucc: 0, opp: 0 });
    setTeamStats({ uccSubs: 0, oppSubs: 0, uccTimeouts: 0, oppTimeouts: 0 });
    setSetWinnerModal(null);
    changeRallyPhase("serve");
  };

  const handleServeStat = (metric, team) => {
    pushToHistory();
    const serverId = team === "ucc" ? lineup[0] : oppLineup[0];
    const isOpp = team === "opp";
    setServePromptVisible(false);

    if (metric === "Ace") {
      logStat(serverId, "Serve", "Ace", 1, isOpp);
      handlePoint(team, true);
    } else if (metric === "Error") setServeErrorPrompt(team);
    else if (metric === "In Play") {
      logStat(serverId, "Serve", "Attempt", 1, isOpp);
      // New: If we serve, prompt for opponent passing (opp_receive) based on setting
      changeRallyPhase(team === "ucc" ? (trackOppReceives ? "opp_receive" : "play") : "receive");
    }
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
          { ...currentSet, scoreUcc: newScore.ucc, scoreOpp: newScore.opp }
        );
    } else if (!isFirebaseAvailable) {
      writeLocalDb({
        ...appData,
        sets: appData.sets.map((s) =>
          s.id === activeSetId
            ? { ...s, scoreUcc: newScore.ucc, scoreOpp: newScore.opp }
            : s
        ),
      });
    }
    const winner = checkSetWin(newScore.ucc, newScore.opp);
    if (winner) setSetWinnerModal(winner);
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
      setTeamStats((s) => ({ ...s, uccSubs: s.uccSubs + 1 }));
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
        { merge: true }
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
        { merge: true }
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

  const handleOppLiberoToggle = () => {
    pushToHistory();
    const index = oppLineup.indexOf(selectedOppId);
    if (index === -1) return;
    const newLineup = [...oppLineup];
    if (selectedOppId === oppLiberoId) {
      newLineup[index] = oppLiberoSwappedOutId;
      setOppLiberoSwappedOutId(null);
    } else {
      setOppLiberoSwappedOutId(selectedOppId);
      newLineup[index] = oppLiberoId;
    }
    setOppLineup(newLineup);
    updateSetState({ oppLineup: newLineup });
    setSelectedOppId(null);
  };

  const handleOppSub = () => {
    if (!newOppNumber.trim()) return;
    pushToHistory();
    const index = oppLineup.indexOf(selectedOppId);
    if (index !== -1) {
      const newLineup = [...oppLineup];
      newLineup[index] = newOppNumber;
      setOppLineup(newLineup);
      updateSetState({ oppLineup: newLineup });
      setTeamStats((s) => ({ ...s, oppSubs: s.oppSubs + 1 }));
      setSelectedOppId(newOppNumber);
      setNewOppNumber("");
    }
  };

  const handleLiberoSwap = () => {
    pushToHistory();
    const index = lineup.indexOf(selectedPlayerId);
    if (index === -1) return;
    const newLineup = [...lineup];
    if (selectedPlayerId === liberoId) {
      newLineup[index] = liberoSwappedOutId;
      setLiberoSwappedOutId(null);
    } else {
      setLiberoSwappedOutId(selectedPlayerId);
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
    setStatsPath([{ level: "season", id: "all", name: "Season Totals" }]);
    setView("stats");
  };

  const viewStatsWithCurrentMatch = () => {
    if (!activeMatch) return viewStatsFromMenu();
    const eventDetails = getEventDetails(activeMatch);
    setStatsPath([
      { level: "season", id: "all", name: "Season Totals" },
      { level: "event", id: eventDetails.id, name: eventDetails.name },
      {
        level: "match",
        id: activeMatch.id,
        name: `vs ${activeMatch.opponent}`,
      },
    ]);
    setView("stats");
  };

  const navigateStats = (level, id, name) =>
    setStatsPath((prev) => [...prev, { level, id, name }]);
  const popStatsTo = (index) =>
    setStatsPath((prev) => prev.slice(0, index + 1));
  const currentNav = statsPath[statsPath.length - 1] || {
    level: "season",
    id: "all",
    name: "Season Totals",
  };

  const filteredStats = useMemo(() => {
    if (currentNav.level === "season") return appData.stats;
    if (currentNav.level === "event") {
      const matchIds = appData.matches
        .filter((m) => getEventDetails(m).id === currentNav.id)
        .map((m) => m.id);
      return appData.stats.filter((s) => matchIds.includes(s.matchId));
    }
    if (currentNav.level === "match")
      return appData.stats.filter((s) => s.matchId === currentNav.id);
    if (currentNav.level === "set")
      return appData.stats.filter((s) => s.setId === currentNav.id);
    return appData.stats;
  }, [appData.stats, appData.matches, currentNav]);

  const subNavOptions = useMemo(() => {
    if (currentNav.level === "season") {
      const events = {};
      appData.matches.forEach((m) => {
        const detail = getEventDetails(m);
        if (!events[detail.id])
          events[detail.id] = { ...detail, level: "event" };
      });
      return Object.values(events);
    }
    if (currentNav.level === "event")
      return appData.matches
        .filter((m) => getEventDetails(m).id === currentNav.id)
        .map((m) => ({ level: "match", id: m.id, name: `vs ${m.opponent}` }));
    if (currentNav.level === "match")
      return appData.sets
        .filter((s) => s.matchId === currentNav.id)
        .sort((a, b) => a.setNum - b.setNum)
        .map((s) => ({ level: "set", id: s.id, name: `Set ${s.setNum}` }));
    return [];
  }, [currentNav, appData.matches, appData.sets]);

  const { uccStats, opponentStats } = useMemo(() => {
    const uccData = {};
    const oppData = {};
    appData.roster.forEach((p) => {
      uccData[p.id] = {
        name: p.name,
        number: p.number,
        birthYear: p.birthYear || null,
        passSum: 0,
        passCount: 0,
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
    });

    filteredStats.forEach((s) => {
      if (s.isOpponent) {
        if (!oppData[s.playerId])
          oppData[s.playerId] = {
            attCount: 0,
            attKill: 0,
            srvAce: 0,
            srvErr: 0,
            passSum: 0,
            passCount: 0,
          };
        const p = oppData[s.playerId];
        if (s.category === "Attack") {
          if (s.metric === "Swing") p.attCount += 1;
          if (s.metric === "Kill") p.attKill += 1;
        } else if (s.category === "Serve") {
          if (s.metric === "Ace") p.srvAce += 1;
          if (s.metric?.includes("Miss")) p.srvErr += 1;
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
        } else if (s.category === "Dig") {
          if (s.metric === "Dig") p.digCount += 1;
          if (s.metric === "Error") p.digErr += 1;
        } else if (s.category === "Attack") {
          if (s.metric === "Swing") p.attCount += 1;
          if (s.metric === "Kill") p.attKill += 1;
          if (
            s.metric === "Out" ||
            s.metric === "Net" ||
            s.metric === "Out/Net"
          )
            p.attErr += 1;
        } else if (s.category === "Block") {
          if (s.metric === "Attempt") p.blkCount += 1;
          if (s.metric === "Block") p.blkStuff += 1;
          if (s.metric === "Late") p.blkLate += 1;
          if (s.metric === "Net Viol") p.blkNet += 1;
          if (s.metric === "Used") p.blkUsed += 1;
        } else if (s.category === "Serve") {
          if (s.metric === "Attempt") p.srvCount += 1;
          if (s.metric === "Ace") p.srvAce += 1;
          if (s.metric?.includes("Miss")) p.srvErr += 1;
        }
      }
    });
    return { uccStats: uccData, opponentStats: oppData };
  }, [filteredStats, appData.roster]);

  const exportCSV = () => {
    const currentTeam = myTeams.find(t => t.id === activeTeam);
    const teamName = currentTeam
      ? currentTeam.name.replace(/\s+/g, "_")
      : "Team";
    let csv = `UCC LANCERS (${teamName}) - ${currentNav.name.toUpperCase()}\nNumber,Name,Pass Avg,Passes,Digs,Dig Errors,Swings,Kills,Kill %,Att Errors,Blocks,Blk Late,Blk Net,Blk Used,Serves,Aces,Serve Errors,Serve +/-\n`;

    Object.values(uccStats).forEach((p) => {
      const passAvg =
        p.passCount > 0 ? (p.passSum / p.passCount).toFixed(2) : "0.00";
      const blkTot = p.blkCount + p.blkStuff + p.blkLate + p.blkNet + p.blkUsed;
      const srvTot = p.srvCount + p.srvAce + p.srvErr;
      const killPct =
        p.attCount > 0
          ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%"
          : "0.0%";
      const srvPlusMinus = p.srvAce - p.srvErr;
      csv += `"${p.number}","${p.name}",${passAvg},${p.passCount},${p.digCount},${p.digErr},${p.attCount},${p.attKill},${killPct},${p.attErr},${blkTot},${p.blkLate},${p.blkNet},${p.blkUsed},${srvTot},${p.srvAce},${p.srvErr},${srvPlusMinus}\n`;
    });

    csv +=
      "\nOPPONENT STATS\nID,Pass Avg,Passes,Swings,Kills,Kill %,Aces,Serve Errors,Serve +/-\n";
    Object.entries(opponentStats).forEach(([id, p]) => {
      const passAvg =
        p.passCount > 0 ? (p.passSum / p.passCount).toFixed(2) : "0.00";
      const killPct =
        p.attCount > 0
          ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%"
          : "0.0%";
      const srvPlusMinus = p.srvAce - p.srvErr;
      csv += `"${id}",${passAvg},${p.passCount},${p.attCount},${p.attKill},${killPct},${p.srvAce},${p.srvErr},${srvPlusMinus}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Lancers_${teamName}_${currentNav.name.replace(
      /[^a-z0-9]/gi,
      "_"
    )}_${new Date().toLocaleDateString().replace(/\//g, "-")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const benchPlayers = appData.roster.filter(p => !lineup.includes(p.id));
  const selectedPlayerObj = appData.roster.find((r) => r.id === selectedPlayerId);

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
        name: name
      });

      // Give access to coach
      batch.set(doc(db, `${publicPath}/${tId}/members/${user.uid}`), { 
        uid: user.uid, 
        role: 'coach', 
        joinedAt: serverTimestamp() 
      });
      
      // Core settings
      batch.set(doc(db, `${publicPath}/${tId}/settings/core`), { 
        roster: DEFAULT_ROSTER, 
        savedRosters: {}, 
        savedLineups: {}, 
        teamName: name, 
        coachCode, 
        playerCode 
      });
      
      // Store codes mapping
      batch.set(doc(db, "share_codes", coachCode), { teamId: tId, role: 'coach' });
      batch.set(doc(db, "share_codes", playerCode), { teamId: tId, role: 'player' });

      // Save visually to user profile
      const newTeams = [...myTeams, { id: tId, name, color, role: 'coach' }];
      batch.set(doc(db, "users", user.uid), { teams: newTeams }, { merge: true });
      
      await batch.commit();
      console.log("Team creation successful");
      alert(`✅ Team created successfully!\n\nCoach Code: ${coachCode}\nPlayer Code: ${playerCode}`);
    } catch(e) {
      console.error("DEBUG - Team Creation Error:", e);
      let errorMsg = e.message || "Unknown error";
      if (errorMsg.includes("permissions")) {
        errorMsg = "Forbidden: Your account does not have permission to create teams. This usually happens if your email is not verified or your session has expired.";
      }
      alert(`❌ Failed to create team.\n\nDetails: ${errorMsg}`);
    }
  };

  const handleJoinTeam = async () => {
    if (!user) return;
    const tIdRaw = prompt("Enter a Coach or Player Share Code:");
    if (!tIdRaw) return;
    const code = tIdRaw.toUpperCase().trim();
    
    try {
      let teamId = code;
      let role = 'coach';
      
      // Try resolving via share_codes
      const codeSnap = await getDoc(doc(db, "share_codes", code));
      if (codeSnap.exists()) {
        teamId = codeSnap.data().teamId;
        role = codeSnap.data().role;
      }

      if (myTeams.find(t => t.id === teamId)) {
        alert("You are already in this team.");
        return;
      }
      
      // 1. Give Access (via permissive member creation rule)
      await setDoc(doc(db, `${publicPath}/${teamId}/members/${user.uid}`), { uid: user.uid, role, joinedAt: serverTimestamp() });
      
      // 2. Fetch metadata that we now have access to read
      const snap = await getDoc(doc(db, `${publicPath}/${teamId}/settings/core`));
      const tName = snap.exists() && snap.data().teamName ? snap.data().teamName : "Joined Team";
      const color = TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)];
      
      // 3. Update user profile
      const newTeams = [...myTeams, { id: teamId, name: tName, color, role }];
      await setDoc(doc(db, "users", user.uid), { teams: newTeams }, { merge: true });
      alert(`Successfully joined ${tName} as a ${role === 'coach' ? "Coach" : "Player"}!`);
    } catch (e) {
      console.error(e);
      alert("Failed to join. Verify the share code is correct.");
    }
  };

  const handleDeleteTeam = async (teamId) => {
    const team = myTeams.find(t => t.id === teamId);
    if (!team) return;
    
    const confirmMsg = team.role === 'coach' 
      ? `⚠️ DISBAND / LEAVE TEAM: Are you sure you want to remove "${team.name}"?`
      : `LEAVE TEAM: Are you sure you want to remove "${team.name}" from your list?`;
      
    if (!window.confirm(confirmMsg)) return;

    try {
      // 1. Remove from user profile instantly so they are unblocked
      const newTeams = myTeams.filter(t => t.id !== teamId);
      await setDoc(doc(db, "users", user.uid), { teams: newTeams }, { merge: true });
      
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
        if (team.role === 'coach') {
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

  const handleDeleteMatch = async (matchId) => {
    const match = appData.matches.find(m => m.id === matchId);
    if (!match) return;

    if (!window.confirm(`⚠️ DELETE GAME: Are you sure you want to delete the match vs ${match.opponent}?\n\nThis will permanently erase all stats and sets for this game. This cannot be undone.`)) return;

    try {
      const teamId = activeTeam;
      
      // 1. Delete associated stats (filter locally then request deletes)
      const statsToDelete = appData.stats.filter(s => s.matchId === matchId);
      if (statsToDelete.length > 0) {
        // Break into batches of 500 (Firestore limit)
        for (let i = 0; i < statsToDelete.length; i += 500) {
          const batch = writeBatch(db);
          statsToDelete.slice(i, i + 500).forEach(s => {
            batch.delete(doc(db, `${publicPath}/${teamId}/stats/${s.id}`));
          });
          await batch.commit();
        }
      }

      // 2. Delete associated sets
      const setsToDelete = appData.sets.filter(s => s.matchId === matchId);
      if (setsToDelete.length > 0) {
        const setBatch = writeBatch(db);
        setsToDelete.forEach(s => {
          setBatch.delete(doc(db, `${publicPath}/${teamId}/sets/${s.id}`));
        });
        await setBatch.commit();
      }

      // 3. Finally delete the match record itself
      await deleteDoc(doc(db, `${publicPath}/${teamId}/matches/${matchId}`));
      
      // If we were in this game, reset view
      if (activeMatch?.id === matchId) {
        setActiveMatch(null);
        setView("menu");
      }
      
      alert("Game and all associated stats deleted successfully.");
    } catch (e) {
      console.error("Delete Match Error:", e);
      alert("Failed to delete game completely. " + e.message);
    }
  };

  const handleDeleteSet = async (setId) => {
    const s = appData.sets.find(set => set.id === setId);
    if (!s) return;
    if (!window.confirm(`⚠️ DELETE SET: Are you sure you want to delete Set ${s.setNum}?\n\nAll stats recorded during this set will be permanently erased.`)) return;
    
    try {
       const teamId = activeTeam;
       const statsToDelete = appData.stats.filter(stat => stat.setId === setId);
       if (statsToDelete.length > 0) {
         const batch = writeBatch(db);
         statsToDelete.forEach(stat => {
           batch.delete(doc(db, `${publicPath}/${teamId}/stats/${stat.id}`));
         });
         await batch.commit();
       }
       
       await deleteDoc(doc(db, `${publicPath}/${teamId}/sets/${setId}`));
       alert("Set and associated stats deleted.");
    } catch (e) {
       console.error("Delete Set Error:", e);
       alert("Failed to delete set.");
    }
  };

  // -------------------------------------------------------------
  // RENDERERS
  // -------------------------------------------------------------
  
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans p-6 text-center">
        <div className="flex flex-col items-center max-w-sm">
           {!authTimeoutReached ? (
             <>
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
               <p className="text-white font-bold tracking-widest uppercase opacity-50">Authenticating...</p>
             </>
           ) : (
             <div className="bg-slate-800 p-8 rounded-3xl border border-white/10 shadow-2xl animate-in fade-in zoom-in duration-500">
               <Shield className="text-amber-400 mb-4 mx-auto" size={48} />
               <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Syncing taking a while?</h3>
               <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                 We're having trouble connecting to the cloud. You can continue in offline mode, but changes might not sync until you reconnect.
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
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
          <img
            src="/unamed.jpg"
            alt="bg"
            referrerPolicy="no-referrer"
            className="h-[800px] w-[800px] object-contain blur-sm rounded-full"
          />
        </div>

        <div className="w-full max-w-3xl relative z-10 flex flex-col items-center">
          <div className="bg-white p-4 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.1)] mb-8">
            <img
              src="/unamed.jpg"
              alt="Lancers Logo"
              referrerPolicy="no-referrer"
              className="h-24 w-24 sm:h-32 sm:w-32 object-contain rounded-full"
            />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-widest text-white uppercase drop-shadow-md text-center mb-2">
            UCC Lancers
          </h1>
          <h2 className="text-sm sm:text-lg font-bold text-slate-400 tracking-widest uppercase text-center mb-10">
            {user ? "Your Teams" : "Sign In to Access Teams"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full px-4 mb-6">
            {user && myTeams.map((team) => (
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
                  <span className="text-[10px] opacity-60 mt-2 tracking-widest font-bold uppercase font-sans">{team.role}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTeam(team.id);
                  }}
                  className="absolute top-4 right-4 p-2 text-white/40 hover:text-red-400 bg-black/10 hover:bg-black/30 rounded-full transition-all group-hover:opacity-100 sm:opacity-0"
                  title="Delete/Leave Team"
                >
                  <Trash2 size={18} />
                </button>
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
                      if (err.code === 'auth/popup-blocked') {
                        alert("Your browser blocked the sign-in popup. Please allow popups for this site, or open it in a new tab.");
                      } else {
                        alert(`Sign-in error: ${err.message}`);
                      }
                    }
                  }}
                  className="bg-white text-slate-800 px-6 py-3 rounded-full font-bold flex items-center shadow-lg hover:bg-slate-100 transition-colors"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-5 h-5 mr-3" />
                  Sign in with Google to Sync
                </button>
                <p className="text-slate-400 text-xs max-w-sm text-center mt-2">
                  If the popup doesn't open, ensure your browser doesn't block popups or Try opening the app in a new tab.
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
      </div>
    );
  }

  if (view === "menu") {
    const teamInfo = myTeams.find(t => t.id === activeTeam) || { name: "Team Data", color: "from-slate-600 to-slate-800" };
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans p-4 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
          <img
            src="/unamed.jpg"
            alt="bg"
            referrerPolicy="no-referrer"
            className="h-[500px] w-[500px] sm:h-[800px] sm:w-[800px] object-contain blur-sm rounded-full"
          />
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] sm:rounded-[3rem] shadow-2xl p-6 sm:p-12 max-w-3xl w-full relative z-10 flex flex-col items-center">
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
            <div className="bg-white p-3 sm:p-4 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.2)] mb-4 sm:mb-6">
              <img
                src="/unamed.jpg"
                alt="Lancers Logo"
                referrerPolicy="no-referrer"
                className="h-20 w-20 sm:h-32 sm:w-32 object-contain rounded-full"
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
              <div className="mt-4 text-slate-400 text-xs sm:text-sm bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                <Users size={14} />
                <span>Share Code: <strong className="text-white tracking-widest select-all">{activeTeam}</strong></span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full mb-6 sm:mb-10">
            {teamInfo.role !== 'player' && (
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
                {appData.matches.filter(m => m.isLive !== false).length > 0 && (
                  <button
                    onClick={joinLiveMatch}
                    className="md:col-span-2 bg-gradient-to-b from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 border border-green-400 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl font-black text-sm sm:text-xl tracking-widest transition-all duration-200 active:scale-95 flex items-center justify-center uppercase shadow-lg"
                  >
                    <Activity className="mr-2 sm:mr-3 text-green-100" size={20} />{" "}
                    Join Live Match
                  </button>
                )}
              </>
            )}
          </div>

          <div className="w-full">
            <button
              onClick={viewStatsFromMenu}
              className="w-full bg-white text-[#001b5e] p-4 sm:p-6 rounded-2xl sm:rounded-3xl font-black text-lg sm:text-xl tracking-widest hover:bg-slate-100 transition-all duration-200 active:scale-95 flex items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.4)]"
            >
              <Database className="mr-2 sm:mr-3 text-[#0033A0]" size={24} />{" "}
              VIEW DATABASE
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "setup") {
    const tourneys = [
      ...new Set(
        appData.matches
          .filter((m) => m.type === "Tournament" && m.title)
          .map((m) => m.title)
      ),
    ];
    const oppNames = Object.keys(appData.opponents);

    return (
      <div className="min-h-screen bg-slate-50 p-2 sm:p-6 md:p-10 font-sans flex flex-col items-center justify-start sm:justify-center">
        <div className="w-full max-w-4xl bg-white rounded-2xl sm:rounded-[2rem] shadow-xl sm:shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
          <div className="bg-gradient-to-r from-[#001b5e] via-[#0033A0] to-[#001b5e] p-4 sm:p-6 text-white flex justify-between items-center shadow-md z-10 relative">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="bg-white p-1 rounded-full shadow-inner hidden sm:block">
                <img
                  src="/unamed.jpg"
                  alt="Logo"
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 sm:h-12 sm:w-12 object-contain rounded-full"
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
                  <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1">
                    Opponent Name
                  </label>
                  <input
                    list="opp-list"
                    className="w-full p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-slate-200 font-bold text-base sm:text-lg text-[#0033A0] focus:ring-2 focus:ring-[#0033A0] outline-none"
                    value={opponentName}
                    onChange={handleOpponentNameChange}
                    placeholder="Enter name..."
                  />
                  <datalist id="opp-list">
                    {oppNames.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
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
                  </select>
                </div>
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
                    First Serve
                  </label>
                  <div className="flex gap-2 min-h-[46px] sm:min-h-[56px]">
                    <button
                      onClick={() => setServing("ucc")}
                      className={`flex-1 rounded-xl sm:rounded-2xl font-black transition-all border text-[10px] sm:text-xs tracking-widest uppercase ${
                        serving === "ucc"
                          ? "bg-[#0033A0] text-white border-[#0033A0] shadow-md"
                          : "bg-white text-slate-400 border-slate-200"
                      }`}
                    >
                      UCC
                    </button>
                    <button
                      onClick={() => setServing("opp")}
                      className={`flex-1 rounded-xl sm:rounded-2xl font-black transition-all border text-[10px] sm:text-xs tracking-widest uppercase ${
                        serving === "opp"
                          ? "bg-[#0033A0] text-white border-[#0033A0] shadow-md"
                          : "bg-white text-slate-400 border-slate-200"
                      }`}
                    >
                      OPP
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <label className="block font-black text-slate-800 uppercase tracking-widest text-sm sm:text-base">
                  UCC Lineup
                </label>
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
                    {appData.roster.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.number} {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                {[1, 2, 3, 4, 5, 6].map((pos, idx) => (
                  <div
                    key={pos}
                    className="bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#0033A0] transition-all flex flex-col"
                  >
                    <div className="bg-slate-100 px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 flex justify-between items-center">
                      <span>Pos {pos}</span>
                      {pos === 1 && serving === "ucc" && (
                        <span className="text-xs sm:text-sm leading-none">
                          🏐
                        </span>
                      )}
                    </div>
                    <select
                      className="p-2 sm:p-3 bg-transparent font-black text-slate-800 outline-none w-full appearance-none cursor-pointer text-center text-sm sm:text-base"
                      value={lineup[idx] || ""}
                      onChange={(e) => {
                        const newLineup = [...lineup];
                        newLineup[idx] = e.target.value;
                        setLineup(newLineup);
                      }}
                    >
                      <option value="">Select Player</option>
                      {appData.roster.map((p) => (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={
                            lineup.includes(p.id) && lineup[idx] !== p.id
                          }
                        >
                          #{p.number} {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
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
          <div className="absolute inset-0 bg-slate-900/90 z-50 flex flex-col items-center justify-center p-2 sm:p-4 backdrop-blur-md">
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
                    placeholder="Save Roster As..."
                    value={rosterPresetName}
                    onChange={(e) => setRosterPresetName(e.target.value)}
                    className="flex-1 bg-transparent border-none font-bold focus:ring-0 outline-none text-slate-700 placeholder-slate-400 text-xs sm:text-base"
                  />
                  <button
                    onClick={saveRosterAsPreset}
                    className="bg-[#0033A0] text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-sm text-xs sm:text-sm"
                  >
                    SAVE
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200">
                  <div className="flex gap-2">
                    <input
                      placeholder="#"
                      className="w-12 sm:w-16 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-slate-200 outline-none font-black text-center text-[#0033A0] text-sm sm:text-base"
                      value={newPlayerNum}
                      onChange={(e) => setNewPlayerNum(e.target.value)}
                      type="number"
                    />
                    <input
                      placeholder="Birth Year (YYYY)"
                      className="w-24 sm:w-32 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-slate-200 outline-none font-bold text-slate-700 text-sm sm:text-base text-center hidden sm:block"
                      value={newPlayerBirthYear}
                      onChange={(e) => setNewPlayerBirthYear(e.target.value)}
                      maxLength={4}
                    />
                  </div>
                  <div className="flex flex-1 gap-2">
                    <input
                      placeholder="Birth YYYY"
                      className="w-24 p-2 rounded-lg border border-slate-200 outline-none font-bold text-slate-700 text-sm text-center sm:hidden"
                      value={newPlayerBirthYear}
                      onChange={(e) => setNewPlayerBirthYear(e.target.value)}
                      maxLength={4}
                    />
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

              <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 bg-slate-100">
                {appData.roster.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center bg-white p-2 sm:p-3 rounded-lg sm:rounded-xl shadow-sm border border-slate-200"
                  >
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-50 flex items-center justify-center font-black text-[#0033A0] text-xs sm:text-base">
                        {p.number}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-700 text-sm sm:text-base truncate">
                          {p.name}
                        </span>
                        {p.birthYear && (
                          <span className="text-[10px] text-slate-400 font-bold tracking-widest">{p.birthYear}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removePlayer(p.id)}
                      className="text-red-400 hover:text-red-600 transition-colors p-2"
                    >
                      <XCircle size={18} className="sm:w-5 sm:h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* OPPONENT LINEUP MODAL */}
        {showOppLineupPrompt && (
          <div className="absolute inset-0 bg-slate-900/90 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-md">
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
                {[1, 2, 3, 4, 5, 6].map((pos, idx) => (
                  <div
                    key={pos}
                    className="flex flex-col bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 focus-within:border-slate-400 transition-colors"
                  >
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest text-center">
                      Pos {pos}{" "}
                      {pos === 1 && serving === "opp" ? (
                        <span className="ml-0.5">🏐</span>
                      ) : (
                        ""
                      )}
                    </label>
                    <input
                      placeholder={`Opp ${pos}`}
                      value={tempOppLineup[idx]}
                      onChange={(e) => {
                        const newArr = [...tempOppLineup];
                        newArr[idx] = e.target.value;
                        setTempOppLineup(newArr);
                      }}
                      className="w-full bg-transparent border-none focus:ring-0 outline-none text-base sm:text-xl font-black text-slate-700 text-center uppercase p-0"
                    />
                  </div>
                ))}
              </div>
              <div className="p-4 sm:p-6 bg-white flex flex-col gap-3 sm:gap-4">
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
      </div>
    );
  }

  if (view === "game") {
    return (
      <div className="h-[100dvh] w-full bg-slate-900 flex flex-col font-sans select-none overflow-hidden">
        {/* HEADER / SCOREBOARD */}
        <header className="bg-gradient-to-r from-slate-900 via-[#001b5e] to-slate-900 text-white shadow-md z-10 border-b border-white/10 shrink-0">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 py-1.5 sm:py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-1 sm:gap-4">
            
            <div className="flex items-center space-x-2 sm:space-x-4 order-1 sm:order-none">
              <div className="bg-white/10 backdrop-blur-md p-1 rounded-full border border-white/20 shadow-sm hidden md:block">
                <img
                  src="/unamed.jpg"
                  alt="Logo"
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 object-contain rounded-full bg-white/10 p-0.5"
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
                  <h2 className="text-[8px] sm:text-xs font-black leading-tight tracking-[0.1em] uppercase text-blue-200 opacity-70">
                    Lancers
                  </h2>
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
                    🏐
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-row sm:flex-col items-center justify-center px-1 sm:px-2 order-3 sm:order-none w-full sm:w-auto mt-1 sm:mt-0 pt-1 sm:pt-0 border-t border-white/5 sm:border-none relative">
              <button 
                onClick={toggleFullscreen}
                className="absolute left-2 sm:-left-8 text-white/50 hover:text-white p-1"
                title="Toggle Fullscreen"
              >
                <Maximize size={14} />
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
                  <span className="text-[5px] sm:text-[6px] tracking-widest text-emerald-400 opacity-80 border-l sm:border-none border-white/20 pl-2 sm:pl-0">LIVE SYNC</span>
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
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 order-2 sm:order-none">
              <div
                className={`py-1 sm:py-2 px-2 sm:px-4 rounded-xl sm:rounded-3xl flex items-center gap-2 transition-all duration-300 ${
                  serving === "opp"
                    ? "bg-white/15 border border-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.1)]"
                    : "bg-transparent border border-transparent"
                }`}
              >
                {serving === "opp" && (
                  <div className="text-xl sm:text-2xl animate-bounce drop-shadow-md">
                    🏐
                  </div>
                )}
                <div className="flex flex-col items-end">
                  <h2 className="text-[8px] sm:text-xs font-black leading-tight tracking-[0.1em] uppercase text-slate-300 opacity-70 truncate max-w-[60px] sm:max-w-[100px]">
                    {opponentName}
                  </h2>
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

        {/* FULL SCREEN COURT */}
        <div className="flex-1 flex items-center justify-center relative bg-slate-900 shadow-inner p-2 sm:p-4 md:p-6 overflow-hidden min-h-0">

          {/* Background Logo */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
            <img
              src="/unamed.jpg"
              alt="Lancers Logo bg"
              className="h-[300px] w-[300px] sm:h-[500px] sm:w-[500px] object-contain rounded-full"
            />
          </div>

          {/* COURT CONTAINER */}
          <div className="w-full max-w-full h-full sm:max-h-full sm:w-auto aspect-[9/16] sm:aspect-[1/1.8] bg-[#c28e60] p-1.5 sm:p-3 shadow-[0_0_30px_rgba(0,0,0,0.5)] relative rounded-lg flex flex-col border-2 sm:border-4 border-slate-800 mx-auto">
            <div className="flex-1 bg-gradient-to-b from-[#e3b587] to-[#d6a575] border-2 sm:border-[6px] border-white relative flex flex-col shadow-inner">
              {/* OPPONENT SIDE */}
              <div className="flex-1 relative flex flex-col justify-between p-1 sm:p-4 border-b-2 sm:border-b-4 border-white/80">
                <div className="absolute bottom-[33.33%] left-0 w-full border-t-[2px] sm:border-t-[3px] border-white/60 shadow-[0_2px_4px_rgba(0,0,0,0.1)]"></div>
                <div className="w-full text-center text-[#8a5a2b]/20 font-black text-3xl sm:text-6xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none tracking-widest uppercase">
                  {opponentName.substring(0, 8)}
                </div>

                <div className="flex justify-around items-center w-full mt-1 sm:mt-4 relative z-10">
                  {[0, 5, 4].map((idx) => {
                    const oppId = oppLineup[idx];
                    const hasNote =
                      oppNotesMem[oppId] && oppNotesMem[oppId].trim() !== "";
                    const isSetter = oppId === oppSetterId;
                    const isLibero = oppId === oppLiberoId;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedOppId(oppId)}
                        className={`relative w-10 h-10 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center text-white font-black shadow-md sm:shadow-[0_5px_10px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all border-2 border-white/50 ${
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
                <div className="flex justify-around items-center w-full mb-1 sm:mb-4 relative z-10 mt-auto">
                  {[1, 2, 3].map((idx) => {
                    const oppId = oppLineup[idx];
                    const hasNote =
                      oppNotesMem[oppId] && oppNotesMem[oppId].trim() !== "";
                    const isSetter = oppId === oppSetterId;
                    const isLibero = oppId === oppLiberoId;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedOppId(oppId)}
                        className={`relative w-10 h-10 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center text-white font-black shadow-md sm:shadow-[0_5px_10px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all border-2 border-white/50 ${
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

                <div className="flex justify-around items-center w-full mt-1 sm:mt-4 relative z-10 mb-auto">
                  {[3, 2, 1].map((idx) => {
                    const p = appData.roster.find((r) => r.id === lineup[idx]);
                    const isLibero = p?.id === liberoId;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedPlayerId(p?.id)}
                        className={`relative w-12 h-12 sm:w-20 sm:h-20 rounded-full flex flex-col items-center justify-center text-white shadow-lg sm:shadow-xl transition-all active:scale-95 border-2 sm:border-[3px] border-white/30 hover:scale-105 ${
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

                <div className="flex justify-around items-center w-full mb-1 sm:mb-4 relative z-10">
                  {[4, 5, 0].map((idx) => {
                    const p = appData.roster.find((r) => r.id === lineup[idx]);
                    const isServer = idx === 0 && serving === "ucc";
                    const isLibero = p?.id === liberoId;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedPlayerId(p?.id)}
                        className={`relative w-12 h-12 sm:w-20 sm:h-20 rounded-full flex flex-col items-center justify-center text-white shadow-lg sm:shadow-xl transition-all active:scale-95 border-2 sm:border-[3px] border-white/30 hover:scale-105 ${
                          isLibero
                            ? "bg-gradient-to-br from-slate-700 to-slate-900"
                            : "bg-gradient-to-br from-[#0044cc] to-[#001b5e]"
                        }`}
                      >
                        {isServer && (
                          <div className="absolute -bottom-1 -right-1 sm:-bottom-3 sm:-right-3 text-lg sm:text-3xl drop-shadow-md animate-bounce z-30">
                            🏐
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
                <div className="absolute inset-x-2 sm:inset-x-4 bottom-[20%] sm:bottom-1/3 flex justify-center pointer-events-none z-20">
                  <div className="bg-[#0033A0]/80 backdrop-blur-sm text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full border border-white/20 shadow-lg animate-pulse flex flex-col items-center">
                    <span className="font-black text-[10px] sm:text-sm tracking-widest uppercase">
                      Awaiting Receive
                    </span>
                    <span className="text-[8px] sm:text-[10px] font-medium opacity-80">
                      Tap UCC passer
                    </span>
                  </div>
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

              {rallyPhase === "serve" && !servePromptVisible && (
                <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none z-20">
                  <button
                    onClick={() => setServePromptVisible(true)}
                    className="pointer-events-auto bg-gradient-to-b from-green-500 to-green-600 text-white px-10 sm:px-16 py-4 sm:py-6 rounded-full shadow-[0_0_40px_rgba(34,197,94,0.4)] border-2 border-green-300 animate-pulse active:scale-95 transition-all outline-none"
                  >
                    <span className="font-black text-2xl sm:text-4xl tracking-widest uppercase block drop-shadow-md">
                      SERVE
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold tracking-widest opacity-80 block mt-1 uppercase text-center">
                      Tap when served
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STICKY BOTTOM BAR (Controls) */}
        <div className="bg-slate-900 border-t border-white/10 px-2 sm:px-4 py-2 sm:py-3 z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] shrink-0">
          <div className="max-w-5xl mx-auto flex gap-2 sm:gap-3 w-full justify-center">
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
            <button
              onClick={() => setEndRallyVisible(true)}
              className="flex-1 bg-gradient-to-b from-[#0044cc] to-[#001b5e] hover:from-[#0055ff] hover:to-[#002277] text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-sm sm:text-xl shadow-[0_5px_15px_rgba(0,51,160,0.4)] border-t border-blue-400/30 transition-all active:scale-95 tracking-widest uppercase"
            >
              End Rally
            </button>
            <button
              onClick={viewStatsWithCurrentMatch}
              className="px-3 sm:px-4 py-3 sm:py-4 bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950 rounded-xl sm:rounded-2xl font-black tracking-widest flex items-center justify-center hover:from-amber-300 hover:to-amber-500 shadow-md border-t border-amber-300 transition-all active:scale-95 text-xs sm:text-sm uppercase"
            >
              <Activity size={18} />
            </button>
            <button
              onClick={handleEndGameLive}
              className="px-3 sm:px-4 py-3 sm:py-4 bg-gradient-to-b from-red-600 to-red-800 text-white rounded-xl sm:rounded-2xl font-black tracking-widest flex items-center justify-center hover:from-red-500 hover:to-red-700 shadow-md border-t border-red-500 transition-all active:scale-95 text-xs sm:text-sm uppercase whitespace-nowrap"
            >
              End Game
            </button>
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* POPUPS (MODALS) */}
        {/* --------------------------------------------------------- */}

        {/* UCC PLAYER ACTION MODAL */}
        {selectedPlayerId && selectedPlayerObj && (
          <div className="absolute inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
            <div className="bg-white w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col scale-in-center border border-[#0033A0]/20 my-auto max-h-[95vh]">
              <div className="bg-gradient-to-r from-[#001b5e] to-[#0033A0] p-3 sm:p-4 flex justify-between items-center text-white">
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

              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 bg-slate-50">
                {rallyPhase === "receive" ? (
                  <div className="bg-blue-50 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-blue-200 relative">
                    <span className="absolute -top-2.5 right-4 bg-[#0033A0] text-white text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                      First Touch
                    </span>
                    <h4 className="text-[10px] sm:text-xs font-black text-[#0033A0] uppercase tracking-widest mb-2 flex items-center">
                      <Activity size={12} className="mr-1" /> Serve Receive
                    </h4>
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                      {[3, 2, 1, 0].map((val) => (
                        <button
                          key={val}
                          onClick={() =>
                            recordStatAndCheckPoint(
                              selectedPlayerId,
                              "Pass",
                              "Rating",
                              val
                            )
                          }
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
                          "Error"
                        )
                      }
                      className="bg-slate-200 text-slate-600 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm shadow-sm active:scale-95 border border-slate-300 uppercase"
                    >
                      Dig Error
                    </button>
                  </div>
                )}

                {!rallyPhase.includes("receive") && (
                  <>
                    <div className="bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                      <h4 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center">
                        <Crosshair size={12} className="mr-1 text-red-500" /> Attack
                      </h4>
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    <button
                      onClick={() =>
                        recordStatAndCheckPoint(
                          selectedPlayerId,
                          "Attack",
                          "Kill"
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
                          "Swing"
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
                          "Out"
                        )
                      }
                      className="col-span-2 bg-slate-100 text-slate-600 py-2 sm:py-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm border border-slate-200 active:scale-95 uppercase tracking-wider"
                    >
                      Out
                    </button>
                    <button
                      onClick={() =>
                        recordStatAndCheckPoint(
                          selectedPlayerId,
                          "Attack",
                          "Net"
                        )
                      }
                      className="col-span-2 bg-slate-100 text-slate-600 py-2 sm:py-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm border border-slate-200 active:scale-95 uppercase tracking-wider"
                    >
                      Net
                    </button>
                  </div>
                </div>

                <div className="bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                  <h4 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center">
                    <Shield size={12} className="mr-1 text-slate-500" /> Block
                  </h4>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                    <button
                      onClick={() =>
                        recordStatAndCheckPoint(
                          selectedPlayerId,
                          "Block",
                          "Block"
                        )
                      }
                      className="bg-gradient-to-b from-green-500 to-green-600 text-white py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm shadow-sm active:scale-95"
                    >
                      STUFF
                    </button>
                    <button
                      onClick={() =>
                        recordStatAndCheckPoint(
                          selectedPlayerId,
                          "Block",
                          "Attempt"
                        )
                      }
                      className="bg-gradient-to-b from-slate-600 to-slate-700 text-white py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm shadow-sm active:scale-95"
                    >
                      TOUCH
                    </button>
                    <button
                      onClick={() =>
                        recordStatAndCheckPoint(
                          selectedPlayerId,
                          "Block",
                          "Used"
                        )
                      }
                      className="bg-gradient-to-b from-slate-400 to-slate-500 text-white py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm shadow-sm active:scale-95"
                    >
                      USED
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    <button
                      onClick={() =>
                        recordStatAndCheckPoint(
                          selectedPlayerId,
                          "Block",
                          "Late"
                        )
                      }
                      className={lateBlockPlayerId === selectedPlayerId ? "bg-amber-400 text-amber-950 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs border border-amber-500 active:scale-95 uppercase tracking-wider transition-colors shadow-inner" : "bg-slate-100 text-slate-600 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs border border-slate-200 active:scale-95 uppercase tracking-wider transition-colors"}
                    >
                      Late
                    </button>
                    <button
                      onClick={() =>
                        recordStatAndCheckPoint(
                          selectedPlayerId,
                          "Block",
                          "Net Viol"
                        )
                      }
                      className="bg-slate-100 text-slate-600 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs border border-slate-200 active:scale-95 uppercase tracking-wider"
                    >
                      Net Viol
                    </button>
                  </div>
                </div>
                </>
              )}
              </div>

              {!rallyPhase.includes("receive") && (
              <div className="bg-slate-200 p-2 sm:p-3 flex gap-1.5 sm:gap-2">
                <button
                  onClick={() => setSubModalVisible(true)}
                  className="flex-1 bg-white text-slate-700 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm uppercase flex justify-center items-center shadow-sm active:scale-95 border border-slate-300"
                >
                  <Users size={14} className="mr-1 sm:mr-1.5" /> Sub
                </button>
                {liberoId &&
                  (lineup.indexOf(selectedPlayerId) === 0 ||
                    lineup.indexOf(selectedPlayerId) === 4 ||
                    lineup.indexOf(selectedPlayerId) === 5) && (
                    <button
                      onClick={handleLiberoSwap}
                      className="flex-1 bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm uppercase flex justify-center items-center shadow-sm active:scale-95 border border-amber-500/50"
                    >
                      <ArrowRightLeft size={14} className="mr-1 sm:mr-1.5" />{" "}
                      {selectedPlayerId === liberoId ? "L Out" : "L In"}
                    </button>
                  )}
              </div>
              )}
            </div>
          </div>
        )}

        {/* OPPONENT PLAYER ACTION MODAL */}
        {selectedOppId && (
          <div className="absolute inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
            <div className="bg-slate-100 w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col scale-in-center border border-slate-700/50 my-auto max-h-[95vh]">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-3 sm:p-4 flex justify-between items-center text-white">
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

              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
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
                              val
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
                            "Kill"
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
                            "Swing"
                          )
                        }
                        className="bg-gradient-to-b from-slate-600 to-slate-700 text-white py-3 sm:py-5 rounded-xl sm:rounded-2xl font-black text-lg sm:text-2xl shadow-sm active:scale-95 border-t border-white/20"
                      >
                        SWING
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                      <button
                        onClick={() =>
                          recordOppStatAndCheckPoint(
                            selectedOppId,
                            "Attack",
                            "Out"
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
                            "Net"
                          )
                        }
                        className="bg-slate-200 text-slate-700 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm shadow-sm active:scale-95 uppercase tracking-widest border border-slate-300"
                      >
                        Attack Net
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
                                val
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
                            ? "✓ Setter"
                            : "Mark Setter"}
                        </button>
                        {oppLiberoId &&
                          (oppLineup.indexOf(selectedOppId) === 0 ||
                            oppLineup.indexOf(selectedOppId) === 4 ||
                            oppLineup.indexOf(selectedOppId) === 5) && (
                            <button
                              onClick={handleOppLiberoToggle}
                              className="flex-1 bg-gradient-to-b from-amber-100 to-amber-200 text-amber-800 text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl border border-amber-300 uppercase shadow-sm"
                            >
                              {selectedOppId === oppLiberoId
                                ? "Swap L Out"
                                : "Swap L In"}
                            </button>
                          )}
                      </div>
                    </div>

                    <div className="flex gap-1.5 sm:gap-2 items-center bg-slate-200 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl">
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
            className={`absolute inset-0 z-40 flex flex-col items-center justify-center p-4 sm:p-6 text-white backdrop-blur-xl ${
              serving === "ucc" ? "bg-[#001b5e]/90" : "bg-slate-900/90"
            }`}
          >
            <div className="text-6xl sm:text-8xl mb-4 sm:mb-6 animate-bounce drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
              🏐
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-3 sm:mb-4 text-center tracking-widest text-shadow-lg uppercase">
              {serving === "ucc" ? "UCC TO SERVE" : `${opponentName} TO SERVE`}
            </h2>

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
          </div>
        )}

        {serveErrorPrompt && !setWinnerModal && (
          <div className="absolute inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-4 sm:p-6 text-white backdrop-blur-xl">
            <XCircle
              size={60}
              className="text-red-500 mb-4 sm:mb-6 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)] sm:w-20 sm:h-20"
            />
            <h2 className="text-2xl sm:text-4xl font-black mb-8 sm:mb-10 text-center tracking-widest uppercase">
              Select Error Type
            </h2>
            <div className="flex w-full max-w-sm gap-3 sm:gap-4">
              <button
                onClick={() => handleServeErrorChoice("Net")}
                className="flex-1 bg-slate-700 text-white py-6 sm:py-8 rounded-2xl sm:rounded-3xl font-black text-2xl sm:text-3xl shadow-xl active:scale-95 border-b-4 border-slate-800"
              >
                NET
              </button>
              <button
                onClick={() => handleServeErrorChoice("Out")}
                className="flex-1 bg-red-600 text-white py-6 sm:py-8 rounded-2xl sm:rounded-3xl font-black text-2xl sm:text-3xl shadow-xl active:scale-95 border-b-4 border-red-800"
              >
                OUT
              </button>
            </div>
          </div>
        )}

        {endRallyVisible && !setWinnerModal && (
          <div className="absolute inset-0 bg-slate-900/95 z-40 flex flex-col items-center justify-center p-4 sm:p-6 text-white backdrop-blur-xl">
            <div className="text-6xl sm:text-8xl mb-4 sm:mb-6 animate-pulse drop-shadow-[0_0_30px_rgba(251,191,36,0.4)]">
              🏆
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
          <div className="absolute inset-0 bg-slate-900/95 z-[60] flex flex-col items-center justify-center p-4 sm:p-6 text-white backdrop-blur-2xl">
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
                <p className="text-[10px] sm:text-xs font-black text-blue-300/70 uppercase tracking-widest mb-1">
                  Lancers
                </p>
                <p className="text-5xl sm:text-6xl font-black text-white">
                  {score.ucc}
                </p>
              </div>
              <div className="text-3xl sm:text-4xl text-white/20 font-black px-1 sm:px-2">
                -
              </div>
              <div className="text-center">
                <p className="text-[10px] sm:text-xs font-black text-slate-400/70 uppercase tracking-widest mb-1">
                  {opponentName.substring(0, 6)}
                </p>
                <p className="text-5xl sm:text-6xl font-black text-white">
                  {score.opp}
                </p>
              </div>
            </div>

            <button
              onClick={startNextSet}
              className="bg-gradient-to-b from-green-500 to-green-600 text-white w-full max-w-sm py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black text-xl sm:text-2xl shadow-[0_10px_20px_rgba(34,197,94,0.3)] active:scale-95 border-t border-white/20 uppercase tracking-widest"
            >
              Continue
            </button>
          </div>
        )}

        {/* UCC SUB MODAL */}
        {subModalVisible && selectedPlayerObj && (
          <div className="absolute inset-0 bg-slate-900/95 z-[110] flex flex-col p-4 sm:p-8 backdrop-blur-xl animate-in fade-in duration-200 justify-center">
            <div className="bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-full max-w-md w-full mx-auto">
              <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-slate-50">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-widest uppercase">
                    Substitute
                  </h2>
                  <p className="text-slate-400 font-bold mt-0.5 text-xs tracking-widest uppercase">
                    Going in for #{selectedPlayerObj.number}
                  </p>
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
                  benchPlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSub(p.id)}
                      className="w-full bg-white p-5 rounded-2xl flex items-center justify-between text-slate-800 shadow-sm border border-slate-200 active:scale-95 transition-all"
                    >
                      <div className="flex items-center space-x-4">
                        <span className="text-2xl font-black text-[#0033A0]">
                          #{p.number}
                        </span>
                        <span className="text-lg font-black">{p.name}</span>
                      </div>
                      <ArrowRightLeft className="text-slate-300" size={24} />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // STATS VIEW (Hierarchical Drill-Down)
  // -------------------------------------------------------------
  if (view === "stats") {
    return (
      <div className="min-h-screen bg-slate-100 p-2 sm:p-8 font-sans flex flex-col relative z-50">
        <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-slate-200 flex-1 flex flex-col overflow-hidden max-w-[1400px] mx-auto w-full">
          <div className="bg-gradient-to-r from-[#001b5e] via-[#0033A0] to-[#001b5e] p-4 sm:p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-md gap-4">
            <div className="flex items-center w-full sm:w-auto">
              <div className="bg-white p-1 sm:p-1.5 rounded-full shadow-inner mr-3 sm:mr-4 hidden sm:block">
                <img
                  src="/unamed.jpg"
                  alt="Logo"
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 sm:h-10 sm:w-10 object-contain rounded-full"
                />
              </div>
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl font-black tracking-widest uppercase drop-shadow-md">
                  Database Stats
                </h1>
              </div>
            </div>
            <div className="flex space-x-2 w-full sm:w-auto">
              <button
                onClick={exportCSV}
                className="flex-1 sm:flex-none bg-green-500 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black flex items-center justify-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider"
              >
                <Download className="mr-1 sm:mr-1.5" size={14} /> CSV
              </button>
              {activeMatch ? (
                <button
                  onClick={() => setView("game")}
                  className="flex-1 sm:flex-none bg-white text-[#0033A0] px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black justify-center flex items-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider"
                >
                  Game
                </button>
              ) : (
                <button
                  onClick={() => setView("menu")}
                  className="flex-1 sm:flex-none bg-white text-[#0033A0] px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black justify-center flex items-center shadow-sm text-[10px] sm:text-xs uppercase tracking-wider"
                >
                  Menu
                </button>
              )}
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
                    className={`flex-shrink-0 hover:text-white transition-colors ${
                      idx === statsPath.length - 1
                        ? "text-white bg-white/20 px-3 py-1 rounded-full"
                        : "text-slate-400"
                    }`}
                  >
                    {nav.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Drill-down Sub-navigation */}
          {subNavOptions.length > 0 && (
            <div className="bg-slate-100 p-3 sm:p-4 border-b border-slate-200 shadow-sm">
              <div className="flex overflow-x-auto gap-2 sm:gap-3 pb-2 scrollbar-hide">
                {subNavOptions.map((opt) => (
                  <div key={opt.id} className="flex-shrink-0 flex items-center bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm hover:border-[#0033A0] transition-colors group">
                    <button
                      onClick={() => navigateStats(opt.level, opt.id, opt.name)}
                      className="px-4 py-2 text-slate-700 font-bold text-xs sm:text-sm whitespace-nowrap hover:bg-[#0033A0] hover:text-white transition-colors"
                    >
                      {opt.name}
                    </button>
                    {teamInfo.role === 'coach' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (opt.level === "match") handleDeleteMatch(opt.id);
                          if (opt.level === "set") handleDeleteSet(opt.id);
                        }}
                        className="px-2 py-2 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-slate-200"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 sm:p-8 flex-1 overflow-y-auto bg-slate-50/50">
            <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-3 sm:mb-4 tracking-widest uppercase flex items-center">
              <Shield className="mr-2 text-[#0033A0]" size={18} /> Lancers{" "}
              <span className="text-slate-400 text-sm ml-2 hidden sm:inline">
                ({currentNav.name})
              </span>
            </h2>
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8 relative">
              {/* Scroll indicator for mobile */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden"></div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-500 text-[9px] sm:text-[10px] tracking-widest uppercase border-b-2 border-slate-200">
                      <th className="p-2 sm:p-3 font-black w-32 sm:w-40 sticky left-0 bg-slate-100 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        PLAYER
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-200">
                        PASSING
                        <br />
                        <span className="opacity-70 font-bold tracking-normal">
                          Avg(Tot)
                        </span>
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-200 bg-slate-50">
                        DIGS
                        <br />
                        <span className="opacity-70 font-bold tracking-normal">
                          (D-Err)
                        </span>
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-200">
                        SWINGS
                        <br />
                        <span className="opacity-70 font-bold tracking-normal">
                          (Att-K-Err)
                        </span>
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-200 text-green-600">
                        KILL %
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-200 bg-slate-50">
                        BLOCKS
                        <br />
                        <span className="opacity-70 font-bold tracking-normal">
                          (Att-Blk-Lt-Net-Us)
                        </span>
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-200">
                        SERVES
                        <br />
                        <span className="opacity-70 font-bold tracking-normal">
                          (Att-Ace-Err)
                        </span>
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-200 text-blue-600 bg-blue-50/50">
                        SRV +/-
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.values(uccStats).map((p) => {
                      const passAvg =
                        p.passCount > 0
                          ? (p.passSum / p.passCount).toFixed(2)
                          : "-";
                      const blkTot =
                        p.blkCount +
                        p.blkStuff +
                        p.blkLate +
                        p.blkNet +
                        p.blkUsed;
                      const srvTot = p.srvCount + p.srvAce + p.srvErr;
                      const killPct =
                        p.attCount > 0
                          ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%"
                          : "0.0%";
                      const srvPlusMinus = p.srvAce - p.srvErr;

                      return (
                        <tr
                          key={p.number}
                          onClick={() => {
                            setCareerPlayerName(p.name);
                            setCareerPlayerBirthYear(p.birthYear || null);
                          }}
                          className="hover:bg-blue-50/50 text-[10px] sm:text-xs cursor-pointer transition-colors"
                          title="Click to view full Career Stats across all teams"
                        >
                          <td className="p-2 sm:p-3 sticky left-0 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)] border-r-2 border-transparent group-hover:border-indigo-400">
                            <div className="flex items-center space-x-1 sm:space-x-2">
                              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#0033A0]/10 text-[#0033A0] font-black flex items-center justify-center text-[9px] sm:text-[10px]">
                                {p.number}
                              </span>
                              <span className="font-bold text-indigo-700 underline truncate max-w-[80px] sm:max-w-none">
                                {p.name}
                              </span>
                            </div>
                          </td>
                          <td className="p-2 sm:p-3 font-bold text-slate-700 text-center border-l border-slate-100">
                            {passAvg}{" "}
                            <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold ml-0.5 sm:ml-1">
                              ({p.passCount})
                            </span>
                          </td>
                          <td className="p-2 sm:p-3 border-l border-slate-100 text-center bg-slate-50/50">
                            <span className="text-blue-600 font-black text-sm">
                              {p.digCount}
                            </span>{" "}
                            <span className="text-slate-300 mx-0.5">-</span>{" "}
                            <span className="text-red-500 font-bold">
                              {p.digErr}
                            </span>
                          </td>
                          <td className="p-2 sm:p-3 border-l border-slate-100 text-center">
                            <span className="font-bold text-slate-600">
                              {p.attCount}
                            </span>{" "}
                            <span className="text-slate-300 mx-0.5">-</span>{" "}
                            <span className="text-green-600 font-black text-sm">
                              {p.attKill}
                            </span>{" "}
                            <span className="text-slate-300 mx-0.5">-</span>{" "}
                            <span className="text-red-500 font-bold">
                              {p.attErr}
                            </span>
                          </td>
                          <td className="p-2 sm:p-3 font-black text-center border-l border-slate-100 text-green-600 bg-green-50/30">
                            {killPct}
                          </td>
                          <td className="p-2 sm:p-3 border-l border-slate-100 bg-slate-50/50 text-center whitespace-nowrap">
                            {blkTot}-{p.blkStuff}-{p.blkLate}-{p.blkNet}-
                            {p.blkUsed}
                          </td>
                          <td className="p-2 sm:p-3 border-l border-slate-100 text-center">
                            <span className="font-bold text-slate-600">
                              {srvTot}
                            </span>{" "}
                            <span className="text-slate-300 mx-0.5">-</span>{" "}
                            <span className="text-emerald-600 font-black text-sm">
                              {p.srvAce}
                            </span>{" "}
                            <span className="text-slate-300 mx-0.5">-</span>{" "}
                            <span className="text-red-500 font-bold">
                              {p.srvErr}
                            </span>
                          </td>
                          <td className="p-2 sm:p-3 font-black text-center border-l border-slate-100 bg-blue-50/50 text-xs sm:text-sm">
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
                    })}
                  </tbody>
                </table>
              </div>
            </div>

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
                        PASS
                        <br />
                        <span className="opacity-70 font-bold tracking-normal">
                          Avg(Tot)
                        </span>
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
                        ACES
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-700 bg-slate-900">
                        SRV ERR
                      </th>
                      <th className="p-2 sm:p-3 font-black text-center border-l border-slate-700 text-blue-400 bg-slate-900">
                        +/-
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
                      Object.entries(opponentStats).map(([id, p]) => {
                        const passAvg =
                          p.passCount > 0
                            ? (p.passSum / p.passCount).toFixed(2)
                            : "-";
                        const killPct =
                          p.attCount > 0
                            ? ((p.attKill / p.attCount) * 100).toFixed(1) + "%"
                            : "0.0%";
                        const srvPlusMinus = p.srvAce - p.srvErr;
                        return (
                          <tr
                            key={id}
                            className="hover:bg-slate-50 text-[10px] sm:text-xs"
                          >
                            <td className="p-2 sm:p-3">
                              <span className="bg-slate-200 text-slate-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-black text-xs sm:text-sm">
                                {id}
                              </span>
                            </td>
                            <td className="p-2 sm:p-3 font-bold text-center border-l border-slate-100 bg-slate-50 text-slate-700">
                              {passAvg}{" "}
                              <span className="text-[9px] sm:text-[10px] text-slate-400 ml-0.5 sm:ml-1">
                                ({p.passCount})
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
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        {careerPlayerName && (
          <CareerStatsModal 
             playerName={careerPlayerName} 
             playerBirthYear={careerPlayerBirthYear}
             myTeams={myTeams} 
             onClose={() => {
                 setCareerPlayerName(null);
                 setCareerPlayerBirthYear(null);
             }} 
          />
        )}
      </div>
    );
  }

  return null;
}
