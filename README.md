# Control Tower - Desktop App

A desktop application wrapper for the **Control Tower** order & delivery management system.
Bundles the Next.js production build with an Electron shell so it runs as a native desktop app on Windows, macOS, and Linux.

## What's Inside

```
desktop-app/
├── main.js              # Electron main process (starts Next.js + opens window)
├── preload.js           # Secure context bridge to renderer
├── package.json         # Electron + electron-builder config
├── icon.png             # App icon (512x512)
├── start.sh             # Linux/macOS quick launcher (no Electron needed)
├── start.bat            # Windows quick launcher (no Electron needed)
└── server/              # Bundled Next.js standalone production build
    ├── server.js
    ├── .next/
    ├── public/
    ├── node_modules/
    └── package.json
```

## Quick Start (No Build Required)

If you just want to run the app locally without installing Electron:

### Linux / macOS
```bash
cd desktop-app
chmod +x start.sh
./start.sh
```

### Windows
```cmd
cd desktop-app
start.bat
```

The script will:
1. Find a free port (starting from 3000)
2. Start the bundled Next.js production server
3. Open `http://127.0.0.1:<port>/` in your terminal — open it in any browser

The SQLite database is stored at `~/.control-tower/control-tower.db` (or `%USERPROFILE%\.control-tower\` on Windows).

## Run as a Native Desktop App (Electron)

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ installed
- Internet connection (for first-time npm install)

### Install & Run
```bash
cd desktop-app
npm install
npm start
```

This launches the Electron window which:
- Starts the bundled Next.js server on `127.0.0.1:3000`
- Opens a native 1440x900 desktop window pointed at the server
- Provides standard menu (File / View / Help), DevTools, fullscreen, etc.

### Build Native Installers

To produce platform-specific installers (.exe / .dmg / .AppImage / .deb):

```bash
# Linux (current platform)
npm run dist:linux
# → produces dist/Control Tower-1.0.0.AppImage and .deb

# Windows installer (requires Windows or Wine)
npm run dist:win
# → produces dist/Control Tower Setup 1.0.0.exe

# macOS dmg (requires macOS)
npm run dist:mac
# → produces dist/Control Tower-1.0.0.dmg
```

Build artifacts are placed in `desktop-app/dist/`.

## How It Works

1. **`main.js`** spawns the Next.js standalone server (`server/server.js`) as a child process
2. It waits for `http://127.0.0.1:3000/api` to respond
3. Once ready, it opens a `BrowserWindow` pointing at `http://127.0.0.1:3000/`
4. The SQLite database is created in the OS user-data directory (`app.getPath('userData')`), so data persists across launches
5. When the window closes, the Next.js server is gracefully shut down

## Features

- Native desktop experience (window menu, DevTools, fullscreen, multi-monitor)
- Bundled production server — no internet connection needed after install
- Persistent local SQLite database
- Auto-finds free port if 3000 is occupied
- Cross-platform (Windows / macOS / Linux)
- External links open in default browser, not inside the app

## Troubleshooting

**"Server failed to start within timeout"**
- Make sure no other process is using port 3000 (or change `PORT` in `main.js`)
- Check that `node` is on your PATH
- Try running `./start.sh` first to see server output directly

**Blank window on first launch**
- The Next.js server needs a few seconds to start. The window waits for `/api` to respond before loading.
- Open DevTools (View → Toggle DevTools) to check for errors.

**Database reset**
- Delete `~/.control-tower/control-tower.db` (Linux/macOS) or `%USERPROFILE%\.control-tower\control-tower.db` (Windows)
- Restart the app — a fresh database will be created

## Build Info

- Electron: 31.x
- electron-builder: 24.x
- Node.js: 18+ required
- App ID: `com.controltower.app`
- Product name: `Control Tower`
