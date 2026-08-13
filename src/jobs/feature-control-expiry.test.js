import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import cron from 'node-cron'
import {
  featureControlExpiryJob,
  startFeatureExpiryJob
} from './feature-control-expiry.js'
import { createLogger } from '#/common/helpers/logging/logger.js'
import { config } from '#/config.js'

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn()
  }
}))

vi.mock('#/common/helpers/logging/logger.js', () => {
  const info = vi.fn()
  return {
    createLogger: vi.fn(() => ({
      info
    }))
  }
})

describe('feature-control-expiry', () => {
  let logger

  beforeEach(() => {
    logger = createLogger()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('featureControlExpiryJob', () => {
    it('should log the expected message', () => {
      featureControlExpiryJob()
      expect(logger.info).toHaveBeenCalledWith('Hello from schedule job')
    })
  })

  describe('startFeatureExpiryJob', () => {
    it('should schedule the job with the cron expression from config', () => {
      const schedule = config.get('jobs.featureControlExpiry.schedule')
      startFeatureExpiryJob()
      expect(cron.schedule).toHaveBeenCalledWith(
        schedule,
        expect.any(Function),
        expect.objectContaining({
          scheduled: true,
          timezone: 'UTC'
        })
      )
      expect(logger.info).toHaveBeenCalledWith('Scheduled jobs started')
    })
  })
})
