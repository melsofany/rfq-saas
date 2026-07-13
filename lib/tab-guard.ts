'use client';

// ─── Tab Guard ────────────────────────────────────────────────────────────────
// Enforces a single active browser tab per session.
// Uses localStorage heartbeat + BroadcastChannel for instant communication.

const HEARTBEAT_KEY = 'qotix_tab_heartbeat';
const HEARTBEAT_INTERVAL_MS = 3_000;   // update heartbeat every 3 s
const HEARTBEAT_TIMEOUT_MS  = 9_000;   // tab is "dead" after 9 s of no heartbeat
const CHANNEL_NAME = 'qotix_tab_channel';

// Unique ID for this tab (sessionStorage → not shared between tabs)
function getTabId(): string {
  if (typeof sessionStorage === 'undefined') return 'ssr';
  let id = sessionStorage.getItem('qotix_tab_id');
  if (!id) {
    id = Math.random().toString(36).slice(2) + '_' + Date.now();
    sessionStorage.setItem('qotix_tab_id', id);
  }
  return id;
}

type Heartbeat = { tabId: string; ts: number };

function readHeartbeat(): Heartbeat | null {
  try {
    return JSON.parse(localStorage.getItem(HEARTBEAT_KEY) || 'null');
  } catch { return null; }
}

function writeHeartbeat(): void {
  localStorage.setItem(HEARTBEAT_KEY, JSON.stringify({ tabId: getTabId(), ts: Date.now() }));
}

function clearHeartbeat(): void {
  const hb = readHeartbeat();
  if (hb?.tabId === getTabId()) localStorage.removeItem(HEARTBEAT_KEY);
}

function isExpired(hb: Heartbeat): boolean {
  return Date.now() - hb.ts > HEARTBEAT_TIMEOUT_MS;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type ConflictReason = 'another_tab' | 'takeover';

export function initTabGuard(callbacks: {
  onConflict: (reason: ConflictReason) => void;
  onClear: () => void;
}): () => void {
  if (typeof window === 'undefined') return () => {};

  const MY_ID = getTabId();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let channel: BroadcastChannel | null = null;

  function claimSession(): void {
    writeHeartbeat();
    heartbeatTimer = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);
    window.addEventListener('beforeunload', handleUnload);
  }

  function releaseSession(): void {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    clearHeartbeat();
    window.removeEventListener('beforeunload', handleUnload);
  }

  function handleUnload(): void {
    releaseSession();
    channel?.postMessage({ type: 'released', tabId: MY_ID });
  }

  // Broadcast that this tab is "taking over" (user chose "use this tab")
  function takeover(): void {
    releaseSession();   // stop old heartbeat first
    claimSession();     // claim with new timestamp
    channel?.postMessage({ type: 'takeover', tabId: MY_ID });
  }

  // Expose takeover so the UI component can call it
  (window as any).__qotixTabTakeover = takeover;

  // BroadcastChannel setup
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (e) => {
      const { type, tabId } = e.data as { type: string; tabId: string };
      if (tabId === MY_ID) return; // own message — ignore

      if (type === 'takeover') {
        // Another tab just took over → release our claim and notify UI
        releaseSession();
        callbacks.onConflict('takeover');
      }
      if (type === 'released') {
        // The active tab closed → if we were blocked we can take over now
        callbacks.onClear();
      }
    };
  } catch { /* Safari private mode — BroadcastChannel unavailable */ }

  // ── Decision logic ──
  const hb = readHeartbeat();
  const canClaim = !hb || hb.tabId === MY_ID || isExpired(hb);

  if (canClaim) {
    claimSession();
  } else {
    // Another live tab holds the session
    callbacks.onConflict('another_tab');
  }

  // Cleanup
  return () => {
    releaseSession();
    channel?.close();
    delete (window as any).__qotixTabTakeover;
  };
}

/** Call from the "Use this tab" button */
export function takeoverTab(): void {
  (window as any).__qotixTabTakeover?.();
}
