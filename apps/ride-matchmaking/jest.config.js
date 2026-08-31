module.exports = {
    displayName: 'ride-matchmaking',
  rootDir: '../..',
  testMatch: ['<rootDir>/apps/ride-matchmaking/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
};
