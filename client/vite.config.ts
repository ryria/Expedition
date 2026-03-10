import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_APP_BASE?.trim() || "/";

  return {
    plugins: [react()],
    base,
    test: {
      environment: 'jsdom',
      globals: true,
      pool: 'threads',
      fileParallelism: false,
      maxWorkers: 1,
      minWorkers: 1,
    },
  } as any;
})
