document.addEventListener("DOMContentLoaded", function() {
    initialApp();
    setupSearchListener();
});

let access_token;
let searchTimeout;

function setupSearchListener() {
    const inputSearch = document.getElementById("search-input");
    console.log(inputSearch);
    inputSearch.addEventListener("input", async (e) => {
        const querry = e.target.value.trim();
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout( async() => {
            if (querry){
            const response = await getTrack(querry);
            resetTrack();
            displayTrack(response);
        }
        }, 500)
    });
}


function resetTrack(){
    const trackSection = document.getElementById('track-section')
    trackSection.innerHTML = '';// xóa hết phần tử con của
}


async function initialApp() {
    access_token = await getSpotifyToken();
    if (access_token) {
        const response = await getTrack();
        displayTrack(response);
    }
}





async function displayTrack(data) {
    // console.log(data.tracks.items);
    data.tracks.items.forEach((items) => {
        console.log(items.id);
        const name = items.name;
        const imgUrl = items.album.images[0].url;
        const artistNames = items.artists.map(artist => artist.name).join(', ');  // sửa: dùng biến mới + join
        
        // Tạo thẻ div
        const element = document.createElement('div');
        element.className = 'track-card'; 

        element.innerHTML = `
            <div class="track-card-container">
              <img src="${imgUrl}" alt="${name}">
              <h3>${name}</h3>
              <p>${artistNames}</p>
            </div>`;

            //thêm event click để phát nhạc
            element.addEventListener("click", () => {
                playTrack(items.id, name, artistNames);
            });
        
        const trackSection = document.getElementById('track-section');
        trackSection.appendChild(element);
    });
}


// ...existing code...

// Đóng modal khi click nút X
document.getElementById('modal-close').addEventListener('click', () => {
    const modal = document.getElementById('modal');
    modal.style.display = 'none';
    document.getElementById('iframe').src = '';  // dừng nhạc
});

// Đóng modal khi click ra ngoài (vào overlay)
document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
        const modal = document.getElementById('modal');
        modal.style.display = 'none';
        document.getElementById('iframe').src = '';
    }
});

// Đóng modal khi nhấn phím ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modal');
        if (modal.style.display === 'block') {
            modal.style.display = 'none';
            document.getElementById('iframe').src = '';
        }
    }
});


//Play track
function playTrack(id, name, artistNames) {
                    console.log(id);
                    console.log(name);
                    console.log(artistNames);
    const iframe = document.getElementById('iframe');
    iframe.src =`https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0`;
    const modal = document.getElementById('modal');
    modal.style.display = 'block';
    const modalName = document.getElementById("modal-name");
    modalName.innerHTML = name;

    
}


async function getTrack(querry='obito') {
    
    try {
        const response = await axios.get("https://api.spotify.com/v1/search", {
            headers: {
                Authorization: `Bearer ${access_token}`
            },
            params: {
                q: querry ,  // từ khóa tìm kiếm
                type: 'track',       // loại: track, album, artist, playlist
                limit: 10,        // số kết quả (tùy chọn)
                // market: "VN"
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error searching:', error.response?.data || error);
    }
}

async function getSpotifyToken() {
    try {
        const credentials = btoa(`${SPOTIFY_CONFIG.clientId}:${SPOTIFY_CONFIG.clientSecret}`);
        
        const response = await axios.post(
            SPOTIFY_CONFIG.TOKEN_URL,
            'grant_type=client_credentials',
            {
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        return response.data.access_token;
    } catch (error) {
        console.error('Error getting token',error);
        return null;
    }
}    