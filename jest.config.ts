import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/server.ts',
    '!<rootDir>/src/constants/**/*.ts',
    '!<rootDir>/src/model/**/*.ts',
    '!<rootDir>/src/schemas/**/*.ts',
    '!<rootDir>/node_modules/**',
    '!<rootDir>/src/tests/**',
    '!<rootDir>/src/sequelize.config.ts',
  ],
  coverageDirectory: '<rootDir>/testReport',
  testMatch: ['**/tests/**/*.test.ts', '!<rootDir>/src/server.ts'],
  // globalSetup: '<rootDir>/src/jest.setup.ts',
  // globalTeardown: '<rootDir>/src/jest.teardown.ts'
};

export default config;
