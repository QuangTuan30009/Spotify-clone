document.addEventListener("DOMContentLoaded", function () {
  initialApp();
  setupSearchListener();
  setupAuthListeners();
});

let access_token;
let sessionId;
let searchTimeout;
const API_BASE = "http://127.0.0.1:3000";

// ============= AUTH FUNCTIONS =============

function setupAuthListeners() {
  const googleLoginBtn = document.getElementById("google-login-btn");
  const spotifyLoginBtn = document.getElementById("spotify-login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  googleLoginBtn.addEventListener("click", () => {
    const sessionQuery = sessionId
      ? `?session=${encodeURIComponent(sessionId)}`
      : "";
    window.location.href = `${API_BASE}/auth/google/login${sessionQuery}`;
  });

  spotifyLoginBtn.addEventListener("click", () => {
    if (!sessionId) {
      return;
    }
    window.location.href = `${API_BASE}/login?session=${encodeURIComponent(sessionId)}`;
  });

  logoutBtn.addEventListener("click", async () => {
    if (sessionId) {
      await axios.post(`${API_BASE}/api/session/logout/${sessionId}`);
    }
    sessionStorage.removeItem("app_session");
    sessionStorage.removeItem("spotify_session");
    sessionId = null;
    access_token = null;
    updateAuthUI(false, "", false);
    resetTrack();
    initialApp();
  });
}

function updateAuthUI(isLoggedIn, userName = "", hasSpotify = false) {
  const googleLoginBtn = document.getElementById("google-login-btn");
  const spotifyLoginBtn = document.getElementById("spotify-login-btn");
  const userInfo = document.getElementById("user-info");
  const userNameSpan = document.getElementById("user-name");
  const providerStatus = document.getElementById("provider-status");

  if (isLoggedIn) {
    googleLoginBtn.style.display = "none";
    userInfo.style.display = "flex";
    spotifyLoginBtn.style.display = hasSpotify ? "none" : "block";
    userNameSpan.textContent = userName || "User";
    providerStatus.textContent = hasSpotify
      ? "Google + Spotify connected"
      : "Connected with Google";
  } else {
    googleLoginBtn.style.display = "block";
    spotifyLoginBtn.style.display = "none";
    userInfo.style.display = "none";
    providerStatus.textContent = "";
  }
}

async function checkAuthStatus() {
  // Check URL params for session from OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const sessionFromUrl = urlParams.get("session");

  if (sessionFromUrl) {
    // Store session and clean URL
    sessionStorage.setItem("app_session", sessionFromUrl);
    sessionStorage.setItem("spotify_session", sessionFromUrl);
    window.history.replaceState({}, document.title, "/");
    sessionId = sessionFromUrl;
  } else {
    // Check stored session
    sessionId =
      sessionStorage.getItem("app_session") ||
      sessionStorage.getItem("spotify_session");
  }

  if (sessionId) {
    try {
      const sessionResponse = await axios.get(
        `${API_BASE}/api/session/${sessionId}`,
      );
      const sessionData = sessionResponse.data;

      if (!sessionData.isLoggedIn || !sessionData.user) {
        access_token = null;
        updateAuthUI(false, "", false);
        return { isAuthenticated: false, hasSpotify: false };
      }

      let hasSpotify = !!sessionData.hasSpotify;
      access_token = null;

      if (hasSpotify) {
        try {
          const tokenResponse = await axios.get(
            `${API_BASE}/api/token/${sessionId}`,
          );
          access_token = tokenResponse.data.access_token;
        } catch (error) {
          console.error(
            "Spotify token check failed:",
            error.response?.data || error,
          );
          hasSpotify = false;
        }
      }

      updateAuthUI(true, sessionData.user.name, hasSpotify);
      return { isAuthenticated: true, hasSpotify };
    } catch (error) {
      console.error("Auth check failed:", error);
      sessionStorage.removeItem("app_session");
      sessionStorage.removeItem("spotify_session");
      sessionId = null;
      access_token = null;
      updateAuthUI(false, "", false);
      return { isAuthenticated: false, hasSpotify: false };
    }
  } else {
    updateAuthUI(false, "", false);
    return { isAuthenticated: false, hasSpotify: false };
  }
}

function setupSearchListener() {
  const inputSearch = document.getElementById("search-input");
  inputSearch.addEventListener("input", async (e) => {
    const querry = e.target.value.trim();
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      if (querry && access_token) {
        const response = await getTrack(querry);
        if (response) {
          resetTrack();
          displayTrack(response);
        }
      }
    }, 500);
  });
}

function resetTrack() {
  const trackSection = document.getElementById("track-section");
  trackSection.innerHTML = "";
}

async function initialApp() {
  const authState = await checkAuthStatus();
  const isAuthenticated = authState.isAuthenticated;
  const hasSpotify = authState.hasSpotify;

  if (isAuthenticated && hasSpotify && access_token) {
    const response = await getTrack();
    if (response) {
      displayTrack(response);
    }
  } else if (isAuthenticated && !hasSpotify) {
    const trackSection = document.getElementById("track-section");
    trackSection.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #fff;">
                <i class="fa-solid fa-link" style="font-size: 48px; margin-bottom: 20px;"></i>
                <h3>Kết nối Spotify để nghe nhạc</h3>
                <p>Bạn đã đăng nhập Google. Bấm "Connect Spotify" ở góc phải để tiếp tục.</p>
            </div>
        `;
  } else {
    // Show message to login
    const trackSection = document.getElementById("track-section");
    trackSection.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #fff;">
                <i class="fa-brands fa-google" style="font-size: 48px; margin-bottom: 20px;"></i>
                <h3>Đăng nhập Google để bắt đầu</h3>
                <p>Sau đó kết nối Spotify để tìm và mở bài hát.</p>
            </div>
        `;
  }
}

async function displayTrack(data) {
  if (!data || !data.tracks || !data.tracks.items) {
    console.error("Invalid track data");
    return;
  }

  data.tracks.items.forEach((items) => {
    const name = items.name;
    const imgUrl = items.album.images[0]?.url || "";
    const artistNames = items.artists.map((artist) => artist.name).join(", ");

    const element = document.createElement("div");
    element.className = "track-card";

    element.innerHTML = `
            <div class="track-card-container">
              <img src="${imgUrl}" alt="${name}">
              <h3>${name}</h3>
              <p>${artistNames}</p>
            </div>`;

    element.addEventListener("click", () => {
      playTrack(items.id, name, artistNames);
    });

    const trackSection = document.getElementById("track-section");
    trackSection.appendChild(element);
  });
}

// ...existing code...

// Đóng modal khi click nút X
document.getElementById("modal-close").addEventListener("click", () => {
  const modal = document.getElementById("modal");
  modal.style.display = "none";
  document.getElementById("iframe").src = ""; // dừng nhạc
});

// Đóng modal khi click ra ngoài (vào overlay)
document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") {
    const modal = document.getElementById("modal");
    modal.style.display = "none";
    document.getElementById("iframe").src = "";
  }
});

// Đóng modal khi nhấn phím ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("modal");
    if (modal.style.display === "block") {
      modal.style.display = "none";
      document.getElementById("iframe").src = "";
    }
  }
});

//Play track
function playTrack(id, name, artistNames) {
  console.log(id);
  console.log(name);
  console.log(artistNames);
  const iframe = document.getElementById("iframe");
  iframe.src = `https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0`;
  const modal = document.getElementById("modal");
  modal.style.display = "block";
  const modalName = document.getElementById("modal-name");
  modalName.innerHTML = name;
}

async function getTrack(querry = "vietnamese hits") {
  if (!access_token) {
    console.error("No access token available");
    return null;
  }

  try {
    const response = await axios.get("https://api.spotify.com/v1/search", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      params: {
        q: querry,
        type: "track",
        limit: 10,
        market: "VN",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error searching:", error.response?.data || error);

    // If token expired, try to refresh
    if (error.response?.status === 401) {
      const refreshed = await checkAuthStatus();
      if (refreshed) {
        return getTrack(querry); // Retry with new token
      }
    }
    return null;
  }
}
