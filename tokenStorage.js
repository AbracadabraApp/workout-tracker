// Token storage helper for GitHub authentication
// Stores token in localStorage (okay if wiped - user just re-enters)

const TOKEN_KEY = 'gainsApp.githubToken';

/**
 * Save GitHub token to localStorage
 * @param {string} token - GitHub personal access token
 */
export function saveToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Load GitHub token from localStorage
 * @returns {string|null} - Token or null if not found
 */
export function loadToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Remove token from localStorage
 */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Check if token exists in localStorage
 * @returns {boolean}
 */
export function hasToken() {
  return localStorage.getItem(TOKEN_KEY) !== null;
}
