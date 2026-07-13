const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let nextProcess = null;
const PORT = 3000;
const HOST = '127.0.0.1';

// Determine server path
function getServerPath() {
  // When packaged with extraResources, server is in resources/server
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'server');
  }
  // In development
  return path.join(__dirname, 'server');
}

// Find node executable
function getNodeExecutable() {
  // Try to use bundled node (when packaged)
  if (app.isPackaged) {
    const possiblePaths = [
      path.join(process.resourcesPath, 'node'),
      path.join(process.resourcesPath, 'node', 'bin', 'node'),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) return p;
    }
  }
  // Fallback to system node
  return process.env.NODE_PATH || 'node';
}

// Start Next.js server
function startNextServer() {
  return new Promise((resolve, reject) => {
    const serverPath = getServerPath();
    const serverFile = path.join(serverPath, 'server.js');

    if (!fs.existsSync(serverFile)) {
      reject(new Error(`Server not found at: ${serverFile}`));
      return;
    }

    const node = getNodeExecutable();
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      HOSTNAME: HOST,
      DATABASE_URL: `file:${path.join(app.getPath('userData'), 'control-tower.db')}`,
    };

    console.log(`Starting Next.js server from: ${serverPath}`);
    console.log(`Database: ${env.DATABASE_URL}`);

    nextProcess = spawn(node, [serverFile], {
      cwd: serverPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    nextProcess.stdout.on('data', (data) => {
      console.log(`[next-server] ${data.toString().trim()}`);
    });

    nextProcess.stderr.on('data', (data) => {
      console.error(`[next-server-error] ${data.toString().trim()}`);
    });

    nextProcess.on('error', (err) => {
      console.error('Failed to start Next.js server:', err);
      reject(err);
    });

    nextProcess.on('exit', (code, signal) => {
      console.log(`Next.js server exited with code ${code} signal ${signal}`);
      nextProcess = null;
    });

    // Wait for server to be ready
    const maxAttempts = 60;
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      const req = http.get(`http://${HOST}:${PORT}/api`, (res) => {
        if (res.statusCode < 500) {
          clearInterval(checkInterval);
          resolve();
        } else {
          res.resume();
        }
      });

      req.on('error', () => {
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          reject(new Error('Server failed to start within timeout'));
        }
      });

      req.setTimeout(1000, () => {
        req.destroy();
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          reject(new Error('Server failed to start within timeout'));
        }
      });
    }, 1000);
  });
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Control Tower',
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    icon: path.join(__dirname, 'icon.png'),
  });

  // Load the Next.js app
  mainWindow.loadURL(`http://${HOST}:${PORT}/`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle external links - open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes(`127.0.0.1:${PORT}`) && !url.includes('localhost')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http') && !url.includes(`127.0.0.1:${PORT}`) && !url.includes('localhost')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Build menu
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Control Tower',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Control Tower',
              message: 'Control Tower',
              detail: 'Version: 1.0.0\nOrder & Delivery Management System\n\nBuilt with Next.js + Electron',
              buttons: ['OK'],
            });
          },
        },
        {
          label: 'Open in Browser',
          click: () => {
            shell.openExternal(`http://${HOST}:${PORT}/`);
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    console.log('Starting Control Tower Desktop...');
    await startNextServer();
    console.log('Server is ready, creating window...');
    createWindow();
  } catch (err) {
    console.error('Failed to start Control Tower:', err);
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Control Tower - Startup Error',
      `Failed to start the application server:\n\n${err.message}\n\nPlease make sure the app is not already running and try again.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (nextProcess) {
    nextProcess.kill('SIGTERM');
    setTimeout(() => {
      if (nextProcess) nextProcess.kill('SIGKILL');
    }, 3000);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (mainWindow === null) {
      createWindow();
    }
  }
});

app.on('before-quit', () => {
  if (nextProcess) {
    nextProcess.kill('SIGTERM');
    setTimeout(() => {
      if (nextProcess) nextProcess.kill('SIGKILL');
    }, 3000);
  }
});

// Handle unexpected exits
process.on('exit', () => {
  if (nextProcess) {
    nextProcess.kill('SIGKILL');
  }
});

process.on('SIGINT', () => {
  if (nextProcess) nextProcess.kill('SIGTERM');
  app.quit();
});

process.on('SIGTERM', () => {
  if (nextProcess) nextProcess.kill('SIGTERM');
  app.quit();
});
