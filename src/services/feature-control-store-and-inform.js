import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { load } from 'js-yaml'
import { config } from '../config.js'
import {
  findFeatureControlByName,
  upsertFeatureControl,
  setFeatureControlToWithdrawn
} from '../repository/feature-control-repository.js'
import {
  getFeatureControl,
  notifyFeatureControlCreatedOrUpdated,
  notifyFeatureControlWithdrawn
} from '../api/config-broker-api.js'

const controlsDirectory = 'feature-controls'

export const informBrokerOfFeatureControls = async (server) => {
  const files = getAllYamlFiles(controlsDirectory)
  const featureControlNames = new Map()

  for (const filePath of files) {
    await processFeatureControlFile(filePath, server, featureControlNames)
  }

  for (const [name, filePaths] of featureControlNames.entries()) {
    if (filePaths.length > 1) {
      server.logger.error(
        `Duplicate feature control name found: ${name} in files: ${filePaths.join(', ')}`
      )
    }
  }
}

const getAllYamlFiles = (dirPath, arrayOfFiles = []) => {
  const files = readdirSync(dirPath)

  files.forEach((file) => {
    const filePath = path.join(dirPath, file)
    if (statSync(filePath).isDirectory()) {
      getAllYamlFiles(filePath, arrayOfFiles)
    } else if (file.endsWith('.yml')) {
      arrayOfFiles.push(filePath)
    }
  })

  return arrayOfFiles
}

const processFeatureControlFile = async (
  filePath,
  server,
  featureControlNames
) => {
  const { db, logger } = server

  try {
    const fileContent = readFileSync(filePath, 'utf8')
    const yamlData = load(fileContent)

    if (!yamlData) {
      logger.warn(`Skipping empty file: ${filePath}`)
      return
    }

    const name = yamlData.name.toUpperCase()
    if (featureControlNames.has(name)) {
      featureControlNames.get(name).push(filePath)
    } else {
      featureControlNames.set(name, [filePath])
    }

    const shouldSendToBroker =
      yamlData.environments?.includes(config.get('cdpEnvironment')) ?? true

    const featureControl = {
      name,
      displayName: yamlData.displayName,
      type: yamlData.type,
      description: yamlData.description,
      scopes: yamlData.scopes,
      owner: yamlData.owner,
      expiryDate: new Date(yamlData.expiryDate),
      createdBy: config.get('serviceDeployer'),
      initialValue: transformEnvironmentValues(yamlData.initial_value)
    }

    if (yamlData.roleRequired) {
      featureControl.roleRequired = transformEnvironmentValues(
        yamlData.roleRequired
      )
    }
    if (yamlData.environments) {
      featureControl.environments = yamlData.environments
    }

    const shouldProceed = await checkIfNewOrUpdated(db, featureControl)

    if (shouldProceed) {
      logger.info(`Updating feature control: ${featureControl.name}`)
      await upsertFeatureControl(db, featureControl)

      if (shouldSendToBroker) {
        await notifyFeatureControlCreatedOrUpdated(featureControl, server)
      } else {
        await withdrawFeatureControlIfExistsInBroker(featureControl, server)
      }
    } else {
      logger.info(
        `Feature control ${featureControl.name} is up to date, will not inform config-broker`
      )
    }
  } catch (err) {
    logger.error(err, `Failed to process feature control file ${filePath}:`)
  }
}

const checkIfNewOrUpdated = async (db, featureControl) => {
  const existing = await findFeatureControlByName(db, featureControl.name)
  if (!existing) {
    return true
  }

  // remove MongoDB internal fields
  const { _id, ...existingData } = existing

  return !isDeepStrictEqual(existingData, featureControl)
}

const withdrawFeatureControlIfExistsInBroker = async (
  featureControl,
  server
) => {
  if (await getFeatureControl(featureControl.name, server)) {
    const payload = {
      name: featureControl.name,
      status: 'withdrawn',
      user: featureControl.createdBy,
      note: 'Withdrawn — definition updated'
    }
    await notifyFeatureControlWithdrawn(payload, server)

    await setFeatureControlToWithdrawn(server.db, featureControl)
  }
}

const transformEnvironmentValues = (initialValueArrayOrObject) => {
  if (Array.isArray(initialValueArrayOrObject)) {
    const obj = {}
    initialValueArrayOrObject.forEach((item) => {
      if (item.name) {
        obj[item.name] = item.value
      }
    })
    return obj
  }

  return initialValueArrayOrObject
}
