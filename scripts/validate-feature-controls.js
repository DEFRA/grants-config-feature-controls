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
  const { files, isAllFiles } = getFilesToValidate(
    process.argv.slice(2)
  )

  let hasError = false

  // Firstly, check that the feature controls are valid against the schema
  for (const filePath of files) {
    try {
      const fileContent = readFileSync(filePath, 'utf8')
      const yamlData = load(fileContent)

      if (!yamlData) {
        console.warn(`Skipping empty file: ${filePath}`)
        continue
      }

      const featureControl = {
        name: yamlData.name ? yamlData.name.toUpperCase() : undefined,
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

  // Then, check for duplicate feature control names
  const duplicateNames = getDuplicateNames(files, isAllFiles)
  for (const [name, filePaths] of duplicateNames) {
    console.error(`Duplicate feature control name found: ${name}`)
    filePaths.forEach((filePath) => {
      console.error(`  - ${filePath}`)
    })
    hasError = true
  }

  if (hasError) {
    process.exit(1)
  }
}

const getFilesToValidate = (args) => {
  if (args.length > 0) {
    const files = args.filter((file) => file.endsWith('.yml'))
    return { files, isAllFiles: false }
  } else {
    const files = getAllYamlFiles(controlsDirectory)
    return { files, isAllFiles: true }
  }
}

const getDuplicateNames = (files, isAllFiles) => {
  const duplicateNames = new Map()
  const nameToFilePaths = new Map()

  const allFiles = isAllFiles ? files : getAllYamlFiles(controlsDirectory)
  for (const filePath of allFiles) {
    try {
      const fileContent = readFileSync(filePath, 'utf8')
      const yamlData = load(fileContent)

      if (yamlData && yamlData.name) {
        const name = yamlData.name.toUpperCase()
        if (!nameToFilePaths.has(name)) {
          nameToFilePaths.set(name, [])
        }
        nameToFilePaths.get(name).push(filePath)
      }
    } catch {
      // Ignore any errors handled in the main validation
    }
  }

  for (const [name, filePaths] of nameToFilePaths.entries()) {
    if (filePaths.length > 1) {
      // If we are validating a subset of files, we only care if one of the duplicates is in our subset
      const containsValidatedFile =
        isAllFiles || filePaths.some((fp) => files.includes(fp))
      if (containsValidatedFile) {
        duplicateNames.set(name, filePaths)
      }
    }
  }

  return duplicateNames
}

validate()
