// Workout data manager with GitHub sync
// Handles loading, saving, and syncing workout data between localStorage and GitHub

import { setToken, getFile, commitFile } from './github.js';
import { loadToken } from './tokenStorage.js';

const REPO_OWNER = 'AbracadabraApp';
const REPO_NAME = 'workout-tracker';
const DATA_FILE = 'workout-data.json';
const BRANCH = 'main';

// Local cache keys
const CACHE_KEY = 'gainsApp.workoutDataCache';
const PENDING_SAVES_KEY = 'gainsApp.pendingSaves';

/**
 * Initialize the workout data system
 * - Loads token from storage
 * - Attempts to fetch latest data from GitHub
 * - Falls back to localStorage cache if offline/no token
 * - Returns the workout data to use in the app
 * @returns {Promise<{workoutHistory: Array, workoutDurations: Object}>}
 */
export async function initWorkoutData() {
  const token = loadToken();
  
  if (token) {
    setToken(token);
    
    try {
      // Try to fetch latest from GitHub
      const remote = await getFile(REPO_OWNER, REPO_NAME, DATA_FILE, BRANCH);
      
      if (remote) {
        const data = JSON.parse(remote.content);
        
        // Cache locally with SHA for future saves
        const cache = {
          data,
          sha: remote.sha,
          lastSync: new Date().toISOString()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        
        console.log('✓ Loaded workout data from GitHub');
        return data;
      }
    } catch (error) {
      console.warn('Failed to fetch from GitHub, using local cache:', error);
    }
  }
  
  // Fallback to local cache
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data } = JSON.parse(cached);
    console.log('✓ Loaded workout data from local cache');
    return data;
  }
  
  // No data anywhere - return empty structure
  console.log('⚠ No workout data found, starting fresh');
  return {
    workoutHistory: [],
    workoutDurations: {}
  };
}

/**
 * Save workout data locally and sync to GitHub
 * @param {Object} data - {workoutHistory: Array, workoutDurations: Object}
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveWorkoutData(data) {
  // Always update local cache first (immediate persistence)
  const cached = localStorage.getItem(CACHE_KEY);
  let currentSha = null;
  
  if (cached) {
    const parsed = JSON.parse(cached);
    currentSha = parsed.sha;
  }
  
  const cache = {
    data,
    sha: currentSha,
    lastSync: new Date().toISOString()
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  
  // Attempt GitHub sync
  const token = loadToken();
  if (!token) {
    // No token - queue for later sync
    addPendingSave(data);
    return { success: true, error: 'No token - saved locally, will sync when token added' };
  }
  
  setToken(token);
  
  try {
    // Fetch latest SHA to avoid conflicts
    const remote = await getFile(REPO_OWNER, REPO_NAME, DATA_FILE, BRANCH);
    const latestSha = remote ? remote.sha : null;
    
    // Commit to GitHub
    const message = `Update workout data - ${new Date().toISOString()}`;
    const content = JSON.stringify(data, null, 2);
    const result = await commitFile(REPO_OWNER, REPO_NAME, DATA_FILE, content, message, BRANCH, latestSha);
    
    // Update cache with new SHA
    cache.sha = result.sha;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    
    // Clear any pending saves since we successfully synced
    clearPendingSaves();
    
    console.log('✓ Synced to GitHub');
    return { success: true };
    
  } catch (error) {
    console.error('GitHub sync failed:', error);
    
    // Queue for retry
    addPendingSave(data);
    
    return { 
      success: true, // Data is saved locally
      error: `Saved locally but sync failed: ${error.message}` 
    };
  }
}

/**
 * Retry syncing any pending saves
 * Call this when token is added or when app comes back online
 * @returns {Promise<{success: boolean, synced: number}>}
 */
export async function retryPendingSaves() {
  const pending = getPendingSaves();
  if (pending.length === 0) {
    return { success: true, synced: 0 };
  }
  
  const token = loadToken();
  if (!token) {
    return { success: false, synced: 0 };
  }
  
  // Use the most recent pending save
  const latestData = pending[pending.length - 1];
  const result = await saveWorkoutData(latestData);
  
  if (result.success && !result.error) {
    // Successfully synced
    clearPendingSaves();
    return { success: true, synced: 1 };
  }
  
  return { success: false, synced: 0 };
}

// Helper functions for managing pending saves queue

function addPendingSave(data) {
  const pending = getPendingSaves();
  pending.push({
    data,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 5 pending saves to prevent bloat
  const trimmed = pending.slice(-5);
  localStorage.setItem(PENDING_SAVES_KEY, JSON.stringify(trimmed));
}

function getPendingSaves() {
  const pending = localStorage.getItem(PENDING_SAVES_KEY);
  return pending ? JSON.parse(pending) : [];
}

function clearPendingSaves() {
  localStorage.removeItem(PENDING_SAVES_KEY);
}

/**
 * Get sync status info for UI display
 * @returns {Object} - {hasPending: boolean, pendingCount: number, lastSync: string|null}
 */
export function getSyncStatus() {
  const pending = getPendingSaves();
  const cached = localStorage.getItem(CACHE_KEY);
  
  let lastSync = null;
  if (cached) {
    const parsed = JSON.parse(cached);
    lastSync = parsed.lastSync;
  }
  
  return {
    hasPending: pending.length > 0,
    pendingCount: pending.length,
    lastSync
  };
}
