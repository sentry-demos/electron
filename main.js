// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain} = require('electron')
const fs = require('fs');
const path = require('path')
const axios = require('axios')

require('./sentry');

let date = Date.now();

// replace with your sentry_key ref: https://develop.sentry.dev/sdk/store/
const SENTRY_KEY='aab0a4e2af5a4df0a9adf094e657809e@o87286' // for testorg-az 'electron' project
const PROJECT_ID='1318230' // for testorg-az 'electron' project
const SENTRY_AUTH_TOKEN="" //Put your auth token here
const dir = app.getAppPath();
const pathToDir = path.join(__dirname, "offlineEvents")

if (!SENTRY_KEY) {
  throw("You must set your SENTRY_KEY in main.js")
} else if (!SENTRY_AUTH_TOKEN) {
  throw("You must set your SENTRY_AUTH_TOKEN in main.js")
}

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
    width: 800,
    height: 600,
    webPreferences: {
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
    fs.mkdirSync((`${dir}`, 'offlineEvents'), (err, directory) => {
      if (err) throw err;
      // A new temporary directory is created within the app root
    });
    Sentry.configureScope(function(scope) {
      scope.setTag('onlineStatus', 'offline')
    });
  }
  if (status === 'online') {
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
            axios.post(`https://${SENTRY_KEY}.ingest.sentry.io/api/${PROJECT_ID}/store/`, data, {
              headers: {
                'Content-Type': 'application/json',
                'X-Sentry-Auth': `Sentry sentry_version=7,sentry_timestamp=${date},sentry_client=sentry-curl/1.0,sentry_key=${SENTRY_KEY}`,
                'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`
              },
            })
            .then(response => {
              if (response.status === 200) {
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
