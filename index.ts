import { config } from './src/config'
import { createUser, setUserRole } from './src/queries/users'
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

if (config.superAdminId) {
	;(async (userId: string) => {
		await createUser(userId)
		await setUserRole(userId, 'SUPER_ADMIN')
	})(config.superAdminId).catch((e) => console.error('Failed to set default super admin:', e))
}
