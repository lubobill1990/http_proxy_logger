# Node.js HTTP Proxy with Request/Response Logger

This project consists of two parts:

1. **HTTP Proxy Server** - A Node.js proxy that logs all requests and responses
2. **Log Viewer** - A Next.js web application to visualize and analyze the logs

## Project Structure

```
nodeproxy/
├── src/                      # Proxy server source code
│   └── index.ts
├── logs/                     # Generated logs directory
│   └── YYYYMMDD_HHMMSS/     # Per-minute directories
│       └── timestamp_METHOD_path/
│           ├── request_metadata.json
│           ├── request_body.*
│           ├── response_metadata.json
│           └── response_body.*
├── apps/
│   └── log-viewer/          # Web UI for viewing logs
├── package.json
├── tsconfig.json
└── README.md
```

## Quick Start

### 1. Install Dependencies

```bash
# Install proxy server dependencies
npm install

# Install log viewer dependencies
cd apps/log-viewer
npm install
cd ../..
```

### 2. Configure Proxy Server

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PROXY_HOST=localhost
PROXY_PORT=8080
TARGET_HOST=localhost
TARGET_PORT=3000
LOG_DIR=logs
```

### 3. Run Proxy Server

```bash
npm run dev
```

The proxy will start on `http://localhost:8080` and forward requests to `http://localhost:3000`.

### 4. Run Log Viewer

```bash
cd apps/log-viewer
npm run dev
```

The log viewer will be available at `http://localhost:3001`.

## Features

### Proxy Server

- Forwards all HTTP traffic to configured target
- Records complete request/response headers and bodies
- Organizes logs by minute in separate directories
- Smart file type detection with appropriate extensions
- JSON formatting for JSON content
- Binary file support (images, PDFs, etc.)

### Log Viewer

- Browse all logged requests
- Filter by time range
- Search by method or path
- View request/response details side-by-side
- JSON viewer with expand/collapse
- JSONPath filtering
- Special handling for Claude API SSE streams
- Dark mode support

## Use Cases

- Debug API calls between frontend and backend
- Inspect HTTP traffic for development
- Analyze request/response patterns
- Monitor Claude API interactions
- Archive HTTP transactions

## Documentation

- [Proxy Server README](README.md)
- [Log Viewer README](apps/log-viewer/README.md)

## License

MIT
