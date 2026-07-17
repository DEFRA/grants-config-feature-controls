import { config } from '#/config.js'
import { createServer } from '#/server.js'
import { informBrokerOfFeatureControls } from '#/services/feature-control-store-and-inform.js'

export async function startServer() {
  const server = await createServer()
  await server.start()

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access your backend on http://localhost:${config.get('port')}`
  )

  await informBrokerOfFeatureControls(server)

  return server
}
