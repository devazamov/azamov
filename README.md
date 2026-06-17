# Telegram Clone

Telegramga o'xshash, real vaqtli ishlaydigan web messenjer.
**React + Node.js + WebSocket + SQLite** asosida qurilgan.

## Imkoniyatlar

- ✅ Ro'yxatdan o'tish / kirish (parol scrypt bilan hashlanadi, HMAC token)
- ✅ Shaxsiy suhbatlar (1:1)
- ✅ Guruh chatlari
- ✅ Real vaqtli xabar almashish (WebSocket)
- ✅ Rasm va fayl yuborish (max 25 MB)
- ✅ Onlayn holati (online/offline)
- ✅ "Yozmoqda..." indikatori
- ✅ Foydalanuvchi qidirish
- ✅ Xabarlar tarixi (SQLite'da saqlanadi)
- ✅ Optimistik UI (xabar darhol ko'rinadi)

## Texnologiyalar

| Qatlam   | Texnologiya |
|----------|-------------|
| Frontend | React 18, Vite |
| Backend  | Node.js (http + ws) |
| Baza     | node:sqlite (Node 24+ ichida, tashqi server kerak emas) |
| Auth     | scrypt (parol) + HMAC-SHA256 (token) |

Tashqi baza yoki og'ir kutubxonalar yo'q — faqat `ws` va `react`/`vite`.

## Talablar

- **Node.js 24+** (`node:sqlite` shu versiyadan boshlab bor)

## Ishga tushirish

Ikkita terminal kerak.

### 1. Backend

```bash
cd server
npm install
npm start        # http://localhost:3001
```

### 2. Frontend

```bash
cd client
npm install
npm run dev      # http://localhost:5173
```

Brauzerda **http://localhost:5173** ni oching.

### Sinab ko'rish

1. Ikki xil brauzerda (yoki biri yashirin oynada) ikkita hisob yarating, masalan `alice` va `bob`.
2. ✎ tugmasini bosib, bir-biringizni qidiring va suhbat boshlang.
3. Xabarlar real vaqtda yetib boradi. 📎 orqali rasm/fayl yuboring.

## Loyiha tuzilmasi

```
telegram-clone/
├── server/
│   └── src/
│       ├── index.js      # HTTP + WS serverni ishga tushirish
│       ├── config.js     # Sozlamalar
│       ├── db.js         # SQLite sxema
│       ├── auth.js       # Parol hash + token
│       ├── store.js      # Ma'lumotlar bilan ishlash (queries)
│       ├── http.js       # REST API + fayl yuklash
│       └── realtime.js   # WebSocket real-time logikasi
└── client/
    └── src/
        ├── App.jsx       # Asosiy holat va layout
        ├── Auth.jsx      # Login / register ekrani
        ├── ChatView.jsx  # Chat oynasi va xabarlar
        ├── components.jsx# Avatar, modal, yordamchilar
        ├── api.js        # REST + WebSocket klient
        └── styles.css    # Telegram uslubidagi dizayn
```

## API qisqacha

| Metod | Endpoint | Tavsif |
|-------|----------|--------|
| POST  | `/api/register` | Ro'yxatdan o'tish |
| POST  | `/api/login` | Kirish |
| GET   | `/api/me` | Joriy foydalanuvchi |
| GET   | `/api/users/search?q=` | Foydalanuvchi qidirish |
| GET   | `/api/chats` | Suhbatlar ro'yxati |
| POST  | `/api/chats/private` | Shaxsiy chat ochish |
| POST  | `/api/chats/group` | Guruh yaratish |
| GET   | `/api/messages?chatId=` | Xabarlar tarixi |
| POST  | `/api/upload` | Fayl yuklash |
| WS    | `/ws?token=` | Real-time kanal |

## Internetga joylash (Deploy)

⚠️ **Muhim:** Bu ilova ikki qismdan iborat. Netlify faqat **frontend**ni
ko'taradi (statik). **Backend** (WebSocket + SQLite) alohida joyga kerak,
masalan **Render.com** (bepul).

### 1-qadam: Backend — Render.com

1. [render.com](https://render.com) ga GitHub bilan kiring.
2. **New → Blueprint** → shu reponi tanlang (`render.yaml` avtomatik o'qiladi).
3. Deploy tugaganda manzilni nusxa oling, masalan:
   `https://azamov-backend.onrender.com`

> Bepul rejada server 15 daqiqa harakatsizlikdan keyin "uxlaydi";
> birinchi so'rov 30-50 soniya sekin bo'lishi mumkin.

### 2-qadam: Frontend — Netlify

1. [netlify.com](https://netlify.com) ga GitHub bilan kiring.
2. **Add new site → Import an existing project** → shu repo.
3. Sozlamalar:
   - **Base directory:** `client`
   - **Build command:** `npm run build`
   - **Publish directory:** `client/dist`
4. **Environment variables** bo'limiga qo'shing:
   - `VITE_API_URL` = `https://azamov-backend.onrender.com` (1-qadamdagi manzil)
5. **Deploy** ni bosing.

Tayyor — Netlify bergan manzilda ilova ishlaydi.

## Ishlab chiqarish uchun eslatma

- `server/src/config.js` dagi `SECRET` ni o'zgartiring (yoki `SECRET` env bering).
- Frontendni `npm run build` bilan yig'ib, statik fayllarni xizmat qiling.
- Bu o'quv loyihasi: xabarlar shifrlanmagan (E2E emas), rate-limiting yo'q.

## Litsenziya

Erkin foydalaning — o'quv maqsadida yaratilgan.
