import process from 'node:process'

import { createLogger } from '#/common/helpers/logging/logger.js'
import { startServer } from '#/common/start-server.js'

await startServer()

process.on('unhandledRejection', (error) => {
  const logger = createLogger()
  logger.info('Unhandled rejection')
  logger.error(error)
  process.exitCode = 1
})
