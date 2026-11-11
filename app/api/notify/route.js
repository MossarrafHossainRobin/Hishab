import { NextResponse } from 'next/server';
import { adminAuth, adminDb, adminMessaging } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

const DEAD = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export async function POST(req) {
  const header = req.headers.get('authorization') || '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: 'Missing token' }, { status: 401 });

  let uid;
  try {
    uid = (await adminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { title = 'Hishab', body = '', exceptToken = '' } = await req.json().catch(() => ({}));

  // Only the signed-in user's own devices are ever targeted.
  const snap = await adminDb().collection(`users/${uid}/devices`).get();
  const tokens = snap.docs.map((d) => d.id).filter((t) => t !== exceptToken);
  if (!tokens.length) return NextResponse.json({ sent: 0 });

  const res = await adminMessaging().sendEachForMulticast({
    tokens,
    data: { title: String(title).slice(0, 80), body: String(body).slice(0, 200), url: '/' },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
  });

  // Remove tokens that are no longer valid (app uninstalled, permission revoked).
  await Promise.all(
    res.responses.map((r, i) =>
      !r.success && DEAD.has(r.error?.code)
        ? adminDb().doc(`users/${uid}/devices/${tokens[i]}`).delete()
        : null
    )
  );

  return NextResponse.json({ sent: res.successCount, failed: res.failureCount });
}