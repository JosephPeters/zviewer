# Environment Variables Configuration Plan

## 🎯 **Objective**

Make all port configurations and service URLs configurable via environment variables while maintaining current defaults for ease of use.

## 📋 **Current Hardcoded Values**

### **Ports**
- **Zellij Web Server**: `8083`
- **Backend API**: `3001`
- **Frontend Dev Server**: `5173`
- **Reverse Proxy**: `4000`

### **URLs/Hosts**
- **Zellij Host**: `127.0.0.1`
- **Backend Host**: `localhost`
- **Frontend Host**: `localhost`

### **Paths**
- **Frontend Base Path**: `/zviewer`
- **API Base Path**: `/zviewer/api`

## 🔧 **Proposed Environment Variables**

### **Port Configuration**
```bash
# Service Ports
ZELLIJ_PORT=8083              # Zellij web server port
BACKEND_PORT=3001             # Backend API server port
FRONTEND_PORT=5173            # Frontend dev server port
PROXY_PORT=4000               # Reverse proxy server port

# Host Configuration
ZELLIJ_HOST=127.0.0.1         # Zellij web server host
BACKEND_HOST=localhost        # Backend API host
FRONTEND_HOST=localhost       # Frontend dev server host
PROXY_HOST=localhost          # Reverse proxy bind host

# Path Configuration
FRONTEND_BASE_PATH=/zviewer   # Frontend base path for reverse proxy
API_BASE_PATH=/zviewer/api    # API base path for reverse proxy
```

### **Optional Advanced Configuration**
```bash
# Development vs Production
NODE_ENV=development          # development | production
DEBUG=false                   # Enable debug logging

# External URLs (for production)
EXTERNAL_DOMAIN=              # e.g., https://zviewer.example.com
TUNNEL_URL=                   # e.g., https://abc123.tunnel.com

# Timeouts and Intervals
SESSION_REFRESH_INTERVAL=30   # Auto-refresh interval in seconds
PROXY_TIMEOUT=30000           # Proxy timeout in milliseconds
```

## 📁 **Files to Modify**

### **1. proxy-server.js**
```javascript
// Current hardcoded values to replace:
const PORT = 4000;
const ZELLIJ_TARGET = 'http://127.0.0.1:8083';
const BACKEND_TARGET = 'http://localhost:3001';
const FRONTEND_TARGET = 'http://localhost:5173';

// New environment-based configuration:
const PORT = process.env.PROXY_PORT || 4000;
const ZELLIJ_TARGET = `http://${process.env.ZELLIJ_HOST || '127.0.0.1'}:${process.env.ZELLIJ_PORT || 8083}`;
const BACKEND_TARGET = `http://${process.env.BACKEND_HOST || 'localhost'}:${process.env.BACKEND_PORT || 3001}`;
const FRONTEND_TARGET = `http://${process.env.FRONTEND_HOST || 'localhost'}:${process.env.FRONTEND_PORT || 5173}`;
```

### **2. server.js (Backend)**
```javascript
// Current:
const PORT = 3001;

// New:
const PORT = process.env.BACKEND_PORT || 3001;
const HOST = process.env.BACKEND_HOST || 'localhost';
```

### **3. vite.config.js**
```javascript
// Current:
base: '/zviewer',

// New:
base: process.env.FRONTEND_BASE_PATH || '/zviewer',
server: {
  port: process.env.FRONTEND_PORT || 5173,
  host: process.env.FRONTEND_HOST || 'localhost'
}
```

### **4. src/main.js (Frontend)**
```javascript
// Current:
const API_BASE_URL = '/zviewer/api';

// New:
const API_BASE_URL = window.ENV?.API_BASE_PATH || '/zviewer/api';
```

### **5. package.json Scripts**
```json
{
  "scripts": {
    "dev": "vite",
    "server": "node server.js",
    "proxy": "node proxy-server.js",
    "dev-proxy": "concurrently \"npm run server\" \"npm run dev\" \"npm run proxy\"",
    "start:zellij": "zellij web --port ${ZELLIJ_PORT:-8083}",
    "start:all": "concurrently \"npm run start:zellij\" \"npm run dev-proxy\""
  }
}
```

## 📄 **Configuration Files**

### **1. .env.example**
```bash
# Zellij Session Viewer Configuration

# Service Ports
ZELLIJ_PORT=8083
BACKEND_PORT=3001
FRONTEND_PORT=5173
PROXY_PORT=4000

# Service Hosts
ZELLIJ_HOST=127.0.0.1
BACKEND_HOST=localhost
FRONTEND_HOST=localhost
PROXY_HOST=localhost

# Application Paths
FRONTEND_BASE_PATH=/zviewer
API_BASE_PATH=/zviewer/api

# Optional Configuration
NODE_ENV=development
DEBUG=false
SESSION_REFRESH_INTERVAL=30
PROXY_TIMEOUT=30000

# External Access (for production)
# EXTERNAL_DOMAIN=https://zviewer.example.com
# TUNNEL_URL=https://abc123.tunnel.com
```

### **2. .env.development**
```bash
# Development defaults (same as current hardcoded values)
ZELLIJ_PORT=8083
BACKEND_PORT=3001
FRONTEND_PORT=5173
PROXY_PORT=4000
ZELLIJ_HOST=127.0.0.1
BACKEND_HOST=localhost
FRONTEND_HOST=localhost
DEBUG=true
```

### **3. .env.production**
```bash
# Production configuration example
ZELLIJ_PORT=8083
BACKEND_PORT=3001
FRONTEND_PORT=5173
PROXY_PORT=80
ZELLIJ_HOST=127.0.0.1
BACKEND_HOST=localhost
FRONTEND_HOST=localhost
NODE_ENV=production
DEBUG=false
```

## 🔄 **Implementation Steps**

### **Phase 1: Basic Port Configuration**
1. ✅ Add dotenv dependency: `npm install dotenv`
2. ✅ Create .env.example with all variables
3. ✅ Update proxy-server.js with environment variables
4. ✅ Update server.js with environment variables
5. ✅ Update vite.config.js with environment variables
6. ✅ Test with default values (should work unchanged)

### **Phase 2: Advanced Configuration**
1. ✅ Update frontend to use environment-based API URLs
2. ✅ Add environment injection for frontend
3. ✅ Update package.json scripts
4. ✅ Add configuration validation
5. ✅ Test with custom port configurations

### **Phase 3: Documentation & Examples**
1. ✅ Update README with environment variable section
2. ✅ Create configuration examples for common scenarios
3. ✅ Add troubleshooting guide for port conflicts
4. ✅ Document production deployment patterns

## 🧪 **Testing Scenarios**

### **Default Configuration (No .env file)**
- Should work exactly as current implementation
- All services on default ports
- No breaking changes

### **Custom Ports**
```bash
ZELLIJ_PORT=9001
BACKEND_PORT=9002
FRONTEND_PORT=9003
PROXY_PORT=9000
```

### **Production Setup**
```bash
PROXY_PORT=80
NODE_ENV=production
DEBUG=false
EXTERNAL_DOMAIN=https://zviewer.company.com
```

### **Development Team Setup**
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

## 📚 **Documentation Updates Required**

### **README.md**
- Add environment variables section
- Update setup instructions
- Add configuration examples

### **REVERSE_PROXY_SETUP.md**
- Add environment variable configuration
- Update port references
- Add troubleshooting for port conflicts

### **New: CONFIGURATION.md**
- Comprehensive environment variable guide
- Common configuration patterns
- Production deployment examples
- Troubleshooting port conflicts

## 🎯 **Benefits**

1. **Flexibility**: Users can configure ports to avoid conflicts
2. **Team Development**: Multiple developers can run simultaneously
3. **Production Ready**: Easy deployment configuration
4. **Docker Friendly**: Environment variables work well with containers
5. **Backward Compatible**: Defaults maintain current behavior

## ⚠️ **Considerations**

1. **Complexity**: More configuration options to document
2. **Validation**: Need to validate port availability and conflicts
3. **Frontend Environment**: Vite environment variable handling
4. **Documentation**: More setup scenarios to explain

## 🚀 **Next Steps**

1. **Create feature branch**: `git checkout -b environment-variables`
2. **Implement Phase 1**: Basic port configuration
3. **Test thoroughly**: Ensure backward compatibility
4. **Update documentation**: README and setup guides
5. **Create PR**: Review and merge when ready
