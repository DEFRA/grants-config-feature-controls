import { informBrokerOfFeatureControls } from './feature-control-store-and-inform.js'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { load } from 'js-yaml'
import { config } from '../config.js'
import {
  findFeatureControlByName,
  upsertFeatureControl
} from '../repository/feature-control-repository.js'
import { createAuthenticatedHeaders } from '@defra/grants-config-utils/broker'

vi.mock('node:fs')
vi.mock('js-yaml')
vi.mock('../config.js', () => ({
  config: {
    get: vi.fn()
  }
}))
vi.mock('@defra/grants-config-utils/broker')
vi.mock('../repository/feature-control-repository.js')
global.fetch = vi.fn()

describe('informBrokerOfFeatureControls', () => {
  let mockServer
  let mockDb
  let mockLogger

  beforeEach(() => {
    mockDb = {}
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }
    mockServer = {
      db: mockDb,
      logger: mockLogger,
      sts: {}
    }
    statSync.mockReturnValue({ isDirectory: () => false })
    config.get.mockImplementation((key) => {
      if (key === 'cdpEnvironment') return 'local'
      if (key === 'serviceDeployer') return 'system'
      if (key === 'configBroker.apiUrl') {
        return 'http://localhost:3001/api/feature-control'
      }
      if (key === 'configBroker.serviceAuth.enabled') return true
      return undefined
    })
    createAuthenticatedHeaders.mockImplementation((server, headers) => ({
      ...headers,
      Authorization: 'Bearer mock-token'
    }))
    vi.clearAllMocks()
  })

  test('should process yml files and notify broker', async () => {
    existsSync.mockReturnValue(true)
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }]
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockResolvedValue({ ok: true })

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ name: 'TEST' })
    )
    expect(fetch).toHaveBeenCalled()
  })

  test('should not notify broker if no change', async () => {
    existsSync.mockReturnValue(true)
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    const data = {
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: new Date('2027-01-01'),
      createdBy: 'system',
      initialValue: { default: true }
    }
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }]
    })
    findFeatureControlByName.mockResolvedValue(data)

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('up to date')
    )
  })

  test('should not notify broker if no change and fields are in different order', async () => {
    existsSync.mockReturnValue(true)
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    const data = {
      // fields in different order than mock returned from db
      initialValue: { default: true },
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: new Date('2027-01-01'),
      createdBy: 'system'
    }
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }]
    })
    findFeatureControlByName.mockResolvedValue(data)

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('up to date')
    )
  })

  test('should notify broker if existing feature control has changed', async () => {
    existsSync.mockReturnValue(true)
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    const existingData = {
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'old desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: new Date('2027-01-01').toISOString(),
      createdBy: 'system',
      initialValue: { default: true }
    }
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'new desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }]
    })
    findFeatureControlByName.mockResolvedValue(existingData)
    fetch.mockResolvedValue({ ok: true })

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalled()
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Updating feature control: TEST')
    )
  })

  test('should process roleRequired if present in yml', async () => {
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }],
      roleRequired: [
        { name: 'default', value: ['admin'] },
        { name: 'test', value: ['test'] }
      ]
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockResolvedValue({ ok: true })

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        name: 'TEST',
        roleRequired: { default: ['admin'], test: ['test'] }
      })
    )
  })

  test('should process roleRequired if present in yml in shorthand format', async () => {
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }],
      roleRequired: { default: ['admin'], test: ['test'] }
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockResolvedValue({ ok: true })

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        name: 'TEST',
        roleRequired: { default: ['admin'], test: ['test'] }
      })
    )
  })

  test('should log error if yml loading fails', async () => {
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockImplementation(() => {
      throw new Error('Read error')
    })

    await informBrokerOfFeatureControls(mockServer)

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.any(Error),
      expect.stringContaining(
        'Failed to process feature control file feature-controls/test.yml:'
      )
    )
  })

  test('should log error if broker returns non-ok status', async () => {
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }]
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error')
    })

    await informBrokerOfFeatureControls(mockServer)

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to notify the config broker about feature control 'TEST'. Status: 500. Error: Internal Server Error"
      )
    )
  })

  test('should log error if broker notification throws', async () => {
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }]
    })
    findFeatureControlByName.mockResolvedValue(null)
    const error = new Error('Network error')
    fetch.mockRejectedValue(error)

    await expect(
      informBrokerOfFeatureControls(mockServer)
    ).resolves.not.toThrow()

    expect(mockLogger.error).toHaveBeenCalledWith(
      error,
      expect.stringContaining(
        "Error notifying the config broker about feature control 'TEST':"
      )
    )
  })

  test('should transform initial_value correctly with multiple items', async () => {
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'object',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [
        { name: 'item1', value: ['val1', 'val2'] },
        { name: 'item2', value: ['val3'] }
      ]
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockResolvedValue({ ok: true })

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        initialValue: {
          item1: ['val1', 'val2'],
          item2: ['val3']
        }
      })
    )
  })

  test('should skip transforming initial_value correctly with multiple items if already in shorthand format', async () => {
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'object',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: {
        item1: ['val1', 'val2'],
        item2: ['val3']
      }
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockResolvedValue({ ok: true })

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        initialValue: {
          item1: ['val1', 'val2'],
          item2: ['val3']
        }
      })
    )
  })

  test('should store control but not notify broker when current env is not in environments', async () => {
    existsSync.mockReturnValue(true)
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      environments: ['prod'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }]
    })
    findFeatureControlByName.mockResolvedValue(null)

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ name: 'TEST' })
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  test('should store control and notify broker when current env is in environments', async () => {
    existsSync.mockReturnValue(true)
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      environments: ['local', 'dev', 'test', 'perf-test', 'ext-test', 'prod'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }]
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockResolvedValue({ ok: true })

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ name: 'TEST' })
    )
    expect(fetch).toHaveBeenCalled()
  })

  test('should not add authentication header if auth is disabled', async () => {
    config.get.mockImplementation((key) => {
      if (key === 'cdpEnvironment') return 'local'
      if (key === 'serviceDeployer') return 'system'
      if (key === 'configBroker.apiUrl') {
        return 'http://localhost:3001/api/feature-control'
      }
      if (key === 'configBroker.serviceAuth.enabled') return false
      return undefined
    })

    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'TEST',
      displayName: 'Test Control',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }]
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockResolvedValue({ ok: true })

    await informBrokerOfFeatureControls(mockServer)

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String)
        })
      })
    )
    expect(createAuthenticatedHeaders).not.toHaveBeenCalled()
  })

  test('should recursively discover yml files in subdirectories', async () => {
    readdirSync.mockImplementation((dir) => {
      if (dir === 'feature-controls') return ['subdir', 'top.yml']
      if (dir === 'feature-controls/subdir') return ['nested.yml']
      return []
    })
    statSync.mockImplementation((filePath) => ({
      isDirectory: () => filePath === 'feature-controls/subdir'
    }))
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'TEST',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }]
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockResolvedValue({ ok: true })

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).toHaveBeenCalledTimes(2)
  })

  test('should log error if duplicate feature control names are found', async () => {
    readdirSync.mockReturnValue(['file1.yml', 'file2.yml'])
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'CLASH',
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }]
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockResolvedValue({ ok: true })

    await informBrokerOfFeatureControls(mockServer)

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate feature control name found: CLASH')
    )
  })

  test('should skip empty yml files and log a warning', async () => {
    readdirSync.mockReturnValue(['empty.yml'])
    readFileSync.mockReturnValue('')
    load.mockReturnValue(null)

    await informBrokerOfFeatureControls(mockServer)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping empty file: feature-controls/empty.yml')
    )
    expect(upsertFeatureControl).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
