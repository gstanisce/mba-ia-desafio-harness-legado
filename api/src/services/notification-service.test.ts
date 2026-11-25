import { afterEach, describe, expect, it, vi } from 'vitest'
import { notifyAssignee } from './notification-service'

describe('notifyAssignee', () => {
  afterEach(() => vi.restoreAllMocks())

  it('registra a atribuição com a referência do chamado', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    notifyAssignee({ id: 'abcdef123456', title: 'Fatura' }, 'a1')
    expect(log).toHaveBeenCalledWith('[notificacao] chamado #abcdef12 (Fatura) atribuido para a1')
  })
})
