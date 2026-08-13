import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  notifyFeatureControlCreatedOrUpdated,
  notifyFeatureControlExpired
} from './config-broker-api.js'
import { config } from '#/config.js'
import { createAuthenticatedHeaders } from '@defra/grants-config-utils/broker'

vi.mock('@defra/grants-config-utils/broker')

describe('config-broker-api', () => {
  let server

  beforeEach(() => {
    server = {
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

  describe('notifyFeatureControlCreatedOrUpdated', () => {
    it('should call fetch with POST and correct payload', async () => {
      const featureControl = { name: 'TEST_FEATURE' }
      fetch.mockResolvedValue({ ok: true })

      await notifyFeatureControlCreatedOrUpdated(featureControl, server)

      expect(fetch).toHaveBeenCalledWith(
        config.get('configBroker.apiUrl'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(featureControl)
        })
      )
      expect(server.logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "Successfully notified the config broker about feature control 'TEST_FEATURE'"
        )
      )
    })

    it('should handle error response', async () => {
      const featureControl = { name: 'TEST_FEATURE' }
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Server Error')
      })

      await notifyFeatureControlCreatedOrUpdated(featureControl, server)

      expect(server.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to notify the config broker about feature control 'TEST_FEATURE'. Status: 500. Error: Server Error"
        )
      )
    })

    it('should handle fetch exception', async () => {
      const featureControl = { name: 'TEST_FEATURE' }
      const error = new Error('Network Error')
      fetch.mockRejectedValue(error)

      await expect(
        notifyFeatureControlCreatedOrUpdated(featureControl, server)
      ).rejects.toThrow('Network Error')

      expect(server.logger.error).toHaveBeenCalledWith(
        error,
        expect.stringContaining(
          "Error notifying the config broker about feature control 'TEST_FEATURE':"
        )
      )
    })
  })

  describe('notifyFeatureControlExpired', () => {
    it('should call fetch with PUT and correct payload', async () => {
      const payload = { name: 'EXPIRED_FEATURE', status: 'expired' }
      fetch.mockResolvedValue({ ok: true })

      await notifyFeatureControlExpired(payload, server)

      expect(fetch).toHaveBeenCalledWith(
        config.get('configBroker.apiUrl') + '/status',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      )
      expect(server.logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "Successfully notified the config broker about feature control 'EXPIRED_FEATURE'"
        )
      )
    })

    it('should handle fetch exception', async () => {
      const payload = { name: 'EXPIRED_FEATURE' }
      const error = new Error('Network Error')
      fetch.mockRejectedValue(error)

      await expect(
        notifyFeatureControlExpired(payload, server)
      ).rejects.toThrow('Network Error')

      expect(server.logger.error).toHaveBeenCalledWith(
        error,
        expect.stringContaining(
          "Error notifying the config broker about feature control 'EXPIRED_FEATURE':"
        )
      )
    })
  })

  describe('getHeaders (internal logic)', () => {
    it('should include authenticated headers when enabled', async () => {
      const featureControl = { name: 'TEST_FEATURE' }
      fetch.mockResolvedValue({ ok: true })

      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'configBroker.serviceAuth.enabled') return true
        if (key === 'configBroker.apiUrl') return 'http://broker'
        return null
      })

      createAuthenticatedHeaders.mockResolvedValue({
        Authorization: 'Bearer token'
      })

      await notifyFeatureControlCreatedOrUpdated(featureControl, server)

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
})
