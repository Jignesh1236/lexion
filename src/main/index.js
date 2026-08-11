import { app, BrowserWindow, Menu, ipcMain, globalShortcut, Tray, nativeImage } from 'electron';
import { join, basename } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { createBallOverlay, getBallOverlay, showBallOverlay, hideBallOverlay, toggleBallOverlay, onOverlayVisibilityChange } from './overlays/ballOverlay.js';
import { applyHotkeys, refreshHotkeys } from './hotkeys.js';

const DATA_DIR = join(app.getPath('userData'), '.appdata');

let mainWindow = null;
let tray = null;
let isQuitting = false;

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function deleteAppData() {
  if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
}

function readDataFile(file) {
  ensureDataDir();
  const safeFile = basename(file);
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, safeFile), 'utf-8'));
  } catch {
    return null;
  }
}

function sanitizePeerId(value) {
  if (!value) return null;
  const clean = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return clean || null;
}

function ensureDefaultConnectSettings() {
  const connect = readDataFile('connect.json') || {};
  if (connect.username) return connect;

  const user = readDataFile('user.json');
  const username = sanitizePeerId(user && (user.username || user.name));
  if (!username) return connect;

  connect.username = username;
  connect.partner = connect.partner || '';
  ensureDataDir();
  writeFileSync(join(DATA_DIR, 'connect.json'), JSON.stringify(connect, null, 2));
  return connect;
}

ipcMain.handle('app:save-data', (_event, file, data) => {
  ensureDataDir();
  const safeFile = basename(file);
  writeFileSync(join(DATA_DIR, safeFile), JSON.stringify(data, null, 2));

  if (safeFile === 'connect.json') {
    applyHotkeys(data);
    getBallOverlay()?.webContents.send('lexion:apply-settings', data);
  }

  return join(DATA_DIR, safeFile);
});

ipcMain.handle('app:load-data', (_event, file) => readDataFile(file));

function mergeDataFile(file, partial) {
  const existing = readDataFile(file) || {};
  const merged = { ...existing, ...partial };
  ensureDataDir();
  writeFileSync(join(DATA_DIR, basename(file)), JSON.stringify(merged, null, 2));
  return merged;
}

ipcMain.on('app:save-hotkeys', (_event, partial) => {
  if (!partial || typeof partial !== 'object') return;
  const merged = mergeDataFile('connect.json', partial);
  applyHotkeys(merged);
});

ipcMain.on('app:open-main', () => {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
});

ipcMain.on('lexion:status', (_event, status) => {
  mainWindow?.webContents.send('lexion:status', status);
});

ipcMain.on('overlay:toggle-visible', () => {
  if (!getBallOverlay()) return;
  if (getBallOverlay().isVisible()) hideBallOverlay();
  else showBallOverlay();
});

function buildMenu() {
  const template = [
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Show Floating Ball',
          type: 'checkbox',
          checked: true,
          click: (item) => {
            if (item.checked) showBallOverlay();
            else hideBallOverlay();
          }
        },
        {
          label: 'Dev Tools',
          type: 'checkbox',
          checked: false,
          click: (item) => {
            if (!mainWindow) return;
            if (item.checked) mainWindow.webContents.openDevTools();
            else mainWindow.webContents.closeDevTools();
          }
        },
        { label: 'Delete .appdata', click: () => { deleteAppData(); mainWindow?.webContents.reload(); } },
        { type: 'separator' },
        { role: 'quit', label: 'Quit' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  const icon = nativeImage.createFromPath(join(__dirname, '../../src/renderer/assets/lesion_over.png')).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('Lexion');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Lexion', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { label: 'Show / Hide Floating Ball', click: () => toggleBallOverlay() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  );
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    icon: join(__dirname, '../../src/renderer/assets/lesion_over.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow = win;

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  try {
    createBallOverlay();
  } catch (err) {
    console.error('[main] createBallOverlay failed:', err);
  }
  try {
    createTray();
  } catch (err) {
    console.error('[main] createTray failed:', err);
  }
  try {
    applyHotkeys(ensureDefaultConnectSettings());
  } catch (err) {
    console.error('[main] applyHotkeys failed:', err);
  }
  try {
    onOverlayVisibilityChange(refreshHotkeys);
  } catch (err) {
    console.error('[main] onOverlayVisibilityChange failed:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err) => {
  console.error('[main] whenReady failed:', err);
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});