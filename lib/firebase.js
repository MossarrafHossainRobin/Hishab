import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cached = null;

// Browser only. Firestore's persistent cache keeps data on the device,
// so reads and writes keep working offline and sync when the network returns.
export function getFirebase() {
  if (typeof window === 'undefined' || !config.apiKey) return null;
  if (cached) return cached;
  const app = getApps().length ? getApp() : initializeApp(config);
  let db;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app);
  }
  cached = { auth: getAuth(app), db, provider: new GoogleAuthProvider() };
  return cached;
}
