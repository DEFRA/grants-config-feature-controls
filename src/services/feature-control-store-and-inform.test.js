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
})
