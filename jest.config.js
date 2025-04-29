/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'], // Look for tests in the src directory
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ], // Standard Jest test file patterns
  transform: {
    '^.+\.(ts|tsx)$': ['ts-jest', { /* ts-jest config options here */ }],
  },
}; 