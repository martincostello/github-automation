module.exports = {
  clearMocks: true,
  moduleFileExtensions: [ 'js', 'ts' ],
  reporters: [
    'default',
    'github-actions'
  ],
  testEnvironment: 'node',
  testMatch: [ '<rootDir>/tests/**/*.ts' ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: true
}
