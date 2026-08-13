import { config } from '#/config.js'
import { createServer } from '#/server.js'
import { informBrokerOfFeatureControls } from '#/services/feature-control-store-and-inform.js'
import { startFeatureExpiryJob } from '#/jobs/feature-control-expiry.js'

export async function startServer() {
  const server = await createServer()
  await server.start()

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access your backend on http://localhost:${config.get('port')}`
  )

  await informBrokerOfFeatureControls(server)

  startFeatureExpiryJob()

  return server
}
