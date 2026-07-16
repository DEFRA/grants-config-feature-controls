import hapi from '@hapi/hapi'
import { informBrokerOfFeatureControls } from '../services/feature-control-store-and-inform.js'

vi.mock('../services/feature-control-store-and-inform.js')
describe('#startServer', () => {
  let startServerImport
  let createServerSpy
  let hapiServerSpy

  beforeAll(async () => {
    vi.stubEnv('PORT', '3098')
    startServerImport = await import('./start-server.js')
    const createServerImport = await import('../server.js')

    createServerSpy = vi.spyOn(createServerImport, 'createServer')
    hapiServerSpy = vi.spyOn(hapi, 'server')
  })

  afterAll(() => {
    vi.resetAllMocks()
  })

  // describe('When server starts', () => {
  //   test('Should start up server as expected', async () => {
  //     await startServerImport.startServer()
  //
  //     expect(createServerSpy).toHaveBeenCalled()
  //     expect(hapiServerSpy).toHaveBeenCalled()
  //     expect(informBrokerOfFeatureControls).toHaveBeenCalled()
  //   })
  // })

  describe('When server start fails', () => {
    test('Should log failed startup message', async () => {
      createServerSpy.mockRejectedValue(new Error('Server failed to start'))

      await expect(startServerImport.startServer()).rejects.toThrow(
        'Server failed to start'
      )
    })
  })
})
