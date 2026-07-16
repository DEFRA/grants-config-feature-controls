// import { readFileSync, existsSync, lstatSync, readdirSync } from "node:fs";
import { config } from '../config.js'

const controlsDirectory = 'feature-controls'

export const informBrokerOfFeatureControls = async (logger) => {
  const configsAtServiceVersion = constructConfigsAtServiceVersion()

  if (await configAlreadyPublished(configsAtServiceVersion, logger)) {
    return // exit early, broker already published config
  }

  // await storeConfigAtServiceVersion(configsAtServiceVersion, logger);
  //
  // await notifyConfigBrokerServiceVersionAvailable(
  //   configsAtServiceVersion,
  //   logger,
  // );
}

const constructConfigsAtServiceVersion = () => {
  const version = config.get('serviceVersion')

  //we may still want to use this version to store with metadata in mongo to decide on whether we want to emit message to config-broker

  // all top-level directories are considered separate grant configurations
  // const configDirs = readdirSync(controlsDirectory, { withFileTypes: true })
  //   .filter((dirent) => dirent.isDirectory())
  //   .map((dirent) => dirent.name);
  //
  // // iterate each grant configuration, collecting: grant, version and files
  // return configDirs.map((grant) => {
  //   const files = readdirSync(`${controlsDirectory}/${grant}`, {
  //     withFileTypes: true,
  //     recursive: true,
  //   })
  //     .filter((dirent) => dirent.isFile())
  //     .map((dirent) => {
  //       const configPath = `${controlsDirectory}/${grant}`;
  //
  //       const direntWithoutConfigPath = dirent.parentPath
  //         ? `${dirent.parentPath.replace(configPath, "")}/${dirent.name}`
  //         : `${dirent.name}`;
  //
  //       const localPath = `${configPath}${direntWithoutConfigPath}`;
  //       const s3Path = `${grant}/${version}${direntWithoutConfigPath}`;
  //       return [localPath, s3Path];
  //     });
  //
  //   return { grant, version, files };
  // });
}

const configAlreadyPublished = async (configsAtServiceVersion, logger) => {
  // using the config-store-and-inform service as an inspiration, check MongoDB for existing configs
  // for (const { grant, version } of configsAtServiceVersion) {
  //   const files = await listFiles(logger, `${grant}/${version}/metadata.json`);
  //   if (files.length > 0) {
  //     logger.warn(
  //       `grant config '${grant}' at version '${version}' already published, not safe to store`,
  //     );
  //     return true;
  //   }
  // }
  return false
}

const sendConfigMessageToBroker = async (
  configBrokerEndpoint,
  configAtServiceVersion,
  configPublishStatus,
  logger
) => {
  const { grant, version, files } = configAtServiceVersion
  // files is an array of tuples, we only want the S3 paths here
  const s3Paths = files.map(([_, s3Path]) => s3Path)

  // When CDP is updated to inject user that did deployment of container, reference that injected variable from config here
  const user = 'system'

  const payload = {
    grant,
    version,
    files: s3Paths,
    status: configPublishStatus,
    user
  }

  const url = new URL(`/api/release-config`, configBrokerEndpoint)
  try {
    const response = await fetch(url.href, {
      method: 'POST',
      headers: {
        // ...createApiHeadersForConfigBroker(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (response.ok) {
      logger.info(
        `successfully notified the config broker about '${grant}' at version '${version}'`
      )
    } else {
      logger.error(
        `call to release config failed with status '${response.status}' and text '${response.statusText}'`
      )
    }
  } catch (err) {
    logger.error('call to release config failed', err)
  }
}
