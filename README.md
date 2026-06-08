# Empower Plant — Electron Demo

An Electron demo app styled as the Empower Plant e-commerce store, built to showcase [Sentry](https://sentry.io) error monitoring, performance tracing, structured logging, custom metrics, and user feedback across both the **main process** and **renderer process**.

---

## Prerequisites

- Node.js v18+ (tested on v24)
- An Apple Silicon or Intel Mac (Windows/Linux also supported by Electron)
- A Sentry account with an **Electron** project

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure credentials

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
SENTRY_DSN=https://<key>@<org-id>.ingest.us.sentry.io/<project-id>
SENTRY_AUTH_TOKEN=<your-auth-token>
SENTRY_ORG=<your-org-slug>
SENTRY_PROJECT=<your-project-slug>
```

- **DSN** — Sentry → Project Settings → Client Keys (the ingest host and project ID are derived from this automatically)
- **SENTRY_AUTH_TOKEN** — Sentry → Settings → Auth Tokens (needs `project:write` scope)
- **SENTRY_ORG / SENTRY_PROJECT** — your org and project slugs, used by the webpack plugin for source map upload
- **BACKEND_URL** — Empower backend to hit. Defaults to `https://flask.empower-plant.com` (hosted production Flask). Swap to any other hosted backend (`express`, `spring-boot`, `aspnetcore`, `laravel`, `ruby-on-rails`) or a locally running instance. Products, images, checkout, and promo codes all come from here.

### 4. (Optional) Upload debug symbols for native crash stack traces

```bash
node sentry-symbols.js
```

This downloads Electron's debug symbol files and uploads them to Sentry so native crash reports have readable stack traces. Verify the upload at **Sentry → Project Settings → Debug Files**.

### 5. (Optional) Upload source maps

```bash
npm run build
```

Runs webpack with the Sentry webpack plugin, which uploads source maps so minified stack traces are resolved in Sentry. Requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` to be set (either in `webpack.config.js` or as environment variables).

---

## Run

```bash
npm start
```

---

## Architecture

| File | Process | Purpose |
|---|---|---|
| `main.js` | Main | App lifecycle, BrowserWindow, IPC handlers, offline event replay |
| `sentry.js` | Main | Sentry init for the main process (`@sentry/electron/main`) |
| `src/index.js` | Renderer | Error/performance demo functions, scope setup |
| `src/sentry-renderer.js` | Renderer | Sentry init for the renderer (`@sentry/electron/renderer`) |
| `src/index.html` | Renderer | Empower Plant UI — nav, hero, product card grid, footer |
| `src/styles.css` | Renderer | Full Empower Plant design system (Playfair Display + Poppins) |
| `webpack.config.js` | Build | Bundles renderer JS and uploads source maps via Sentry webpack plugin |
| `sentry-symbols.js` | Build | Downloads and uploads Electron native debug symbols |

### Why two Sentry init files?

`@sentry/electron` v5+ requires separate entry points for each process:
- **Main process** → `@sentry/electron/main`
- **Renderer process** → `@sentry/electron/renderer`

A single shared `require('@sentry/electron')` will throw at startup.

---

## Sentry Features Demonstrated

### Error Monitoring
| Demo | Process | Error Type |
|---|---|---|
| Monstera Deliciosa | Main | `process.crash()` native crash |
| Spider Plant | Renderer | Native renderer crash |
| Fiddle-Leaf Fig | Renderer | `TypeError` — not a function |
| Philodendron | Renderer | `ReferenceError` — undefined variable |
| Chinese Evergreen | Renderer | `RangeError` — out of range parameter |
| Snake Plant | Renderer | `SyntaxError` — via `eval()` |
| Peace Lily | Renderer | Generic unhandled `Error` |
| Bird of Paradise | Main | Generic unhandled `Error` via IPC |
| Pothos | Main | `ReferenceError` via IPC |
| ZZ Plant | Main | `RangeError` via IPC |

### Performance Tracing
| Demo | What it does |
|---|---|
| Bonsai Tree | 200ms busy-wait wrapped in `Sentry.startSpan()` |
| Ivy Vine | 20 parallel fetches each in their own child span under one parent transaction (N+1 pattern) |

### Structured Logging (`enableLogs: true`)
Every error and performance action emits a `Sentry.logger.*` call (`info`, `warn`, `error`, `log`). The `beforeSendLog` hook attaches the current user's email to every log entry.

### Custom Metrics
Every error button click records `Sentry.metrics.count('demo.error.triggered', 1, { tags: { errorType } })`. The slow span records `Sentry.metrics.distribution('demo.task.duration', ms, { unit: 'millisecond' })`. The N+1 demo records a `metrics.count` on trigger and a `metrics.gauge` for items fetched.

### Session Replay
`replayIntegration` is active with `replaysSessionSampleRate: 1.0` and `replaysOnErrorSampleRate: 1.0`. Every session is recorded and replayed in Sentry. `networkDetailAllowUrls: [/.*/]` captures full request/response detail for all network calls.

### Browser Profiling
`browserProfilingIntegration` is active with `profilesSampleRate: 1.0`. The main process injects `Document-Policy: js-profiling` via `session.defaultSession.webRequest.onHeadersReceived` — this is required to enable the JS Self-Profiling API in Electron's renderer (equivalent to the `serve.json` header used by the React app).

### User Feedback
`feedbackIntegration` is active and auto-injects a floating feedback button into the renderer. Clicking it opens the Sentry feedback dialog, which automatically attaches to the most recent error event ID stored in `sessionStorage`.

### Offline Event Replay
When the app goes offline, `beforeSend` writes Sentry events to `./offlineEvents/` on disk instead of sending them. When the app reconnects, the IPC `online-status-changed` handler reads those files and replays them to the Sentry Store API.

### Error Fingerprinting
Both `sentry.js` and `src/sentry-renderer.js` include a `beforeSend` hook that sets `event.fingerprint` to `['{{ default }}', errorType]`, grouping issues by JavaScript error class rather than message.

### Customer Type Tag
On renderer startup, a random `customerType` (`small-plan`, `medium-plan`, `large-plan`, `enterprise`) is set on the scope and as a global metric attribute — matching the Empower Plant React app's tagging pattern.

---

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@sentry/electron` | ^7.10.0 | Sentry SDK (main + renderer) |
| `@sentry/cli` | ^3.x | Debug symbol upload CLI |
| `axios` | ^1.x | HTTP client for offline event replay |
| `jquery` | ^3.x | DOM helpers in the renderer |
| `electron` | ^41+ | App runtime |
| `@sentry/webpack-plugin` | ^5.x | Source map upload at build time |
| `webpack` | ^5.x | Renderer bundle + source map generation |

---

## Docs

- [Sentry Electron SDK](https://docs.sentry.io/platforms/javascript/guides/electron/)
- [Electron debug symbols on GitHub Releases](https://github.com/electron/electron/releases)
- [Sentry Custom Metrics](https://docs.sentry.io/product/metrics/)
- [Sentry Structured Logging](https://docs.sentry.io/platforms/javascript/guides/electron/logs/)
- [Sentry User Feedback](https://docs.sentry.io/product/user-feedback/)
