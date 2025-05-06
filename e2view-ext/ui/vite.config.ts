import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    cors: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    }
  },
  build: {
    // Output directory relative to the ui folder (goes to project root/ui-dist)
    outDir: '../ui-dist',
    // Ensure the output directory is cleaned before each build
    emptyOutDir: true,
  },
})
