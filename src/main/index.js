import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import { join, basename } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';

const DATA_DIR = join(app.getPath('userData'), '.appdata');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function deleteAppData() {
  if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
}

ipcMain.handle('app:save-data', (_event, file, data) => {
  ensureDataDir();
  const safeFile = basename(file);
  writeFileSync(join(DATA_DIR, safeFile), JSON.stringify(data, null, 2));
  return join(DATA_DIR, safeFile);
});

ipcMain.handle('app:load-data', (_event, file) => {
  ensureDataDir();
  const safeFile = basename(file);
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, safeFile), 'utf-8'));
  } catch {
    return null;
  }
});

function buildMenu() {
  const template = [
    {
      label: 'Settings',
      submenu: [
        { label: 'Delete .appdata', click: () => { deleteAppData(); const win = BrowserWindow.getAllWindows()[0]; win?.webContents.reload(); } },
        {
          label: 'Dev Tools',
          type: 'checkbox',
          checked: false,
          click: (item, win) => {
            if (!win) return;
            if (item.checked) {
              win.webContents.openDevTools();
            } else {
              win.webContents.closeDevTools();
            }
          }
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quit' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
