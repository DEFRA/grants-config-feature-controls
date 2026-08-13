import cron from 'node-cron'
import { config } from '#/config.js'
import {
  findNewlyExpiredFeatureControls,
  setFeatureControlToExpired
} from '#/repository/feature-control-repository.js'
import { notifyFeatureControlExpired } from 'src/api/config-broker-api.js'

export const featureControlExpiryJob = async (server) => {
  server.logger.info('Running feature control expiry job..')

  const expiredFeatureControls = await findNewlyExpiredFeatureControls(
    server.db
  )

  for (const featureControl of expiredFeatureControls) {
    await notifyFeatureControlExpired(
      {
        name: featureControl.name,
        status: 'expired',
        user: 'system',
        note: 'Expired — expiry date reached'
      },
      server
    )
    await setFeatureControlToExpired(server.db, featureControl)
  }

  server.logger.info('Feature control expiry job completed successfully')
}

export const startFeatureExpiryJob = (server) => {
  const schedule = config.get('jobs.featureControlExpiry.schedule')
  cron.schedule(schedule, () => featureControlExpiryJob(server), {
    scheduled: true,
    timezone: 'UTC'
  })
  server.logger.info('Feature control expiry scheduled job started')
}
