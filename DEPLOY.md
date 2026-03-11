# 🚀 Deploy Tunify lên Render.com

Hướng dẫn deploy app Spotify lên Render (miễn phí, hỗ trợ Express).

## 📋 Các bước deploy:

### Bước 1: Tạo tài khoản Render

1. Vào: https://render.com
2. Click **"Get Started for Free"**
3. Sign up bằng GitHub (khuyến nghị)
4. Authorize Render truy cập GitHub

### Bước 2: Tạo Web Service

1. Vào Dashboard: https://dashboard.render.com
2. Click **"New +"** → chọn **"Web Service"**
3. Connect repository: **Spotify-clone**
4. Click **"Connect"**

### Bước 3: Cấu hình Web Service

Điền các thông tin:

**Basic Settings:**
- **Name**: `tunify-spotify` (hoặc tên bạn muốn)
- **Region**: Singapore (gần VN nhất)
- **Branch**: `main`
- **Root Directory**: (để trống)
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Instance Type:**
- Chọn **"Free"** (đủ dùng)

### Bước 4: Thêm Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**, thêm:

```
SPOTIFY_CLIENT_ID=843c972142e44429987c08846ebf4aa3
SPOTIFY_CLIENT_SECRET=d377713ba9ab4e00ad1b6943e715eeff
PORT=10000
REDIRECT_URI=https://tunify-spotify.onrender.com/callback
```

⚠️ **Lưu ý:** 
- Thay `tunify-spotify` bằng tên service bạn đặt
- Render tự động dùng port 10000

### Bước 5: Deploy!

1. Click **"Create Web Service"**
2. Đợi 2-3 phút để deploy
3. Xem logs để theo dõi quá trình

### Bước 6: Cập nhật Spotify Dashboard

1. Vào: https://developer.spotify.com/dashboard
2. Chọn app → **Settings**
3. Tìm **"Redirect URIs"**
4. Thêm: `https://tunify-spotify.onrender.com/callback`
   (thay `tunify-spotify` bằng tên service của bạn)
5. Click **Add** → **Save**

### Bước 7: Test!

1. Mở URL của bạn: `https://tunify-spotify.onrender.com`
2. Click **"Login with Spotify"**
3. Đăng nhập và nghe nhạc! 🎵

---

## 🔧 Sau khi deploy:

### Auto Deploy từ GitHub

Mỗi lần bạn push code lên GitHub, Render sẽ tự động deploy lại!

### Xem Logs

Dashboard → Your Service → **Logs** tab

### Custom Domain (Optional)

Dashboard → Settings → **Custom Domains** → Add domain của bạn

---

## ⚠️ Lưu ý quan trọng:

### Free Tier Limitations:

- ✅ Miễn phí mãi mãi
- ⚠️ Sleep sau 15 phút không dùng (khởi động lại khi có request, ~30s)
- ⚠️ 750 giờ/tháng (đủ dùng)

### Để tránh sleep:

Dùng service như:
- https://cron-job.org (ping app 5-10 phút/lần)
- UptimeRobot (monitor miễn phí)

---

## 🐛 Troubleshooting:

### Build failed?
- Check Logs tab
- Thường do thiếu dependencies → chạy `npm install` local trước

### "Invalid redirect URI"?
- Đảm bảo đã thêm `https://your-app.onrender.com/callback` vào Spotify Dashboard
- URI phải khớp CHÍNH XÁC (có/không có trailing slash)

### App sleep?
- Free tier sleep sau 15 phút
- Khởi động lại khi có request đầu tiên (~30 giây)
- Upgrade lên paid plan để luôn active

---

## 💡 Tips:

1. **URL sẽ là:** `https://[tên-bạn-đặt].onrender.com`
2. **HTTPS tự động:** Render tự cấp SSL cert miễn phí
3. **Environment Variables:** Có thể update bất cứ lúc nào
4. **Redeploy manual:** Dashboard → Manual Deploy → Deploy latest commit

---

## 📚 Tài liệu:

- [Render Docs](https://render.com/docs)
- [Deploy Node.js](https://render.com/docs/deploy-node-express-app)

---

✅ Done! App của bạn đã online!
