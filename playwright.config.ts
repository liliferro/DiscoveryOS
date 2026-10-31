import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    actionTimeout: 20000,
  },
  reporter: "list",
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3100",
    timeout: 60000,
    reuseExistingServer: false,
    env: {
      PORT: "3100",
      DISCOVERY_DB_FILE: `e2e-${Date.now()}.sqlite`,
      DISCOVERY_TEST_AI: "1",
    },
  },
});
