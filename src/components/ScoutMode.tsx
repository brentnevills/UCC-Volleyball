import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Eye,
  Search,
  Users,
  Plus,
  Trash2,
  Undo,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  X,
  Activity,
  Trophy,
  Calendar,
  Clock,
  Download,
  Share2,
  Edit3,
  Shield,
  FileText,
  Save,
  Check,
  ArrowRightLeft,
  Sparkles,
  Maximize,
  Minimize,
  Home,
  Layers,
} from "lucide-react";
import { doc, setDoc, writeBatch } from "firebase/firestore";

export interface ScoutPlayer {
  id: string;
  name: string;
  number: string;
  position?: string;
  notes?: string;
}

interface ScoutModeProps {
  appData: any;
  setAppData: React.Dispatch<React.SetStateAction<any>>;
  myTeams: any[];
  activeTeam: string | null;
  user: any;
  isFirebaseAvailable: boolean;
  publicPath: string;
  db: any;
  writeLocalDb: (data: any) => void;
  onBackToMenu: () => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  handleInstallApp: () => void;
}

// Quick Tendency Tags for Volleyball Scouting
const SCOUT_TENDENCY_TAGS = [
  "Hits Crosscourt",
  "Hits Line",
  "Sharp Angle",
  "Roll Shot",
  "Tips to Doughnut (3/4)",
  "Deep Corner Tip",
  "Float Serve",
  "Jump Topspin",
  "Targets Libero",
  "Targets Seam",
  "Strong Blocker",
  "Slow Transition",
  "Clutch Go-To",
  "High Error Rate",
];

const STANDARD_POSITIONS = [
  { code: "OH", label: "Outside Hitter" },
  { code: "MB", label: "Middle Blocker" },
  { code: "RS", label: "Right Side / Opp" },
  { code: "S", label: "Setter" },
  { code: "L", label: "Libero" },
  { code: "DS", label: "Defensive Specialist" },
];

export const ScoutMode: React.FC<ScoutModeProps> = ({
  appData,
  setAppData,
  myTeams,
  activeTeam,
  user,
  isFirebaseAvailable,
  publicPath,
  db,
  writeLocalDb,
  onBackToMenu,
  isFullscreen,
  toggleFullscreen,
  handleInstallApp,
}) => {
  // Mode state: 'setup' -> configure match & pick team/player | 'live' -> watch & scout
  const [scoutPhase, setScoutPhase] = useState<"setup" | "live">("setup");

  // Setup Fields
  const [scoutTeamName, setScoutTeamName] = useState("");
  const [facingTeamName, setFacingTeamName] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Autocomplete state for Scout Team
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const [teamHighlightIndex, setTeamHighlightIndex] = useState(-1);
  const teamInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Autocomplete state for Facing Team
  const [isFacingDropdownOpen, setIsFacingDropdownOpen] = useState(false);
  const facingInputRef = useRef<HTMLInputElement>(null);
  const facingDropdownRef = useRef<HTMLDivElement>(null);

  // Team Rosters & Players
  const [scoutRoster, setScoutRoster] = useState<ScoutPlayer[]>([]);
  const [newPlayerNum, setNewPlayerNum] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerPos, setNewPlayerPos] = useState("OH");
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);

  // Live Game State
  const [activeScoutMatch, setActiveScoutMatch] = useState<any>(null);
  const [activeScoutSetId, setActiveScoutSetId] = useState<string | null>(null);
  const [currentSetNum, setCurrentSetNum] = useState(1);
  const [scoreScoutTeam, setScoreScoutTeam] = useState(0);
  const [scoreFacingTeam, setScoreFacingTeam] = useState(0);
  const [serveErrorModalOpen, setServeErrorModalOpen] = useState(false);

  // Quick Tendency & Notes state
  const [customNote, setCustomNote] = useState("");
  const [playerNotesMap, setPlayerNotesMap] = useState<{ [playerId: string]: string[] }>({});

  // Summary / Box Score Modal
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // 1. Gather all team names from database for autocomplete
  const allAvailableTeams = useMemo(() => {
    const list: Array<{ name: string; source: string; playerCount: number }> = [];
    const seen = new Set<string>();

    // From Opponents
    Object.keys(appData.opponents || {}).forEach((key) => {
      const opp = appData.opponents[key];
      const name = (opp?.teamName || key).trim();
      if (name && name.toLowerCase() !== "practice" && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        const count =
          opp.roster?.length ||
          opp.defaultLineup?.filter((p: string) => p && p.trim()).length ||
          0;
        list.push({ name, source: "Saved Opponent", playerCount: count });
      }
    });

    // From myTeams
    (myTeams || []).forEach((t) => {
      const name = (t.name || "").trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({ name, source: "My Team", playerCount: appData.roster?.length || 0 });
      }
    });

    // From past matches
    (appData.matches || []).forEach((m: any) => {
      const opp = (m.opponent || "").trim();
      if (opp && opp.toLowerCase() !== "practice" && !seen.has(opp.toLowerCase())) {
        seen.add(opp.toLowerCase());
        list.push({ name: opp, source: "Past Match", playerCount: 0 });
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [appData.opponents, appData.matches, appData.roster, myTeams]);

  // Filtered teams for autocomplete dropdown as user types
  const filteredTeams = useMemo(() => {
    const query = scoutTeamName.trim().toLowerCase();
    if (!query) {
      // Show top 6 known teams when empty
      return allAvailableTeams.slice(0, 6);
    }
    return allAvailableTeams.filter((t) => t.name.toLowerCase().includes(query));
  }, [scoutTeamName, allAvailableTeams]);

  const filteredFacingTeams = useMemo(() => {
    const query = facingTeamName.trim().toLowerCase();
    if (!query) return allAvailableTeams.slice(0, 6);
    return allAvailableTeams.filter((t) => t.name.toLowerCase().includes(query));
  }, [facingTeamName, allAvailableTeams]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        teamInputRef.current &&
        !teamInputRef.current.contains(e.target as Node)
      ) {
        setIsTeamDropdownOpen(false);
      }
      if (
        facingDropdownRef.current &&
        !facingDropdownRef.current.contains(e.target as Node) &&
        facingInputRef.current &&
        !facingInputRef.current.contains(e.target as Node)
      ) {
        setIsFacingDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When a team is selected or typed, load their known roster
  const loadRosterForTeam = (teamName: string) => {
    const trimmed = teamName.trim();
    if (!trimmed) {
      setScoutRoster([]);
      setSelectedPlayerId(null);
      return;
    }

    // Check if it's one of myTeams
    const isMyTeam = myTeams.some((t) => t.name?.toLowerCase() === trimmed.toLowerCase());
    if (isMyTeam && appData.roster && appData.roster.length > 0) {
      const loaded: ScoutPlayer[] = appData.roster
        .filter((p: any) => !p.isRetired)
        .map((p: any) => ({
          id: p.id || `my_${p.number}`,
          number: p.number || "-",
          name: p.name || `Player ${p.number}`,
          position: p.position || "OH",
        }));
      setScoutRoster(loaded);
      if (loaded.length > 0) setSelectedPlayerId(loaded[0].id);
      return;
    }

    // Check in appData.opponents
    const existingKey = Object.keys(appData.opponents || {}).find(
      (k) =>
        k.toLowerCase() === trimmed.toLowerCase() ||
        appData.opponents[k]?.teamName?.toLowerCase() === trimmed.toLowerCase(),
    );

    if (existingKey) {
      const opp = appData.opponents[existingKey];
      if (opp.roster && opp.roster.length > 0) {
        setScoutRoster(opp.roster);
        setSelectedPlayerId(opp.roster[0].id);
        return;
      }
      // If defaultLineup exists
      if (opp.defaultLineup && opp.defaultLineup.length > 0) {
        const loaded: ScoutPlayer[] = opp.defaultLineup
          .filter((item: string) => item && item.trim())
          .map((item: string, idx: number) => {
            const numMatch = item.match(/\d+/);
            const num = numMatch ? numMatch[0] : `${idx + 1}`;
            const name = item.replace(/^[#\d\s-]+/, "").trim() || `Player #${num}`;
            return {
              id: `p_${idx + 1}_${num}`,
              number: num,
              name: name,
              position: opp.setterId === item ? "S" : opp.liberoId === item ? "L" : "OH",
            };
          });

        if (loaded.length > 0) {
          setScoutRoster(loaded);
          setSelectedPlayerId(loaded[0].id);
          return;
        }
      }
    }

    // Default starter roster template if new team
    const defaultNewRoster: ScoutPlayer[] = [
      { id: "sp_1", number: "1", name: "Outside Hitter 1", position: "OH" },
      { id: "sp_2", number: "4", name: "Middle Blocker 1", position: "MB" },
      { id: "sp_3", number: "7", name: "Setter", position: "S" },
      { id: "sp_4", number: "10", name: "Right Side", position: "RS" },
      { id: "sp_5", number: "12", name: "Middle Blocker 2", position: "MB" },
      { id: "sp_6", number: "15", name: "Outside Hitter 2", position: "OH" },
      { id: "sp_7", number: "18", name: "Libero", position: "L" },
    ];
    setScoutRoster(defaultNewRoster);
    setSelectedPlayerId(defaultNewRoster[0].id);
  };

  // Handle Team Selection from Autocomplete
  const handleSelectTeam = (teamName: string) => {
    setScoutTeamName(teamName);
    setIsTeamDropdownOpen(false);
    setTeamHighlightIndex(-1);
    loadRosterForTeam(teamName);
  };

  const handleSelectFacingTeam = (teamName: string) => {
    setFacingTeamName(teamName);
    setIsFacingDropdownOpen(false);
  };

  // Add a new player to the scouted team
  const handleAddPlayer = () => {
    const num = newPlayerNum.trim();
    if (!num) {
      alert("Please provide a jersey number.");
      return;
    }
    const name = newPlayerName.trim() || `Player #${num}`;
    const newId = `scout_${Date.now()}_${num}`;
    const newP: ScoutPlayer = {
      id: newId,
      number: num,
      name: name,
      position: newPlayerPos,
    };

    const updated = [...scoutRoster, newP].sort(
      (a, b) => parseInt(a.number || "0") - parseInt(b.number || "0"),
    );
    setScoutRoster(updated);
    setSelectedPlayerId(newId);
    setNewPlayerNum("");
    setNewPlayerName("");
    setIsAddPlayerOpen(false);
    showNotification(`Added #${num} ${name} to roster`);

    // Sync to opponent record in background
    syncRosterToOpponent(scoutTeamName, updated);
  };

  const handleRemovePlayer = (playerId: string) => {
    const updated = scoutRoster.filter((p) => p.id !== playerId);
    setScoutRoster(updated);
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(updated.length > 0 ? updated[0].id : null);
    }
    syncRosterToOpponent(scoutTeamName, updated);
  };

  const syncRosterToOpponent = async (teamName: string, roster: ScoutPlayer[]) => {
    if (!teamName || !activeTeam) return;
    const safeName = teamName.trim().replace(/\//g, "-");
    const existing = appData.opponents?.[safeName] || {};
    const updatedOpp = {
      ...existing,
      teamName: teamName.trim(),
      roster,
    };

    setAppData((prev: any) => ({
      ...prev,
      opponents: {
        ...prev.opponents,
        [safeName]: updatedOpp,
      },
    }));

    if (isFirebaseAvailable && user) {
      try {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/opponents/${safeName}`),
          updatedOpp,
          { merge: true },
        );
      } catch (err) {
        console.error("Failed to sync scout roster to opponent doc:", err);
      }
    } else {
      writeLocalDb({
        ...appData,
        opponents: {
          ...appData.opponents,
          [safeName]: updatedOpp,
        },
      });
    }
  };

  // Start Live Scouting Session
  const handleStartScouting = async () => {
    if (!scoutTeamName.trim()) {
      alert("Please specify or choose a team to scout.");
      teamInputRef.current?.focus();
      return;
    }
    if (scoutRoster.length === 0) {
      alert("Please add at least one player to scout.");
      setIsAddPlayerOpen(true);
      return;
    }

    const matchId = `scout_${Date.now()}`;
    const setId = `scout_set_${Date.now()}_1`;
    const finalFacing = facingTeamName.trim() || "Opponent";
    const finalTitle =
      eventTitle.trim() || `Scout: ${scoutTeamName} vs ${finalFacing}`;

    const newMatch = {
      id: matchId,
      teamId: activeTeam || "default",
      date: new Date().toISOString(),
      type: "Scout",
      title: finalTitle,
      opponent: scoutTeamName.trim(),
      facingTeam: finalFacing,
      format: "Scout Game",
      isLive: true,
      scoutTargetTeam: scoutTeamName.trim(),
    };

    const newSet = {
      id: setId,
      teamId: activeTeam || "default",
      matchId: matchId,
      setNum: 1,
      scoreUcc: 0,
      scoreOpp: 0,
    };

    setActiveScoutMatch(newMatch);
    setActiveScoutSetId(setId);
    setCurrentSetNum(1);
    setScoreScoutTeam(0);
    setScoreFacingTeam(0);
    if (!selectedPlayerId && scoutRoster.length > 0) {
      setSelectedPlayerId(scoutRoster[0].id);
    }

    setAppData((prev: any) => ({
      ...prev,
      matches: [newMatch, ...prev.matches],
      sets: [...prev.sets, newSet],
    }));

    if (isFirebaseAvailable && user && activeTeam) {
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, `${publicPath}/${activeTeam}/matches/${matchId}`), newMatch);
        batch.set(doc(db, `${publicPath}/${activeTeam}/sets/${setId}`), newSet);
        await batch.commit();
      } catch (e) {
        console.error("Failed to write scout match to Firebase:", e);
      }
    } else {
      writeLocalDb({
        ...appData,
        matches: [newMatch, ...appData.matches],
        sets: [...appData.sets, newSet],
      });
    }

    setScoutPhase("live");
    showNotification(`Live Scout session started for ${scoutTeamName}!`);
  };

  // Log a stat for the currently selected scouted player
  const logScoutStat = async (
    category: string,
    metric: string,
    value = 1,
    isPointFor = false,
    isPointAgainst = false,
  ) => {
    if (!selectedPlayerId || !activeScoutMatch || !activeScoutSetId) {
      alert("Please select a player to log stats for.");
      return;
    }

    const statId = `scout_stat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newStat = {
      id: statId,
      teamId: activeTeam || "default",
      matchId: activeScoutMatch.id,
      setId: activeScoutSetId,
      playerId: selectedPlayerId,
      category,
      metric,
      value,
      isOpponent: true, // Marked as scouted/opponent player
      timestamp: new Date().toISOString(),
    };

    // Auto update live score if a direct point or error
    if (isPointFor) {
      setScoreScoutTeam((prev) => prev + 1);
    } else if (isPointAgainst) {
      setScoreFacingTeam((prev) => prev + 1);
    }

    setAppData((prev: any) => ({
      ...prev,
      stats: [...prev.stats, newStat],
    }));

    if (isFirebaseAvailable && user && activeTeam) {
      try {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/stats/${statId}`),
          newStat,
        );
      } catch (err) {
        console.error("Failed to save scout stat to cloud:", err);
      }
    } else {
      writeLocalDb({
        ...appData,
        stats: [...appData.stats, newStat],
      });
    }

    const activeP = scoutRoster.find((p) => p.id === selectedPlayerId);
    showNotification(
      `Logged ${category} (${metric}) for #${activeP?.number || ""} ${activeP?.name || ""}`,
    );
  };

  // Undo Last Stat
  const handleUndoLast = async () => {
    if (!activeScoutMatch) return;
    const matchStats = appData.stats.filter(
      (s: any) => s.matchId === activeScoutMatch.id,
    );
    if (matchStats.length === 0) {
      showNotification("No actions to undo.");
      return;
    }
    const lastStat = matchStats[matchStats.length - 1];

    setAppData((prev: any) => ({
      ...prev,
      stats: prev.stats.filter((s: any) => s.id !== lastStat.id),
    }));

    if (isFirebaseAvailable && user && activeTeam) {
      try {
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(
          doc(db, `${publicPath}/${activeTeam}/stats/${lastStat.id}`),
        );
      } catch (err) {
        console.error("Failed to delete stat:", err);
      }
    } else {
      writeLocalDb({
        ...appData,
        stats: appData.stats.filter((s: any) => s.id !== lastStat.id),
      });
    }

    showNotification(`Undid last action (${lastStat.category}: ${lastStat.metric})`);
  };

  // Add a tendency tag or note for the active player
  const handleAddTendencyTag = (tag: string) => {
    if (!selectedPlayerId) return;
    const current = playerNotesMap[selectedPlayerId] || [];
    if (current.includes(tag)) {
      setPlayerNotesMap({
        ...playerNotesMap,
        [selectedPlayerId]: current.filter((t) => t !== tag),
      });
      return;
    }
    const updated = [...current, tag];
    setPlayerNotesMap({
      ...playerNotesMap,
      [selectedPlayerId]: updated,
    });
    showNotification(`Added tag "${tag}"`);
  };

  const handleAddCustomNote = () => {
    if (!selectedPlayerId || !customNote.trim()) return;
    const current = playerNotesMap[selectedPlayerId] || [];
    const updated = [...current, customNote.trim()];
    setPlayerNotesMap({
      ...playerNotesMap,
      [selectedPlayerId]: updated,
    });
    setCustomNote("");
    showNotification("Saved observation note.");
  };

  // Next Set handling
  const handleNextSet = async () => {
    if (!activeScoutMatch) return;
    const nextSetNum = currentSetNum + 1;
    const newSetId = `scout_set_${Date.now()}_${nextSetNum}`;
    const newSet = {
      id: newSetId,
      teamId: activeTeam || "default",
      matchId: activeScoutMatch.id,
      setNum: nextSetNum,
      scoreUcc: 0,
      scoreOpp: 0,
    };

    setActiveScoutSetId(newSetId);
    setCurrentSetNum(nextSetNum);
    setScoreScoutTeam(0);
    setScoreFacingTeam(0);

    setAppData((prev: any) => ({
      ...prev,
      sets: [...prev.sets, newSet],
    }));

    if (isFirebaseAvailable && user && activeTeam) {
      try {
        await setDoc(
          doc(db, `${publicPath}/${activeTeam}/sets/${newSetId}`),
          newSet,
        );
      } catch (e) {
        console.error(e);
      }
    }
    showNotification(`Started Set ${nextSetNum}`);
  };

  // Active Player Details
  const activePlayer = useMemo(() => {
    return scoutRoster.find((p) => p.id === selectedPlayerId) || null;
  }, [scoutRoster, selectedPlayerId]);

  // Player Stats for Current Match
  const currentMatchStats = useMemo(() => {
    if (!activeScoutMatch) return [];
    return appData.stats.filter((s: any) => s.matchId === activeScoutMatch.id);
  }, [appData.stats, activeScoutMatch]);

  const activePlayerStats = useMemo(() => {
    if (!selectedPlayerId) return { kills: 0, swings: 0, errors: 0, aces: 0, srvErr: 0, passes: 0, passSum: 0, digs: 0, touches: 0, blocks: 0 };
    const pStats = currentMatchStats.filter((s: any) => s.playerId === selectedPlayerId);

    let kills = 0;
    let swings = 0;
    let errors = 0;
    let aces = 0;
    let srvErr = 0;
    let passes = 0;
    let passSum = 0;
    let digs = 0;
    let touches = 0;
    let blocks = 0;

    pStats.forEach((s: any) => {
      if (s.category === "Attack") {
        swings++;
        if (s.metric === "Kill") kills++;
        else if (s.metric === "Error" || s.metric === "Blocked") errors++;
      } else if (s.category === "Serve") {
        if (s.metric === "Ace") aces++;
        else if (s.metric?.includes("Miss") || s.metric === "Error") srvErr++;
      } else if (s.category === "Pass") {
        passes++;
        passSum += Number(s.metric) || 0;
      } else if (s.category === "Defense") {
        if (s.metric === "Dig") digs++;
        else if (s.metric === "Touch") touches++;
      } else if (s.category === "Block") {
        if (s.metric === "Stuff") blocks++;
      }
    });

    return { kills, swings, errors, aces, srvErr, passes, passSum, digs, touches, blocks };
  }, [currentMatchStats, selectedPlayerId]);

  // Overall player summary table for all scouted players
  const playerSummaries = useMemo(() => {
    return scoutRoster.map((p) => {
      const pStats = currentMatchStats.filter((s: any) => s.playerId === p.id);
      let kills = 0;
      let swings = 0;
      let errors = 0;
      let aces = 0;
      let srvErr = 0;
      let passes = 0;
      let passSum = 0;
      let digs = 0;
      let blocks = 0;

      pStats.forEach((s: any) => {
        if (s.category === "Attack") {
          swings++;
          if (s.metric === "Kill") kills++;
          else if (s.metric === "Error" || s.metric === "Blocked") errors++;
        } else if (s.category === "Serve") {
          if (s.metric === "Ace") aces++;
          else if (s.metric?.includes("Miss") || s.metric === "Error") srvErr++;
        } else if (s.category === "Pass") {
          passes++;
          passSum += Number(s.metric) || 0;
        } else if (s.category === "Defense" && s.metric === "Dig") {
          digs++;
        } else if (s.category === "Block" && s.metric === "Stuff") {
          blocks++;
        }
      });

      const killPct = swings > 0 ? ((kills / swings) * 100).toFixed(0) : "-";
      const hitEff = swings > 0 ? (((kills - errors) / swings)).toFixed(3) : "-";
      const passAvg = passes > 0 ? (passSum / passes).toFixed(2) : "-";
      const points = kills + aces + blocks;

      return {
        ...p,
        totalStats: pStats.length,
        swings,
        kills,
        errors,
        killPct,
        hitEff,
        aces,
        srvErr,
        passes,
        passAvg,
        digs,
        blocks,
        points,
        notes: playerNotesMap[p.id] || [],
      };
    });
  }, [scoutRoster, currentMatchStats, playerNotesMap]);

  // Export Scout Report CSV
  const handleExportCSV = () => {
    let csv = `SCOUT REPORT: ${scoutTeamName.toUpperCase()} vs ${(facingTeamName || "OPPONENT").toUpperCase()}\n`;
    csv += `Date: ${new Date().toLocaleDateString()} | Event: ${eventTitle || "Game Scout"}\n\n`;
    csv += `Number,Name,Pos,Points,Kills,Att Errors,Swings,Kill %,Hit Eff,Aces,Serve Err,Pass Avg,Passes,Digs,Blocks,Tendencies & Notes\n`;

    playerSummaries.forEach((p) => {
      const notesClean = (p.notes || []).join("; ").replace(/,/g, " ");
      csv += `${p.number},"${p.name}",${p.position || "-"},${p.points},${p.kills},${p.errors},${p.swings},${p.killPct},${p.hitEff},${p.aces},${p.srvErr},${p.passAvg},${p.passes},${p.digs},${p.blocks},"${notesClean}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Scout_${scoutTeamName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification("Scout report CSV downloaded!");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between select-none">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-black px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs sm:text-sm animate-bounce">
          <CheckCircle2 size={18} />
          <span>{notification}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* PHASE 1: SCOUT SETUP & TEAM / PLAYER PICKER               */}
      {/* ========================================================= */}
      {scoutPhase === "setup" && (
        <div className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 max-w-4xl mx-auto w-full">
          {/* Header */}
          <div className="w-full flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 text-emerald-400 p-3 rounded-2xl border border-emerald-500/30">
                <Eye size={28} />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-black tracking-wider uppercase text-white flex items-center gap-2">
                  Scout Mode
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                    LIVE GAME WATCH
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  Watch courtside, pick a team & player, and track real-time scouting tendencies.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleFullscreen}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl transition-all"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
              <button
                onClick={onBackToMenu}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all"
              >
                <Home size={16} />
                <span>Menu</span>
              </button>
            </div>
          </div>

          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Team & Match Information */}
            <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                  <Shield size={16} className="text-emerald-400" />
                  1. Team to Scout (With Autocomplete)
                </h2>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                  Required
                </span>
              </div>

              {/* Team Name Input with Live Dropdown Autocomplete */}
              <div className="relative">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Team Name (Type to search dropdown)
                </label>
                <div className="relative flex items-center">
                  <Search
                    size={18}
                    className="absolute left-3.5 text-slate-400 pointer-events-none"
                  />
                  <input
                    ref={teamInputRef}
                    type="text"
                    value={scoutTeamName}
                    onChange={(e) => {
                      setScoutTeamName(e.target.value);
                      setIsTeamDropdownOpen(true);
                      setTeamHighlightIndex(-1);
                    }}
                    onFocus={() => setIsTeamDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (!isTeamDropdownOpen) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setTeamHighlightIndex((prev) =>
                          prev < filteredTeams.length - 1 ? prev + 1 : 0,
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setTeamHighlightIndex((prev) =>
                          prev > 0 ? prev - 1 : filteredTeams.length - 1,
                        );
                      } else if (e.key === "Enter" && teamHighlightIndex >= 0) {
                        e.preventDefault();
                        handleSelectTeam(filteredTeams[teamHighlightIndex].name);
                      } else if (e.key === "Escape") {
                        setIsTeamDropdownOpen(false);
                      }
                    }}
                    placeholder="e.g. Chatham-Kent, Ursuline, St. Pat's..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white font-bold text-sm sm:text-base pl-10 pr-10 py-3 rounded-2xl outline-none transition-all"
                  />
                  {scoutTeamName && (
                    <button
                      type="button"
                      onClick={() => {
                        setScoutTeamName("");
                        setScoutRoster([]);
                        setIsTeamDropdownOpen(true);
                        teamInputRef.current?.focus();
                      }}
                      className="absolute right-3 text-slate-400 hover:text-white p-1"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown Menu */}
                {isTeamDropdownOpen && (
                  <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto backdrop-blur-xl"
                  >
                    <div className="p-2 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                      <span>Matching Teams ({filteredTeams.length})</span>
                      <span className="text-emerald-400">Click or press Enter to pick</span>
                    </div>

                    {filteredTeams.length > 0 ? (
                      filteredTeams.map((team, idx) => (
                        <div
                          key={team.name}
                          onClick={() => handleSelectTeam(team.name)}
                          onMouseEnter={() => setTeamHighlightIndex(idx)}
                          className={`p-3 flex items-center justify-between cursor-pointer border-b border-slate-800/40 transition-colors ${
                            idx === teamHighlightIndex
                              ? "bg-emerald-600/30 text-white"
                              : "hover:bg-slate-800 text-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-black text-xs">
                              {team.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-white">
                                {team.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {team.source}
                              </div>
                            </div>
                          </div>
                          {team.playerCount > 0 && (
                            <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                              {team.playerCount} players
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center">
                        <p className="text-xs text-slate-400 mb-2">
                          No existing team matches "{scoutTeamName}".
                        </p>
                        <button
                          type="button"
                          onClick={() => handleSelectTeam(scoutTeamName.trim())}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all"
                        >
                          ➕ Scout "{scoutTeamName}" as New Team
                        </button>
                      </div>
                    )}

                    {scoutTeamName.trim() &&
                      !filteredTeams.some(
                        (t) =>
                          t.name.toLowerCase() ===
                          scoutTeamName.trim().toLowerCase(),
                      ) && (
                        <div
                          onClick={() => handleSelectTeam(scoutTeamName.trim())}
                          className="p-3 bg-emerald-950/40 hover:bg-emerald-900/50 cursor-pointer text-emerald-300 font-bold text-xs flex items-center gap-2 border-t border-emerald-800/40"
                        >
                          <Plus size={14} />
                          <span>Use "{scoutTeamName}" as Custom Team</span>
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Facing Opponent (Optional with Autocomplete) */}
              <div className="relative">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Facing Opponent (Optional match context)
                </label>
                <div className="relative flex items-center">
                  <ArrowRightLeft
                    size={16}
                    className="absolute left-3.5 text-slate-500 pointer-events-none"
                  />
                  <input
                    ref={facingInputRef}
                    type="text"
                    value={facingTeamName}
                    onChange={(e) => {
                      setFacingTeamName(e.target.value);
                      setIsFacingDropdownOpen(true);
                    }}
                    onFocus={() => setIsFacingDropdownOpen(true)}
                    placeholder="e.g. McGregor, Lambton Central, Neutral..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-white text-sm pl-10 pr-4 py-2.5 rounded-2xl outline-none"
                  />
                </div>

                {isFacingDropdownOpen && (
                  <div
                    ref={facingDropdownRef}
                    className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-40 overflow-hidden max-h-48 overflow-y-auto"
                  >
                    {filteredFacingTeams.map((team) => (
                      <div
                        key={team.name}
                        onClick={() => handleSelectFacingTeam(team.name)}
                        className="p-2.5 hover:bg-slate-800 cursor-pointer text-xs font-semibold text-slate-200 flex justify-between border-b border-slate-800"
                      >
                        <span>{team.name}</span>
                        <span className="text-[10px] text-slate-400">{team.source}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Match/Event Title */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Event / Location / Stage
                </label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. SWOSSAA Semis - Court 2, Pool A..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-white text-sm px-3.5 py-2.5 rounded-2xl outline-none"
                />
              </div>

              {/* Action Button to Start Live Scouting */}
              <button
                onClick={handleStartScouting}
                disabled={!scoutTeamName.trim()}
                className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black py-4 px-6 rounded-2xl shadow-xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 text-base tracking-wider uppercase"
              >
                <Eye size={20} />
                <span>Start Live Scouting</span>
              </button>
            </div>

            {/* Right Column: Pick a Player from this Team */}
            <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                      <Users size={16} className="text-emerald-400" />
                      2. Pick a Player to Scout
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {scoutTeamName
                        ? `Players on ${scoutTeamName} (${scoutRoster.length})`
                        : "Type or select a team first"}
                    </p>
                  </div>

                  <button
                    onClick={() => setIsAddPlayerOpen(!isAddPlayerOpen)}
                    className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
                  >
                    <Plus size={14} />
                    <span>Add Player</span>
                  </button>
                </div>

                {/* Inline Add Player Form */}
                {isAddPlayerOpen && (
                  <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30 mb-4 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                      <span>Add Player to {scoutTeamName || "Team"}</span>
                      <button
                        onClick={() => setIsAddPlayerOpen(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <input
                        type="text"
                        placeholder="Jersey #"
                        value={newPlayerNum}
                        onChange={(e) => setNewPlayerNum(e.target.value)}
                        className="col-span-3 bg-slate-900 border border-slate-700 text-white font-bold text-center text-sm p-2 rounded-xl outline-none focus:border-emerald-500"
                      />
                      <input
                        type="text"
                        placeholder="Name (or position tag)"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        className="col-span-6 bg-slate-900 border border-slate-700 text-white text-sm p-2 rounded-xl outline-none focus:border-emerald-500"
                      />
                      <select
                        value={newPlayerPos}
                        onChange={(e) => setNewPlayerPos(e.target.value)}
                        className="col-span-3 bg-slate-900 border border-slate-700 text-white text-xs p-2 rounded-xl outline-none font-bold"
                      >
                        {STANDARD_POSITIONS.map((pos) => (
                          <option key={pos.code} value={pos.code}>
                            {pos.code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleAddPlayer}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 rounded-xl transition-all"
                    >
                      Save Player to Roster
                    </button>
                  </div>
                )}

                {/* Player Grid / List */}
                <div className="max-h-72 sm:max-h-80 overflow-y-auto space-y-2 pr-1">
                  {scoutRoster.length > 0 ? (
                    scoutRoster.map((player) => {
                      const isSelected = selectedPlayerId === player.id;
                      return (
                        <div
                          key={player.id}
                          onClick={() => setSelectedPlayerId(player.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? "bg-emerald-950/60 border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                              : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl font-black text-sm flex items-center justify-center ${
                                isSelected
                                  ? "bg-emerald-500 text-slate-950 shadow"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              #{player.number}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-white flex items-center gap-2">
                                {player.name}
                                {isSelected && (
                                  <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                    Scout Target
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span className="text-emerald-400 font-semibold">
                                  {player.position || "OH"}
                                </span>
                                {playerNotesMap[player.id]?.length > 0 && (
                                  <span>
                                    • {playerNotesMap[player.id].length} notes
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <CheckCircle2 size={20} className="text-emerald-400" />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovePlayer(player.id);
                              }}
                              className="text-slate-500 hover:text-red-400 p-1 rounded-lg"
                              title="Remove Player"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 p-6">
                      <Users size={32} className="mx-auto text-slate-600 mb-2" />
                      <p className="text-xs text-slate-400">
                        No players loaded yet. Type or pick a team above, or click "+ Add Player".
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Scouted Player Active Preview Footer */}
              {activePlayer && (
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Active Scout Target:</span>
                  <span className="font-bold text-emerald-300">
                    #{activePlayer.number} {activePlayer.name} ({activePlayer.position || "OH"})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PHASE 2: LIVE GAME WATCH & COURTSIDE SCOUTING INTERFACE  */}
      {/* ========================================================= */}
      {scoutPhase === "live" && (
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Top Live Header */}
          <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-lg z-20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 hidden sm:inline">
                  Scout Mode Live
                </span>
              </div>

              {/* Game Matchup & Score Tracker */}
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
                <span className="text-xs font-black text-white">
                  {scoutTeamName}
                </span>
                <div className="flex items-center gap-1 font-mono font-black text-sm text-emerald-400">
                  <span>{scoreScoutTeam}</span>
                  <span className="text-slate-600">-</span>
                  <span>{scoreFacingTeam}</span>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {facingTeamName || "Opponent"}
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-bold ml-1">
                  Set {currentSetNum}
                </span>
              </div>
            </div>

            {/* Quick Score Adjustment & Controls */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <span className="text-[10px] text-slate-400 px-1">Score:</span>
                <button
                  onClick={() => setScoreScoutTeam((prev) => prev + 1)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-0.5 rounded"
                  title="Add Scout Team Point"
                >
                  +{scoutTeamName.slice(0, 3)}
                </button>
                <button
                  onClick={() => setScoreFacingTeam((prev) => prev + 1)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-2 py-0.5 rounded"
                  title="Add Opponent Point"
                >
                  +Opp
                </button>
              </div>

              <button
                onClick={handleUndoLast}
                className="bg-slate-800 hover:bg-slate-700 text-amber-400 p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold"
                title="Undo Last Action"
              >
                <Undo size={16} />
                <span className="hidden md:inline">Undo</span>
              </button>

              <button
                onClick={() => setIsSummaryModalOpen(true)}
                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5"
              >
                <FileText size={16} />
                <span>Box Score</span>
              </button>

              <button
                onClick={() => setScoutPhase("setup")}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl font-bold text-xs"
              >
                Edit Setup
              </button>

              <button
                onClick={onBackToMenu}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl"
                title="Exit to Menu"
              >
                <Home size={16} />
              </button>
            </div>
          </div>

          {/* Player Switcher Bar: "Pick a player from a certain team" */}
          <div className="bg-slate-900/60 border-b border-slate-800 px-3 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
              Pick Player:
            </span>
            <div className="flex items-center gap-2">
              {scoutRoster.map((player) => {
                const isSelected = selectedPlayerId === player.id;
                return (
                  <button
                    key={player.id}
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all ${
                      isSelected
                        ? "bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-400/40 font-black scale-105"
                        : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span>#{player.number}</span>
                    <span>{player.name}</span>
                    <span className="text-[10px] opacity-75">
                      ({player.position || "OH"})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Scout Action Console */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            {/* Left: Active Scouted Player Card & Live Metrics */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {activePlayer ? (
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800/60">
                      CURRENTLY SCOUTING
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {scoutTeamName}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg">
                      #{activePlayer.number}
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-white">
                        {activePlayer.name}
                      </h3>
                      <p className="text-xs font-bold text-emerald-400">
                        {activePlayer.position
                          ? `${activePlayer.position} - ${STANDARD_POSITIONS.find((p) => p.code === activePlayer.position)?.label || ""}`
                          : "Outside Hitter"}
                      </p>
                    </div>
                  </div>

                  {/* Real-time Player Metric Summary */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-center">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        Kills / Swings
                      </div>
                      <div className="text-base font-black text-emerald-400">
                        {activePlayerStats.kills} / {activePlayerStats.swings}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        Kill %
                      </div>
                      <div className="text-base font-black text-white">
                        {activePlayerStats.swings > 0
                          ? `${((activePlayerStats.kills / activePlayerStats.swings) * 100).toFixed(0)}%`
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        Pass Avg
                      </div>
                      <div className="text-base font-black text-amber-300">
                        {activePlayerStats.passes > 0
                          ? (
                              activePlayerStats.passSum /
                              activePlayerStats.passes
                            ).toFixed(2)
                          : "-"}
                      </div>
                    </div>
                  </div>

                  {/* Secondary Metrics */}
                  <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs font-semibold text-slate-300">
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">
                        Aces / Srv Err
                      </span>
                      {activePlayerStats.aces} / {activePlayerStats.srvErr}
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">
                        Digs / Touches
                      </span>
                      {activePlayerStats.digs} / {activePlayerStats.touches}
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">
                        Stuff Blocks
                      </span>
                      {activePlayerStats.blocks}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-center">
                  <p className="text-sm text-slate-400">No player picked yet.</p>
                </div>
              )}

              {/* Tendency Tagging & Observation Notes */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-emerald-400" />
                    Player Tendencies & Notes
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    Tap to tag
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {SCOUT_TENDENCY_TAGS.map((tag) => {
                    const isTagged =
                      selectedPlayerId &&
                      playerNotesMap[selectedPlayerId]?.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => handleAddTendencyTag(tag)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          isTagged
                            ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm"
                            : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>

                {/* Freeform Note Input */}
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCustomNote();
                    }}
                    placeholder="Custom observation (e.g. tips when out of system)..."
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-xs text-white p-2.5 rounded-xl outline-none"
                  />
                  <button
                    onClick={handleAddCustomNote}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-2.5 rounded-xl transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Right: One-Touch Courtside Action Pad */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              {/* Category 1: ATTACK / SWINGS */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                    <Activity size={16} className="text-emerald-400" />
                    ATTACK ACTIONS (Spikes & Swings)
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    For #{activePlayer?.number || "?"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    onClick={() => logScoutStat("Attack", "Kill", 1, true, false)}
                    className="bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-slate-950 font-black p-4 rounded-2xl flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all"
                  >
                    <span className="text-lg sm:text-xl">KILL</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-950">
                      Point Won (+1)
                    </span>
                  </button>

                  <button
                    onClick={() => logScoutStat("Attack", "In Play", 1, false, false)}
                    className="bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-black p-4 rounded-2xl flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all"
                  >
                    <span className="text-lg sm:text-xl">IN PLAY</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                      Rally Continues
                    </span>
                  </button>

                  <button
                    onClick={() => logScoutStat("Attack", "Blocked", 1, false, true)}
                    className="bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-white font-black p-4 rounded-2xl flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all"
                  >
                    <span className="text-lg sm:text-xl">BLOCKED</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">
                      Hit Stuffed
                    </span>
                  </button>

                  <button
                    onClick={() => logScoutStat("Attack", "Error", 1, false, true)}
                    className="bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black p-4 rounded-2xl flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all"
                  >
                    <span className="text-lg sm:text-xl">ERROR</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-200">
                      Out / Net
                    </span>
                  </button>
                </div>
              </div>

              {/* Category 2: SERVE & SERVE RECEIVE (PASSING) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Serve Actions */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">
                    SERVE
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => logScoutStat("Serve", "Ace", 1, true, false)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black p-3.5 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-base">ACE</div>
                      <div className="text-[9px] text-emerald-200 uppercase font-bold">
                        Point (+1)
                      </div>
                    </button>
                    <button
                      onClick={() => logScoutStat("Serve", "In Play", 1, false, false)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-black p-3.5 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-base">IN PLAY</div>
                      <div className="text-[9px] text-blue-200 uppercase font-bold">
                        Good Serve
                      </div>
                    </button>
                    <button
                      onClick={() => setServeErrorModalOpen(true)}
                      className="bg-red-600 hover:bg-red-500 text-white font-black p-3.5 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-base">ERROR</div>
                      <div className="text-[9px] text-red-200 uppercase font-bold">
                        Miss
                      </div>
                    </button>
                  </div>
                </div>

                {/* Serve Receive Rating (0-3 scale) */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-300">
                      SERVE RECEIVE (PASS)
                    </h4>
                    <span className="text-[10px] text-slate-400">0 - 3 Rating</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => logScoutStat("Pass", "3", 3)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black p-3 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-lg">3</div>
                      <div className="text-[9px] text-emerald-200 uppercase">Perfect</div>
                    </button>
                    <button
                      onClick={() => logScoutStat("Pass", "2", 2)}
                      className="bg-teal-600 hover:bg-teal-500 text-white font-black p-3 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-lg">2</div>
                      <div className="text-[9px] text-teal-200 uppercase">Good</div>
                    </button>
                    <button
                      onClick={() => logScoutStat("Pass", "1", 1)}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-black p-3 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-lg">1</div>
                      <div className="text-[9px] text-amber-200 uppercase">Poor</div>
                    </button>
                    <button
                      onClick={() => logScoutStat("Pass", "0", 0, false, true)}
                      className="bg-red-600 hover:bg-red-500 text-white font-black p-3 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-lg">0</div>
                      <div className="text-[9px] text-red-200 uppercase">Ace / Err</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Category 3: DEFENSE (DIGS) & BLOCKING */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Defense / Digs */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">
                    DEFENSE (DIGS)
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => logScoutStat("Defense", "Dig", 1)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-black p-3 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-sm sm:text-base">DIG</div>
                      <div className="text-[9px] text-blue-200 uppercase font-bold">
                        Up & Controlled
                      </div>
                    </button>
                    <button
                      onClick={() => logScoutStat("Defense", "Touch", 1)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-black p-3 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-sm sm:text-base">TOUCH</div>
                      <div className="text-[9px] text-indigo-200 uppercase font-bold">
                        Contacted
                      </div>
                    </button>
                    <button
                      onClick={() => logScoutStat("Defense", "Error", 1, false, true)}
                      className="bg-red-600 hover:bg-red-500 text-white font-black p-3 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-sm sm:text-base">ERROR</div>
                      <div className="text-[9px] text-red-200 uppercase font-bold">
                        Dropped
                      </div>
                    </button>
                  </div>
                </div>

                {/* Blocking */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">
                    BLOCKING
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => logScoutStat("Block", "Stuff", 1, true, false)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black p-3 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-sm sm:text-base">STUFF</div>
                      <div className="text-[9px] text-emerald-200 uppercase font-bold">
                        Point (+1)
                      </div>
                    </button>
                    <button
                      onClick={() => logScoutStat("Block", "Touch", 1)}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-black p-3 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-sm sm:text-base">TOUCH</div>
                      <div className="text-[9px] text-purple-200 uppercase font-bold">
                        Slowdown
                      </div>
                    </button>
                    <button
                      onClick={() => logScoutStat("Block", "Error", 1, false, true)}
                      className="bg-red-600 hover:bg-red-500 text-white font-black p-3 rounded-xl text-center active:scale-95 transition-all"
                    >
                      <div className="text-sm sm:text-base">ERROR</div>
                      <div className="text-[9px] text-red-200 uppercase font-bold">
                        Net / Tool
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Bar: Set Management & Next Set */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center justify-between">
                <div className="text-xs font-bold text-slate-400">
                  Total Logged Actions in Set {currentSetNum}:{" "}
                  <span className="text-white font-black">
                    {currentMatchStats.filter(
                      (s: any) => s.setId === activeScoutSetId,
                    ).length}
                  </span>
                </div>
                <button
                  onClick={handleNextSet}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition-all"
                >
                  Finish Set {currentSetNum} & Start Set {currentSetNum + 1}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SERVE ERROR DETAILS MODAL                                */}
      {/* ========================================================= */}
      {serveErrorModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <h3 className="text-lg font-black uppercase tracking-wider text-white">
              Select Serve Error Type
            </h3>
            <p className="text-xs text-slate-400">
              Identify error tendency for #{activePlayer?.number || ""}{" "}
              {activePlayer?.name || ""}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  logScoutStat("Serve", "Miss - Net", 1, false, true);
                  setServeErrorModalOpen(false);
                }}
                className="bg-red-950/70 hover:bg-red-900 border border-red-700 text-white font-bold p-3 rounded-xl text-sm"
              >
                Net
              </button>
              <button
                onClick={() => {
                  logScoutStat("Serve", "Miss - Long", 1, false, true);
                  setServeErrorModalOpen(false);
                }}
                className="bg-red-950/70 hover:bg-red-900 border border-red-700 text-white font-bold p-3 rounded-xl text-sm"
              >
                Long (Deep)
              </button>
              <button
                onClick={() => {
                  logScoutStat("Serve", "Miss - Wide", 1, false, true);
                  setServeErrorModalOpen(false);
                }}
                className="bg-red-950/70 hover:bg-red-900 border border-red-700 text-white font-bold p-3 rounded-xl text-sm"
              >
                Wide (Out)
              </button>
              <button
                onClick={() => {
                  logScoutStat("Serve", "Miss - Foot Fault", 1, false, true);
                  setServeErrorModalOpen(false);
                }}
                className="bg-red-950/70 hover:bg-red-900 border border-red-700 text-white font-bold p-3 rounded-xl text-sm"
              >
                Foot Fault
              </button>
            </div>
            <button
              onClick={() => setServeErrorModalOpen(false)}
              className="w-full text-xs text-slate-400 hover:text-white pt-2 font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* BOX SCORE & SCOUT REPORT MODAL                           */}
      {/* ========================================================= */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <FileText className="text-emerald-400" size={20} />
                  Scout Report: {scoutTeamName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live box score and player tendencies for this game watch.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow"
                >
                  <Download size={14} />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="text-slate-400 hover:text-white p-2 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content / Table */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Pos</th>
                      <th className="py-2.5 px-3 text-center">PTS</th>
                      <th className="py-2.5 px-3 text-center">Kills</th>
                      <th className="py-2.5 px-3 text-center">Swings</th>
                      <th className="py-2.5 px-3 text-center">Kill %</th>
                      <th className="py-2.5 px-3 text-center">Aces</th>
                      <th className="py-2.5 px-3 text-center">Pass Avg</th>
                      <th className="py-2.5 px-3 text-center">Digs</th>
                      <th className="py-2.5 px-3 text-center">Blocks</th>
                      <th className="py-2.5 px-3">Tendencies</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {playerSummaries.map((p) => (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-800/40 ${
                          p.id === selectedPlayerId ? "bg-emerald-950/20" : ""
                        }`}
                      >
                        <td className="py-3 px-3 font-black text-emerald-400">
                          #{p.number}
                        </td>
                        <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                          {p.name}
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-semibold">
                          {p.position || "-"}
                        </td>
                        <td className="py-3 px-3 text-center font-black text-emerald-300">
                          {p.points}
                        </td>
                        <td className="py-3 px-3 text-center text-white">
                          {p.kills}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-400">
                          {p.swings}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-white">
                          {p.killPct}%
                        </td>
                        <td className="py-3 px-3 text-center text-emerald-400">
                          {p.aces}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-amber-300">
                          {p.passAvg}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-300">
                          {p.digs}
                        </td>
                        <td className="py-3 px-3 text-center text-purple-300">
                          {p.blocks}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-300 max-w-xs">
                          {p.notes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {p.notes.map((n, idx) => (
                                <span
                                  key={idx}
                                  className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]"
                                >
                                  {n}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Score:{" "}
                <strong className="text-white">
                  {scoutTeamName} {scoreScoutTeam} - {scoreFacingTeam}{" "}
                  {facingTeamName || "Opp"}
                </strong>{" "}
                (Set {currentSetNum})
              </div>
              <button
                onClick={() => setIsSummaryModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all"
              >
                Back to Live Scout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
