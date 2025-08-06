import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// Environment-based configuration with defaults
const PORT = process.env.PROXY_PORT || 4000;
const PROXY_HOST = process.env.PROXY_HOST || 'localhost';
const ZELLIJ_HOST = process.env.ZELLIJ_HOST || '127.0.0.1';
const ZELLIJ_PORT = process.env.ZELLIJ_PORT || 8083;
const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = process.env.BACKEND_PORT || 3001;
const FRONTEND_HOST = process.env.FRONTEND_HOST || 'localhost';
const FRONTEND_PORT = process.env.FRONTEND_PORT || 5173;
const FRONTEND_BASE_PATH = process.env.FRONTEND_BASE_PATH || '/zviewer';
const API_BASE_PATH = process.env.API_BASE_PATH || '/zviewer/api';

// HTTPS configuration
const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true';
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH;
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH;

// Service URLs
const PROTOCOL = HTTPS_ENABLED ? 'https' : 'http';
const ZELLIJ_TARGET = `${PROTOCOL}://${ZELLIJ_HOST}:${ZELLIJ_PORT}`;
const BACKEND_TARGET = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const FRONTEND_TARGET = `http://${FRONTEND_HOST}:${FRONTEND_PORT}${FRONTEND_BASE_PATH}`;

console.log('🚀 Starting Zellij Session Viewer Reverse Proxy...');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      zellij: ZELLIJ_TARGET,
      frontend: FRONTEND_TARGET,
      backend: BACKEND_TARGET
    }
  });
});

// Backend API proxy - Must come before zviewer catch-all
app.use(API_BASE_PATH, createProxyMiddleware({
  target: `${BACKEND_TARGET}/api`,
  changeOrigin: true,
  pathRewrite: { [`^${API_BASE_PATH}`]: '' }, // Remove API_BASE_PATH prefix, target already has /api
  onProxyReq: (proxyReq, req, res) => {
    console.log(`📡 API: ${req.method} ${req.url} → ${BACKEND_TARGET}/api${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Backend API proxy error:', err.message);
    res.status(500).json({ error: 'Backend API unavailable' });
  }
}));

// Session manager UI proxy - Rewrite /zviewer to / for Vite
app.use(FRONTEND_BASE_PATH, createProxyMiddleware({
  target: FRONTEND_TARGET,
  changeOrigin: true,
  //pathRewrite: { [`^${FRONTEND_BASE_PATH}`]: '' }, // Strip FRONTEND_BASE_PATH prefix for Vite
  ws: true, // Enable WebSocket support for Vite HMR
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🖥️  UI: ${req.method} ${req.url} → ${FRONTEND_TARGET}${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Frontend proxy error:', err.message);
    res.status(500).send('Frontend unavailable');
  }
}));

// Zellij web client at root - Only for non-zviewer paths
app.use('/', createProxyMiddleware({
  target: ZELLIJ_TARGET,
  changeOrigin: true,
  ws: true,
  secure: false, // Allow self-signed certificates
  // Filter function to avoid conflicts with /zviewer
  filter: (pathname, req) => {
    const shouldProxy = !pathname.startsWith(FRONTEND_BASE_PATH) && !pathname.startsWith('/health');
    console.log(`🔍 Filter: ${pathname} → ${shouldProxy ? 'Zellij' : 'Skip'}`);
    return shouldProxy;
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🖥️  Zellij: ${req.method} ${req.url} → ${ZELLIJ_TARGET}${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Zellij proxy error:', err.message);
    res.status(500).send('Zellij web client unavailable');
  }
}));

// Start the proxy server
const startServer = () => {
  if (HTTPS_ENABLED) {
    if (!HTTPS_KEY_PATH || !HTTPS_CERT_PATH) {
      console.error('❌ HTTPS enabled but certificate paths not provided');
      console.error('   Set HTTPS_KEY_PATH and HTTPS_CERT_PATH environment variables');
      process.exit(1);
    }

    try {
      const privateKey = fs.readFileSync(HTTPS_KEY_PATH, 'utf8');
      const certificate = fs.readFileSync(HTTPS_CERT_PATH, 'utf8');
      const credentials = { key: privateKey, cert: certificate };

      const httpsServer = https.createServer(credentials, app);
      httpsServer.listen(PORT, PROXY_HOST, () => {
        console.log(`\n🎯 Reverse Proxy Server running on ${PROTOCOL}://${PROXY_HOST}:${PORT}`);
        logServerInfo();
      });
    } catch (error) {
      console.error('❌ Failed to start HTTPS server:', error.message);
      process.exit(1);
    }
  } else {
    app.listen(PORT, PROXY_HOST, () => {
      console.log(`\n🎯 Reverse Proxy Server running on ${PROTOCOL}://${PROXY_HOST}:${PORT}`);
      logServerInfo();
    });
  }
};

const logServerInfo = () => {
  console.log('\n📋 Service Routes:');
  console.log(`   🖥️  Zellij Web Client:     ${PROTOCOL}://${PROXY_HOST}:${PORT}/`);
  console.log(`   📱 Session Manager UI:    ${PROTOCOL}://${PROXY_HOST}:${PORT}${FRONTEND_BASE_PATH}/`);
  console.log(`   🔌 Backend API:           ${PROTOCOL}://${PROXY_HOST}:${PORT}${API_BASE_PATH}/`);
  console.log(`   ❤️  Health Check:         ${PROTOCOL}://${PROXY_HOST}:${PORT}/health`);
  console.log(`\n🚀 Ready to tunnel port ${PORT}!`);
  console.log('\n💡 Usage:');
  console.log(`   1. Start zellij web server: zellij web --port ${ZELLIJ_PORT}`);
  console.log('   2. Start backend API: npm run server');
  console.log('   3. Start frontend: npm run dev');
  console.log(`   4. Tunnel this proxy: cloudflare tunnel --url ${PROXY_HOST}:${PORT}`);
};

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down reverse proxy server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down reverse proxy server...');
  process.exit(0);
});
