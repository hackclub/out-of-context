import type { App } from '@slack/bolt';
import { registerDMHandler } from '../src/interfaces/slack/handlers/dmHandler.js';

const registerListeners = (app: App) => {
  registerDMHandler(app);
};

export default registerListeners;
