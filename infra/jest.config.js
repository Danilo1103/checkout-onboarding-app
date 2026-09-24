module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  collectCoverageFrom: ['lib/**/*.ts'],
  coverageReporters: ['text', 'text-summary'],
};
