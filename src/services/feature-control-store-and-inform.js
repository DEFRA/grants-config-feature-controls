import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { load } from 'js-yaml'
import { config } from '../config.js'
import {
  findFeatureControlByName,
  upsertFeatureControl
} from '../repository/feature-control-repository.js'

const controlsDirectory = 'feature-controls'

export const informBrokerOfFeatureControls = async (server) => {
  const { db, logger } = server

  const files = readdirSync(controlsDirectory).filter((file) =>
    file.endsWith('.yml')
  )

  for (const file of files) {
    try {
      const filePath = path.join(controlsDirectory, file)
      const fileContent = readFileSync(filePath, 'utf8')
      const yamlData = load(fileContent)

      const featureControl = {
        name: yamlData.name.toUpperCase(),
        type: yamlData.type,
        description: yamlData.description,
        scopes: yamlData.scopes,
        owner: yamlData.owner,
        expiryDate: new Date(yamlData.expiryDate).toISOString(),
        createdBy: config.get('serviceDeployer'),
        initialValue: transformInitialValue(yamlData.initial_value)
      }

      if (yamlData.roleRequired) {
        featureControl.roleRequired = yamlData.roleRequired
      }

      const existing = await findFeatureControlByName(db, featureControl.name)

      let shouldProceed = false
      if (!existing) {
        shouldProceed = true
      } else {
        // Remove MongoDB internal fields for comparison
        const { _id, ...existingData } = existing
        // Compare data. We use stringify for a simple deep comparison of plain objects
        if (JSON.stringify(existingData) !== JSON.stringify(featureControl)) {
          shouldProceed = true
        }
      }

      if (shouldProceed) {
        logger.info(`Updating feature control: ${featureControl.name}`)
        await upsertFeatureControl(db, featureControl)

        await sendToBroker(featureControl, logger)
      } else {
        logger.info(
          `Feature control ${featureControl.name} is up to date, will not inform config-broker`
        )
      }
    } catch (err) {
      logger.error(`Failed to process feature control file ${file}:`, err)
    }
  }
}

const transformInitialValue = (initialValueArray) => {
  if (!Array.isArray(initialValueArray)) return initialValueArray
  const obj = {}
  initialValueArray.forEach((item) => {
    obj[item.name] = item.value
  })
  return obj
}

const sendToBroker = async (payload, logger) => {
  const baseUrl = config.get('configBroker.baseUrl')
  // The schema location suggested /api/feature-control or similar
  // Based on the prompt's context of config broker and feature-control-schemas.js
  const url = new URL('/api/feature-control', baseUrl)

  try {
    const response = await fetch(url.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
      `Error notifying the config broker about feature control '${payload.name}':`,
      err
    )
  }
}
