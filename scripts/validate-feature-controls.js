import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { load } from 'js-yaml'
//ignore cannot resolve file message about below line, this will be added dynamically by pipeline
import { postAddFeatureControlSchema } from './feature-control-schemas.temp.js'

const controlsDirectory = 'feature-controls'

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

const validate = () => {
  const args = process.argv.slice(2)
  let files = []

  if (args.length > 0) {
    files = args.filter((file) => file.endsWith('.yml'))
    if (files.length === 0) {
      console.log('No feature control files to validate.')
      return
    }
  } else {
    files = getAllYamlFiles(controlsDirectory)
  }

  let hasError = false
  const featureControlNames = new Map()

  for (const filePath of files) {
    try {
      const fileContent = readFileSync(filePath, 'utf8')
      const yamlData = load(fileContent)

      if (!yamlData) {
        console.warn(`Skipping empty file: ${filePath}`)
        continue
      }

      const name = yamlData.name ? yamlData.name.toUpperCase() : undefined
      if (name) {
        if (featureControlNames.has(name)) {
          featureControlNames.get(name).push(filePath)
        } else {
          featureControlNames.set(name, [filePath])
        }
      }

      const featureControl = {
        name,
        displayName: yamlData.displayName,
        type: yamlData.type,
        description: yamlData.description,
        scopes: yamlData.scopes,
        owner: yamlData.owner,
        expiryDate: yamlData.expiryDate
          ? new Date(yamlData.expiryDate).toISOString()
          : undefined,
        createdBy: 'system',
        initialValue: yamlData.initial_value
          ? transformEnvironmentValues(yamlData.initial_value)
          : undefined
      }

      if (yamlData.roleRequired) {
        featureControl.roleRequired = transformEnvironmentValues(
          yamlData.roleRequired
        )
      }
      if (yamlData.environments) {
        featureControl.environments = yamlData.environments
      }

      const { error } = postAddFeatureControlSchema.validate(featureControl, {
        abortEarly: false
      })

      if (error) {
        console.error(`Validation failed for ${filePath}:`)
        error.details.forEach((detail) => {
          console.error(`  - ${detail.message}`)
        })
        hasError = true
      } else {
        console.log(`Successfully validated ${filePath}`)
      }
    } catch (err) {
      console.error(
        `Failed to process feature control file ${filePath}:`,
        err.message
      )
      hasError = true
    }
  }

  for (const [name, filePaths] of featureControlNames.entries()) {
    if (filePaths.length > 1) {
      console.error(`Duplicate feature control name found: ${name}`)
      filePaths.forEach((filePath) => {
        console.error(`  - ${filePath}`)
      })
      hasError = true
    }
  }

  if (hasError) {
    process.exit(1)
  }
}

validate()
