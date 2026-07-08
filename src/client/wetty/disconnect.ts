import { overlay } from './disconnect/elements';
import { verifyPrompt } from './disconnect/verify';

export function disconnect(reason?: string): void {
  if (overlay === null) return;
  overlay.style.display = 'block';
  const msg = document.getElementById('msg');
  if (msg !== null) msg.innerHTML = reason ?? 'Session ended';
  window.removeEventListener('beforeunload', verifyPrompt, false);
}

export function showReconnecting(): void {
  if (overlay === null) return;
  overlay.style.display = 'block';
  const msg = document.getElementById('msg');
  if (msg !== null) msg.innerHTML = 'Reconnecting...';
}

export function hideOverlay(): void {
  if (overlay === null) return;
  overlay.style.display = 'none';
}
