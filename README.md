# grants-config-feature-controls

Core delivery platform Node.js Backend Template.

- [Grant Configuration](#grant-configuration)
  - [Create new](#create-new)
  - [Update existing](#update-existing)
  - [Non-configuration changes](#non-configuration-changes)
  - [Hotfix release](#hotfix-release)
- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Local development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Testing](#testing)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [API endpoints](#api-endpoints)
- [Development helpers](#development-helpers)
  - [MongoDB Locks](#mongodb-locks)
  - [Proxy](#proxy)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Grant Configuration

### Create new

Each directory within the `configurations` folder represents a separate grant.

To create a new grant:

1. Create a new directory under `configurations`, for example:

   ```text
   configurations/playground
   ```

2. Add at least one configuration file, for example:

   ```text
   configurations/playground/slide-config/main.json
   ```

3. Create a new version:

   ```bash
   npm run version
   ```

4. Stage and commit your changes using the standard commit format:

   ```bash
   git add .
   git commit -m "feat(YOUR-TICKET): YOUR-MESSAGE"
   ```

5. Push your branch and then follow the standard GitHub pull request process.

   ```bash
   git push
   ```

### Update existing

To update the configuration for an existing grant:

1. Add or modify the required configuration files.

2. Create a new version:

   ```bash
   npm run version
   ```

3. Stage and commit your changes:

   ```bash
   git add .
   git commit -m "feat(YOUR-TICKET): YOUR-MESSAGE"
   ```

4. Push your branch and then follow the standard GitHub pull request process.

   ```bash
   git push
   ```

### Non-configuration changes

Any change that does not modify the contents of the `configurations` directory is considered a **non-configuration change**.

Do **not** create a changeset for these changes. Non-configuration changes do not trigger service publication when merged into `main`.

### Hotfix release

Hotfix releases should only be used as a last resort when a fix cannot be delivered through the normal release process because subsequent releases contain incompatible changes.

> **Important:** Changes made on a hotfix branch are not automatically included in future releases. After publishing the hotfix, apply the same changes to `main` to ensure they are included in the next release.

Hotfix releases can only increment the **patch** version of an existing release.

If a hotfix is required, complete the following steps:

1. Create a hotfix branch from the tagged release version that requires the fix. For example, the following command creates a `hotfix-releases/6.3.x` branch from the `6.3.0` tag:

   ```bash
   git fetch --tags
   git switch -c hotfix-releases/6.3.x tags/6.3.0
   ```

2. Make the required configuration changes.

3. Create a new patch version:

   ```bash
   npm run version
   ```

4. Stage, commit, and push your changes.

5. Manually run the **Publish Hot Fix** GitHub workflow.

   **Note:** This workflow only runs on branches with the `hotfix-releases/` prefix.

   The workflow will:
   - Publish the new patch version.
   - Remove the generated changeset file.

   The workflow requires a `description` input, which is used as part of the workflow run name.

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v24` and [npm](https://nodejs.org/) `>= v11`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd grants-config-feature-controls
nvm use
```

## Local development

### Setup

Install application dependencies:

```bash
npm install
```

### Git hooks

Install git hooks (optional)

```bash
npm run git:hooks
```

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

### Testing

To test the application run:

```bash
npm run test
```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json).
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## API endpoints

| Endpoint       | Description |
| :------------- | :---------- |
| `GET: /health` | Health      |

## Development helpers

### MongoDB Locks

If you require a write lock for Mongo you can acquire it via `server.locker` or `request.locker`:

```javascript
async function doStuff(server) {
  const lock = await server.locker.lock('unique-resource-name')

  if (!lock) {
    // Lock unavailable
    return
  }

  try {
    // do stuff
  } finally {
    await lock.free()
  }
}
```

Keep it small and atomic.

You may use **using** for the lock resource management.
Note test coverage reports do not like that syntax.

```javascript
async function doStuff(server) {
  await using lock = await server.locker.lock('unique-resource-name')

  if (!lock) {
    // Lock unavailable
    return
  }

  // do stuff

  // lock automatically released
}
```

Helper methods are also available in `/src/helpers/mongo-lock.js`.

### Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Docker

Build:

```bash
docker build --no-cache --tag grants-config-feature-controls .
```

Run:

```bash
docker run -e PORT=3001 -p 3001:3001 grants-config-feature-controls
```

### Docker Compose

A local environment with:

- Floci for AWS services (S3, SQS, SNS etc)
- Redis
- MongoDB
- This service.
- A commented out frontend example.

```bash
docker compose up --build -d
```

Mock AWS resources can be created when Floci starts up by editing the scripts in `./compose/floci/start.d/`.
MongoDB records can also be created when Mongo starts by editing the scripts in `./compose/mongo/`.

### Dependabot

Dependabot is enabled in this repository.

### SonarCloud

SonarCloud is enabled in this repository.

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
