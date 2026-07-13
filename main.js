require('dotenv').config();

// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain, session} = require('electron')
const fs = require('fs');
const path = require('path')
const axios = require('axios')

const Sentry = require('./sentry');

let date = Date.now();

const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const dir = app.getAppPath();
const pathToDir = path.join(__dirname, "offlineEvents")

if (!process.env.SENTRY_DSN) {
  throw new Error('SENTRY_DSN is not set. Copy .env.example to .env and fill in your values.');
} else if (!SENTRY_AUTH_TOKEN) {
  throw new Error('SENTRY_AUTH_TOKEN is not set. Copy .env.example to .env and fill in your values.');
}

// Derive Store API endpoint from DSN so region (ingest.us vs ingest) is always correct
const _dsn = new URL(process.env.SENTRY_DSN);
const SENTRY_PUBLIC_KEY = _dsn.username;
const SENTRY_INGEST_HOST = _dsn.host;
const PROJECT_ID = _dsn.pathname.replace('/', '');

const removeDir = function(path) {
  if (fs.existsSync(path)) {
    const files = fs.readdirSync(path)

    if (files.length > 0) {
      files.forEach(function(filename) {
        if (fs.statSync(path + '/' + filename).isDirectory()) {
          removeDir(path + '/' + filename)
        } else {
          fs.unlinkSync(path + '/' + filename)
        }
      })
      fs.rmdirSync(path)
    } else {
      fs.rmdirSync(path)
    }
  } else {
    console.log("Directory does not exist. No offline events to send")
  }
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
// let mainWindow
let onlineStatusWindow;

function createWindow () {
  // Create the browser window.
  onlineStatusWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // and load the index.html of the app.
  onlineStatusWindow.loadURL(`file://${__dirname}/src/index.html`)

  // Open the DevTools.
  onlineStatusWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  onlineStatusWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    onlineStatusWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // Required for browserProfilingIntegration — Sentry checks for this header
  // before enabling the JS Self-Profiling API in the renderer.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Document-Policy': ['js-profiling'],
      },
    });
  });

  createWindow();
})
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (onlineStatusWindow === null) createWindow()
})

// check online/offline status
ipcMain.on('online-status-changed', (event, status) => {
  if (status === 'offline') {
    console.log('OFFLINE')
    fs.mkdirSync((`${dir}`, 'offlineEvents'), (err, directory) => {
      if (err) throw err;
      // A new temporary directory is created within the app root
    });
    // Modern scope API — replaces deprecated Sentry.configureScope
    Sentry.getCurrentScope().setTag('onlineStatus', 'offline');
    Sentry.logger.warn('App went offline', { status });
  }
  if (status === 'online') {
    Sentry.getCurrentScope().setTag('onlineStatus', 'online');
    Sentry.logger.info('App came back online', { status });

    if (fs.existsSync("./offlineEvents/")) {
      fs.readdir("./offlineEvents/", function (err, files) {
        //handling error
        if (err) {
          return console.log('Unable to scan directory: ' + err);
        }
        //listing all files using forEach
        files.forEach(function (file) {
          fs.readFile("./offlineEvents/" + file, "utf8", function (err, data) {
            if (err) throw err;
            // replace with your project store endpoint https://develop.sentry.dev/sdk/store/ and Auth Token
            axios.post(`https://${SENTRY_INGEST_HOST}/api/${PROJECT_ID}/store/`, data, {
              headers: {
                'Content-Type': 'application/json',
                'X-Sentry-Auth': `Sentry sentry_version=7,sentry_timestamp=${date},sentry_client=sentry-curl/1.0,sentry_key=${SENTRY_PUBLIC_KEY}`,
                'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`
              },
            })
            .then(response => {
              if (response.status === 200) {
                Sentry.logger.info('Replayed offline events successfully');
                removeDir(pathToDir)
              }
            })
          });
        });
      });
    } else {
      console.log("Directory does not exist. No offline events to send")
    }
  }
})

// IPC handlers — triggered from the renderer via button clicks

ipcMain.on('demo.error', () => {
  Sentry.logger.error('About to throw a demo error in the main process');
  Sentry.metrics.count('demo.error.triggered', 1, { tags: { errorType: 'unhandledError', process: 'main' } });
  throw new Error('Error triggered in main process');
});

ipcMain.on('demo.referenceError', () => {
  Sentry.logger.error('About to throw a ReferenceError in the main process');
  Sentry.metrics.count('demo.error.triggered', 1, { tags: { errorType: 'referenceError', process: 'main' } });
  // eslint-disable-next-line no-undef
  console.log(undefinedVariable);
});

ipcMain.on('demo.rangeError', () => {
  Sentry.logger.error('About to throw a RangeError in the main process');
  Sentry.metrics.count('demo.error.triggered', 1, { tags: { errorType: 'rangeError', process: 'main' } });
  Sentry.setContext('rangeError', { parameter: 0, validRange: '1–100' });
  throw new RangeError('Parameter must be between 1 and 100');
});

ipcMain.on('demo.crash', () => {
  Sentry.logger.warn('Native crash triggered in main process');
  process.crash();
});
