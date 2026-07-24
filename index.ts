import { config } from './src/config'
import { app } from './src/slack'

Bun.serve({
	routes: {
		'/slack/events': (req) => app.receiver.fetch(req),
	},
	port: config.port,
})

console.log(`Server listening on port ${config.port}`)
