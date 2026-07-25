/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // So os .spec.ts dentro de src/ - frontend/ e WACRM/ (projeto de
  // referencia, nao faz parte do backend, ver CLAUDE.md) ficam fora mesmo
  // sem exclusao explicita, ja que o padrao so varre src/.
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  clearMocks: true,
  // tsconfig proprio para os testes (nao o tsconfig.json principal, que tem
  // rootDir="./src" - test/ fica fora dele de proposito, ver CLAUDE.md
  // sobre nao misturar codigo de teste no build de producao).
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
};
