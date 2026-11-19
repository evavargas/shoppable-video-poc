// Host control panel (PoC, no real auth). Built as its own file (host.js): nothing here ships in widget.js.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { collection, connectFirestoreEmulator, deleteDoc, doc, getFirestore, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { devHostToken, isValidHandle, LIVE_STATUSES, type HostStatus } from './logic';

const LIVE_ID = 'merece-live';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const say = (msg: string, bad = false) => {
  const el = $('msg');
  el.textContent = msg;
  el.dataset.bad = String(bad);
};

async function main() {
  const res = await fetch('/api/getEmbedConfig?id=merece-demo');
  const fb = (await res.json()).firebase as { projectId: string; apiKey?: string; emulatorHost?: string };
  const app = initializeApp({ projectId: fb.projectId, apiKey: fb.apiKey ?? 'poc' }, 'poc-host');
  const db = getFirestore(app);
  const local = Boolean(fb.emulatorHost);
  let canWrite = false;

  if (fb.emulatorHost) {
    const [host = '127.0.0.1', port] = fb.emulatorHost.split(':');
    connectFirestoreEmulator(db, host, Number(port));
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    try {
      await signInWithCustomToken(auth, devHostToken(fb.projectId));
      canWrite = true;
    } catch {
      canWrite = false;
    }
  }

  $('mode').textContent = canWrite
    ? 'Modo local: podés controlar el emulador.'
    : 'Solo lectura: en producción las escrituras están bloqueadas por las reglas de Firestore.';
  document.querySelectorAll<HTMLButtonElement>('[data-write]').forEach((b) => (b.disabled = !canWrite));
  void local;

  const liveRef = doc(db, 'lives', LIVE_ID);
  const write = (data: Record<string, unknown>, ok: string) =>
    updateDoc(liveRef, data).then(
      () => say(ok),
      (e) => say(`No se pudo guardar (${e?.code ?? 'error'}).`, true),
    );

  onSnapshot(liveRef, (s) => {
    const status = String(s.get('status') ?? 'ended') as HostStatus;
    $('status').textContent = LIVE_STATUSES.includes(status) ? status : 'ended';
    $('pinned').textContent = (s.get('pinnedProduct') as string | null) ?? '—';
  });

  $('go-live').onclick = () => write({ status: 'live' }, 'Live iniciado.');
  $('end-live').onclick = () => {
    if (confirm('¿Terminar el live? Los espectadores dejarán de verlo.')) void write({ status: 'ended' }, 'Live terminado.');
  };
  $('unpin').onclick = () => write({ pinnedProduct: null }, 'Producto desfijado.');
  $('pin-form').onsubmit = (e) => {
    e.preventDefault();
    const handle = $<HTMLSelectElement>('pin-handle').value;
    if (!isValidHandle(handle)) return say('Elegí un producto.', true);
    void write({ pinnedProduct: handle }, 'Producto fijado.');
  };

  fetch('/products.json')
    .then((r) => r.json())
    .then((d: { products: { handle: string; title: string }[] }) => {
      $('pin-handle').replaceChildren(...d.products.map((p) => new Option(p.title, p.handle)));
    })
    .catch(() => say('No se pudo cargar la lista de productos.', true));

  onSnapshot(query(collection(db, 'lives', LIVE_ID, 'messages'), orderBy('at', 'desc'), limit(30)), (snap) => {
    const list = $('chat');
    list.replaceChildren(
      ...snap.docs.map((d) => {
        const li = document.createElement('li');
        const txt = document.createElement('span');
        txt.textContent = `${d.get('name')}: ${d.get('text')}`; // textContent: chat is user input
        const del = document.createElement('button');
        del.className = 'btn btn-outline btn-sm';
        del.textContent = 'Borrar';
        del.disabled = !canWrite;
        del.onclick = () => deleteDoc(d.ref).then(() => say('Mensaje borrado.'), (e) => say(`No se pudo borrar (${e?.code ?? 'error'}).`, true));
        li.append(txt, del);
        return li;
      }),
    );
    if (snap.empty) list.textContent = 'Sin mensajes.';
  });
}

main().catch(() => say('No se pudo conectar con Firebase.', true));
