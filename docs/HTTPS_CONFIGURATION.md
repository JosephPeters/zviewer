# HTTPS Configuration Guide

This document details how to configure HTTPS support for the Zellij Session Viewer proxy server.

## Overview

The proxy server supports both HTTP and HTTPS modes with automatic protocol switching. When HTTPS is enabled, all services (proxy server and Zellij web client) are configured to use HTTPS connections.

## Environment Variables

### Required HTTPS Variables
```bash
# Enable/disable HTTPS mode
HTTPS_ENABLED=true

# Certificate file paths (required when HTTPS_ENABLED=true)
HTTPS_KEY_PATH=/path/to/private-key.pem
HTTPS_CERT_PATH=/path/to/certificate.pem
```

### Example .env Configuration
```bash
# Basic service configuration
PROXY_PORT=4000
PROXY_HOST=localhost
ZELLIJ_HOST=127.0.0.1
ZELLIJ_PORT=8083

# HTTPS Configuration
HTTPS_ENABLED=true
HTTPS_KEY_PATH=/Users/username/.certs/localhost+3-key.pem
HTTPS_CERT_PATH=/Users/username/.certs/localhost+3.pem
```

## Certificate Requirements

### Supported Certificate Types
- **Self-signed certificates** (development)
- **CA-signed certificates** (production)
- **Let's Encrypt certificates** (production)

### Certificate File Formats
- **Private Key**: `.pem`, `.key` formats
- **Certificate**: `.pem`, `.crt`, `.cert` formats

## Configuration Scenarios

### 1. HTTP Mode (Default)
```bash
# .env file or omit HTTPS variables entirely
HTTPS_ENABLED=false
```

**Results:**
- Proxy server: `http://localhost:4000`
- Zellij target: `http://127.0.0.1:8083`
- All service URLs use HTTP protocol

### 2. HTTPS Mode with Self-Signed Certificates
```bash
# .env file
HTTPS_ENABLED=true
HTTPS_KEY_PATH=/path/to/localhost-key.pem
HTTPS_CERT_PATH=/path/to/localhost.pem
```

**Results:**
- Proxy server: `https://localhost:4000`
- Zellij target: `https://127.0.0.1:8083`
- All service URLs use HTTPS protocol
- Accepts self-signed certificates

### 3. HTTPS Mode with Production Certificates
```bash
# .env file
HTTPS_ENABLED=true
HTTPS_KEY_PATH=/etc/ssl/private/domain.key
HTTPS_CERT_PATH=/etc/ssl/certs/domain.crt
```

**Results:**
- Production-ready HTTPS configuration
- Full certificate chain validation
- Suitable for public deployment

## Generating Self-Signed Certificates

### Using mkcert (Recommended for Development)
```bash
# Install mkcert
brew install mkcert  # macOS
# or follow mkcert installation for your OS

# Create local CA
mkcert -install

# Generate certificates for localhost and 127.0.0.1
mkcert localhost 127.0.0.1

# Files created:
# - localhost+1-key.pem (private key)
# - localhost+1.pem (certificate)
```

### Using OpenSSL
```bash
# Generate private key
openssl genrsa -out localhost.key 2048

# Generate certificate signing request
openssl req -new -key localhost.key -out localhost.csr \
  -subj "/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -in localhost.csr -signkey localhost.key \
  -out localhost.pem -days 365

# Clean up
rm localhost.csr
```

## Service URL Mapping

### HTTP Mode URLs
- **Session Manager**: `http://localhost:4000/zviewer/`
- **Direct Zellij**: `http://localhost:4000/`
- **Backend API**: `http://localhost:4000/zviewer/api/`
- **Health Check**: `http://localhost:4000/health`

### HTTPS Mode URLs  
- **Session Manager**: `https://localhost:4000/zviewer/`
- **Direct Zellij**: `https://localhost:4000/`
- **Backend API**: `https://localhost:4000/zviewer/api/`
- **Health Check**: `https://localhost:4000/health`

## Starting Services

### Zellij Web Server

#### HTTP Mode
```bash
zellij web --port 8083
```

#### HTTPS Mode
```bash
# Zellij must also run with HTTPS when proxy uses HTTPS
zellij web --port 8083 --ssl-cert /path/to/certificate.pem --ssl-key /path/to/private-key.pem
```

### Proxy Server
```bash
# Uses environment variables from .env file
npm run dev-proxy
```

## Troubleshooting

### Common Issues

#### 1. Certificate Path Errors
**Error:** `HTTPS enabled but certificate paths not provided`

**Solution:** Ensure `HTTPS_KEY_PATH` and `HTTPS_CERT_PATH` are set and point to valid files.

#### 2. Certificate File Not Found
**Error:** `ENOENT: no such file or directory`

**Solution:** Verify certificate file paths are absolute and files exist.

#### 3. 502 Bad Gateway to Zellij
**Error:** Cannot connect to Zellij web client

**Causes & Solutions:**
- **Zellij running HTTP, proxy expects HTTPS**: Start Zellij with SSL certificates
- **Certificate mismatch**: Ensure Zellij uses compatible certificates
- **Port mismatch**: Verify `ZELLIJ_PORT` matches actual Zellij port

#### 4. Browser Certificate Warnings
**Issue:** "Your connection is not private" warnings

**Solutions:**
- **Development**: Add certificates to browser trust store (mkcert handles this automatically)
- **Production**: Use CA-signed certificates

### Debug Commands

#### Test Certificate Files
```bash
# Verify private key
openssl rsa -in /path/to/private-key.pem -check

# Verify certificate
openssl x509 -in /path/to/certificate.pem -text -noout

# Check certificate-key pair match
openssl rsa -noout -modulus -in private-key.pem | openssl md5
openssl x509 -noout -modulus -in certificate.pem | openssl md5
```

#### Test HTTPS Connections
```bash
# Test proxy server
curl -k https://localhost:4000/health

# Test Zellij direct connection
curl -k https://127.0.0.1:8083
```

## Security Considerations

### Development
- Self-signed certificates are acceptable
- Use `mkcert` for automatic browser trust
- Certificate warnings are expected without proper CA

### Production
- Use CA-signed certificates (Let's Encrypt recommended)
- Ensure proper certificate chain
- Regular certificate renewal
- Consider using reverse proxy (nginx/Apache) for SSL termination

## Integration with External Access

### Cloudflare Tunnel
```bash
# HTTP mode
cloudflare tunnel --url localhost:4000

# HTTPS mode  
cloudflare tunnel --url https://localhost:4000
```

### nginx Reverse Proxy
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private-key.pem;

    location / {
        proxy_pass https://localhost:4000;
        proxy_ssl_verify off;  # For self-signed certificates
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Configuration Validation

### Startup Checks
The proxy server validates configuration on startup:

1. **Certificate files exist** when HTTPS is enabled
2. **Certificate files are readable**
3. **Proper certificate format**

### Health Check Response
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "services": {
    "zellij": "https://127.0.0.1:8083",
    "frontend": "http://localhost:5173/zviewer",
    "backend": "http://localhost:3001"
  }
}
```

## Migration Guide

### From HTTP to HTTPS
1. Generate or obtain SSL certificates
2. Update `.env` file with HTTPS configuration
3. Restart Zellij with SSL support
4. Restart proxy server
5. Update any external references to use HTTPS URLs

### From HTTPS to HTTP  
1. Set `HTTPS_ENABLED=false` in `.env`
2. Restart Zellij without SSL (remove SSL flags)
3. Restart proxy server
4. Update external references to use HTTP URLs

## Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HTTPS_ENABLED` | No | `false` | Enable HTTPS mode |
| `HTTPS_KEY_PATH` | Yes* | - | Path to private key file |
| `HTTPS_CERT_PATH` | Yes* | - | Path to certificate file |
| `PROXY_PORT` | No | `4000` | Proxy server port |
| `PROXY_HOST` | No | `localhost` | Proxy server host |
| `ZELLIJ_HOST` | No | `127.0.0.1` | Zellij server host |
| `ZELLIJ_PORT` | No | `8083` | Zellij server port |

*Required when `HTTPS_ENABLED=true`