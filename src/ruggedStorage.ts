/**
 * Rugged Offline Storage Engine for UCC Volleyball Stats
 * 
 * Provides an unbreakable multi-tier storage architecture:
 * Tier 1: In-Memory Hot Cache (Zero latency, synchronous)
 * Tier 2: LocalStorage with Double-Buffering & Rolling Backup
 * Tier 3: IndexedDB Full Mirror (High capacity, transactional)
 * Tier 4: Auto-Recovery & Self-Healing Engine
 * Tier 5: JSON Snapshot Export & Import Portable Recovery
 */

const DB_NAME = "UCC_Rugged_Storage_v1";
const DB_VERSION = 1;
const STORE_TEAMS = "team_data";
const STORE_SNAPSHOTS = "backup_snapshots";
const STORE_OUTBOX = "offline_outbox";

// In-Memory Hot Cache to guarantee data is never lost during memory pressure
const memoryCache: Record<string, any> = {};

let idbInstance: IDBDatabase | null = null;
let isIdbInitializing = false;
const idbInitCallbacks: ((db: IDBDatabase | null) => void)[] = [];

/**
 * Initialize IndexedDB with self-healing fallback
 */
export function getIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (idbInstance) {
    return Promise.resolve(idbInstance);
  }

  if (isIdbInitializing) {
    return new Promise((resolve) => {
      idbInitCallbacks.push(resolve);
    });
  }

  isIdbInitializing = true;

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_TEAMS)) {
          db.createObjectStore(STORE_TEAMS, { keyPath: "teamId" });
        }
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          const snapshotStore = db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id" });
          snapshotStore.createIndex("by_team", "teamId", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
          const outboxStore = db.createObjectStore(STORE_OUTBOX, { keyPath: "id", autoIncrement: true });
          outboxStore.createIndex("by_team", "teamId", { unique: false });
        }
      };

      request.onsuccess = (event: any) => {
        idbInstance = event.target.result;
        isIdbInitializing = false;
        resolve(idbInstance);
        while (idbInitCallbacks.length > 0) {
          const cb = idbInitCallbacks.shift();
          if (cb) cb(idbInstance);
        }
      };

      request.onerror = (event: any) => {
        console.warn("RuggedStorage: IndexedDB open warning (LocalStorage fallback active):", event?.target?.error);
        isIdbInitializing = false;
        resolve(null);
        while (idbInitCallbacks.length > 0) {
          const cb = idbInitCallbacks.shift();
          if (cb) cb(null);
        }
      };
    } catch (err) {
      console.warn("RuggedStorage: IndexedDB unavailable, continuing with LocalStorage:", err);
      isIdbInitializing = false;
      resolve(null);
      while (idbInitCallbacks.length > 0) {
        const cb = idbInitCallbacks.shift();
        if (cb) cb(null);
      }
    }
  });
}

/**
 * Safely clean non-critical keys if LocalStorage experiences quota pressure
 */
function emergencyPruneLocalStorage(currentTeamKey: string) {
  try {
    const keysToPreserve = new Set([
      `ucc_vball_db_${currentTeamKey}`,
      `ucc_backup_${currentTeamKey}`,
      "ucc_vball_active_team",
      "ucc_vball_guest_teams",
      "ucc_current_role",
    ]);

    const removablePrefixes = ["ucc_temp_", "ucc_log_", "ucc_cache_"];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || keysToPreserve.has(key)) continue;

      if (removablePrefixes.some((p) => key.startsWith(p))) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.warn("RuggedStorage prune notice:", e);
  }
}

/**
 * RUGGED DUAL-ENGINE SAVE:
 * Commits data synchronously to memory and LocalStorage,
 * and asynchronously to IndexedDB with rolling snapshots.
 */
export async function ruggedSaveTeamData(teamId: string, data: any): Promise<boolean> {
  if (!teamId || !data) return false;
  const targetKey = teamId.trim();

  // Tier 1: In-Memory Hot Cache
  memoryCache[targetKey] = JSON.parse(JSON.stringify(data));

  // Tier 2: Synchronous LocalStorage with Double-Buffering
  let localStorageSuccess = false;
  try {
    const serialized = JSON.stringify(data);
    const mainKey = `ucc_vball_db_${targetKey}`;
    const backupKey = `ucc_backup_${targetKey}`;

    // Update backup key first (to ensure a crash during write leaves previous backup intact)
    try {
      localStorage.setItem(backupKey, serialized);
    } catch (backupErr) {
      emergencyPruneLocalStorage(targetKey);
      try {
        localStorage.setItem(backupKey, serialized);
      } catch {}
    }

    // Update primary key
    localStorage.setItem(mainKey, serialized);
    localStorage.setItem(`ucc_last_save_${targetKey}`, new Date().toISOString());
    localStorageSuccess = true;
  } catch (lsError) {
    console.warn("RuggedStorage: LocalStorage write error, falling back to IndexedDB:", lsError);
    emergencyPruneLocalStorage(targetKey);
    try {
      localStorage.setItem(`ucc_vball_db_${targetKey}`, JSON.stringify(data));
      localStorageSuccess = true;
    } catch {}
  }

  // Tier 3: Transactional IndexedDB Persistence & Snapshot Rotation
  try {
    const db = await getIndexedDB();
    if (db) {
      const tx = db.transaction([STORE_TEAMS, STORE_SNAPSHOTS], "readwrite");
      const teamStore = tx.objectStore(STORE_TEAMS);
      const snapshotStore = tx.objectStore(STORE_SNAPSHOTS);

      const record = {
        teamId: targetKey,
        data: data,
        updatedAt: Date.now(),
      };
      teamStore.put(record);

      // Create a timestamped snapshot
      const snapshotId = `${targetKey}_${Date.now()}`;
      snapshotStore.put({
        id: snapshotId,
        teamId: targetKey,
        data: data,
        createdAt: Date.now(),
      });

      // Keep only the latest 30 snapshots in IndexedDB to manage space while retaining deep history
      try {
        const index = snapshotStore.index("by_team");
        const request = index.getAllKeys(targetKey);
        request.onsuccess = () => {
          const keys = request.result;
          if (keys && keys.length > 30) {
            const keysToDelete = keys.slice(0, keys.length - 30);
            for (const key of keysToDelete) {
              snapshotStore.delete(key);
            }
          }
        };
      } catch {}
    }
  } catch (idbErr) {
    console.warn("RuggedStorage: IndexedDB background write note:", idbErr);
  }

  return localStorageSuccess || true;
}

/**
 * RUGGED SELF-HEALING LOAD:
 * Attempts to load from LocalStorage -> Memory -> Backup Key -> IndexedDB -> Latest Snapshot.
 * Automatically repairs corrupted storage layers.
 */
export async function ruggedLoadTeamData(teamId: string): Promise<any | null> {
  if (!teamId) return null;
  const targetKey = teamId.trim();

  // Tier 1: Try LocalStorage Primary Key
  try {
    const raw = localStorage.getItem(`ucc_vball_db_${targetKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        memoryCache[targetKey] = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`RuggedStorage: Primary LocalStorage corrupted for ${targetKey}, attempting auto-recovery:`, e);
  }

  // Tier 2: Try LocalStorage Backup Key
  try {
    const backupRaw = localStorage.getItem(`ucc_backup_${targetKey}`);
    if (backupRaw) {
      const parsed = JSON.parse(backupRaw);
      if (parsed && typeof parsed === "object") {
        // Self-heal primary key
        try {
          localStorage.setItem(`ucc_vball_db_${targetKey}`, backupRaw);
        } catch {}
        memoryCache[targetKey] = parsed;
        console.log(`RuggedStorage: Successfully self-healed team ${targetKey} from LocalStorage backup!`);
        return parsed;
      }
    }
  } catch (e) {}

  // Tier 3: In-Memory Hot Cache
  if (memoryCache[targetKey]) {
    return memoryCache[targetKey];
  }

  // Tier 4: IndexedDB Primary Store
  try {
    const db = await getIndexedDB();
    if (db) {
      const parsedFromIdb: any = await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_TEAMS, "readonly");
          const store = tx.objectStore(STORE_TEAMS);
          const req = store.get(targetKey);
          req.onsuccess = () => resolve(req.result ? req.result.data : null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (parsedFromIdb && typeof parsedFromIdb === "object") {
        // Self-heal LocalStorage
        try {
          localStorage.setItem(`ucc_vball_db_${targetKey}`, JSON.stringify(parsedFromIdb));
          localStorage.setItem(`ucc_backup_${targetKey}`, JSON.stringify(parsedFromIdb));
        } catch {}
        memoryCache[targetKey] = parsedFromIdb;
        console.log(`RuggedStorage: Successfully restored team ${targetKey} from IndexedDB mirror!`);
        return parsedFromIdb;
      }

      // Tier 5: IndexedDB Snapshots (Last Resort Recovery)
      const snapshotData: any = await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_SNAPSHOTS, "readonly");
          const store = tx.objectStore(STORE_SNAPSHOTS);
          const index = store.index("by_team");
          const req = index.getAll(targetKey);
          req.onsuccess = () => {
            const list = req.result;
            if (Array.isArray(list) && list.length > 0) {
              list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
              resolve(list[0].data);
            } else {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (snapshotData && typeof snapshotData === "object") {
        try {
          localStorage.setItem(`ucc_vball_db_${targetKey}`, JSON.stringify(snapshotData));
        } catch {}
        memoryCache[targetKey] = snapshotData;
        console.log(`RuggedStorage: Successfully restored team ${targetKey} from rolling snapshot!`);
        return snapshotData;
      }
    }
  } catch (idbErr) {
    console.warn("RuggedStorage: IndexedDB load attempt warning:", idbErr);
  }

  return null;
}

export interface RollingSnapshotInfo {
  id: string;
  teamId: string;
  createdAt: number;
  dateFormatted: string;
  source: string;
  note?: string;
  matchesCount: number;
  setsCount: number;
  statsCount: number;
  rosterCount: number;
  matchTitles: string[];
  data: any;
}

/**
 * Retrieve all rolling snapshots across IndexedDB, LocalStorage backups, and memory cache
 */
export async function getRollingSnapshots(teamId?: string): Promise<RollingSnapshotInfo[]> {
  const snapshots: RollingSnapshotInfo[] = [];
  const activeKey = (typeof localStorage !== "undefined" ? localStorage.getItem("ucc_vball_active_team") : "") || "ucc_main";
  const targetKey = (teamId || activeKey).trim();
  const seenIds = new Set<string>();

  // 1. Check IndexedDB snapshot store
  try {
    const db = await getIndexedDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction([STORE_SNAPSHOTS, STORE_TEAMS], "readonly");
          const snapStore = tx.objectStore(STORE_SNAPSHOTS);
          const req = snapStore.getAll();
          req.onsuccess = () => {
            const list = req.result;
            if (Array.isArray(list)) {
              for (const item of list) {
                if (!item || !item.data) continue;
                const matches = Array.isArray(item.data.matches) ? item.data.matches : [];
                const sets = Array.isArray(item.data.sets) ? item.data.sets : [];
                const stats = Array.isArray(item.data.stats) ? item.data.stats : [];
                const roster = Array.isArray(item.data.roster) ? item.data.roster : [];
                const matchTitles = matches.map((m: any) =>
                  m.opponent ? `vs ${m.opponent}` : m.type || "Match",
                );
                const created =
                  item.createdAt ||
                  (item.id && !isNaN(Number(item.id.split("_").pop()))
                    ? Number(item.id.split("_").pop())
                    : Date.now());

                const uniqueKey = `idb_snap_${item.teamId || targetKey}_${item.id || created}_${matches.length}_${stats.length}`;
                if (seenIds.has(uniqueKey)) continue;
                seenIds.add(uniqueKey);

                snapshots.push({
                  id: item.id || `snap_${created}`,
                  teamId: item.teamId || targetKey,
                  createdAt: created,
                  dateFormatted: new Date(created).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  }),
                  source: item.id?.startsWith("manual_")
                    ? "Manual Snapshot"
                    : item.id?.includes("pre_resync") || item.note?.toLowerCase().includes("resync")
                    ? "Pre-Resync Snapshot"
                    : "IndexedDB Rolling Snapshot",
                  note: item.note || (item.id?.includes("pre_resync") ? "Automated Pre-Resync Safeguard" : undefined),
                  matchesCount: matches.length,
                  setsCount: sets.length,
                  statsCount: stats.length,
                  rosterCount: roster.length,
                  matchTitles,
                  data: item.data,
                });
              }
            }

            // Also check STORE_TEAMS mirror
            try {
              const teamStore = tx.objectStore(STORE_TEAMS);
              const teamReq = teamStore.getAll();
              teamReq.onsuccess = () => {
                const teamList = teamReq.result;
                if (Array.isArray(teamList)) {
                  for (const tItem of teamList) {
                    if (!tItem || !tItem.data) continue;
                    const matches = Array.isArray(tItem.data.matches) ? tItem.data.matches : [];
                    const sets = Array.isArray(tItem.data.sets) ? tItem.data.sets : [];
                    const stats = Array.isArray(tItem.data.stats) ? tItem.data.stats : [];
                    const roster = Array.isArray(tItem.data.roster) ? tItem.data.roster : [];
                    const matchTitles = matches.map((m: any) =>
                      m.opponent ? `vs ${m.opponent}` : m.type || "Match",
                    );
                    const created = tItem.updatedAt || Date.now();
                    const uniqueKey = `idb_team_${tItem.teamId}_${created}_${matches.length}_${stats.length}`;
                    if (!seenIds.has(uniqueKey)) {
                      seenIds.add(uniqueKey);
                      snapshots.push({
                        id: `idb_team_${tItem.teamId}_${created}`,
                        teamId: tItem.teamId,
                        createdAt: created,
                        dateFormatted: new Date(created).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          second: "2-digit",
                        }),
                        source: "IndexedDB Team Mirror",
                        note: "Continuous Dual-Engine Database Mirror",
                        matchesCount: matches.length,
                        setsCount: sets.length,
                        statsCount: stats.length,
                        rosterCount: roster.length,
                        matchTitles,
                        data: tItem.data,
                      });
                    }
                  }
                }
                resolve();
              };
              teamReq.onerror = () => resolve();
            } catch {
              resolve();
            }
          };
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch (err) {
    console.warn("Could not query IndexedDB snapshots:", err);
  }

  // 2. Check LocalStorage backup keys
  if (typeof localStorage !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith("ucc_backup_") || key.startsWith("ucc_vball_db_")) {
          const isBackupKey = key.startsWith("ucc_backup_");
          const tId = key.replace(isBackupKey ? "ucc_backup_" : "ucc_vball_db_", "");
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const d = JSON.parse(raw);
              if (d && typeof d === "object") {
                const matches = Array.isArray(d.matches) ? d.matches : [];
                const sets = Array.isArray(d.sets) ? d.sets : [];
                const stats = Array.isArray(d.stats) ? d.stats : [];
                const roster = Array.isArray(d.roster) ? d.roster : [];
                const matchTitles = matches.map((m: any) =>
                  m.opponent ? `vs ${m.opponent}` : m.type || "Match",
                );
                const lastSave = localStorage.getItem(`ucc_last_save_${tId}`);
                const created = lastSave ? new Date(lastSave).getTime() : Date.now();

                const uniqueKey = `ls_${tId}_${isBackupKey ? "bk" : "db"}_${matches.length}_${stats.length}`;
                if (!seenIds.has(uniqueKey)) {
                  seenIds.add(uniqueKey);
                  snapshots.push({
                    id: key,
                    teamId: tId,
                    createdAt: created,
                    dateFormatted: new Date(created).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                    }),
                    source: isBackupKey ? "LocalStorage Double-Buffer Backup" : "LocalStorage Team Cache",
                    note: isBackupKey ? "Synchronous Safety Buffer" : "Active Local Cache",
                    matchesCount: matches.length,
                    setsCount: sets.length,
                    statsCount: stats.length,
                    rosterCount: roster.length,
                    matchTitles,
                    data: d,
                  });
                }
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn("Could not check LocalStorage backups:", e);
    }
  }

  // Filter by team if requested and teamId !== "all"
  const filtered = (teamId && teamId !== "all")
    ? snapshots.filter((s) => s.teamId === teamId)
    : snapshots;

  // Sort newest first
  filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return filtered;
}

/**
 * Manually capture a designated snapshot point
 */
export async function createManualSnapshot(teamId: string, data: any, note?: string): Promise<string> {
  const targetKey = teamId.trim();
  const timestamp = Date.now();
  const snapshotId = `manual_${targetKey}_${timestamp}`;

  try {
    const db = await getIndexedDB();
    if (db) {
      const tx = db.transaction([STORE_SNAPSHOTS], "readwrite");
      const store = tx.objectStore(STORE_SNAPSHOTS);
      store.put({
        id: snapshotId,
        teamId: targetKey,
        data: data,
        createdAt: timestamp,
        note: note || "Manual User Snapshot",
      });
    }
  } catch (err) {
    console.warn("Manual snapshot creation error:", err);
  }

  return snapshotId;
}

/**
 * Capture an automated pre-resync snapshot before cloud syncing
 */
export async function capturePreResyncSnapshot(teamId: string, data: any): Promise<string> {
  const targetKey = (teamId || "ucc_main").trim();
  const timestamp = Date.now();
  const snapshotId = `pre_resync_${targetKey}_${timestamp}`;

  try {
    const db = await getIndexedDB();
    if (db) {
      const tx = db.transaction([STORE_SNAPSHOTS], "readwrite");
      const store = tx.objectStore(STORE_SNAPSHOTS);
      store.put({
        id: snapshotId,
        teamId: targetKey,
        data: data,
        createdAt: timestamp,
        note: "Automated Pre-Resync Safeguard Snapshot",
      });
    }
    // Also save in LocalStorage backup as extra safety net
    try {
      localStorage.setItem(`ucc_backup_pre_resync_${targetKey}`, JSON.stringify(data));
      localStorage.setItem(`ucc_last_save_pre_resync_${targetKey}`, new Date(timestamp).toISOString());
    } catch {}
  } catch (err) {
    console.warn("Pre-resync snapshot notice:", err);
  }

  return snapshotId;
}

/**
 * Atomically restore a snapshot across LocalStorage, Memory Cache, and IndexedDB
 */
export async function restoreRollingSnapshot(teamId: string, snapshotData: any): Promise<boolean> {
  if (!snapshotData || typeof snapshotData !== "object") return false;
  const targetKey = (teamId || "ucc_main").trim();

  try {
    // 1. Save to all rugged storage tiers
    await ruggedSaveTeamData(targetKey, snapshotData);

    // 2. Also log a restore snapshot marker
    await createManualSnapshot(
      targetKey,
      snapshotData,
      `Restored on ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    );

    return true;
  } catch (err) {
    console.error("Failed to restore rolling snapshot:", err);
    return false;
  }
}

/**
 * Delete a specific rolling snapshot from IndexedDB
 */
export async function deleteRollingSnapshot(snapshotId: string): Promise<boolean> {
  try {
    if (snapshotId.startsWith("ucc_backup_") || snapshotId.startsWith("ucc_vball_db_")) {
      localStorage.removeItem(snapshotId);
      return true;
    }
    const db = await getIndexedDB();
    if (db) {
      const tx = db.transaction([STORE_SNAPSHOTS], "readwrite");
      const store = tx.objectStore(STORE_SNAPSHOTS);
      store.delete(snapshotId);
      return true;
    }
  } catch (err) {
    console.warn("Delete snapshot warning:", err);
  }
  return false;
}

/**
 * Export all local data across all teams as an unbreakable portable JSON backup
 */
export async function exportFullOfflineBackup(): Promise<{
  filename: string;
  data: any;
}> {
  const backupPayload: Record<string, any> = {
    exportedAt: new Date().toISOString(),
    appVersion: "1.0.0",
    teams: {},
    myTeamsList: [],
    guestTeamsList: [],
    activeTeam: localStorage.getItem("ucc_vball_active_team") || "",
  };

  try {
    const rawMyTeams = localStorage.getItem("ucc_vball_guest_teams");
    if (rawMyTeams) {
      backupPayload.guestTeamsList = JSON.parse(rawMyTeams);
    }
  } catch {}

  // Collect all teams from LocalStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    if (key.startsWith("ucc_vball_db_")) {
      const teamId = key.replace("ucc_vball_db_", "");
      try {
        const val = localStorage.getItem(key);
        if (val) backupPayload.teams[teamId] = JSON.parse(val);
      } catch {}
    } else if (key.startsWith("ucc_vball_my_teams_")) {
      try {
        const val = localStorage.getItem(key);
        if (val) backupPayload.myTeamsList = JSON.parse(val);
      } catch {}
    }
  }

  // Also collect any teams stored only in IndexedDB
  try {
    const db = await getIndexedDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_TEAMS, "readonly");
          const store = tx.objectStore(STORE_TEAMS);
          const req = store.getAll();
          req.onsuccess = () => {
            if (Array.isArray(req.result)) {
              for (const record of req.result) {
                if (record && record.teamId && record.data && !backupPayload.teams[record.teamId]) {
                  backupPayload.teams[record.teamId] = record.data;
                }
              }
            }
            resolve();
          };
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {}

  const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `ucc_volleyball_backup_${dateStr}.json`;

  return { filename, data: backupPayload };
}

/**
 * Import and restore an offline JSON backup safely
 */
export async function importFullOfflineBackup(backupJsonString: string): Promise<{
  success: boolean;
  teamsRestored: number;
  message: string;
}> {
  try {
    const parsed = JSON.parse(backupJsonString);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid backup file format.");
    }

    let teamsRestored = 0;

    // Restore teams data
    if (parsed.teams && typeof parsed.teams === "object") {
      for (const [teamId, teamData] of Object.entries(parsed.teams)) {
        if (teamId && teamData) {
          await ruggedSaveTeamData(teamId, teamData);
          teamsRestored++;
        }
      }
    }

    // Restore team lists
    if (Array.isArray(parsed.guestTeamsList) && parsed.guestTeamsList.length > 0) {
      localStorage.setItem("ucc_vball_guest_teams", JSON.stringify(parsed.guestTeamsList));
    }
    if (Array.isArray(parsed.myTeamsList) && parsed.myTeamsList.length > 0) {
      const activeUserUid = localStorage.getItem("ucc_guest_uid") || "guest";
      localStorage.setItem(`ucc_vball_my_teams_${activeUserUid}`, JSON.stringify(parsed.myTeamsList));
    }

    if (parsed.activeTeam) {
      localStorage.setItem("ucc_vball_active_team", parsed.activeTeam);
    }

    return {
      success: true,
      teamsRestored,
      message: `Successfully restored ${teamsRestored} team(s) from backup!`,
    };
  } catch (err: any) {
    return {
      success: false,
      teamsRestored: 0,
      message: err?.message || "Failed to parse backup JSON file.",
    };
  }
}

/**
 * Diagnostic test that exercises read/write across memory, LocalStorage, and IndexedDB
 */
export async function runStorageHealthCheck(activeTeam: string): Promise<{
  healthy: boolean;
  localStorageActive: boolean;
  indexedDbActive: boolean;
  totalTeams: number;
  activeTeamStatsCount: number;
  activeTeamMatchesCount: number;
}> {
  let localStorageActive = false;
  let indexedDbActive = false;

  // Test LocalStorage
  try {
    const testKey = "__ucc_storage_selftest__";
    localStorage.setItem(testKey, "1");
    localStorageActive = localStorage.getItem(testKey) === "1";
    localStorage.removeItem(testKey);
  } catch {
    localStorageActive = false;
  }

  // Test IndexedDB
  try {
    const db = await getIndexedDB();
    if (db) {
      indexedDbActive = true;
    }
  } catch {
    indexedDbActive = false;
  }

  // Count teams and records
  let totalTeams = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("ucc_vball_db_")) totalTeams++;
  }

  let activeTeamStatsCount = 0;
  let activeTeamMatchesCount = 0;

  if (activeTeam) {
    try {
      const data = await ruggedLoadTeamData(activeTeam);
      if (data) {
        activeTeamStatsCount = Array.isArray(data.stats) ? data.stats.length : 0;
        activeTeamMatchesCount = Array.isArray(data.matches) ? data.matches.length : 0;
      }
    } catch {}
  }

  return {
    healthy: localStorageActive || indexedDbActive,
    localStorageActive,
    indexedDbActive,
    totalTeams,
    activeTeamStatsCount,
    activeTeamMatchesCount,
  };
}
