// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs');
const path = require('path')
const axios = require('axios')
const Sentry = require('@sentry/electron/main');
const { replayIntegration } = require('@sentry/electron/renderer');

const dir = app.getAppPath();

Sentry.init({
  // TODO: Replace with your project's DSN
  dsn: '***',
  integrations: [
    replayIntegration(),
  ],
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event) {
    console.log(event.tags.onlineStatus)
    if (event.tags.onlineStatus === 'online') {
      return event
    } else if (event.tags.onlineStatus === 'offline') {
      let sentryEvent = event
      console.log(sentryEvent.event_id)

      // write to a new file
      fs.writeFileSync('./offlineEvents/' + sentryEvent.event_id + '.json', JSON.stringify(sentryEvent), (err) => {
        // throws an error, you could also catch it here
        if (err) throw err;
        // success case, the file was saved
        console.log('Event saved!');
      });
    }
    return event
  }
});

const removeDir = function (path) {
  if (fs.existsSync(path)) {
    const files = fs.readdirSync(path)

    if (files.length > 0) {
      files.forEach(function (filename) {
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

function createWindow() {
  // Create the browser window.
  onlineStatusWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
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
app.on('ready', createWindow)
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
    event.setTag
    fs.mkdirSync((`${dir}`, 'offlineEvents'), (err, directory) => {
      if (err) throw err;
      // A new temporary directory is created within the app root
    });
    Sentry.configureScope(scope => {
      scope.setTag("onlineStatus", 'offline');
    });
  }
})

// The IPC handlers below trigger errors in the here (main process) when
// the user clicks on corresponding buttons in the UI (renderer).
// JAVASCRIPT
ipcMain.on('demo.error', () => {
  console.log('Error triggered in main processes');
  throw new Error('Error triggered in main processes');
});

// CRASH
ipcMain.on('demo.crash', () => {
  console.log('process.crash()');
  process.crash();
});
