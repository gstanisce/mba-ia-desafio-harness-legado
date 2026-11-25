// Único lugar do front que lê import.meta.env (G5). Endereço da API vem daqui.
export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:4000'
