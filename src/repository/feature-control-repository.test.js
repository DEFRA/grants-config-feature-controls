import {
  findFeatureControlByName,
  upsertFeatureControl,
  findNewlyExpiredFeatureControls,
  setFeatureControlToExpired,
  setFeatureControlToWithdrawn
} from './feature-control-repository.js'

describe('featureControlRepository', () => {
  let db
  let server

  beforeAll(async () => {
    // Dynamic import to ensure vitest-mongodb setup is applied
    const { createServer } = await import('#/server.js')
    server = await createServer()
    await server.initialize()
    db = server.db
  })

  beforeEach(async () => {
    await db.collection('feature-controls').deleteMany({})
  })

  describe('upsertFeatureControl', () => {
    test('should insert a new document', async () => {
      const data = { name: 'TEST', value: true }
      await upsertFeatureControl(db, data)

      const result = await db
        .collection('feature-controls')
        .findOne({ name: 'TEST' })
      expect(result).toMatchObject(data)
    })

    test('should update an existing document', async () => {
      const data = { name: 'TEST', value: true }
      await upsertFeatureControl(db, data)

      const updatedData = { name: 'TEST', value: false }
      await upsertFeatureControl(db, updatedData)

      const result = await db
        .collection('feature-controls')
        .findOne({ name: 'TEST' })
      expect(result.value).toBe(false)
    })
  })

  describe('findFeatureControlByName', () => {
    test('should return the document if it exists', async () => {
      const data = { name: 'TEST', value: true }
      await db.collection('feature-controls').insertOne(data)

      const result = await findFeatureControlByName(db, 'TEST')
      expect(result).toMatchObject(data)
    })

    test('should return null if it does not exist', async () => {
      const result = await findFeatureControlByName(db, 'NON_EXISTENT')
      expect(result).toBeNull()
    })
  })

  describe('findNewlyExpiredFeatureControls', () => {
    test('should return expired feature controls that have not been notified', async () => {
      const now = new Date()
      const past = new Date(now.getTime() - 1000)
      const future = new Date(now.getTime() + 1000)

      await db.collection('feature-controls').insertMany([
        { name: 'EXPIRED_NOT_NOTIFIED', expiryDate: past },
        {
          name: 'EXPIRED_ALREADY_NOTIFIED',
          expiryDate: past,
          notifiedExpired: true
        },
        { name: 'NOT_YET_EXPIRED', expiryDate: future }
      ])

      const result = await findNewlyExpiredFeatureControls(db)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('EXPIRED_NOT_NOTIFIED')
    })
  })

  describe('setFeatureControlToExpired', () => {
    test('should set notifiedExpired to true', async () => {
      const featureControl = { name: 'TO_BE_EXPIRED' }
      await db.collection('feature-controls').insertOne(featureControl)

      await setFeatureControlToExpired(db, featureControl)

      const result = await db
        .collection('feature-controls')
        .findOne({ name: 'TO_BE_EXPIRED' })
      expect(result.notifiedExpired).toBe(true)
    })
  })
  describe('setFeatureControlToWithdrawn', () => {
    test('should set notifiedWithdrawn to true', async () => {
      const featureControl = { name: 'TO_BE_WITHDRAWN' }
      await db.collection('feature-controls').insertOne(featureControl)

      await setFeatureControlToWithdrawn(db, featureControl)

      const result = await db
        .collection('feature-controls')
        .findOne({ name: 'TO_BE_WITHDRAWN' })
      expect(result.notifiedWithdrawn).toBe(true)
    })
  })
})
