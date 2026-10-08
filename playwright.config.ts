import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  projects: [
    { name: 'web', grepInvert: /@red/ },
    { name: 'red', grep: /@red/ },
  ],
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4321', viewport: { width: 390, height: 844 }, browserName: 'chromium' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: false,
    timeout: 300_000,
    env: { DATOS_JSON: process.env.DATOS_JSON ?? 'tests/fixtures/datos.json' },
  },
});
