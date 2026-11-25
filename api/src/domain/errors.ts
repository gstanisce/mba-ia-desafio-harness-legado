// Erro de regra de negócio com o status HTTP que a rota devolve.
// Mora no domínio para que services possam lançá-lo sem importar http/ (G6).
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
