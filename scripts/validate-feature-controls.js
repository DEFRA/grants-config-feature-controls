import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { load } from 'js-yaml'
//ignore cannot resolve file message about below line, this will added dynamically by pipeline
import { postAddFeatureControlSchema } from './feature-control-schemas.temp.js'

const controlsDirectory = 'feature-controls'

const transformInitialValue = (initialValueArray) => {
  const obj = {}
  initialValueArray.forEach((item) => {
    obj[item.name] = item.value
  })
  return obj
}

const validate = () => {
  const files = readdirSync(controlsDirectory).filter((file) =>
    file.endsWith('.yml')
  )

  let hasError = false

  for (const file of files) {
    try {
      const filePath = path.join(controlsDirectory, file)
      const fileContent = readFileSync(filePath, 'utf8')
      const yamlData = load(fileContent)

      if (!yamlData) {
        console.warn(`Skipping empty file: ${file}`)
        continue
      }

      const featureControl = {
        name: yamlData.name ? yamlData.name.toUpperCase() : undefined,
        type: yamlData.type,
        description: yamlData.description,
        scopes: yamlData.scopes,
        environments: yamlData.environments,
        owner: yamlData.owner,
        expiryDate: yamlData.expiryDate
          ? new Date(yamlData.expiryDate).toISOString()
          : undefined,
        createdBy: 'system',
        initialValue: yamlData.initial_value
          ? transformInitialValue(yamlData.initial_value)
          : undefined
      }

      if (yamlData.roleRequired) {
        featureControl.roleRequired = yamlData.roleRequired
      }

      const { error } = postAddFeatureControlSchema.validate(featureControl, {
        abortEarly: false
      })

      if (error) {
        console.error(`Validation failed for ${file}:`)
        error.details.forEach((detail) => {
          console.error(`  - ${detail.message}`)
        })
        hasError = true
      } else {
        console.log(`Successfully validated ${file}`)
      }
    } catch (err) {
      console.error(
        `Failed to process feature control file ${file}:`,
        err.message
      )
      hasError = true
    }
  }

  if (hasError) {
    process.exit(1)
  }
}

validate()
