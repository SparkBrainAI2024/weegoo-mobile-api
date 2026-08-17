module.exports = {
  displayName: 'cron',
  rootDir: '../..',
  testMatch: ['<rootDir>/apps/cron/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
};
