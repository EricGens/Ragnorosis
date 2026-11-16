import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Tests run in plain Node: the sim and the UI's geometry helpers are pure functions, and skipping the
    // simulated browser makes the suite start several times faster. A test that renders React components
    // opts in by putting `// @vitest-environment jsdom` on its first line.
    environment: 'node',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
})
