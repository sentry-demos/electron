const { BrowserTracing } = require("@sentry/tracing");
const { init } = require('@sentry/electron');
const fs = require('fs');

init({
  // TODO: Replace with your project's DSN
  dsn: 'https://aab0a4e2af5a4df0a9adf094e657809e@o87286.ingest.sentry.io/1318230',

  // This enables automatic instrumentation (highly recommended), but is not
  // necessary for purely manual usage
  integrations: [new BrowserTracing()],

  // To set a uniform sample rate
  tracesSampleRate: 1.0,
  beforeSend(event) {
    if (event.tags.onlineStatus === 'online') {
      return event
    } else if (event.tags.onlineStatus === 'offline') {
      console.log('OFFLINE')
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

