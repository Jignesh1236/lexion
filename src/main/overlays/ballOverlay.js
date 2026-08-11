import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';

let overlayWin = null;
let ipcReady = false;

export function createBallOverlay() {
  const { x, y, width, height } = screen.getPrimaryDisplay().bounds;

  overlayWin = new BrowserWindow({
    x,
    y,
    width,
    height,
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

  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setIgnoreMouseEvents(true, { forward: true });

  if (process.env['ELECTRON_RENDERER_URL']) {
    overlayWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`);
  } else {
    overlayWin.loadFile(join(__dirname, '../renderer/overlay.html'));
  }

  registerOverlayIpc();

  return overlayWin;
}

function registerOverlayIpc() {
  if (ipcReady) return;
  ipcReady = true;

  ipcMain.on('overlay:set-interactive', (event, interactive) => {
    if (event.sender !== overlayWin?.webContents) return;
    overlayWin.setIgnoreMouseEvents(!interactive, { forward: true });
  });
}

export function getBallOverlay() {
  return overlayWin;
}

export function showBallOverlay() {
  if (!overlayWin) return;
  overlayWin.show();
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
}

export function hideBallOverlay() {
  overlayWin?.hide();
}

export function toggleBallOverlay() {
  if (!overlayWin) return;
  if (overlayWin.isVisible()) hideBallOverlay();
  else showBallOverlay();
}