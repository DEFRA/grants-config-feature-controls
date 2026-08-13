import { config } from '../config.js'
import { createAuthenticatedHeaders } from '@defra/grants-config-utils/broker'

export const notifyFeatureControlCreatedOrUpdated = async (
  featureControl,
  server
) => {
  const { logger } = server
  const apiUrl = config.get('configBroker.apiUrl')
  const url = new URL(apiUrl)

  try {
    const headers = await getHeaders(server)

    const response = await fetch(url.href, {
      method: 'POST',
      headers,
      body: JSON.stringify(featureControl)
    })

    await handleResponse(
      response,
      logger,
      `Successfully notified the config broker about feature control '${featureControl.name}'`,
      `Failed to notify the config broker about feature control '${featureControl.name}'.`
    )
  } catch (err) {
    logger.error(
      err,
      `Error notifying the config broker about feature control '${featureControl.name}':`
    )
    throw err
  }
}

export const notifyFeatureControlExpired = async (payload, server) => {
  const { logger } = server
  const apiUrl = config.get('configBroker.apiUrl') + '/status'
  const url = new URL(apiUrl)

  try {
    const headers = await getHeaders(server)

    const response = await fetch(url.href, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    })

    await handleResponse(
      response,
      logger,
      `Successfully notified the config broker about feature control expiry '${payload.name}'`,
      `Failed to notify the config broker about feature control expiry '${payload.name}'.`
    )
  } catch (err) {
    logger.error(
      err,
      `Error notifying the config broker about feature control expiry '${payload.name}':`
    )
    throw err
  }
}

const getHeaders = async (server) => {
  const authEnabled = config.get('configBroker.serviceAuth.enabled')
  let headers = {
    'Content-Type': 'application/json'
  }
  if (authEnabled) {
    headers = await createAuthenticatedHeaders(server, headers)
  }
  return headers
}

const handleResponse = async (
  response,
  logger,
  successMessage,
  errorMessage
) => {
  if (!response) {
    return
  }
  if (response.ok) {
    logger.info(successMessage)
  } else {
    const responseText = await response.text()
    logger.error(
      `${errorMessage} Status: ${response.status}. Error: ${responseText}`
    )
  }
}
