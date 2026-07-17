import {
  findFeatureControlByName,
  upsertFeatureControl
} from './feature-control-repository.js'

describe('featureControlRepository', () => {
  let db

  beforeAll(async () => {
    // Dynamic import to ensure vitest-mongodb setup is applied
    const { createServer } = await import('#/server.js')
    const server = await createServer()
    await server.initialize()
    db = server.db
  })

  beforeEach(async () => {
    await db.collection('feature-controls').deleteMany({})
  })

  test('upsertFeatureControl should insert a new document', async () => {
    const data = { name: 'TEST', value: true }
    await upsertFeatureControl(db, data)

    const result = await db
      .collection('feature-controls')
      .findOne({ name: 'TEST' })
    expect(result).toMatchObject(data)
  })

  test('upsertFeatureControl should update an existing document', async () => {
    const data = { name: 'TEST', value: true }
    await upsertFeatureControl(db, data)

    const updatedData = { name: 'TEST', value: false }
    await upsertFeatureControl(db, updatedData)

    const result = await db
      .collection('feature-controls')
      .findOne({ name: 'TEST' })
    expect(result.value).toBe(false)
  })

  test('findFeatureControlByName should return the document if it exists', async () => {
    const data = { name: 'TEST', value: true }
    await db.collection('feature-controls').insertOne(data)

    const result = await findFeatureControlByName(db, 'TEST')
    expect(result).toMatchObject(data)
  })

  test('findFeatureControlByName should return null if it does not exist', async () => {
    const result = await findFeatureControlByName(db, 'NON_EXISTENT')
    expect(result).toBeNull()
  })
})
