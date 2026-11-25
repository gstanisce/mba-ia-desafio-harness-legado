import { prisma } from './prisma'
import { UserRecord } from '../domain/ticket'

export type NewUser = {
  name: string
  email: string
  passwordHash: string
  role?: 'customer' | 'agent' | 'admin'
}

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>
  findByEmail(email: string): Promise<UserRecord | null>
  create(data: NewUser): Promise<UserRecord>
}

class PrismaUserRepository implements UserRepository {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } })
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  }

  create(data: NewUser) {
    return prisma.user.create({ data })
  }
}

export const userRepository = new PrismaUserRepository()
