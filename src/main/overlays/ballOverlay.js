import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';

let overlayWin = null;
let ipcReady = false;
let pollTimer = null;

let interactiveAreas = [];
let dragging = false;
let interactive = false;
let ignoreLockUntil = 0;

const POLL_INTERVAL = 25;
const HIT_PAD = 10;

const visibilityListeners = [];

export function onOverlayVisibilityChange(listener) {
  visibilityListeners.push(listener);
}

function notifyVisibilityChange() {
  for (const listener of visibilityListeners) listener();
}

function pointInArea(px, py, area) {
  if (area.type === 'rect') {
    return (
      px >= area.x - HIT_PAD &&
      px <= area.x + area.w + HIT_PAD &&
      py >= area.y - HIT_PAD &&
      py <= area.y + area.h + HIT_PAD
    );
  }
  if (area.type === 'circle') {
    const dx = px - area.x;
    const dy = py - area.y;
    const r = area.r + HIT_PAD;
    return dx * dx + dy * dy <= r * r;
  }
  return false;
}

function updateInteractive() {
  if (!overlayWin) return;

  const bounds = screen.getPrimaryDisplay().bounds;
  const cursor = screen.getCursorScreenPoint();
  const px = cursor.x - bounds.x;
  const py = cursor.y - bounds.y;
  const now = Date.now();

  let shouldInteract = false;
  if (dragging) {
    shouldInteract = true;
  } else if (now < ignoreLockUntil) {
    shouldInteract = false;
  } else {
    for (const area of interactiveAreas) {
      if (pointInArea(px, py, area)) {
        shouldInteract = true;
        break;
      }
    }
  }

  if (shouldInteract && !interactive) {
    interactive = true;
    overlayWin.setIgnoreMouseEvents(false);
  } else if (!shouldInteract && interactive) {
    interactive = false;
    overlayWin.setIgnoreMouseEvents(true, { forward: true });
  }
}

function registerOverlayIpc() {
  if (ipcReady) return;
  ipcReady = true;

  ipcMain.on('overlay:set-areas', (event, areas) => {
    if (event.sender !== overlayWin?.webContents) return;
    interactiveAreas = Array.isArray(areas) ? areas : [];
    updateInteractive();
  });

  ipcMain.on('overlay:set-drag', (event, on) => {
    if (event.sender !== overlayWin?.webContents) return;
    dragging = !!on;
    if (dragging) interactive = false;
    updateInteractive();
  });

  ipcMain.on('overlay:force-ignore', (event) => {
    if (event.sender !== overlayWin?.webContents) return;
    ignoreLockUntil = Date.now() + 250;
    interactive = false;
    overlayWin.setIgnoreMouseEvents(true, { forward: true });
  });

  ipcMain.on('overlay:apply-audio-devices', (_event, inputId, outputId) => {
    overlayWin?.webContents.send('overlay:apply-audio-devices', inputId, outputId);
  });
}

export function createBallOverlay() {
  const { x, y, width, height } = screen.getPrimaryDisplay().bounds;

  overlayWin = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    hasShadow: false,
    enableLargerThanScreen: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWin.once('ready-to-show', () => {
    try { overlayWin.setAlwaysOnTop(true, 'screen-saver'); } catch {}
    try { overlayWin.showInactive(); } catch { try { overlayWin.show(); } catch {} }
    try { overlayWin.setIgnoreMouseEvents(true, { forward: true }); } catch {}
  });

  overlayWin.webContents.on('did-fail-load', (_event, code, desc) => {
    console.error('[ballOverlay] failed to load overlay:', code, desc);
  });

  overlayWin.webContents.on('render-process-gone', (_event, details) => {
    console.error('[ballOverlay] render-process-gone:', details);
    try {
      setTimeout(() => {
        if (!overlayWin || overlayWin.isDestroyed()) return;
        console.log('[ballOverlay] reloading crashed overlay…');
        overlayWin.reload();
      }, 1000);
    } catch (err) {
      console.error('[ballOverlay] reload on crash failed:', err);
    }
  });

  overlayWin.webContents.on('unresponsive', () => {
    console.warn('[ballOverlay] overlay unresponsive');
  });

  overlayWin.webContents.on('crashed', (_event, killed) => {
    console.error('[ballOverlay] overlay crashed, killed=', killed);
    try {
      setTimeout(() => {
        if (!overlayWin || overlayWin.isDestroyed()) return;
        console.log('[ballOverlay] reloading crashed overlay…');
        overlayWin.reload();
      }, 1000);
    } catch (err) {
      console.error('[ballOverlay] reload on crash failed:', err);
    }
  });

  overlayWin.on('closed', () => {
    stopPolling();
    overlayWin = null;
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    overlayWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`).catch((err) => console.error('[ballOverlay] loadURL error:', err));
  } else {
    overlayWin.loadFile(join(__dirname, '../renderer/overlay.html')).catch((err) => console.error('[ballOverlay] loadFile error:', err));
  }

  registerOverlayIpc();
  stopPolling();
  pollTimer = setInterval(updateInteractive, POLL_INTERVAL);

  return overlayWin;
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function getBallOverlay() {
  return overlayWin;
}

export function showBallOverlay() {
  if (!overlayWin) return;
  interactive = false;
  overlayWin.show();
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  notifyVisibilityChange();
}

export function hideBallOverlay() {
  if (!overlayWin) return;
  interactive = false;
  overlayWin.hide();
  notifyVisibilityChange();
}

export function toggleBallOverlay() {
  if (!overlayWin) return;
  if (overlayWin.isVisible()) hideBallOverlay();
  else showBallOverlay();
}