import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const TOKEN_KEY = 'hishab-fcm-token';
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const getMyToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};

// 'ios-install' | 'unsupported' | 'denied' | 'default' | 'granted'
export async function pushState() {
  if (typeof window === 'undefined') return 'unsupported';
  if (isIOS() && !isStandalone()) return 'ios-install';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported().catch(() => false))) {
    return 'unsupported';
  }
  return Notification.permission; // default | granted | denied
}

// Must be called from a tap (iOS requires a user gesture to ask for permission).
export async function enablePush(fb, user) {
  const state = await pushState();
  if (state === 'ios-install') throw new Error('Add Hishab to your Home Screen first, then open it from there.');
  if (state === 'unsupported') throw new Error('This browser cannot receive alerts.');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications were not allowed.');

  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(fb.app), {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error('Could not get a device token.');
  await setDoc(doc(fb.db, 'users', user.uid, 'devices', token), {
    token,
    platform: isIOS() ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'web',
    updatedAt: serverTimestamp(),
  });
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  return token;
}

// Asks the server to push a message to this user's devices.
export async function notify(user, { title, body, includeSelf = false }) {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ title, body, exceptToken: includeSelf ? '' : getMyToken() }),
  });
  if (!res.ok) throw new Error('Notification request failed');
  return res.json();
}