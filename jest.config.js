/** Unit tests for pure logic (engine, protocol). No React Native runtime. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/engine', '<rootDir>/models', '<rootDir>/services'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          rootDir: '.',
          module: 'commonjs',
          moduleResolution: 'bundler',
          target: 'es2022',
          strict: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          isolatedModules: true,
          types: ['jest', 'node'],
          paths: { '@/*': ['./*'] },
        },
      },
    ],
  },
};
