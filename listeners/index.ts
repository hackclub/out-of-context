import type { App } from '@slack/bolt';
import { registerActionHandlers } from '../src/interfaces/slack/handlers/actionHandler.js';
import { registerCommandHandlers } from '../src/interfaces/slack/handlers/commandHandler.js';
import { registerDMHandler } from '../src/interfaces/slack/handlers/dmHandler.js';
import { registerModeratorHandlers } from '../src/interfaces/slack/handlers/moderatorHandler.js';

const registerListeners = (app: App) => {
  registerDMHandler(app);
  registerCommandHandlers(app);
  registerActionHandlers(app);
  registerModeratorHandlers(app);
};

export default registerListeners;
