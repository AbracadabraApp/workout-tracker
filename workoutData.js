// Workout data manager with GitHub sync via Cloudflare Worker
// READ: Tries Worker first, falls back to raw.githubusercontent.com, then cache
// WRITE: Requires app key in URL hash
//
// Local-first: unsynced changes are flagged as pending and are never
// overwritten by the remote copy. On launch, local and remote are merged.

import { loadToken } from './tokenStorage.js';

const REPO_OWNER = 'AbracadabraApp';
const REPO_NAME = 'workout-tracker';
const DATA_FILE = 'workout-data.json';
const BRANCH = 'main';

const WORKER_URL = 'https://gains-data.josh-petersen.workers.dev/data';
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

  // Try Worker first (with auth if available)
  const key = loadToken();
  if (key) {
    try {
      const response = await fetch(WORKER_URL, {
        headers: { 'X-App-Key': key }
      });
      if (response.ok) {
        remote = await response.json();
        console.log('✓ Loaded workout data from Worker');
      }
    } catch (error) {
      console.warn('Worker fetch failed, trying fallback:', error);
    }
  }

  // Fall back to public raw URL
  if (!remote) {
    try {
      const response = await fetch(RAW_URL + '?t=' + Date.now());
      if (response.ok) {
        remote = await response.json();
        console.log('✓ Loaded workout data from GitHub (fallback)');
      }
    } catch (error) {
      console.warn('GitHub fetch failed, using cache:', error);
    }
  }

  if (remote && cached && cached.pending) {
    const merged = mergeData(remote, cached.data);
    writeCache(merged, true);
    console.log('✓ Merged unsynced local workouts; retrying push');
    saveWorkoutData(merged).catch(() => {});
    return merged;
  }

  if (remote) {
    writeCache(remote, false);
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
 * the pending flag clears only after the Worker confirms the commit.
 */
export async function saveWorkoutData(data) {
  writeCache(data, true);

  const key = loadToken();
  if (!key) {
    return {
      success: false,
      error: 'No app key. Add #key=YOUR_KEY to URL. Workouts are kept on this device until it syncs.'
    };
  }

  try {
    const response = await fetch(WORKER_URL, {
      method: 'PUT',
      headers: {
        'X-App-Key': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Worker returned ${response.status}`);
    }

    const result = await response.json();
    writeCache(result.data, false);
    console.log('✓ Saved to GitHub via Worker');
    return { success: true };
  } catch (error) {
    console.error('Save failed:', error);
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
