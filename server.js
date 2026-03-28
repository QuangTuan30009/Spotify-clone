const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(".")); // Serve static files

// Spotify Config
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.REDIRECT_URI || `http://localhost:${PORT}/callback`;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || `${BASE_URL}/auth/google/callback`;
const SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "user-top-read",
  "user-read-recently-played",
].join(" ");

// In-memory token storage (trong production nên dùng database)
let sessions = {};
let usersByGoogleId = {};

function createSessionId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateSession(sessionId) {
  if (sessionId && sessions[sessionId]) {
    return { sessionId, session: sessions[sessionId] };
  }

  const newSessionId = createSessionId();
  sessions[newSessionId] = {
    user: null,
    spotify: null,
  };

  return { sessionId: newSessionId, session: sessions[newSessionId] };
}

// ============= ROUTES =============

// 0. Google login endpoint - Redirect user to Google OAuth
app.get("/auth/google/login", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect("/?error=google_config_missing");
  }

  const existingSessionId = req.query.session;
  const { sessionId } = getOrCreateSession(existingSessionId);

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${encodeURIComponent(sessionId)}`;

  res.redirect(authUrl);
});

// 0.1 Google callback - Auto-register user on first login
app.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) {
    return res.redirect("/?error=google_no_code");
  }

  try {
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const googleAccessToken = tokenResponse.data.access_token;
    const userInfoResponse = await axios.get(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
        },
      },
    );

    const profile = userInfoResponse.data;
    let user = usersByGoogleId[profile.sub];
    const isFirstLogin = !user;

    if (!user) {
      user = {
        id: createSessionId(),
        googleId: profile.sub,
        email: profile.email,
        name: profile.name || profile.email,
        picture: profile.picture || "",
        provider: "google",
        createdAt: new Date().toISOString(),
      };
      usersByGoogleId[profile.sub] = user;
    }

    const { sessionId, session } = getOrCreateSession(state);
    session.user = user;

    res.redirect(`/?session=${sessionId}&auth=google&new_user=${isFirstLogin}`);
  } catch (error) {
    console.error(
      "Google OAuth failed:",
      error.response?.data || error.message,
    );
    res.redirect("/?error=google_auth_failed");
  }
});

// 1. Login endpoint - Redirect user to Spotify
app.get("/login", (req, res) => {
  const existingSessionId = req.query.session;
  const { sessionId } = getOrCreateSession(existingSessionId);

  const authUrl =
    `https://accounts.spotify.com/authorize?` +
    `client_id=${SPOTIFY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&show_dialog=true` +
    `&state=${encodeURIComponent(sessionId)}`;

  res.redirect(authUrl);
});

// 2. Callback endpoint - Spotify redirects here after login
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) {
    return res.redirect("/?error=no_code");
  }

  try {
    // Exchange code for access token
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET,
            ).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const { access_token, refresh_token, expires_in } = response.data;

    const { sessionId, session } = getOrCreateSession(state);
    session.spotify = {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    };

    // Redirect về frontend với session ID
    res.redirect(`/?session=${sessionId}`);
  } catch (error) {
    console.error(
      "Error exchanging code:",
      error.response?.data || error.message,
    );
    res.redirect("/?error=auth_failed");
  }
});

// 3. Get access token endpoint
app.get("/api/token/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const tokenData = sessions[sessionId]?.spotify;

  if (!tokenData) {
    return res.status(401).json({ error: "No session found" });
  }

  // Check if token expired
  if (Date.now() >= tokenData.expires_at) {
    try {
      // Refresh token
      const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: tokenData.refresh_token,
        }),
        {
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(
                SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET,
              ).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      const { access_token, expires_in } = response.data;

      // Update stored token
      sessions[sessionId].spotify.access_token = access_token;
      sessions[sessionId].spotify.expires_at = Date.now() + expires_in * 1000;

      return res.json({ access_token });
    } catch (error) {
      console.error(
        "Error refreshing token:",
        error.response?.data || error.message,
      );
      return res.status(401).json({ error: "Failed to refresh token" });
    }
  }

  res.json({ access_token: tokenData.access_token });
});

// Session info endpoint for Google login status and linked providers
app.get("/api/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions[sessionId];

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  return res.json({
    sessionId,
    isLoggedIn: !!session.user,
    hasSpotify: !!session.spotify,
    user: session.user,
  });
});

// 4. Logout endpoint
app.post("/api/logout/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  delete sessions[sessionId];
  res.json({ success: true });
});

// Alias route for a clearer name used by frontend
app.post("/api/session/logout/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  delete sessions[sessionId];
  res.json({ success: true });
});

// 5. Proxy endpoint cho Spotify API (optional - để hide token)
app.get("/api/spotify/*", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  const tokenData = sessions[sessionId]?.spotify;

  if (!tokenData) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const spotifyPath = req.params[0];
  const queryString = new URLSearchParams(req.query).toString();
  const url = `https://api.spotify.com/v1/${spotifyPath}${queryString ? "?" + queryString : ""}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    res.json(response.data);
  } catch (error) {
    res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: "API request failed" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasSpotifyConfig: !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET),
    hasGoogleConfig: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🎵 Spotify OAuth Server Running     ║
╠════════════════════════════════════════╣
║  Server:    http://localhost:${PORT}     ║
║  Login:     http://localhost:${PORT}/login ║
║  Status:    ✅ Ready                   ║
╚════════════════════════════════════════╝
    `);

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error("⚠️  WARNING: Missing Spotify credentials in .env file!");
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error("⚠️  WARNING: Missing Google credentials in .env file!");
  }
});
