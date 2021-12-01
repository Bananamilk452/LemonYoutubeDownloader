/* eslint-disable import/no-extraneous-dependencies */
const {
  app, protocol, BrowserWindow, Menu,
} = require('electron');
const installExtension = require('electron-devtools-installer').default;
const { VUEJS_DEVTOOLS } = require('electron-devtools-installer');
const { join } = require('path');
const { autoUpdater } = require('electron-updater');
const logger = require('electron-log');
const createProtocol = require('./createProtocol');
const ipcInit = require('./ipc');
const initInstallScript = require('./install');

// #region Initial Setting
const isDevelopment = process.env.NODE_ENV !== 'production';
// 알림에 이름 제대로 표시하기 위해서 vue.config.js에 명시된 ID와 같이 맞추기
app.setAppUserModelId('com.lemonyoutubedownloader.app');
// console 객체를 electron-log로 대체
Object.assign(console, logger.functions);
logger.transports.console.format = '{h}:{i}:{s} {text}';
logger.transports.file.getFile().clear();
// autoUpdater 로그 기록
autoUpdater.logger = logger;
autoUpdater.logger.transports.file.level = 'info';
Menu.setApplicationMenu(null);
// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } },
]);

// #endregion

async function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 500,
    height: 800,
    autoHideMenuBar: true,
    title: 'LemonYoutubeDownloader',
    webPreferences: {

      devTools: true,
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false, // turn off remote
      preload: join(__dirname, 'preload.js'), // use a preload script
    },
  });

  ipcInit(win);
  initInstallScript(win);

  autoUpdater.on('update-available', () => {
    win.webContents.send('update status', '최신 버전 다운로드 중...');
  });

  autoUpdater.on('update-not-available', () => {
    win.webContents.send('update status', '최신 버전입니다!');
  });

  if (process.argv[2] === 'dev') {
    // Load the url of the dev server if in development mode
    await win.loadURL('http://localhost:8080');
    if (!process.env.IS_TEST) win.webContents.openDevTools();
  } else {
    createProtocol('app');
    // Load the index.html when not in development
    win.loadURL('app://./index.html');
    autoUpdater.checkForUpdatesAndNotify({
      title: '새 업데이트 설치가 준비되었습니다.',
      body: '{appName} 버전 {version}이 다운로드되었으며 앱 종료 시에 자동으로 설치됩니다.',
    });
  }
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS_DEVTOOLS);
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString());
    }
  }
  createWindow();
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit();
      }
    });
  } else {
    process.on('SIGTERM', () => {
      app.quit();
    });
  }
}
