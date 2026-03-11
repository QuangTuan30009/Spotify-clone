// Spotify OAuth Configuration
// Client credentials are now stored in backend (.env file)
// This file is kept for backwards compatibility

function getCurrentURL() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

// Deprecated - now using OAuth flow
const SPOTIFY_CONFIG = {
  // These are no longer used in frontend
  // All authentication is handled by backend
  apiBase: "http://localhost:3000",
};

console.log(`
🎵 TUNIFY - SPOTIFY WEB PLAYER
📝 Authentication Mode: OAuth 2.0
🔐 Secure: Client credentials stored in backend
🌐 API Base: ${SPOTIFY_CONFIG.apiBase}
✨ Status: Ready
`);
