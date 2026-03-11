const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(".")); // Serve static files

// Spotify Config
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.REDIRECT_URI || `http://localhost:${PORT}/callback`;
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
let userTokens = {};

// ============= ROUTES =============

// 1. Login endpoint - Redirect user to Spotify
app.get("/login", (req, res) => {
  const authUrl =
    `https://accounts.spotify.com/authorize?` +
    `client_id=${SPOTIFY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&show_dialog=true`;

  res.redirect(authUrl);
});

// 2. Callback endpoint - Spotify redirects here after login
app.get("/callback", async (req, res) => {
  const code = req.query.code;

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

    // Lưu tokens (demo đơn giản - production nên dùng session/database)
    const sessionId = Date.now().toString();
    userTokens[sessionId] = {
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
  const tokenData = userTokens[sessionId];

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
      userTokens[sessionId].access_token = access_token;
      userTokens[sessionId].expires_at = Date.now() + expires_in * 1000;

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

// 4. Logout endpoint
app.post("/api/logout/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  delete userTokens[sessionId];
  res.json({ success: true });
});

// 5. Proxy endpoint cho Spotify API (optional - để hide token)
app.get("/api/spotify/*", async (req, res) => {
  const sessionId = req.headers["x-session-id"];
  const tokenData = userTokens[sessionId];

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
    hasConfig: !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET),
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
});
