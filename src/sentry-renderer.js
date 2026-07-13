const Sentry = require('@sentry/electron/renderer');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.SENTRY_RELEASE,
  environment: process.env.SENTRY_ENVIRONMENT,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  propagateTraceparent: true,
  tracePropagationTargets: ['localhost', /empower-plant\.com/, /\.run\.app$/],
  debug: true,
  enableLogs: true,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
    Sentry.feedbackIntegration({ colorScheme: 'system' }),
    Sentry.replayIntegration({
      blockAllMedia: false,
      networkDetailAllowUrls: [/.*/],
      unmask: ['.sentry-unmask'],
    }),
    Sentry.browserProfilingIntegration(),
    Sentry.elementTimingIntegration(),
  ],

  beforeSendLog: (log) => {
    const tags = Sentry.getIsolationScope().getScopeData().tags;
    if (tags && 'user.email' in tags) {
      log.attributes['user.email'] = tags['user.email'];
    }
    return log;
  },

  beforeSend(event) {
    if (event.exception) {
      const errorType = event.exception.values?.[0]?.type;
      if (errorType) {
        event.fingerprint = ['{{ default }}', errorType];
      }
      sessionStorage.setItem('lastErrorEventId', event.event_id);
    }
    return event;
  },
});

module.exports = Sentry;
