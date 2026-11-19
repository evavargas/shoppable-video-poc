// Merece demo store: the MERCHANT's side of the page (theme, cart, product grid, dialogs).
// None of this is part of the widget. The widget talks to it only through the `poc:cart-add` event and CSS variables.
(() => {
  'use strict';

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (cents) => new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(cents / 100);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CUP = '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M30 14 C26 22 34 26 30 34"/><path d="M48 10 C44 20 54 24 48 34"/><path d="M66 14 C62 22 70 26 66 34"/><path d="M18 44 L78 44 L74 74 C73 82 66 88 58 88 L38 88 C30 88 23 82 22 74 Z"/><path d="M78 52 C92 52 92 72 76 72"/></svg>';

  // Delivery zones and the fee of the day (from the Merece site; one source for the zones section and the cart)
  const ZONES = [
    { id: 'parque-rodo', name: 'Parque Rodó', fee: 5000, color: '#b9a5d6' },
    { id: 'pocitos', name: 'Pocitos', fee: 5000, color: '#f0ae86' },
    { id: 'punta-carretas', name: 'Punta Carretas', fee: 7500, color: '#b9a5d6' },
    { id: 'palermo', name: 'Palermo', fee: 10000, color: '#f0ae86' },
    { id: 'barrio-sur', name: 'Barrio Sur', fee: 11000, color: '#b9a5d6' },
    { id: 'centro', name: 'Centro', fee: 12500, color: '#f0ae86' },
    { id: 'cordon', name: 'Cordón', fee: 14000, color: '#b9a5d6' },
    { id: 'tres-cruces', name: 'Tres Cruces', fee: 15000, color: '#f0ae86' },
  ];

  const SECTIONS = [
    { type: 'combos', title: 'Combos', tone: 'accent' },
    { type: 'postres', title: 'Deli merecidos', tone: 'accent', note: 'Hechos hoy, listos para llevar.' },
    { type: 'bebidas', title: '¿Sin bebida para acompañar el postre?', tone: 'accent', hand: true },
    { type: 'tortas', title: 'Vos pedí y te lo preparamos', tone: 'highlight', note: '48 hs de anticipación', big: true },
  ];

  // ---------- Theme (light by default; the toggle remembers; the system preference is NOT forced, like on Merece) ----------
  const THEME_KEY = 'merece-demo-theme';
  function setTheme(theme, persist = true) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    $$('[data-theme-toggle]').forEach((b) => {
      b.setAttribute('aria-pressed', String(theme === 'dark'));
      b.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
      b.title = theme === 'dark' ? 'Tema claro' : 'Tema oscuro';
      b.innerHTML = theme === 'dark'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z"/></svg>';
    });
    if (persist) try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage blocked: the toggle still works for this visit */ }
  }
  setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light', false);
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')));

  // ---------- Wordmark (letters with a slight tilt, like the logo) ----------
  $$('[data-wordmark]').forEach((el) => {
    el.classList.add('wordmark');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Merece');
    el.innerHTML = [...'Merece'].map((c) => `<span aria-hidden="true">${c}</span>`).join('');
  });
  $$('[data-cup]').forEach((el) => (el.innerHTML = CUP));

  // ---------- Neon signs: lit when on screen, still when the user prefers less motion ----------
  $$('[data-neon]').forEach((el) => {
    const text = el.dataset.neon;
    el.setAttribute('aria-hidden', 'true'); // the real heading is a separate .sr-only element
    el.classList.add('neon');
    el.dataset.tone = el.dataset.tone || 'highlight';
    el.innerHTML = text.split(' ').map((w) => `<span style="display:inline-block;white-space:nowrap">${[...w].map((c) => `<span class="neon-letter">${esc(c)}</span>`).join('')}</span>`).join(' ');
    if (reduceMotion) return el.setAttribute('data-lit', 'true');
    new IntersectionObserver(([e]) => el.setAttribute('data-lit', String(e.isIntersecting)), { threshold: 0.6 }).observe(el);
  });

  // ---------- Toast ----------
  const toast = $('#toast');
  let toastTimer;
  function say(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // ---------- Cart (same data shape as Shopify's /cart.js, kept in localStorage) ----------
  const CART_KEY = 'merece-demo-cart';
  const cart = { items: [], fulfilment: 'retiro', zone: '' };
  try { Object.assign(cart, JSON.parse(localStorage.getItem(CART_KEY) || '{}')); } catch { /* corrupted: start empty */ }
  if (!Array.isArray(cart.items)) cart.items = [];
  const save = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ignore */ } };
  const count = () => cart.items.reduce((n, l) => n + l.quantity, 0);
  const subtotal = () => cart.items.reduce((n, l) => n + l.price * l.quantity, 0);
  const zone = () => ZONES.find((z) => z.id === cart.zone);
  const shipping = () => (cart.fulfilment === 'envio' ? zone()?.fee ?? null : 0);

  function addLine(line) {
    const key = `${line.variant_id}`;
    const found = cart.items.find((l) => l.key === key);
    if (found) found.quantity += line.quantity ?? 1;
    else cart.items.push({ ...line, key, quantity: line.quantity ?? 1 });
    save();
    render();
    bump();
  }

  const badges = $$('[data-cart-count]');
  function bump() {
    badges.forEach((b) => { b.classList.add('bump'); setTimeout(() => b.classList.remove('bump'), 220); });
  }

  // The widget announces what it added; the store turns that into a cart line (a real theme would call /cart.js or the Section Rendering API).
  window.addEventListener('poc:cart-add', (e) => {
    const d = e.detail || {};
    if (!d.variantId) return;
    addLine({
      variant_id: d.variantId, handle: d.handle, title: d.title, variant_title: d.variantTitle || '', price: Math.round(d.price * 100), image: d.image || '',
      advance: (products.find((p) => p.handle === d.handle)?.tags || []).some((t) => t.startsWith('anticipacion')),
    });
    say(`${d.title} agregado al carrito`);
  });

  // ---------- Products ----------
  let products = [];
  const sectionOf = (type) => SECTIONS.find((s) => s.type === type);

  function photo(p) {
    return p.featured_image
      ? `<img src="${esc(p.featured_image)}" alt="${esc(p.title)}" loading="lazy" width="800" height="600">`
      : `<div class="placeholder" role="img" aria-label="${esc(p.title)}">${CUP}</div>`;
  }

  function productCard(p) {
    const soldOut = !p.available;
    const advance = p.tags.some((t) => t.startsWith('anticipacion'));
    const hasOptions = p.variants.length > 1;
    return `<li class="product${soldOut ? ' sold-out' : ''}">
      <div class="photo">${photo(p)}${advance ? '<span class="tag">A pedido</span>' : ''}</div>
      <div class="body">
        <div class="top"><h3>${esc(p.title)}</h3><span class="price">${hasOptions ? 'desde ' : ''}${money(p.price)}</span></div>
        <p class="desc">${esc(p.description)}</p>
        ${advance ? '<p class="meta">24 h no alcanzan: pedila con 48 hs</p>' : ''}
        <div class="pick"><button class="btn btn-sm" type="button" data-pick="${esc(p.handle)}" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Sin stock por hoy' : 'Elegir'}</button></div>
      </div>
    </li>`;
  }

  function renderMenu() {
    const host = $('#carta-lista');
    host.innerHTML = SECTIONS.map((s) => {
      const items = products.filter((p) => p.product_type === s.type);
      const cls = `neon-sign${s.hand ? '' : ' display'}${s.big ? '' : ' small'}`;
      return `<section aria-labelledby="h-${s.type}">
        <div class="section-head"><h2 id="h-${s.type}" class="sr-only">${esc(s.title)}</h2><span class="${cls}" data-neon="${esc(s.title)}" data-tone="${s.tone}"></span></div>
        ${s.note ? `<p class="section-note">${esc(s.note)}</p>` : ''}
        <ul class="grid">${items.map(productCard).join('')}</ul>
      </section>`;
    }).join('');
    // neon signs were injected after load: run the builder on the new nodes
    $$('[data-neon]', host).forEach((el) => {
      const text = el.dataset.neon;
      el.setAttribute('aria-hidden', 'true');
      el.classList.add('neon');
      el.innerHTML = text.split(' ').map((w) => `<span style="display:inline-block;white-space:nowrap">${[...w].map((c) => `<span class="neon-letter">${esc(c)}</span>`).join('')}</span>`).join(' ');
      if (reduceMotion) return el.setAttribute('data-lit', 'true');
      new IntersectionObserver(([e]) => el.setAttribute('data-lit', String(e.isIntersecting)), { threshold: 0.6 }).observe(el);
    });
  }

  // ---------- Option dialog (Shopify variants: every option combination is one variant) ----------
  const optDialog = $('#opts');
  let picking = null;

  function openOptions(handle) {
    const p = products.find((x) => x.handle === handle);
    if (!p) return;
    const advance = p.tags.some((t) => t.startsWith('anticipacion'));
    const multi = p.variants.length > 1;
    if (!multi && !advance) {
      const v = p.variants[0];
      addLine({ variant_id: v.id, handle: p.handle, title: p.title, variant_title: '', price: v.price, image: p.featured_image || '', advance: false });
      say(`${p.title} agregado al carrito`);
      return;
    }
    picking = { p, chosen: p.options.map((o) => o.values[0]) };
    $('#opts-title').textContent = p.title;
    $('#opts-kicker').textContent = advance ? 'Torta a pedido' : 'Armá tu pedido';
    $('#opts-fields').innerHTML = (multi ? p.options : []).map((o, i) => `<fieldset class="fieldset"><legend>${esc(o.name)}</legend><div class="chips">${o.values.map((v, j) => `<label class="chip"><input type="radio" name="opt-${i}" value="${esc(v)}" ${j === 0 ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div></fieldset>`).join('');
    const ack = $('#opts-ack');
    ack.hidden = !advance;
    ack.querySelector('input').checked = false;
    updatePick();
    optDialog.showModal();
  }

  function currentVariant() {
    const { p, chosen } = picking;
    return p.variants.length > 1 ? p.variants.find((v) => [v.option1, v.option2, v.option3].filter(Boolean).every((o, i) => o === chosen[i])) : p.variants[0];
  }

  function updatePick() {
    const v = currentVariant();
    $('#opts-price').textContent = money(v.price);
    const advance = picking.p.tags.some((t) => t.startsWith('anticipacion'));
    $('#opts-add').disabled = !v.available || (advance && !$('#opts-ack input').checked);
  }

  optDialog.addEventListener('change', (e) => {
    if (e.target.name?.startsWith('opt-')) picking.chosen[Number(e.target.name.slice(4))] = e.target.value;
    updatePick();
  });
  $('#opts-add').addEventListener('click', () => {
    const { p } = picking;
    const v = currentVariant();
    addLine({ variant_id: v.id, handle: p.handle, title: p.title, variant_title: p.variants.length > 1 ? v.title : '', price: v.price, image: p.featured_image || '', advance: p.tags.some((t) => t.startsWith('anticipacion')) });
    optDialog.close();
    say(`${p.title} agregado al carrito`);
  });
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); })); // click on the backdrop

  document.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) openOptions(pick.dataset.pick);
  });

  // ---------- Cart drawer ----------
  const drawer = $('#cart');
  $$('[data-open-cart]').forEach((b) => b.addEventListener('click', () => { render(); drawer.showModal(); }));

  function render() {
    badges.forEach((b) => { b.textContent = count(); b.dataset.zero = String(count() === 0); });
    if (!drawer) return;
    const lines = $('#cart-lines');
    if (cart.items.length === 0) {
      lines.innerHTML = '<li class="empty">Tu pedido está vacío.<br>Elegí algo rico de la carta o mirá los videos.</li>';
    } else {
      lines.innerHTML = cart.items.map((l) => `<li class="line">
        ${l.image ? `<img src="${esc(l.image)}" alt="" width="64" height="64">` : '<div class="ph" aria-hidden="true"></div>'}
        <div>
          <h3>${esc(l.title)}</h3>
          ${l.variant_title ? `<p class="opts">${esc(l.variant_title)}</p>` : ''}
          ${l.advance ? '<p class="opts">Torta a pedido · 48 hs</p>' : ''}
          <div class="controls">
            <div class="qty" role="group" aria-label="Cantidad de ${esc(l.title)}">
              <button type="button" data-qty="${esc(l.key)}" data-d="-1" aria-label="Quitar una unidad">−</button>
              <output aria-live="polite">${l.quantity}</output>
              <button type="button" data-qty="${esc(l.key)}" data-d="1" aria-label="Agregar una unidad">+</button>
            </div>
            <strong>${money(l.price * l.quantity)}</strong>
          </div>
          <button class="link-btn" type="button" data-remove="${esc(l.key)}">Quitar</button>
        </div>
      </li>`).join('');
    }
    $('#fulfil-retiro').checked = cart.fulfilment === 'retiro';
    $('#fulfil-envio').checked = cart.fulfilment === 'envio';
    const sel = $('#cart-zone');
    sel.hidden = cart.fulfilment !== 'envio';
    sel.value = cart.zone;
    const ship = shipping();
    $('#sum-sub').textContent = money(subtotal());
    $('#sum-ship').textContent = cart.fulfilment === 'retiro' ? 'Retiro · sin costo' : ship === null ? 'Elegí una zona' : money(ship);
    $('#sum-total').textContent = ship === null ? money(subtotal()) : money(subtotal() + ship);
    $('#sum-total-label').textContent = ship === null ? 'Subtotal' : 'Total estimado';
    $('#cart-advance').hidden = !cart.items.some((l) => l.advance);
    $('#cart-send').disabled = cart.items.length === 0 || (cart.fulfilment === 'envio' && ship === null);
  }

  $('#cart-zone').innerHTML = '<option value="">Elegí tu zona…</option>' + ZONES.map((z) => `<option value="${z.id}">${esc(z.name)} · ${money(z.fee)}</option>`).join('');
  drawer.addEventListener('click', (e) => {
    const q = e.target.closest('[data-qty]');
    const r = e.target.closest('[data-remove]');
    if (q) {
      const l = cart.items.find((x) => x.key === q.dataset.qty);
      l.quantity += Number(q.dataset.d);
      if (l.quantity <= 0) cart.items = cart.items.filter((x) => x !== l);
    } else if (r) cart.items = cart.items.filter((x) => x.key !== r.dataset.remove);
    else if (e.target.id === 'cart-clear') cart.items = [];
    else return;
    save();
    render();
  });
  drawer.addEventListener('change', (e) => {
    if (e.target.name === 'fulfilment') cart.fulfilment = e.target.value;
    if (e.target.id === 'cart-zone') cart.zone = e.target.value;
    save();
    render();
  });

  // The real Merece flow ends in a WhatsApp message. The demo shows the message instead of sending it.
  function orderMessage() {
    const rows = cart.items.map((l) => `${l.quantity} × ${l.title} (${money(l.price)})${l.variant_title ? ` · ${l.variant_title}` : ''}${l.advance ? ' · torta a pedido, +48 hs' : ''}`);
    const z = zone();
    const lines = ['Hola Merece! Quiero hacer un pedido.', ...rows, '', `Subtotal ${money(subtotal())}`];
    if (cart.fulfilment === 'envio' && z) lines.push(`Envío a ${z.name}: ~${money(z.fee)} (estimado)`, `Total estimado ${money(subtotal() + z.fee)}`);
    else lines.push('Retiro: a coordinar · sin costo', `Total estimado ${money(subtotal())}`);
    lines.push('Pago por transferencia.');
    return lines.join('\n');
  }
  $('#cart-send').addEventListener('click', () => {
    $('#order-text').textContent = orderMessage();
    $('#order').showModal();
  });
  $('#order-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#order-text').textContent); say('Mensaje copiado'); } catch { say('No se pudo copiar'); }
  });
  $('#order-done').addEventListener('click', () => { cart.items = []; save(); render(); $('#order').close(); drawer.close(); say('Pedido de demostración enviado'); });

  // ---------- Zones section ----------
  $('#zone-list').innerHTML = ZONES.map((z) => `<li><button class="zone" type="button" data-zone="${z.id}" aria-pressed="false"><span><i class="dot" style="background:${z.color}" aria-hidden="true"></i><b>${esc(z.name)}</b></span><span>${money(z.fee)}</span></button></li>`).join('');
  $('#zone-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-zone]');
    if (!b) return;
    $$('#zone-list .zone').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const z = ZONES.find((x) => x.id === b.dataset.zone);
    cart.zone = z.id;
    save();
    $('#zone-result').textContent = `Envío a ${z.name}: ${money(z.fee)}. Se suma al total de tu pedido.`;
    render();
  });

  // ---------- Boot ----------
  render();
  fetch('/products.json')
    .then((r) => r.json())
    .then((d) => { products = d.products; renderMenu(); render(); })
    .catch(() => { $('#carta-lista').innerHTML = '<p class="section-note">No pudimos cargar la carta. Probá de nuevo en un rato.</p>'; });
})();
