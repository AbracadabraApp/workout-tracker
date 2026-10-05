// Cloudflare Worker for gains-data
// Proxies GitHub API calls with secure token handling

const REPO_OWNER = 'AbracadabraApp';
const REPO_NAME = 'workout-tracker';
const DATA_FILE = 'workout-data.json';
const BRANCH = 'main';

function entryKey(h) {
  return `${h.date}|${h.workout}|${h.exercise}`;
}

// Merge data: incoming wins on collision
function mergeData(remote, incoming) {
  const byKey = new Map();
  (remote.workoutHistory || []).forEach(h => byKey.set(entryKey(h), h));
  (incoming.workoutHistory || []).forEach(h => byKey.set(entryKey(h), h));
  return {
    ...remote,
    ...incoming,
    workoutHistory: Array.from(byKey.values()),
    workoutDurations: { ...(remote.workoutDurations || {}), ...(incoming.workoutDurations || {}) }
  };
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'X-App-Key, Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return origin === 'https://abracadabraapp.github.io' || origin.startsWith('http://localhost');
}

async function getFileFromGitHub(token) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE}?ref=${BRANCH}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'gains-data-worker',
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  // Decode base64 content
  const content = atob(data.content.replace(/\n/g, ''));
  return {
    content: JSON.parse(content),
    sha: data.sha
  };
}

async function commitToGitHub(token, content, message, sha) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'gains-data-worker',
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      content: btoa(content),
      branch: BRANCH,
      sha
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub commit failed: ${response.status} - ${error}`);
  }

  return response.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      if (isAllowedOrigin(origin)) {
        return new Response(null, {
          headers: corsHeaders(origin)
        });
      }
      return new Response('Forbidden', { status: 403 });
    }

    // Check auth
    const appKey = request.headers.get('X-App-Key');
    if (!appKey || appKey !== env.APP_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(isAllowedOrigin(origin) ? corsHeaders(origin) : {})
    };

    try {
      // GET /data - fetch from GitHub
      if (request.method === 'GET' && url.pathname === '/data') {
        const file = await getFileFromGitHub(env.GITHUB_TOKEN);
        return new Response(JSON.stringify(file.content), { headers });
      }

      // PUT /data - merge and commit
      if (request.method === 'PUT' && url.pathname === '/data') {
        const incoming = await request.json();

        // Fetch current file with retry logic
        let attempt = 0;
        let success = false;
        let result;

        while (attempt < 2 && !success) {
          try {
            const current = await getFileFromGitHub(env.GITHUB_TOKEN);
            const merged = mergeData(current.content, incoming);
            const message = `Workout ${new Date().toISOString()}`;

            result = await commitToGitHub(
              env.GITHUB_TOKEN,
              JSON.stringify(merged, null, 2),
              message,
              current.sha
            );

            success = true;
            return new Response(JSON.stringify({ success: true, data: merged }), { headers });
          } catch (error) {
            if ((error.message.includes('409') || error.message.includes('422')) && attempt === 0) {
              // SHA conflict, retry once
              attempt++;
              continue;
            }
            throw error;
          }
        }
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers
      });
    }
  }
};
