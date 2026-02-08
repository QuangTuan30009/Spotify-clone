//Tự động detect URL hiện tại 
function getCurrentURL() {
    if (typeof window !== 'undefined'){
        return window.location.origin;
    }
    //Fallback cho các trường hợp không có window object
    return 'http://localhost:3000';
}

//Spotify API Config
const SPOTIFY_CONFIG = {
    clientId: '843c972142e44429987c08846ebf4aa3',
    clientSecret: 'd377713ba9ab4e00ad1b6943e715eeff',
    TOKEN_URL: 'https://accounts.spotify.com/api/token',
    get redirectUri() {
        return `${getCurrentURL()}`;
    }
};

console.log(`
🎵 SPORTIFY WEB PLAYER
📝 Cấu hình:
- Client ID: ${SPOTIFY_CONFIG.clientId ? "✅" : "❌"}
- Client Secret: ${SPOTIFY_CONFIG.clientSecret ? "✅" : "❌"}
- Redirect URI: ${SPOTIFY_CONFIG.redirectUri}
`);