// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy pentru backend HealthOS local
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Fără sourcemap în producție → bundle mai mic livrat utilizatorilor.
    // (pune 'true' temporar doar dacă ai nevoie să depanezi producția)
    sourcemap: false,
    // Separăm librăriile mari în chunk-uri proprii: se cache-uiesc independent,
    // deci la un update de cod al tău utilizatorul nu re-descarcă recharts/supabase.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('react-router')) return 'router'
          if (id.includes('@tanstack')) return 'query'
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react'
          return 'vendor'
        },
      },
    },
    // Ridicăm pragul de avertisment (avem chunk-uri legitim mari)
    chunkSizeWarningLimit: 1500,
  },
})
