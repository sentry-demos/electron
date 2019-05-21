// TODO - can access the Sentry object?
require('../sentry');

const { ipcRenderer } = require('electron');
const { crash } = global.process || {};

console.log('Sentry', Sentry)

function notAFunctionError() {
    var someArray = [{ func: function () {}}];
    someArray[1].func();
}

function syntaxError() {
    eval('foo bar');
}


// JAVASRIPT
function errorMain() {
    ipcRenderer.send('demo.error');
};
function errorRenderer() {
    throw new Error('Error triggered in renderer process');
};

// CRASH
function crashMain() {
    ipcRenderer.send('demo.crash');
};

crashRenderer = crash



// WOULD BE NICE...
// versions = {
//     chrome: process.versions.chrome,
//     electron: process.versions.electron,
//     node: process.versions.node,
// };
  


// function rangeError() {
//     throw new RangeError('Parameter must be between 1 and 100');
// }

// function uriError() {
//     decodeURIComponent('%');
//   }