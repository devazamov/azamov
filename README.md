# AZAMOV — Messenjer

Real vaqtli chat ilovasi. **React + Firebase** asosida.
Server yo'q — Firebase butun backend'ni ta'minlaydi, shuning uchun
to'g'ridan-to'g'ri Netlify'ga joylashadi.

## Imkoniyatlar

- ✅ Email/parol bilan ro'yxatdan o'tish va kirish (Firebase Auth)
- ✅ Shaxsiy suhbatlar (1:1)
- ✅ Guruh chatlari
- ✅ Real vaqtli xabar (Firestore onSnapshot)
- ✅ Rasm va fayl yuborish (Firebase Storage)
- ✅ Onlayn holati va "yozmoqda..." indikatori
- ✅ Foydalanuvchi qidirish

## Texnologiyalar

| Qatlam     | Texnologiya |
|------------|-------------|
| Frontend   | React 18, Vite |
| Auth       | Firebase Authentication |
| Ma'lumotlar| Cloud Firestore (realtime) |
| Fayllar    | Firebase Storage |
| Hosting    | Netlify |

## Firebase sozlash (bir martalik)

1. [console.firebase.google.com](https://console.firebase.google.com) da loyiha yarating.
2. **Authentication → Sign-in method → Email/Password** ni yoqing.
3. **Firestore Database** yarating (production mode).
4. **Storage** ni yoqing.
5. **Project settings → Web app** dan config'ni oling.
6. Xavfsizlik qoidalarini joylang:
   - Firestore → Rules → `firestore.rules` mazmunini qo'ying → Publish
   - Storage → Rules → `storage.rules` mazmunini qo'ying → Publish

## Lokal ishga tushirish

```bash
cd client
npm install
cp .env.example .env      # .env ni Firebase config bilan to'ldiring
npm run dev               # http://localhost:5173
```

`.env` quyidagicha to'ldiriladi:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=azamov-xxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=azamov-xxxx
VITE_FIREBASE_STORAGE_BUCKET=azamov-xxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123...
VITE_FIREBASE_APP_ID=1:123...:web:abc...
```

## Netlify'ga joylash

1. [netlify.com](https://netlify.com) → **Add new site → Import an existing project** → GitHub repo.
2. Sozlamalar:
   - **Base directory:** `client`
   - **Build command:** `npm run build`
   - **Publish directory:** `client/dist`
3. **Environment variables** ga `.env` dagi barcha `VITE_FIREBASE_*` qiymatlarni qo'shing.
4. **Deploy**.

> Firebase Console → Authentication → Settings → **Authorized domains** ga
> Netlify manzilingizni (`xxxx.netlify.app`) qo'shishni unutmang.

## Loyiha tuzilmasi

```
client/src/
├── firebase.js     # Firebase init (env config)
├── chatStore.js    # Auth + Firestore + Storage mantiqi
├── App.jsx         # Asosiy holat, realtime listenerlar
├── Auth.jsx        # Kirish / ro'yxatdan o'tish
├── ChatView.jsx    # Chat oynasi
├── components.jsx  # Avatar, modal
├── Logo.jsx        # AZAMOV logosi
└── styles.css
```

## Ma'lumotlar modeli (Firestore)

```
users/{uid}                  # profil: username, displayName, avatarColor, lastActive
chats/{chatId}               # type, members[], memberInfo, lastMessage, typing
chats/{chatId}/messages/{id} # senderId, body, attachment, createdAt
```
