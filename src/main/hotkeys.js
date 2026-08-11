import { globalShortcut } from 'electron';
import { getBallOverlay, toggleBallOverlay } from './overlays/ballOverlay.js';

let currentSettings = null;

export function applyHotkeys(settings) {
  currentSettings = settings || null;
  refreshHotkeys();
}

export function refreshHotkeys() {
  globalShortcut.unregisterAll();

  const settings = currentSettings;
  if (!settings || !getBallOverlay()) return;

  const overlayVisible = getBallOverlay().isVisible();

  if (overlayVisible && settings.pttKey) {
    try {
      const ok = globalShortcut.register(settings.pttKey, () => {
        getBallOverlay()?.webContents.send('lexion:ptt-toggle');
      });
      if (!ok) console.warn('PTT key registration failed:', settings.pttKey);
    } catch (error) {
      console.warn('PTT key registration error:', error.message);
    }
  }

  if (settings.overlayToggleKey) {
    try {
      const ok = globalShortcut.register(settings.overlayToggleKey, () => toggleBallOverlay());
      if (!ok) console.warn('Overlay toggle key registration failed:', settings.overlayToggleKey);
    } catch (error) {
      console.warn('Overlay toggle key registration error:', error.message);
    }
  }
}

export function clearHotkeys() {
  globalShortcut.unregisterAll();
}