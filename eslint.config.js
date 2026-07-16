import neostandard from 'neostandard'

export default neostandard({
  env: ['node', 'vitest'],
  ignores: [
    ...neostandard.resolveIgnoresFromGitignore(),
    'src/services/feature-control-store-and-inform.js',
    'src/common/start-server.test.js'
  ], // temporary
  noJsx: true,
  noStyle: true
})
