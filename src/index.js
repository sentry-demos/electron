//index.js
const electron = require('electron');
const Sentry_renderer = Sentry = require('@sentry/electron/renderer');
const Sentry_browser = Sentry = require('@sentry/browser');
const { crash } = global.process || {};

Sentry_renderer.init({
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,

    // Capture Replay for 10% of all sessions,
    // plus for 100% of sessions with an error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
});

function notAFunctionError() {
    setStatusTag();
    var someArray = [{ func: function () { } }];
    someArray[1].func();
}

function syntaxError() {
    setStatusTag();
    eval('foo bar');
}

function setStatusTag(){
    const scope = Sentry_browser.getCurrentScope();
    if (window.navigator.onLine === true) {
        scope.setTag("onlineStatus", 'online');
    } else if (window.navigator.onLine === false) {
        scope.setTag("onlineStatus", 'offline');
    }
}


// CRASH
function crashMain() {
    ipcRenderer.send('demo.crash');
};

// JAVASCRIPT
function errorMain() {
    ipcRenderer.send('demo.error');
};
function errorRenderer() {
    throw new Error('Error in renderer process');
};

crashRenderer = crash


// WOULD BE NICE...
const versions = {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
};
console.log('VERSIONS', versions)