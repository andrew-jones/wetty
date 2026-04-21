import _ from 'lodash';
import { overlay } from './disconnect/elements';
import { verifyPrompt } from './disconnect/verify';

export function disconnect(reason: string): void {
  if (_.isNull(overlay)) return;
  overlay.style.display = 'block';
  const msg = document.getElementById('msg');
  if (!_.isUndefined(reason) && !_.isNull(msg)) msg.innerHTML = reason;
  window.removeEventListener('beforeunload', verifyPrompt, false);
}

export function showReconnecting(): void {
  if (_.isNull(overlay)) return;
  overlay.style.display = 'block';
  const msg = document.getElementById('msg');
  if (!_.isNull(msg)) msg.innerHTML = 'Reconnecting...';
}

export function hideOverlay(): void {
  if (_.isNull(overlay)) return;
  overlay.style.display = 'none';
}
