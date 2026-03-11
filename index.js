document.addEventListener("DOMContentLoaded", function () {
  initialApp();
  setupSearchListener();
  setupAuthListeners();
});

let access_token;
let sessionId;
let searchTimeout;
const API_BASE = 'http://127.0.0.1:3000';

// ============= AUTH FUNCTIONS =============

function setupAuthListeners() {
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  loginBtn.addEventListener("click", () => {
    window.location.href = `${API_BASE}/login`;
  });

  logoutBtn.addEventListener("click", async () => {
    if (sessionId) {
      await axios.post(`${API_BASE}/api/logout/${sessionId}`);
    }
    sessionStorage.removeItem("spotify_session");
    sessionId = null;
    access_token = null;
    updateAuthUI(false);
    resetTrack();
  });
}

function updateAuthUI(isLoggedIn, userName = "") {
  const loginBtn = document.getElementById("login-btn");
  const userInfo = document.getElementById("user-info");
  const userNameSpan = document.getElementById("user-name");

  if (isLoggedIn) {
    loginBtn.style.display = "none";
    userInfo.style.display = "flex";
    userNameSpan.textContent = userName || "User";
  } else {
    loginBtn.style.display = "block";
    userInfo.style.display = "none";
  }
}

async function checkAuthStatus() {
  // Check URL params for session from OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const sessionFromUrl = urlParams.get("session");

  if (sessionFromUrl) {
    // Store session and clean URL
    sessionStorage.setItem("spotify_session", sessionFromUrl);
    window.history.replaceState({}, document.title, "/");
    sessionId = sessionFromUrl;
  } else {
    // Check stored session
    sessionId = sessionStorage.getItem("spotify_session");
  }

  if (sessionId) {
    try {
      // Get access token from backend
      const response = await axios.get(`${API_BASE}/api/token/${sessionId}`);
      access_token = response.data.access_token;

      // Get user info
      const userResponse = await axios.get("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      updateAuthUI(true, userResponse.data.display_name);
      return true;
    } catch (error) {
      console.error("Auth check failed:", error);
      sessionStorage.removeItem("spotify_session");
      sessionId = null;
      access_token = null;
      updateAuthUI(false);
      return false;
    }
  } else {
    updateAuthUI(false);
    return false;
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
  const isAuthenticated = await checkAuthStatus();

  if (isAuthenticated && access_token) {
    const response = await getTrack();
    if (response) {
      displayTrack(response);
    }
  } else {
    // Show message to login
    const trackSection = document.getElementById("track-section");
    trackSection.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #fff;">
                <i class="fa-brands fa-spotify" style="font-size: 48px; margin-bottom: 20px;"></i>
                <h3>Đăng nhập để khám phá nhạc</h3>
                <p>Click "Login with Spotify" để bắt đầu</p>
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
