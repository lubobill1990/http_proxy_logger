# Systemd Service Configuration

This directory contains systemd service files for running the applications as system services.

## Services

1. **proxy.service** - HTTP Proxy Logger
2. **log-viewer.service** - Log Viewer Web Application
3. **copilot-api.service** - Copilot API Server

## Installation

### 1. Build the applications first

```bash
cd /c/src/nodeproxy
yarn install
yarn build
```

### 2. Copy service files to systemd directory

```bash
sudo cp systemd/*.service /etc/systemd/system/
```

### 3. Reload systemd daemon

```bash
sudo systemctl daemon-reload
```

### 4. Enable services to start on boot

```bash
sudo systemctl enable proxy.service
sudo systemctl enable log-viewer.service
sudo systemctl enable copilot-api.service
```

### 5. Start the services

```bash
sudo systemctl start proxy.service
sudo systemctl start log-viewer.service
sudo systemctl start copilot-api.service
```

## Managing Services

### Check service status

```bash
sudo systemctl status proxy.service
sudo systemctl status log-viewer.service
sudo systemctl status copilot-api.service
```

### View service logs

```bash
sudo journalctl -u proxy.service -f
sudo journalctl -u log-viewer.service -f
sudo journalctl -u copilot-api.service -f
```

### Stop services

```bash
sudo systemctl stop proxy.service
sudo systemctl stop log-viewer.service
sudo systemctl stop copilot-api.service
```

### Restart services

```bash
sudo systemctl restart proxy.service
sudo systemctl restart log-viewer.service
sudo systemctl restart copilot-api.service
```

### Disable services (prevent auto-start on boot)

```bash
sudo systemctl disable proxy.service
sudo systemctl disable log-viewer.service
sudo systemctl disable copilot-api.service
```

## Configuration

### Proxy Service

Edit `/c/src/nodeproxy/apps/proxy/.env` to configure:
- `PROXY_HOST` - Proxy server host (default: localhost)
- `PROXY_PORT` - Proxy server port (default: 8080)
- `TARGET_HOST` - Target server host
- `TARGET_PORT` - Target server port
- `LOG_DIR` - Log directory path

### Log Viewer Service

Edit `/c/src/nodeproxy/apps/log-viewer/.env` to configure:
- `PORT` - Log viewer port (default: 3001)

## Troubleshooting

If services fail to start, check:

1. **Permissions**: Ensure the user `bolu1` has read/write access to all directories
2. **Node.js**: Verify Node.js is installed and accessible at `/usr/bin/node`
3. **Build**: Make sure applications are built (`yarn build`)
4. **Environment files**: Check that `.env` files exist and are properly configured
5. **Logs**: Check systemd logs for error messages using `journalctl`

### Common Issues

**Service won't start:**
```bash
# Check for errors
sudo journalctl -u proxy.service -n 50 --no-pager
```

**Port already in use:**
```bash
# Find process using the port
sudo lsof -i :8080
sudo lsof -i :3001
```

**Permission denied:**
```bash
# Ensure correct ownership
sudo chown -R bolu1:bolu1 /c/src/nodeproxy
```
