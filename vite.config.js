import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/partyfund/', // Replace with your GitHub repo name
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Ensure proper handling of assets
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
