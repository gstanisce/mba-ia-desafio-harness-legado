import { describe, expect, it } from 'vitest'
import { AuthService, EmailTakenError, InvalidCredentialsError } from './auth-service'
import { HttpError } from '../domain/errors'
import { UserRecord } from '../domain/ticket'
import type { NewUser, UserRepository } from '../repositories/user-repository'

class FakeUserRepository implements UserRepository {
  users: UserRecord[] = []

  async findById(id: string) {
    return this.users.find((u) => u.id === id) || null
  }

  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email) || null
  }

  async create(data: NewUser): Promise<UserRecord> {
    const user: UserRecord = { id: `u${this.users.length + 1}`, role: 'customer', createdAt: new Date(), ...data }
    this.users.push(user)
    return user
  }
}

describe('AuthService', () => {
  it('cadastra cliente sem expor o hash', async () => {
    const service = new AuthService(new FakeUserRepository())
    const user = await service.register({ name: 'Maria', email: 'maria@x.com', password: '12345678' })
    expect(user).toEqual({ id: 'u1', name: 'Maria', email: 'maria@x.com', role: 'customer' })
  })

  it('recusa e-mail repetido', async () => {
    const service = new AuthService(new FakeUserRepository())
    await service.register({ name: 'Maria', email: 'maria@x.com', password: '12345678' })
    await expect(service.register({ name: 'Outra', email: 'maria@x.com', password: '12345678' })).rejects.toBeInstanceOf(
      EmailTakenError,
    )
  })

  it('faz login com a senha certa e recusa a errada', async () => {
    const service = new AuthService(new FakeUserRepository())
    await service.register({ name: 'Maria', email: 'maria@x.com', password: '12345678' })
    const user = await service.login({ email: 'maria@x.com', password: '12345678' })
    expect(user.email).toBe('maria@x.com')
    await expect(service.login({ email: 'maria@x.com', password: 'errada123' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    )
  })

  it('me devolve o usuário logado e 401 quando ele não existe', async () => {
    const repo = new FakeUserRepository()
    const service = new AuthService(repo)
    await service.register({ name: 'Maria', email: 'maria@x.com', password: '12345678' })
    expect(await service.me('u1')).toEqual({ id: 'u1', name: 'Maria', email: 'maria@x.com', role: 'customer' })
    await expect(service.me('nao-existe')).rejects.toMatchObject({ status: 401, code: 'unauthorized' })
    await expect(service.me('nao-existe')).rejects.toBeInstanceOf(HttpError)
  })
})
