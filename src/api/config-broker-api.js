import { config } from '../config.js'
import { createAuthenticatedHeaders } from '@defra/grants-config-utils/broker'

const brokerApiUrlConfigKey = 'configBroker.apiUrl'

export const getFeatureControl = async (name, server) => {
  const { logger } = server
  const brokerApiUrl = config.get(brokerApiUrlConfigKey)
  const apiUrl = `${brokerApiUrl}/${name}`
  const url = new URL(apiUrl)

  try {
    const headers = await getHeaders(server)

    const response = await fetch(url.href, {
      method: 'GET',
      headers
    })

    return response.ok ? await response.json() : null
  } catch (err) {
    logger.error(err, 'Error fetching feature control: ' + name)
    throw err
  }
}

export const notifyFeatureControlCreatedOrUpdated = async (
  featureControl,
  server
) => {
  await notify(
    {
      method: 'POST',
      body: JSON.stringify(featureControl),
      path: ''
    },
    server,
    `Successfully notified the config broker about feature control '${featureControl.name}'`,
    `Failed to notify the config broker about feature control '${featureControl.name}'.`,
    `Error notifying the config broker about feature control '${featureControl.name}':`
  )
}

export const notifyFeatureControlExpired = async (payload, server) => {
  await notify(
    {
      method: 'PUT',
      body: JSON.stringify(payload),
      path: '/status'
    },
    server,
    `Successfully notified the config broker about feature control expiry '${payload.name}'`,
    `Failed to notify the config broker about feature control expiry '${payload.name}'.`,
    `Error notifying the config broker about feature control expiry '${payload.name}':`
  )
}

export const notifyFeatureControlWithdrawn = async (payload, server) => {
  await notify(
    {
      method: 'PUT',
      body: JSON.stringify(payload),
      path: '/status'
    },
    server,
    `Successfully notified the config broker about feature control withdrawn '${payload.name}'`,
    `Failed to notify the config broker about feature control withdrawn '${payload.name}'.`,
    `Error notifying the config broker about feature control withdrawn '${payload.name}':`
  )
}

const notify = async (
  requestOptions,
  server,
  successMessage,
  errorMessage,
  exceptionMessage
) => {
  const { logger } = server
  const brokerApiUrl = config.get(brokerApiUrlConfigKey)
  const apiUrl = brokerApiUrl + (requestOptions.path || '')
  const url = new URL(apiUrl)

  try {
    const headers = await getHeaders(server)

    const response = await fetch(url.href, {
      method: requestOptions.method,
      headers,
      body: requestOptions.body
    })

    await handleResponse(response, logger, successMessage, errorMessage)
  } catch (err) {
    logger.error(err, exceptionMessage)
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
