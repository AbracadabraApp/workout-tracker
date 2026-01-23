// Token storage - reads from URL hash (iOS-proof)
// Bookmark your app as: https://abracadabraapp.github.io/workout-tracker/#token=YOUR_TOKEN

export function loadToken() {
  const hash = window.location.hash;
  if (hash && hash.includes('token=')) {
    const token = hash.split('token=')[1].split('&')[0];
    return token || null;
  }
  return null;
}

export function saveToken(token) {
  // Update URL hash without reload
  window.location.hash = `token=${token}`;
  return true;
}

export function clearToken() {
  window.location.hash = '';
}

export function hasToken() {
  return loadToken() !== null;
}