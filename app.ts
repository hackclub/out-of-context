import { App, LogLevel } from '@slack/bolt';
import 'dotenv/config';
import { config } from './src/config/index.js';
import { startOAuthServer } from './src/interfaces/http/oauth-server.js';
import registerListeners from './listeners/index.js';

const logLevel = (process.env.LOG_LEVEL as LogLevel | undefined)
  ?? (process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG);

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel,
});

registerListeners(app);
startOAuthServer();

(async () => {
  try {
    await app.start(process.env.PORT || 3000);

    if (config.slack.oocChannelId) {
      await app.client.conversations
        .join({ channel: config.slack.oocChannelId })
        .catch((err: any) => {
          if (err?.data?.error === 'already_in_channel') return;
          app.logger.warn('[startup] Could not join OOC channel — direct-post enforcement disabled:', err);
        });
    }

    app.logger.info('Out of Context is running....');
  } catch (error) {
    app.logger.error('Unable to start App', error);
  }
})();
