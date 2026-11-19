import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { COUNTER, parseEvent } from './event';
import { normalizeStatus } from './live';

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
  // Defaults first, then whatever counters the stats doc has: new event types show up without changing this function.
  res.json({ embeddingId: id, views: 0, clicks: 0, addToCarts: 0, addToCartValue: 0, currency: null, ...s });
});

/**
 * GET /api/liveStatus?id=bakery-live -> { status: "live" | "scheduled" | "ended" }
 * A tiny endpoint on purpose: the widget asks this BEFORE loading the Firebase SDK, so pages with no live running pay almost nothing.
 * Cached for 5 s at the browser and CDN: fresh enough for "is there a live now?", cheap under load.
 */
export const getLiveStatus = onRequest({ cors: true }, async (req, res) => {
  const id = req.query.id;
  if (req.method !== 'GET' || typeof id !== 'string' || !ID_PATTERN.test(id)) {
    res.status(400).json({ error: 'bad request' });
    return;
  }
  const snap = await db.collection('lives').doc(id).get();
  res.set('Cache-Control', 'public, max-age=5, s-maxage=5');
  res.json({ status: normalizeStatus(snap.data()?.status) });
});
