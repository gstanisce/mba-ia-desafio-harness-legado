import type { HealthRepository } from '../repositories/health-repository'

export class HealthService {
  constructor(private health: HealthRepository) {}

  // lança erro quando o banco não responde; a rota traduz para 503
  async check() {
    await this.health.ping()
  }
}
