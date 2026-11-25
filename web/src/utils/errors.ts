// Mensagem para mostrar na tela a partir de qualquer erro capturado.
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Erro inesperado'
}
