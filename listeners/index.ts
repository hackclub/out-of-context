import type { App } from '@slack/bolt';
import { registerActionHandlers } from '../src/interfaces/slack/handlers/actionHandler.js';
import { registerChannelHandler } from '../src/interfaces/slack/handlers/channelHandler.js';
import { registerCommandHandlers } from '../src/interfaces/slack/handlers/commandHandler.js';
import { registerDMHandler } from '../src/interfaces/slack/handlers/dmHandler.js';
import { registerModeratorHandlers } from '../src/interfaces/slack/handlers/moderatorHandler.js';
import { registerShortcutHandler } from '../src/interfaces/slack/handlers/shortcutHandler.js';

const registerListeners = (app: App) => {
  registerDMHandler(app);
  registerCommandHandlers(app);
  registerActionHandlers(app);
  registerModeratorHandlers(app);
  registerShortcutHandler(app);
  registerChannelHandler(app);
};

export default registerListeners;
