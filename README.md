# electron-quick-start

## Setup
1. `npm install`
2. Place your DSN Key in `index.html`
```javascript
    <script>
      Sentry.init({ dsn: '<dsn_key>' })
    </script>
 ```
3. Upload the Debug Information Files
The download and upload take a few minutes.
```bash
npm install -g @sentry/wizard

# Optional, if the following command (sentry-wizard) errors then perform this
npm install --save-dev @sentry/cli electron-download

# dynamically creates the sentry.properties file and sentry-symbols.js, for Download/Upload of symbols
sentry-wizard --integration electron

# Downloads the Electron Symbols (from Electron Github)
# Uploads your Electron Symbols (i.e. Debug Information Files) to Sentry.io.
node sentry-symbols.js
```
4. Check that your Debug Info Files were uploaded  
Sentry.io > Project Settings > Debug Files


## Run
1. `npm start`


## Docs
- Sentry Documentation https://docs.sentry.io/platforms/javascript/electron/
- Where the Electron Symbols get downloaded from:
https://github.com/electron/electron/releases

## Electron Basics
- `package.json` - Points to the app's main file and lists its details and dependencies.
- `main.js` - Starts the app and creates a browser window to render HTML. This is the app's **main process**.
- `index.html` - A web page to render. This is the app's **renderer process**.
This is a minimal Electron application based on the [Quick Start Guide](https://electronjs.org/docs/tutorial/quick-start) within the Electron documentation.
You can learn more about each of these components within the [Quick Start Guide](https://electronjs.org/docs/tutorial/quick-start).

## GIF Electron Native Crash
![gif](electron-native-crash.gif)

## GIF Electron Javascript
![gif](electron-javascript.gif)