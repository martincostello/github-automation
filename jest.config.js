module.exports = {
  clearMocks: true,
  reporters: [
    'default',
    'github-actions'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: true
}
