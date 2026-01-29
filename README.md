# HTTP Proxy Logger with Web Viewer

A Node.js HTTP proxy server built with TypeScript and Hono that logs all requests and responses, paired with a Next.js web application for viewing and analyzing the logs.

## Features

### Proxy Server
- Proxies all HTTP traffic to a configurable target host and port
- Records all request and response headers and bodies
- Organizes logs by minute in separate directories
- Each request/response pair gets its own directory named with timestamp, method, and path
- Automatically detects content types and saves files with appropriate extensions
- Special handling for JSON content (formatted and saved as `.json` files)
- Binary content (images, PDFs, etc.) saved with proper file extensions for easy viewing
- Handles errors gracefully and logs them

### Log Viewer
- Web-based UI for browsing and analyzing logged requests
- Time-based filtering
- Search by method or path
- Side-by-side request/response view
- JSON viewer with expand/collapse functionality
- Special parsing for Claude API SSE streams
- Resizable JSON viewers with persistent heights
- URL-based deep linking to specific requests

## Project Structure

This is a monorepo containing two applications:

```
nodeproxy/
├── apps/
│   ├── proxy/          # HTTP proxy server
│   └── log-viewer/     # Next.js log viewer web app
└── logs/               # Shared log directory
```

## Installation

Install dependencies for both applications:

```bash
# Install all dependencies
npm run install:all

# Or install individually
npm run install:proxy
npm run install:viewer
```

## Configuration

### Proxy Server

Create a `.env` file in `apps/proxy/` (copy from `.env.example`):

```bash
cd apps/proxy
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Proxy server settings
PROXY_HOST=localhost
PROXY_PORT=8080

# Target server (where to forward requests)
TARGET_HOST=localhost
TARGET_PORT=3000

# Log directory (relative to apps/proxy)
LOG_DIR=../../logs
```

## Usage

### Run both applications

```bash
npm run dev
```

This will start:
- Proxy server on http://localhost:8080
- Log viewer on http://localhost:3001

### Run individually

```bash
# Proxy server only
npm run dev:proxy

# Log viewer only
npm run dev:viewer
```

## Log Structure

Logs are organized as follows:

```
logs/
├── 20260128_143000/          # Minute directory (YYYYMMDD_HHMMSS)
│   ├── 1738073456789_GET_api_users/
│   │   ├── request_metadata.json
│   │   ├── response_metadata.json
│   │   └── response_body.json
│   ├── 1738073457123_POST_api_login/
│   │   ├── request_metadata.json
│   │   ├── request_body.json
│   │   ├── response_metadata.json
│   │   └── response_body.json
│   └── 1738073458456_GET_images_logo/
│       ├── request_metadata.json
│       ├── response_metadata.json
│       └── response_body.png
└── 20260128_143100/          # Next minute directory
    └── ...
```

### File naming conventions

- **Request directory**: `{timestamp}_{METHOD}_{sanitized_path}`
- **Metadata files**:
  - `request_metadata.json` - Contains method, URL, headers, and timestamp
  - `response_metadata.json` - Contains status code, headers, and timestamp
- **Body files**:
  - JSON content: `request_body.json` or `response_body.json`
  - Binary content: `request_body.{ext}` or `response_body.{ext}` (e.g., `.png`, `.pdf`, `.jpg`)
  - Other content: Saved with appropriate extension based on Content-Type header

### Supported file extensions

The proxy automatically detects and uses appropriate extensions:

- **JSON**: `.json`
- **HTML**: `.html`
- **Images**: `.png`, `.jpg`, `.gif`, `.svg`, `.webp`
- **Documents**: `.pdf`, `.xml`, `.txt`
- **Code**: `.js`, `.css`
- **Archives**: `.zip`
- **Binary**: `.bin` (default for unknown types)

## How It Works

1. The proxy server listens on the configured `PROXY_HOST:PROXY_PORT`
2. All incoming requests are intercepted and logged
3. Requests are forwarded to `TARGET_HOST:TARGET_PORT`
4. Responses from the target are logged
5. Responses are sent back to the original client
6. Each minute, a new directory is created for organizing logs
7. Each request/response pair gets its own subdirectory with a unique timestamp

## Example Use Case

If you want to debug API calls between a frontend and backend:

1. Set `TARGET_HOST` and `TARGET_PORT` to your backend server
2. Start the proxy server
3. Configure your frontend to call the proxy server instead of the backend directly
4. All requests and responses will be logged for inspection

## Error Handling

If the proxy encounters an error while forwarding a request:

- An `error.txt` file is created in the request directory with error details
- A 502 Bad Gateway response is returned to the client

## License

MIT
