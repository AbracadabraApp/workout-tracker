// App key storage - reads from URL hash (iOS-proof)
// Bookmark your app as: https://abracadabraapp.github.io/workout-tracker/#key=YOUR_KEY

export function loadToken() {
  const hash = window.location.hash;
  // Try #key= first (new format), fall back to #token= (legacy)
  if (hash && hash.includes('key=')) {
    const key = hash.split('key=')[1].split('&')[0];
    return key || null;
  }
  if (hash && hash.includes('token=')) {
    const token = hash.split('token=')[1].split('&')[0];
    return token || null;
  }
  return null;
}

export function saveToken(token) {
  // Update URL hash without reload
  window.location.hash = `key=${token}`;
  return true;
}

export function clearToken() {
  window.location.hash = '';
}

export function hasToken() {
  return loadToken() !== null;
}