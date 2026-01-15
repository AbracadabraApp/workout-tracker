// GitHub API client for workout tracker
// Handles reading and writing workout-data.json to the repository

const GITHUB_API_BASE = 'https://api.github.com';

let authToken = null;

/**
 * Set the GitHub personal access token for API calls
 * @param {string} token - GitHub personal access token
 */
export function setToken(token) {
  authToken = token;
}

/**
 * Get the current token (for checking if authenticated)
 * @returns {string|null}
 */
export function getToken() {
  return authToken;
}

/**
 * Fetch a file from the repository
 * @param {string} owner - Repository owner (e.g., 'AbracadabraApp')
 * @param {string} repo - Repository name (e.g., 'workout-tracker')
 * @param {string} path - File path (e.g., 'workout-data.json')
 * @param {string} branch - Branch name (default: 'main')
 * @returns {Promise<{content: string, sha: string}|null>}
 */
export async function getFile(owner, repo, path, branch = 'main') {
  if (!authToken) {
    throw new Error('GitHub token not set. Call setToken() first.');
  }

  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (response.status === 404) {
    // File doesn't exist yet
    return null;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GitHub API error: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  
  // Decode base64 content
  const content = atob(data.content.replace(/\n/g, ''));
  
  return {
    content,
    sha: data.sha
  };
}

/**
 * Commit a file to the repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} content - File content (will be base64 encoded)
 * @param {string} message - Commit message
 * @param {string} branch - Branch name (default: 'main')
 * @param {string|null} sha - Current file SHA (required for updates, null for new files)
 * @returns {Promise<{sha: string, commit: object}>}
 */
export async function commitFile(owner, repo, path, content, message, branch = 'main', sha = null) {
  if (!authToken) {
    throw new Error('GitHub token not set. Call setToken() first.');
  }

  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
  
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))), // Encode to base64 (UTF-8 safe)
    branch
  };

  // Include SHA for updates (prevents conflicts)
  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GitHub API error: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  
  return {
    sha: data.content.sha,
    commit: data.commit
  };
}

/**
 * Check if the token has write access to the repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<boolean>}
 */
export async function checkAccess(owner, repo) {
  if (!authToken) {
    return false;
  }

  try {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.permissions?.push === true;
  } catch (error) {
    console.error('Access check failed:', error);
    return false;
  }
}
