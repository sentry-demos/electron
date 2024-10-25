//index.js
const electron = require('electron');
const Sentry_renderer = Sentry = require('@sentry/electron/renderer');
const { crash } = global.process || {};

Sentry_renderer.init({
    integrations: [
        Sentry_renderer.browserTracingIntegration(),
        Sentry_renderer.replayIntegration({
            // Additional SDK configuration goes in here, for example:
            maskAllText: true,
            blockAllMedia: true,
        })
    ],
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

function inputError() {
    const scope = Sentry_renderer.getCurrentScope();
    throw "Submit failed";
}

function setStatusTag() {
    const scope = Sentry_renderer.getCurrentScope();
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