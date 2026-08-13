import cron from 'node-cron'
import { config } from '#/config.js'
import {
  findNewlyExpiredFeatureControls,
  setFeatureControlToExpired
} from '#/repository/feature-control-repository.js'
import { createAuthenticatedHeaders } from '@defra/grants-config-utils/broker'

export const featureControlExpiryJob = async (server) => {
  server.logger.info('Running feature control expiry job..')

  const expiredFeatureControls = await findNewlyExpiredFeatureControls(
    server.db
  )

  for (const featureControl of expiredFeatureControls) {
    await callBrokerToExpireFeatureControl(
      {
        name: featureControl.name,
        status: 'expired',
        user: 'system',
        note: 'Expired — expiry date reached'
      },
      server.logger,
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

const callBrokerToExpireFeatureControl = async (payload, logger, server) => {
  const apiUrl = config.get('configBroker.apiUrl') + '/status'
  const authEnabled = config.get('configBroker.serviceAuth.enabled')
  const url = new URL(apiUrl)

  try {
    let headers = {
      'Content-Type': 'application/json'
    }
    if (authEnabled) {
      headers = await createAuthenticatedHeaders(server, headers)
    }

    const response = await fetch(url.href, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    })

    if (response.ok) {
      logger.info(
        `Successfully notified the config broker about feature control '${payload.name}'`
      )
    } else {
      const responseText = await response.text()
      logger.error(
        `Failed to notify the config broker about feature control '${payload.name}'. Status: ${response.status}. Error: ${responseText}`
      )
    }
  } catch (err) {
    logger.error(
      err,
      `Error notifying the config broker about feature control '${payload.name}':`
    )
  }
}
