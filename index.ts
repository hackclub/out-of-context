import { config } from './src/config'
import { app, userApp } from './src/slack'
import { attachListeners } from './src/slack/listeners'

attachListeners(app, userApp)

Bun.serve({
	routes: {
		'/slack/events': (req) => userApp.receiver.fetch(req),
	},
	port: config.port,
})

console.log(`Server listening on port ${config.port}`)
