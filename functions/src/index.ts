import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { COUNTER, parseEvent } from './event';

// Same region as the Firestore database (São Paulo): every read stays on one continent.
setGlobalOptions({ region: 'southamerica-east1' });

initializeApp(); // picks up project + emulator settings from the environment
const db = getFirestore();

const ID_PATTERN = /^[\w-]{1,64}$/;

/**
 * GET /api/getEmbedConfig?id=home-carousel
 * Reads embeds/{id} from Firestore and returns it as JSON.
 * cors: true because the widget runs on the STORE's origin, not ours.
 */
export const getEmbedConfig = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const id = req.query.id;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }
  const snap = await db.collection('embeds').doc(id).get();
  if (!snap.exists) {
    res.status(404).json({ error: 'unknown embedding' });
    return;
  }
  // Browsers cache 1 min, the CDN 5 min: config changes show up fast enough, Firestore reads stay cheap.
  res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
  res.json({
    embeddingId: id,
    ...snap.data(),
    // Public settings the widget needs to open its own Firestore listeners (live chat and poll).
    firebase: {
      projectId: process.env.GCLOUD_PROJECT,
      apiKey: process.env.WEB_API_KEY, // a Firebase web API key is public by design; restrict it by referrer in the console
      emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
    },
  });
});

/**
 * POST /api/track  (body: JSON sent as text/plain by navigator.sendBeacon)
 * Stores the raw event and bumps the counters in stats/{embeddingId} in ONE batch, so they never disagree.
 */
export const track = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  let body: unknown;
  try {
    // text/plain avoids a CORS preflight, so we parse the raw bytes ourselves.
    body = JSON.parse(req.rawBody.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'invalid json' });
    return;
  }
  const event = parseEvent(body);
  if (!event) {
    res.status(400).json({ error: 'invalid event' });
    return;
  }

  const stats: Record<string, unknown> = { [COUNTER[event.type]]: FieldValue.increment(1) };
  if (event.type === 'add_to_cart') {
    stats.addToCartValue = FieldValue.increment(event.value ?? 0);
    stats.currency = event.currency; // PoC: assumes one currency per embedding
  }
  const batch = db.batch();
  batch.create(db.collection('events').doc(), { ...event, at: FieldValue.serverTimestamp() });
  batch.set(db.collection('stats').doc(event.embeddingId), stats, { merge: true });
  await batch.commit();
  res.status(204).send();
});

/** GET /api/stats?id=home-carousel -> the "revenue attributed to video" numbers. */
export const getStats = onRequest({ cors: true }, async (req, res) => {
  const id = req.query.id;
  if (req.method !== 'GET' || typeof id !== 'string' || !ID_PATTERN.test(id)) {
    res.status(400).json({ error: 'bad request' });
    return;
  }
  const s = (await db.collection('stats').doc(id).get()).data() ?? {};
  res.set('Cache-Control', 'no-store');
  res.json({
    embeddingId: id,
    views: s.views ?? 0,
    clicks: s.clicks ?? 0,
    addToCarts: s.addToCarts ?? 0,
    addToCartValue: s.addToCartValue ?? 0,
    currency: s.currency ?? null,
  });
});
