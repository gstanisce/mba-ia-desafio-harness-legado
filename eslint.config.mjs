// G2: lint sem erro e sem warning em api/ e web/.
// Regras de tipo (G1) ficam no tsc; aqui só o que o lint pega.
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'api/prisma/migrations/**'],
  },
  {
    files: ['api/src/**/*.ts', 'api/test/**/*.ts', 'api/prisma/**/*.ts', 'web/src/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
    },
  },
)
