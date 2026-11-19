import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import css from './widget.css?inline';
import type { Track } from './track';
import type { EmbedConfig, FirebaseSettings, LiveApi, Store } from './types';

export interface Deps {
  loadConfig: (id: string) => Promise<EmbedConfig>;
  store: Store;
  track: Track;
  fetchLiveStatus: (liveId: string) => Promise<string>;
  connectLive: (settings: FirebaseSettings) => Promise<LiveApi>;
}

export function mount(host: HTMLElement, { loadConfig, store, track, connectLive, fetchLiveStatus }: Deps) {
  // Shadow DOM: the store's CSS can't reach in, ours can't leak out.
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const root = document.createElement('div');
  shadow.append(style, root);

  const hide = () => {
    host.style.display = 'none';
  };

  createRoot(root).render(
    <ErrorBoundary onFail={hide}>
      <App
        layoutHint={(['stories', 'floating'] as const).find((l) => l === host.dataset.layout) ?? 'carousel'}
        onLayout={(l) => (host.dataset.layout = l)}
        fetchLiveStatus={fetchLiveStatus}
        embeddingId={host.dataset.embeddingId ?? ''} loadConfig={loadConfig} store={store} track={track} connectLive={connectLive} onFail={hide} />
    </ErrorBoundary>,
  );
}
