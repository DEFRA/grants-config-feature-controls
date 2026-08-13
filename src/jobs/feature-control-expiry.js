import cron from 'node-cron'
import { createLogger } from '#/common/helpers/logging/logger.js'
import { config } from '#/config.js'

const logger = createLogger()

export const featureControlExpiryJob = () => {
  logger.info('Hello from schedule job')
}

export const startFeatureExpiryJob = () => {
  const schedule = config.get('jobs.featureControlExpiry.schedule')
  cron.schedule(schedule, featureControlExpiryJob, {
    scheduled: true,
    timezone: 'UTC'
  })
  logger.info('Scheduled jobs started')
}
