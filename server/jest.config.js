module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'index.js',
        'src/**/*.js',
        '!node_modules/**',
        '!coverage/**',
        '!scripts/**'
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    testMatch: ['**/tests/**/*.test.js'],
    verbose: true
};
