# Developer Guide - Zellij Session Viewer

## 🎯 **Project Overview**

The Zellij Session Viewer is a web-based interface for managing and viewing zellij terminal sessions. It provides a modern UI with embedded terminal access through a reverse proxy architecture.

### **What This Application Does**
1. **Lists zellij sessions** via backend API that executes `zellij list-sessions`
2. **Displays session management UI** with sidebar navigation and status indicators
3. **Embeds zellij web client** in iframes for direct terminal access
4. **Provides same-origin authentication** through reverse proxy architecture

## 🏗️ **Architecture Deep Dive**

### **Service Architecture**
```
┌─────────────────────────────────────────────────────────────┐
│                    Reverse Proxy (port 4000)               │
│                     proxy-server.js                        │
├─────────────────────────────────────────────────────────────┤
│ Route: /              → Zellij Web (127.0.0.1:8083)       │
│ Route: /zviewer/      → Frontend UI (localhost:5173)       │
│ Route: /zviewer/api/  → Backend API (localhost:3001)       │
└─────────────────────────────────────────────────────────────┘
```

### **Data Flow**
1. **User visits** `/zviewer/` → Frontend UI loads
2. **Frontend calls** `/zviewer/api/sessions` → Backend API
3. **Backend executes** `zellij list-sessions --no-formatting`
4. **Backend parses** output and returns JSON
5. **Frontend displays** session list with status indicators
6. **User clicks session** → iframe loads `/session-name` (zellij web client)

## 📁 **Codebase Structure**

### **Key Files**
```
zview/
├── proxy-server.js          # 🔥 Reverse proxy - routes all traffic
├── server.js               # 🔌 Backend API - zellij commands
├── src/main.js             # 🖥️ Frontend logic - UI and state
├── src/style.css           # 🎨 Responsive styling
├── vite.config.js          # ⚙️ Frontend build config
└── package.json            # 📦 Dependencies and scripts
```

### **Configuration Files**
```
├── .env.example                 # Environment variables template ⭐
├── DEPLOYMENT_OPTIONS.md        # All deployment approaches
├── REVERSE_PROXY_SETUP.md       # Detailed setup guide
├── ENVIRONMENT_VARIABLES_PLAN.md # Configuration plan (implemented)
└── docs/DEVELOPER_GUIDE.md      # This file
```

## 🔧 **Core Components**

### **1. Reverse Proxy (proxy-server.js)**
**Purpose**: Routes traffic to appropriate services, enables same-origin access

**Key Functions**:
- Routes `/zviewer/api/*` to backend with path rewriting
- Routes `/zviewer/*` to frontend (Vite dev server)
- Routes `/*` to zellij web client (with filter to avoid conflicts)
- Provides health check endpoint at `/health`

**Critical Code**:
```javascript
// API Proxy - strips /zviewer/api prefix
app.use('/zviewer/api', createProxyMiddleware({
  target: 'http://localhost:3001/api',
  pathRewrite: { '^/zviewer/api': '' }
}));

// Frontend Proxy - passes /zviewer path to Vite
app.use('/zviewer', createProxyMiddleware({
  target: 'http://localhost:5173/zviewer'
}));

// Zellij Proxy - catch-all with filter
app.use('/', createProxyMiddleware({
  target: 'http://127.0.0.1:8083',
  filter: (pathname) => !pathname.startsWith('/zviewer')
}));
```

### **2. Backend API (server.js)**
**Purpose**: Executes zellij commands and provides REST API

**Endpoints**:
- `GET /api/sessions` - Returns parsed session list
- `GET /api/health` - Health check

**Key Functions**:
```javascript
// Execute zellij command
const { stdout } = await execAsync('zellij list-sessions --no-formatting');

// Parse session format: "name [Created time ago] [status]"
const sessions = stdout.trim().split('\n')
  .filter(line => line.trim())
  .map(parseSessionLine);
```

### **3. Frontend UI (src/main.js)**
**Purpose**: Session management interface with embedded terminal access

**Key State**:
```javascript
const appState = {
  sessions: [],           // Session data from API
  selectedSession: null,  // Currently viewed session
  loading: false,        // Loading state
  sidebarCollapsed: false // Mobile sidebar state
};
```

**Key Functions**:
- `fetchSessions()` - API call to get session list
- `selectSession(session)` - Load session in iframe
- `renderSessions()` - Update UI with session data
- `setupEventListeners()` - Keyboard shortcuts and clicks

## ⚙️ **Environment Variables Configuration**

### **Overview**
The application supports comprehensive environment variable configuration for flexible deployment across different environments and teams.

### **Implementation Architecture**

#### **Backend Configuration (server.js & proxy-server.js)**
```javascript
import dotenv from 'dotenv';
dotenv.config(); // Load .env file

// Environment-based configuration with defaults
const PORT = process.env.BACKEND_PORT || 3001;
const HOST = process.env.BACKEND_HOST || 'localhost';
const PROXY_PORT = process.env.PROXY_PORT || 4000;
const ZELLIJ_TARGET = `http://${process.env.ZELLIJ_HOST || '127.0.0.1'}:${process.env.ZELLIJ_PORT || 8083}`;
```

#### **Frontend Configuration (vite.config.js)**
```javascript
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    base: env.FRONTEND_BASE_PATH || '/zviewer',
    server: {
      port: parseInt(env.FRONTEND_PORT) || 5173,
      host: env.FRONTEND_HOST || 'localhost'
    }
  }
});
```

#### **Client-Side Configuration (src/main.js)**
```javascript
// Vite environment variables (VITE_ prefix for client access)
const API_BASE_URL = import.meta.env.VITE_API_BASE_PATH || '/zviewer/api';
const SESSION_REFRESH_INTERVAL = parseInt(import.meta.env.VITE_SESSION_REFRESH_INTERVAL) || 30;
```

### **Configuration Hierarchy**
1. **Environment Variables** (highest priority) - from `.env` file or system
2. **Default Values** (fallback) - hardcoded defaults maintain backward compatibility
3. **No Breaking Changes** - existing setups work unchanged

### **Key Implementation Details**

#### **dotenv Integration**
- Added `dotenv` dependency to package.json
- Both `server.js` and `proxy-server.js` load environment variables at startup
- Environment loading happens before any other configuration

#### **Dynamic Service URLs**
```javascript
// Before (hardcoded)
const ZELLIJ_TARGET = 'http://127.0.0.1:8083';
const BACKEND_TARGET = 'http://localhost:3001';

// After (configurable)
const ZELLIJ_TARGET = `http://${ZELLIJ_HOST}:${ZELLIJ_PORT}`;
const BACKEND_TARGET = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
```

#### **Vite Environment Variables**
- Uses `VITE_` prefix for client-side accessibility
- Environment variables available in browser via `import.meta.env`
- Configured in vite.config.js using `loadEnv()`

#### **Path Configuration**
```javascript
// Configurable proxy routes
app.use(API_BASE_PATH, createProxyMiddleware({ /* ... */ }));
app.use(FRONTEND_BASE_PATH, createProxyMiddleware({ /* ... */ }));

// Dynamic filter logic
filter: (pathname) => !pathname.startsWith(FRONTEND_BASE_PATH)
```

### **Development Patterns**

#### **Configuration File Structure**
```bash
# .env.example (template)
PROXY_PORT=4000
BACKEND_PORT=3001
FRONTEND_PORT=5173
ZELLIJ_PORT=8083

# .env (user-specific, gitignored)
PROXY_PORT=4001    # Custom port to avoid conflicts
BACKEND_PORT=3002
```

#### **Script Enhancement**
```json
{
  "scripts": {
    "start:zellij": "zellij web --port ${ZELLIJ_PORT:-8083}",
    "start:all": "concurrently \"npm run start:zellij\" \"npm run dev-proxy\""
  }
}
```

### **Testing & Validation**

#### **Backward Compatibility Testing**
```bash
# Test 1: Default behavior (no .env file)
npm run dev-proxy  # Should work exactly as before

# Test 2: Custom configuration  
echo "PROXY_PORT=4001" > .env
npm run dev-proxy  # Should use port 4001

# Test 3: Health checks
curl http://localhost:4001/health  # Verify service discovery
```

#### **Multi-Developer Setup**
```bash
# Developer A
PROXY_PORT=4001
BACKEND_PORT=3002
FRONTEND_PORT=5174

# Developer B
PROXY_PORT=4002
BACKEND_PORT=3003
FRONTEND_PORT=5175
```

### **Production Considerations**

#### **Container Integration**
```dockerfile
# Environment variables work seamlessly with Docker
ENV PROXY_PORT=80
ENV NODE_ENV=production
ENV DEBUG=false
```

#### **Service Discovery**
- Health endpoints now return dynamic service URLs
- Proxy routes adapt to environment configuration
- Logging shows actual ports and hosts being used

### **Troubleshooting Environment Variables**

#### **Debug Environment Loading**
```bash
# Check if dotenv is loading variables
npm run server
# Look for: "[dotenv@17.2.1] injecting env (N) from .env"
```

#### **Common Issues**
1. **Port Conflicts**: Use different ports per developer
2. **Missing VITE_ Prefix**: Client-side vars need `VITE_` prefix
3. **Case Sensitivity**: Environment variable names are case-sensitive
4. **Number Parsing**: Use `parseInt()` for numeric environment variables

#### **Validation Commands**
```bash
# Test backend with custom port
BACKEND_PORT=3002 npm run server

# Test proxy with custom port  
PROXY_PORT=4001 npm run proxy

# Verify environment variable loading
node -e "require('dotenv').config(); console.log(process.env.PROXY_PORT)"
```

## 🔄 **Development Workflow**

### **Starting Development**

#### **Default Setup (No Configuration Required)**
```bash
# Terminal 1: Start zellij web server
zellij web --port 8083
# Or use npm script (respects ZELLIJ_PORT env var)
npm run start:zellij

# Terminal 2: Start all services
npm run dev-proxy

# Or start everything including zellij
npm run start:all

# Terminal 3: (Optional) Tunnel for external access
cloudflare tunnel --url localhost:4000
```

#### **Custom Configuration Setup**
```bash
# Step 1: Create environment configuration
cp .env.example .env
# Edit .env with your preferred ports

# Step 2: Start with custom configuration
npm run start:all  # Uses environment variables automatically
```

### **Development URLs**

#### **Default URLs (no .env file)**
- **Session Manager**: `http://localhost:4000/zviewer/`
- **Direct Zellij**: `http://localhost:4000/`
- **API Health**: `http://localhost:4000/zviewer/api/health`
- **Proxy Health**: `http://localhost:4000/health`

#### **Custom URLs (with environment variables)**
- **Session Manager**: `http://localhost:${PROXY_PORT}${FRONTEND_BASE_PATH}/`
- **Direct Zellij**: `http://localhost:${PROXY_PORT}/`
- **API Health**: `http://localhost:${PROXY_PORT}${API_BASE_PATH}/health`
- **Proxy Health**: `http://localhost:${PROXY_PORT}/health`

**Example with PROXY_PORT=4001:**
- **Session Manager**: `http://localhost:4001/zviewer/`

### **Testing Checklist**
- [ ] Session list loads correctly
- [ ] Session selection works (iframe loads)
- [ ] Authentication persists in embedded sessions
- [ ] Keyboard shortcuts work (arrows, enter, escape)
- [ ] Auto-refresh updates session list
- [ ] Mobile responsive design works
- [ ] Error handling for offline sessions

## 🐛 **Common Development Issues**

### **1. "Cannot GET /" Errors**
**Cause**: Proxy routing conflicts or service not running
**Debug**: Check proxy logs for routing decisions
**Fix**: Verify all services running, check filter logic

### **2. 404 Asset Errors**
**Cause**: Vite base path misconfiguration
**Current Fix**: `base: '/zviewer'` in vite.config.js
**Debug**: Check browser network tab for asset URLs

### **3. CORS/Authentication Issues**
**Cause**: Cross-origin requests or iframe restrictions
**Solution**: Reverse proxy provides same-origin access
**Debug**: Check browser console for CORS errors

### **4. Session List Empty**
**Cause**: Zellij not running or command execution fails
**Debug**: Test `zellij list-sessions --no-formatting` manually
**Fix**: Ensure zellij is installed and sessions exist

## 🔧 **Adding New Features**

### **Backend API Extension**
1. Add new endpoint in `server.js`
2. Test with curl: `curl http://localhost:3001/api/new-endpoint`
3. Update proxy if needed (usually automatic)

### **Frontend Feature Addition**
1. Add UI elements in `renderSessions()` or create new render function
2. Add event handlers in `setupEventListeners()`
3. Update state management in `appState`
4. Add CSS styling in `src/style.css`

### **Proxy Configuration**
1. Add new route in `proxy-server.js`
2. Consider route order (specific routes before catch-all)
3. Test routing with proxy logs
4. Update health check if needed

## 📊 **Performance Considerations**

### **Current Optimizations**
- **On-demand iframe loading**: Sessions load only when selected
- **Efficient polling**: 30-second auto-refresh interval
- **Minimal API calls**: Only session list, not individual session data
- **Responsive design**: Mobile-optimized with collapsible sidebar

### **Potential Improvements**
- **WebSocket integration**: Real-time session updates
- **Session caching**: Reduce API calls for unchanged data
- **Lazy loading**: Load session details only when needed
- **Connection pooling**: Reuse connections for better performance

## 🔮 **Future Development Areas**

### **Immediate Opportunities**
1. ~~**Environment Variables**: Implement the plan in `ENVIRONMENT_VARIABLES_PLAN.md`~~ ✅ **COMPLETED**
2. **Session Creation**: Add UI for creating new sessions
3. **Session Management**: Delete/rename sessions from UI
4. **Error Handling**: Better error states and recovery

### **Advanced Features**
1. **Real-time Updates**: WebSocket connection for live session changes
2. **Session Templates**: Pre-configured session layouts
3. **Bulk Operations**: Multi-session selection and actions
4. **Plugin System**: Extensible architecture for custom features

## 🧪 **Testing Strategy**

### **Manual Testing**
1. **Multiple Sessions**: Create 3-5 zellij sessions for testing
2. **Session States**: Test active, exited, and new sessions
3. **Network Conditions**: Test with slow/offline backend
4. **Browser Testing**: Chrome, Firefox, Safari (note HTTPS requirement)
5. **Mobile Testing**: Responsive design on various screen sizes

### **Automated Testing (Future)**
- Unit tests for session parsing logic
- Integration tests for API endpoints
- E2E tests for complete user workflows
- Performance tests for large session lists

## 📚 **Key Dependencies**

### **Runtime Dependencies**
- **express**: Backend web server
- **cors**: Cross-origin resource sharing
- **http-proxy-middleware**: Reverse proxy functionality

### **Development Dependencies**
- **vite**: Frontend build tool and dev server
- **concurrently**: Run multiple npm scripts simultaneously

### **External Dependencies**
- **zellij**: Terminal multiplexer (must be installed)
- **Node.js**: Runtime environment (v14+)

## 🔗 **Important Links**

- **Zellij Web Client Docs**: https://zellij.dev/documentation/web-client.html
- **Cloudflare Quick Tunnels**: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/
- **Vite Configuration**: https://vitejs.dev/config/
- **Express.js Docs**: https://expressjs.com/

## 💡 **Development Tips**

1. **Use proxy logs**: They show exactly how requests are routed
2. **Test with real sessions**: Create actual zellij sessions for realistic testing
3. **Check browser console**: Frontend errors and network requests
4. **Monitor all terminals**: Backend, frontend, and proxy logs
5. **Use health endpoints**: Quick way to verify services are running

---

**Happy coding! 🚀 This architecture provides a solid foundation for building advanced terminal session management features.**
