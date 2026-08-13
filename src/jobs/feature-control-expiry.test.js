import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import cron from 'node-cron'
import {
  featureControlExpiryJob,
  startFeatureExpiryJob
} from './feature-control-expiry.js'
import { config } from '#/config.js'
import {
  findNewlyExpiredFeatureControls,
  setFeatureControlToExpired
} from '#/repository/feature-control-repository.js'
import { createAuthenticatedHeaders } from '@defra/grants-config-utils/broker'

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn()
  }
}))

vi.mock('#/repository/feature-control-repository.js')
vi.mock('@defra/grants-config-utils/broker')

describe('feature-control-expiry', () => {
  let server

  beforeEach(() => {
    server = {
      db: 'mock-db',
      logger: {
        info: vi.fn(),
        error: vi.fn()
      }
    }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  describe('featureControlExpiryJob', () => {
    it('should find expired feature controls and notify broker', async () => {
      const expiredControls = [{ name: 'feature1' }, { name: 'feature2' }]
      findNewlyExpiredFeatureControls.mockResolvedValue(expiredControls)
      fetch.mockResolvedValue({ ok: true })

      await featureControlExpiryJob(server)

      expect(findNewlyExpiredFeatureControls).toHaveBeenCalledWith(server.db)
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(setFeatureControlToExpired).toHaveBeenCalledTimes(2)
      expect(server.logger.info).toHaveBeenCalledWith(
        'Feature control expiry job completed successfully'
      )
    })

    it('should handle broker notification failure', async () => {
      const expiredControls = [{ name: 'feature1' }]
      findNewlyExpiredFeatureControls.mockResolvedValue(expiredControls)
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error')
      })

      await featureControlExpiryJob(server)

      expect(server.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to notify the config broker about feature control 'feature1'"
        )
      )
      expect(setFeatureControlToExpired).toHaveBeenCalledWith(
        server.db,
        expiredControls[0]
      )
    })

    it('should handle fetch exception', async () => {
      const expiredControls = [{ name: 'feature1' }]
      findNewlyExpiredFeatureControls.mockResolvedValue(expiredControls)
      const error = new Error('Network error')
      fetch.mockRejectedValue(error)

      await featureControlExpiryJob(server)

      expect(server.logger.error).toHaveBeenCalledWith(
        error,
        expect.stringContaining(
          "Error notifying the config broker about feature control 'feature1'"
        )
      )
      expect(setFeatureControlToExpired).toHaveBeenCalledWith(
        server.db,
        expiredControls[0]
      )
    })

    it('should include authenticated headers if auth is enabled', async () => {
      const expiredControls = [{ name: 'feature1' }]
      findNewlyExpiredFeatureControls.mockResolvedValue(expiredControls)
      fetch.mockResolvedValue({ ok: true })

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'configBroker.serviceAuth.enabled') return true
        if (key === 'configBroker.apiUrl') return 'http://broker'
        return null
      })

      createAuthenticatedHeaders.mockResolvedValue({
        Authorization: 'Bearer token'
      })

      await featureControlExpiryJob(server)

      expect(createAuthenticatedHeaders).toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token'
          })
        })
      )
    })
  })

  describe('startFeatureExpiryJob', () => {
    it('should schedule the job with the cron expression from config', () => {
      const schedule = config.get('jobs.featureControlExpiry.schedule')
      startFeatureExpiryJob(server)
      expect(cron.schedule).toHaveBeenCalledWith(
        schedule,
        expect.any(Function),
        expect.objectContaining({
          scheduled: true,
          timezone: 'UTC'
        })
      )

      // Test the wrapper function
      const wrapper = cron.schedule.mock.calls[0][1]
      wrapper()
      expect(server.logger.info).toHaveBeenCalledWith(
        'Running feature control expiry job..'
      )
    })
  })
})
