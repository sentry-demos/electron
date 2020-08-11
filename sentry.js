const { init } = require('@sentry/electron');
const fs = require('fs');

init({
  // TODO: Replace with your project's DSN
  dsn: 'https://4bf1205ddeb946a28c75f9784513459d@sentry.io/1466009',
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

