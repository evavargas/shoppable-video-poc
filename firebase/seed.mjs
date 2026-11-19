// Loads a seed file into Firestore: embeds/{id} (config) and lives/{id} (poll definition + a welcome message).
//
//   Emulator:    FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node firebase/seed.mjs            (uses seed-data.json)
//   Production:  GOOGLE_CLOUD_QUOTA_PROJECT=terry-shop node firebase/seed.mjs --project terry-shop --file firebase/prod-data.json
//   Add --dry to print what would be written without writing anything.
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const dry = process.argv.includes('--dry');
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const project = emulator ? 'demo-terry-poc' : arg('--project');
const file = arg('--file') ?? new URL('./seed-data.json', import.meta.url).pathname;

if (!emulator && !project) {
  console.error('Refusing to run: set FIRESTORE_EMULATOR_HOST, or pass --project <id> to write to a real project.');
  process.exit(1);
}
const data = JSON.parse(readFileSync(file, 'utf8'));
console.log(`${dry ? 'DRY RUN: ' : ''}${emulator ? 'emulator' : 'PRODUCTION'} project=${project} file=${file}`);

const db = dry ? null : (initializeApp({ projectId: project }), getFirestore());
for (const [id, doc] of Object.entries(data.embeds)) {
  console.log(`embeds/${id}:`, JSON.stringify(doc));
  await db?.collection('embeds').doc(id).set(doc);
}
for (const [id, doc] of Object.entries(data.lives)) {
  console.log(`lives/${id}:`, JSON.stringify(doc));
  const { welcome, ...liveDoc } = doc; // `welcome` is seed-only: the first chat message, in the language of the live
  await db?.collection('lives').doc(id).set(liveDoc);
  // fixed id: re-running the script does not duplicate the welcome message
  await db?.collection('lives').doc(id).collection('messages').doc('welcome').set({ name: welcome?.name ?? 'Host', text: welcome?.text ?? 'Welcome! Ask us anything.', at: Timestamp.now() });
}
console.log(dry ? 'Nothing written.' : 'Done.');
