import { defineConfig } from '@playwright/test'

// End-to-end tests of the built Electron app (ADR-0027). Build first: `npm run e2e` does it.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  // One Electron app at a time: the tests share the screen and keyboard focus.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' }
})
