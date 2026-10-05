// Workout data manager with GitHub sync
// READ: Always works (public repo, no auth)
// WRITE: Requires token in URL hash
//
// Local-first: unsynced changes are flagged as pending and are never
// overwritten by the remote copy. On launch, local and remote are merged.

import { setToken, getFile, commitFile } from './github.js';
import { loadToken } from './tokenStorage.js';

const REPO_OWNER = 'AbracadabraApp';
const REPO_NAME = 'workout-tracker';
const DATA_FILE = 'workout-data.json';
const BRANCH = 'main';

const RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${DATA_FILE}`;

const CACHE_KEY = 'gainsApp.workoutDataCache';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeCache(data, pending) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      pending: !!pending,
      lastSync: pending ? (readCache() || {}).lastSync || null : new Date().toISOString()
    }));
  } catch (e) {
    console.warn('Could not write local cache:', e);
  }
}

function entryKey(h) {
  return `${h.date}|${h.workout}|${h.exercise}`;
}

// Union of both histories; local wins when the same date/workout/exercise exists in both.
function mergeData(remote, local) {
  const byKey = new Map();
  (remote.workoutHistory || []).forEach(h => byKey.set(entryKey(h), h));
  (local.workoutHistory || []).forEach(h => byKey.set(entryKey(h), h));
  return {
    ...remote,
    ...local,
    workoutHistory: Array.from(byKey.values()),
    workoutDurations: { ...(remote.workoutDurations || {}), ...(local.workoutDurations || {}) }
  };
}

/**
 * Initialize workout data.
 * If local has unsynced changes, merge them with remote and try to push.
 */
export async function initWorkoutData() {
  const cached = readCache();
  let remote = null;

  try {
    const response = await fetch(RAW_URL + '?t=' + Date.now());
    if (response.ok) remote = await response.json();
  } catch (error) {
    console.warn('Failed to fetch from GitHub, using cache:', error);
  }

  if (remote && cached && cached.pending) {
    const merged = mergeData(remote, cached.data);
    writeCache(merged, true);
    console.log('✓ Merged unsynced local workouts with GitHub; retrying push');
    saveWorkoutData(merged).catch(() => {});
    return merged;
  }

  if (remote) {
    writeCache(remote, false);
    console.log('✓ Loaded workout data from GitHub');
    return remote;
  }

  if (cached) {
    console.log('✓ Loaded workout data from cache (offline mode)');
    return cached.data;
  }

  console.log('⚠ No workout data found');
  return { workoutHistory: [], workoutDurations: {} };
}

/**
 * Save workout data. Always saved locally as pending first;
 * the pending flag clears only after GitHub confirms the commit.
 */
export async function saveWorkoutData(data) {
  writeCache(data, true);

  const token = loadToken();
  if (!token) {
    return {
      success: false,
      error: 'No token. Add #token=YOUR_TOKEN to URL. Workouts are kept on this device until it syncs.'
    };
  }

  setToken(token);

  try {
    // Merge with whatever is on GitHub so nothing there is lost either
    const remote = await getFile(REPO_OWNER, REPO_NAME, DATA_FILE, BRANCH);
    const sha = remote ? remote.sha : null;
    let toSave = data;
    if (remote && remote.content) {
      try {
        const remoteData = JSON.parse(remote.content);
        toSave = mergeData(remoteData, data);
      } catch (e) { /* content not decodable; save local as-is */ }
    }

    const message = `Workout ${new Date().toISOString()}`;
    await commitFile(REPO_OWNER, REPO_NAME, DATA_FILE, JSON.stringify(toSave, null, 2), message, BRANCH, sha);

    writeCache(toSave, false);
    console.log('✓ Saved to GitHub');
    return { success: true };
  } catch (error) {
    console.error('GitHub save failed:', error);
    return {
      success: false,
      error: `Save failed: ${error.message}. Kept on this device; will retry next launch.`
    };
  }
}

export function getSyncStatus() {
  const cached = readCache();
  return {
    hasToken: loadToken() !== null,
    pending: !!(cached && cached.pending),
    lastSync: cached ? cached.lastSync : null
  };
}
