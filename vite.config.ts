import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { apiDevPlugin } from './vite-plugin-api-dev.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (empty prefix) so non-VITE_-prefixed server secrets
  // (GROQ_KEY, NEWSAPI_KEY, CURRENTS_KEY) reach the dev-only API proxy
  // plugin via process.env — Vite only auto-exposes VITE_-prefixed vars to
  // client code, not arbitrary vars to Node-side plugin code.
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [
      tailwindcss(),
      react(),
      apiDevPlugin(),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('/react/')) return 'react-vendor';
            return undefined;
          },
        },
      },
    },
  }
})
