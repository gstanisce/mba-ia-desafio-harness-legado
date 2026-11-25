// Regras de dependência (G4, G6, G7, G8, G9).
// tsPreCompilationDeps: true faz o dependency-cruiser contar imports só de tipo,
// que o TypeScript apaga na compilação mas continuam sendo acoplamento.
module.exports = {
  forbidden: [
    {
      name: 'G4',
      comment: 'http não fala com o banco: nada de @prisma/client nem de repositories',
      severity: 'error',
      from: { path: '^api/src/http/' },
      to: { path: ['^api/src/repositories/', '/node_modules/@prisma/client/'] },
    },
    {
      name: 'G6',
      comment: 'services não conhecem Express, multer nem http (nem tipos)',
      severity: 'error',
      from: { path: '^api/src/services/' },
      to: { path: ['^api/src/http/', '/node_modules/(@types/)?(express|multer)[\\w-]*/'] },
    },
    {
      name: 'G7',
      comment: 'o pacote openai só é importado em api/src/integrations/',
      severity: 'error',
      from: { pathNot: '^api/src/integrations/' },
      to: { path: '/node_modules/openai/' },
    },
    {
      name: 'G8',
      comment: 'o front não importa arquivos da API',
      severity: 'error',
      from: { path: '^web/' },
      to: { path: '^api/' },
    },
    {
      name: 'G9',
      comment: 'nenhum import circular em api/src e web/src',
      severity: 'error',
      from: { path: '^(api/src|web/src)/' },
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.cjs', '.json'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    exclude: { path: '/(\.balcao|dist)/' },
    reporterOptions: {},
  },
}
