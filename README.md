# Hishab

Personal income and expense tracker with monthly and yearly totals and net balance.
Next.js + Firebase (Google sign-in, Firestore). Installable PWA that works offline.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill the 4 Firebase web app values.
3. `npm run dev`  (the service worker only runs in production: `npm run build && npm start`)

## Firebase setup
1. Console > Add project > Add app (Web) > copy the config values.
2. Authentication > Sign-in method > enable Google.
3. Firestore Database > Create database > Rules > paste `firestore.rules` > Publish.
4. Authentication > Settings > Authorized domains > add your Vercel domain.

## Deploy
Push to GitHub, import in Vercel, add the 4 `NEXT_PUBLIC_FIREBASE_*` variables, deploy.

## Install on Android
Open the Vercel URL in Chrome > menu > Install app. Open it once online, then it works offline.
Entries made offline sync automatically when the connection returns.
