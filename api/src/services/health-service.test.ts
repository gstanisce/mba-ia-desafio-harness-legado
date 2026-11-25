import { describe, expect, it } from 'vitest'
import { HealthService } from './health-service'

describe('HealthService', () => {
  it('passa quando o banco responde', async () => {
    await expect(new HealthService({ ping: async () => {} }).check()).resolves.toBeUndefined()
  })

  it('repassa a falha quando o banco não responde', async () => {
    const service = new HealthService({
      ping: async () => {
        throw new Error('sem banco')
      },
    })
    await expect(service.check()).rejects.toThrow('sem banco')
  })
})
