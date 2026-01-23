// Workout data manager with GitHub sync
// READ: Always works (public repo, no auth)
// WRITE: Requires token in URL hash

import { setToken, getFile, commitFile } from './github.js';
import { loadToken } from './tokenStorage.js';

const REPO_OWNER = 'AbracadabraApp';
const REPO_NAME = 'workout-tracker';
const DATA_FILE = 'workout-data.json';
const BRANCH = 'main';

// Raw GitHub URL for public read access (no token needed)
const RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${DATA_FILE}`;

// Local cache key
const CACHE_KEY = 'gainsApp.workoutDataCache';

/**
 * Initialize workout data
 * ALWAYS fetches from GitHub (public, no auth needed)
 * Falls back to cache only if offline
 */
export async function initWorkoutData() {
  try {
    // Fetch directly from raw.githubusercontent.com - no token needed
    const response = await fetch(RAW_URL + '?t=' + Date.now()); // cache bust
    
    if (response.ok) {
      const data = await response.json();
      
      // Cache locally for offline fallback
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        lastSync: new Date().toISOString()
      }));
      
      console.log('✓ Loaded workout data from GitHub');
      return data;
    }
  } catch (error) {
    console.warn('Failed to fetch from GitHub, trying cache:', error);
  }
  
  // Offline fallback
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data } = JSON.parse(cached);
    console.log('✓ Loaded workout data from cache (offline mode)');
    return data;
  }
  
  // No data anywhere
  console.log('⚠ No workout data found');
  return { workoutHistory: [], workoutDurations: {} };
}

/**
 * Save workout data to GitHub
 * Requires token in URL hash
 */
export async function saveWorkoutData(data) {
  // Always cache locally first
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    data,
    lastSync: new Date().toISOString()
  }));
  
  const token = loadToken();
  if (!token) {
    return { 
      success: false, 
      error: 'No token. Add #token=YOUR_TOKEN to URL or paste in settings.' 
    };
  }
  
  setToken(token);
  
  try {
    // Get current SHA for update
    const remote = await getFile(REPO_OWNER, REPO_NAME, DATA_FILE, BRANCH);
    const sha = remote ? remote.sha : null;
    
    // Commit to GitHub
    const message = `Workout ${new Date().toISOString()}`;
    const content = JSON.stringify(data, null, 2);
    await commitFile(REPO_OWNER, REPO_NAME, DATA_FILE, content, message, BRANCH, sha);
    
    console.log('✓ Saved to GitHub');
    return { success: true };
    
  } catch (error) {
    console.error('GitHub save failed:', error);
    return { 
      success: false, 
      error: `Save failed: ${error.message}. Data cached locally.` 
    };
  }
}

/**
 * Get sync status
 */
export function getSyncStatus() {
  const cached = localStorage.getItem(CACHE_KEY);
  const hasToken = loadToken() !== null;
  
  return {
    hasToken,
    lastSync: cached ? JSON.parse(cached).lastSync : null
  };
}