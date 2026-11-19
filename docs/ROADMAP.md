# Roadmap: what is done and what comes next

This file is the handover between work sessions. It says where the project stands, how to get running again, and the **designed but not yet built** plan for features 4 to 7, with decisions already taken and the open questions.
Last updated: 2026-11-19.

## 1. Where we are

| Step | Status | Notes |
|---|---|---|
| Base PoC (a to e): widget, Firestore config, Shopify cart, tracking, live chat + poll | Done and deployed | `terry-shop.web.app` |
| Part 1: bakery demo store, dashboard, isolation test, Pexels media, card/player polish, cart-count event | Done and deployed | |
| Feature 1: timed product hotspots (`hotspot_click`) | Done and deployed | |
| Feature 2: stories layout (`story_open`, progress bars) | Done and deployed | |
| Feature 3: floating live mini-player (`getLiveStatus`, `status` field) | Done and deployed | |
| Feature 4: live extras (viewer count, hearts, pinned product) | Done and deployed | Built as planned in section 4 (see the implementation notes there) |
| Feature 5: gamified discount / secret item | **Planned** (section 5), next to build | |
| Feature 6: upcoming live (countdown, "Remind me") | Outlined (section 6) | |
| Feature 7: host control page + auth model + rules | Outlined (section 7) | |
| Final deploy of features 5 to 7 and README screenshots for them | Pending | |

Numbers at the last check: widget **75.3 KB gzip** (`widget.js`), `live.js` 143.2 KB gzip (lazy), 73 widget tests + 35 function tests passing.

### Deploy status and checklist

Features 1 to 4 were deployed on 2026-11-19: new function `getLiveStatus`, new Firestore rules (viewers, reactions), the new demo files, and production data reseeded (`demo-bakery`, `demo-stories`, `demo-live`, `home-carousel`, `lives/bakery-live` with `status: "live"` and `pinnedProduct`). A smoke test of `https://terry-shop.web.app` showed the carousel with prices, 5 story avatars (104 px reserved), the floating mini-player and no console errors.

Repeat this for every later feature, and **confirm before running it** (it publishes to the internet and writes to the real database):

1. `npm run build -w widget && npm run build -w functions`
2. `npx firebase deploy --project terry-shop --force`
3. `GOOGLE_CLOUD_QUOTA_PROJECT=terry-shop node firebase/seed.mjs --project terry-shop --file firebase/prod-data.json` (it overwrites documents with the same ids)
4. Check `https://terry-shop.web.app/api/liveStatus?id=bakery-live`, the dashboard, and the store page.

Note: the dashboard counters in production also include events created by smoke tests.

## 2. How to get running again

```bash
npm install
npm run emulators        # builds widget + functions, starts Firestore, Functions, Hosting (needs Java)
npm run seed             # second terminal: loads sample embeddings and the live room
```

- Store: http://127.0.0.1:5002, dashboard: `/dashboard.html`, isolation test: `/isolation-test.html`, Emulator UI: http://127.0.0.1:4000
- Checks: `npm run typecheck -w widget && npm test -w widget && npm test -w functions`
- Flip a live on/off by hand: Emulator UI, Firestore, `lives/bakery-live`, field `status`.
- Hosting emulator caveat: it has no HTTP Range support, so seeking inside a video does not work locally (it does on real Hosting).

### Tools that were used outside the repo (not needed to run it)

- A local ffmpeg (npm `ffmpeg-static`) to trim and compress the Pexels videos and make posters.
- `puppeteer-core` driving the installed Google Chrome to take the README screenshots and to run end-to-end checks. Not committed. If you want that to be repeatable, add a small `scripts/` folder with the Puppeteer scripts (open question 3 below).

## 3. Rules that every new feature must follow

These are decisions taken earlier; keep them unless there is a reason.

- **Architecture stays:** Vite IIFE widget, Shadow DOM, Firestore config per embedding id, `sendBeacon` tracking, `live.js` loaded on demand, error boundary that hides the widget on failure.
- **Resilience:** a failing new feature must not break the carousel, the player or the store page. Hide the feature, never the host.
- **Size budget:** `widget.js` stays under **80 KB gzip**; anything that needs Firebase goes in `live.js`. Report sizes after each feature (`npm run build -w widget` prints them).
- **Cost awareness:** every real-time listener and every write has a price. State it in the code comment and the README (this is also a good interview topic).
- **Tracking:** every new interaction sends an event through the existing tracker, is validated by `parseEvent`, counted in `stats/{embeddingId}`, and shows on the dashboard automatically (`getStats` returns every counter).
- **Tests:** Vitest + Testing Library for new components, a pure function test for each new validator, CI must stay green.
- **Docs:** README gets a section, a row in the feature table, and screenshots. The explanation must be usable in an interview, in English.
- **Process:** one feature at a time, then stop so it can be tested locally. Deploy only at the end.

## 4. Feature 4: live extras (viewer count, heart reactions, pinned product)

> **Implemented.** The design below was followed. Differences and additions made while building it:
> - `LiveApi.watchStatus` became `watchLive` (status + `pinnedProduct`), used by both the mini-player and the live panel.
> - The viewers listener is capped at 100 documents (`orderBy lastSeen desc`, `limit(100)`) and the UI shows `100+` when full.
> - Hearts also have a 2 s safety-net timer to remove them when no CSS animation runs (background tab, jsdom).
> - The `reaction` event carries `count` (integer 1 to 50) and increments the `reactions` counter by that amount.
> - Seed data pins `weekend-pastry-box` on `bakery-live` (the Shopify dev-store embedding shares this live room, so its pinned card stays empty because that handle doesn't exist there).
> - Still missing from the plan: automated rules tests (now part of feature 7).

Goal: make a live feel alive, with three small real-time features on top of the existing chat and poll. All three live in `live.js` (Firestore) and in the live panel of the player.

### 4a. Viewer count

Decision: **heartbeat documents in Firestore**, counted on the client. Keep it simple, document the limits.

- **Data:** `lives/{liveId}/viewers/{sessionId}` with one field, `lastSeen` (server timestamp). `sessionId` is the same per-page-load id the tracker already uses (exported from `track.ts`).
- **Write:** when the player opens a live video, `setDoc(..., { lastSeen: serverTimestamp() })` immediately and every **30 s** while the player is open; best-effort `deleteDoc` on close.
- **Read:** one listener on the `viewers` collection. A viewer counts as "watching" if `lastSeen` is within the last **75 s** (2.5 heartbeats). A timer re-evaluates every 15 s because no document changes when someone silently leaves.
- **UI:** a pill "N watching" in the live panel (with `aria-live="off"`; do not announce every change). Show nothing when the count is unknown.
- **Rules:** `create, update` allowed only on a document whose id is a valid session id, with `keys().hasOnly(['lastSeen'])` and `lastSeen == request.time`; `delete` allowed on the same doc; `read` allowed.
- **Why not Realtime Database presence?** RTDB has `onDisconnect`, which is the correct tool, but it adds a second database and SDK. Explain this as the "at scale" answer.
- **Known cost (write it in the README):** each client listens to the whole collection, so one heartbeat triggers one read per connected viewer: cost grows as N². Fine for tens of viewers. At scale, a scheduled Cloud Function writes one `lives/{id}.viewerCount` every 10 s and clients listen to that single document. Also add a Firestore TTL policy on an `expireAt` field to delete stale viewer documents.
- **Tests:** counting window logic as a pure function (`countActive(docs, now)`), heartbeat starts and stops with the player (fake timers), listener unsubscribes on close.

### 4b. Heart reactions that float up

- **Data:** `lives/{liveId}/reactions/{auto}` with `{ type: 'heart', count, sessionId, at }`.
- **Client write is batched:** taps are counted locally and flushed **at most once per second** as one document with `count` (1 to 20). Never one write per tap. Each tap also animates a heart immediately (optimistic), so the sender does not wait.
- **Client read:** a listener ordered by `at desc`, `limit(20)`; use `docChanges()` and animate only documents of type `added` that arrive **after** the listener's first snapshot (ignore history), skipping the sender's own `sessionId` (already animated locally). For a doc with `count: n`, spawn `min(n, 8)` hearts with random horizontal offsets.
- **Animation:** CSS only (`transform` + `opacity`, 1.6 s, removed on `animationend`), a cap of 30 hearts on screen, and **no hearts at all under `prefers-reduced-motion`** (show a small counter bump instead).
- **UI:** a heart button next to the chat input (44 px target, `aria-label="Send a heart"`).
- **Rules:** `create` only, `keys().hasOnly(['type','count','sessionId','at'])`, `type == 'heart'`, `count` int between 1 and 20, `at == request.time`.
- **Tracking:** new event `reaction` with an optional `count`; `parseEvent` accepts `count` as an integer 1 to 50 (only for `reaction`); counter `reactions` increases by `count`. One event per flushed batch, not per tap.
- **Tests:** batching (many taps in 1 s give one write), cap on visible hearts, own hearts not duplicated, reduced motion path, rules by hand in the emulator (see open question 2).

### 4c. Pinned product

- **Data:** `lives/{liveId}.pinnedProduct` = a product handle or `null`. The host changes it (Emulator UI for now, `/host.html` in feature 7).
- **Client:** extend `LiveApi.watchStatus` into `watchLive(liveId, cb)` that delivers `{ status, pinnedProduct, drop?, startsAt? }` from the **same** document listener the mini-player already opens (one listener, not three). The player shows a "Pinned by the host" card above the normal product list, using `store.getProduct(handle)` (memoized store) and the existing `ProductCard`.
- **Behavior:** when the pin changes, the card swaps with a short highlight animation (disabled under reduced motion) and announces politely (`role="status"`: "The host pinned: <title>"). Unpinning removes it. An unknown handle or a failed product fetch shows nothing (never an error box).
- **Validation:** the handle must match `^[\w-]{1,255}$` before it is used in a URL (same rule as events).
- **Add to cart** from the pinned card sends the usual `add_to_cart` event, with the video id of the video being watched.
- **Tests:** pin appears/changes/disappears with a fake `LiveApi`, invalid handle ignored, add to cart from pinned card tracked.

### 4 acceptance criteria

- Two browser tabs on the same live: counts go from 1 to 2 watching, and drop back after closing one (within about 75 s).
- Tapping hearts in tab A floats hearts in tab B; hammering the button never produces more than 1 write per second per viewer.
- Changing `pinnedProduct` in the Emulator UI updates the pinned card in both tabs without a reload.
- `live.js` stays the only place that imports Firebase; `widget.js` growth is under 2 KB gzip.

## 5. Feature 5: gamified discount / secret item

Goal: the host "drops" something during the live; viewers see a timed reveal with a countdown and can claim it. The code is fake (we do not integrate Shopify discounts), but the flow, the timing and the tracking are real.

### Data model

`lives/{liveId}.drop` (a map, or `null`):

```json
{
  "id": "drop-2026-11-19-1",
  "type": "coupon",
  "title": "20% off the pastry box",
  "percent": 20,
  "handle": "weekend-pastry-box",
  "code": "LIVE20",
  "expiresAt": "<timestamp>",
  "maxClaims": 50
}
```

- `type: "coupon"` shows a code to copy. `type: "secret_item"` unlocks a hidden product (`handle` that appears in no carousel) as an extra card in the player.
- `id` must change for every new drop, so a viewer who claimed an earlier drop can claim the next one.
- The host writes the whole map in one update, so viewers never see a half-written drop.

### Client behavior

- **Reveal card:** appears over the live panel when a `drop` arrives whose `expiresAt` is in the future, with a countdown ("Claim in 00:42"), a **Claim** button and a dismiss. It must not steal focus; announce politely once when it appears.
- **Countdown without clock skew:** the viewer's clock can be wrong by minutes. Estimate the offset once from the `Date` response header of `liveStatus` (`offset = serverNow - Date.now()`), then count down to `expiresAt - (Date.now() + offset)`. Render with `requestAnimationFrame` at most 1 update per second; stop at 0 and change the card to "Expired".
- **Claim:** sends `coupon_claim` (with `dropId` and, if present, `productHandle`), marks the drop as claimed in `sessionStorage` (`poc-claimed:<dropId>`), and reveals the code with a **Copy** button (`navigator.clipboard`, falling back to selecting the text). For `secret_item`, the hidden product card is added to the player's product list and can be added to the cart normally.
- **Limit the claims honestly:** `maxClaims` is only a display hint in the PoC ("N left" would need a server counter). Write that down.
- **Reduced motion:** no shake or confetti; use a plain color change.
- **Fake discount note (README):** a real discount needs a Shopify discount code applied through `/discount/CODE` or at checkout, or a Shopify Function. Nothing here changes a price.

### Tracking and stats

- New event `coupon_claim`: fields `dropId` (id pattern), optional `productHandle`; counter `couponClaims`; one per viewer per drop (the client dedupes with the session flag).
- `parseEvent` gets a `dropId` field validated with the same id pattern as `videoId`; unknown fields stay dropped.
- Dashboard: `couponClaims` appears automatically.

### Rules and security

- Clients can **read** `lives/{liveId}` already. They cannot write it (host only, feature 7). A viewer who edits the DOM can show themselves a code; that is accepted because the code is fake. Say so.

### Tests

- Pure function `remainingSeconds(expiresAt, now, offset)`, with skew cases.
- Card appears, counts down (fake timers), expires, claim tracked once, code revealed, copy button, secret item added to the product list, drop replaced by a new id re-enables claiming, reduced motion path.

### 5 acceptance criteria

- Writing `drop` in the Emulator UI shows the card in every open tab within about a second; after `expiresAt` it shows "Expired".
- Claiming twice in the same session sends only one `coupon_claim`.
- A viewer with a wrong system clock still sees the right countdown (test by changing the OS clock or simulating the offset).

## 6. Feature 6: upcoming live (outlined)

- `lives/{liveId}.status = "scheduled"` plus `startsAt` (timestamp, written by the host).
- `getLiveStatus` also returns `startsAt` for scheduled lives (the status is already normalized to `live | scheduled | ended`).
- In the floating layout, a "Live starts in 00:12:30" card with a **Remind me** button. The button sets a `localStorage` flag per live and sends `remind_me` (no email, no push; say that clearly). When the host switches the status to `live`, the card becomes the normal mini-player in real time (the same `watchLive` listener).
- Countdown uses the same clock-offset helper as feature 5; the card text updates once per second, and screen readers only get a polite announcement at 10 min, 1 min and at start.
- New event `remind_me`, counter `reminders`.
- Tests: card only when `scheduled`, countdown, remind flag and event, transition to live, expired `startsAt` without the host going live (shows "Starting soon", never negative time).

## 7. Feature 7: host control page and the auth model (outlined)

Goal: a tiny `/host.html`, clearly labeled **"PoC only, no real authentication"**, to run a live without the Emulator UI.

- **Controls:** start / end the live (`status`), schedule (`startsAt`), pin a product, drop a coupon or secret item, and moderate chat (delete messages).
- **Data access:** the page uses the Firebase client SDK against Firestore (same project as the widget).
- **Rules, the important design:** writes to `lives/{liveId}` (fields `status`, `startsAt`, `pinnedProduct`, `drop`) and `delete` on `messages` require `request.auth.token.host == true`.
  - In the **emulator**, the host page signs in with the Auth emulator using an **unsigned custom token** with the claim `host: true`. The Auth emulator accepts that; **production would reject it**. So the host page genuinely works only locally, which is the point.
  - **Real auth, to explain in the README:** Firebase Authentication (Google sign-in or email link) for the merchant team, and a **custom claim** `host: true` set by a trusted server with the Admin SDK (or checked against an allow-list document). Rules then trust the signed claim. Sensitive host actions that need server logic (for example creating a real Shopify discount) go through a Cloud Function that checks the same claim.
- **Moderation rule:** `delete` on `lives/{id}/messages/{id}` only for the host. Viewers still cannot update or delete anything.
- **Tests:** add `@firebase/rules-unit-testing` and write real rules tests (viewer cannot write `status`, host can, viewer can create a valid chat message and cannot create an oversized one, vote create-only, reactions shape, viewers heartbeat shape). This also closes the old gap "rules are only probed by hand".
- **Page UX:** one column, large buttons, shows the current state (status, pinned, active drop, viewer count) from the same live listener, and a destructive-action confirmation for "end live".

## 8. Cross-cutting work (do it with the features)

| Area | What changes |
|---|---|
| `functions/src/event.ts` | add `reaction` (+ `count`), `coupon_claim` (+ `dropId`), `remind_me`; extend tests; extend `COUNTER` (`reactions`, `couponClaims`, `reminders`) |
| `LiveApi` (`types.ts`, `live/live.ts`) | `watchLive` replaces `watchStatus` (one listener, richer payload), `heartbeat`, `watchViewers`, `sendReaction`, `watchReactions` |
| `firebase/firestore.rules` | viewers, reactions, host writes, message delete (see sections 4 and 7) |
| Seed data | `pinnedProduct`, an example `drop`, a `scheduled` live for the demo, hidden `secret_item` product JSON in `widget/public/products/` |
| Dashboard | nothing to change for new counters; maybe group "live" counters visually |
| README | new sections, feature table rows, screenshots (floating hearts, pinned card, reveal card, upcoming card, host page), trade-offs and cost notes |

## 9. Known issues and loose ends (not tied to a feature)

- **Dependabot:** 6 development-only alerts (`@grpc/grpc-js`, `glob`, `minimatch`, `uuid`, `@opentelemetry/core`) via Firebase tooling. Try `npm audit` and `npm update`, and re-run CI.
- **GitHub Actions:** `actions/checkout@v4` and `actions/setup-node@v4` warn about Node 20 deprecation; bump to the current major versions.
- **`track` is public and unthrottled:** accepts any embedding id. At scale: Pub/Sub in front, rate limits, App Check, signed embedding ids (already in the README's scale section).
- **Pexels media in a public repo:** the license allows free use and modification but forbids redistribution on stock platforms. The files are trimmed and re-encoded and credited. If you prefer zero doubt, keep them out of git and only deploy them to Hosting.
- **Real-device check:** swipe, tap targets and the native video controls were only tested with mobile emulation. Try an actual phone.
- **Accessibility audit:** run axe on the store page, the player and the mini-player; test with VoiceOver.
- **Performance measurement:** run Lighthouse / WebPageTest on the demo store to get real LCP and CLS numbers for the README (the layout-shift reasoning is documented, but not yet measured).
- **Real Shopify store:** `home-carousel` points at the three real products of the dev store; re-check it after the deploy, with the storefront password in your own browser.
- **Open Graph / SEO of the demo page:** not needed for the PoC.

## 10. Open questions to decide before building

1. **Viewer count:** heartbeat documents (planned, simple, N² read cost) or Realtime Database presence (more correct, second database)? Planned answer: heartbeat for the PoC, RTDB in the "at scale" notes.
2. **Rules tests:** build them in feature 7 (planned) or earlier, with feature 4's rules?
3. **Scripts:** commit the Puppeteer end-to-end and screenshot scripts into the repo (`scripts/e2e/`)? They are useful as a smoke test but add a dev dependency.
4. **Language of the docs:** the repo is in English because the interview is in English. A Spanish copy of the README or this roadmap could be added for studying.
5. **Demo content:** replace the sample Pexels clips by your own videos, and decide whether the Shopify dev store should keep sharing the `bakery-live` room.

## 11. Prompt to resume the work

Paste this at the start of the next session:

> Context: repo `evavargas/shoppable-video-poc`. Read `README.md` and `docs/ROADMAP.md` first. Features 1 to 4 are built and pushed but not deployed. Implement **feature 5** exactly as planned in section 5 of the roadmap, stopping afterwards so I can test it locally. Follow section 3 (rules), add tests, keep CI green, update the README, report the new gzip sizes, and explain new concepts in simple words (I need to explain them in English in an interview). Do not deploy until I say so.
