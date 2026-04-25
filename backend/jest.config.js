// jest.config.js
// Configured for ES Modules (the project uses "type": "module")
// Run tests with: node --experimental-vm-modules node_modules/jest/bin/jest.js

export default {
  testEnvironment: "node",
  transform: {},                         // no Babel — use native ESM
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/server.js",                    // skip entry point
  ],
};