import { informBrokerOfFeatureControls } from './feature-control-store-and-inform.js'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { load } from 'js-yaml'
import {
  findFeatureControlByName,
  upsertFeatureControl
} from '../repository/feature-control-repository.js'

vi.mock('node:fs')
vi.mock('js-yaml')
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
      logger: mockLogger
    }
    vi.clearAllMocks()
  })

  test('should process yml files and notify broker', async () => {
    existsSync.mockReturnValue(true)
    readdirSync.mockReturnValue(['test.yml'])
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
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: new Date('2027-01-01').toISOString(),
      createdBy: 'system',
      initialValue: { default: true }
    }
    load.mockReturnValue({
      name: 'TEST',
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
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }],
      roleRequired: 'admin'
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockResolvedValue({ ok: true })

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        name: 'TEST',
        roleRequired: 'admin'
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
      expect.stringContaining(
        'Failed to process feature control file test.yml'
      ),
      expect.any(Error)
    )
  })

  test('should log error if broker returns non-ok status', async () => {
    readdirSync.mockReturnValue(['test.yml'])
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
      type: 'boolean',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [{ name: 'default', value: true }]
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockRejectedValue(new Error('Network error'))

    await informBrokerOfFeatureControls(mockServer)

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Error notifying the config broker about feature control 'TEST':"
      ),
      expect.any(Error)
    )
  })

  test('should transform initial_value correctly with multiple items', async () => {
    readdirSync.mockReturnValue(['test.yml'])
    readFileSync.mockReturnValue('content')
    load.mockReturnValue({
      name: 'TEST',
      type: 'object',
      description: 'desc',
      scopes: ['scope'],
      owner: 'owner',
      expiryDate: '2027-01-01',
      initial_value: [
        { name: 'item1', value: 'val1' },
        { name: 'item2', value: 'val2' }
      ]
    })
    findFeatureControlByName.mockResolvedValue(null)
    fetch.mockResolvedValue({ ok: true })

    await informBrokerOfFeatureControls(mockServer)

    expect(upsertFeatureControl).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        initialValue: {
          item1: 'val1',
          item2: 'val2'
        }
      })
    )
  })
})
