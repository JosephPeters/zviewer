import { defineConfig, loadEnv } from 'vite'
import dns from 'node:dns'

dns.setDefaultResultOrder('verbatim')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    base: env.FRONTEND_BASE_PATH || '/zviewer',
    server: {
      port: parseInt(env.FRONTEND_PORT) || 5173,
      host: env.FRONTEND_HOST || 'localhost',
      allowedHosts: true,
      // Proxy config removed - handled by reverse proxy server
    },
  }
})