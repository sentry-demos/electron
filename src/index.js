//index.js
require('../sentry');

const { ipcRenderer } = require('electron');
const { crash } = global.process || {};

function notAFunctionError() {
    var someArray = [{ func: function () {}}];
    someArray[1].func();
}

function syntaxError() {
    eval('foo bar');
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