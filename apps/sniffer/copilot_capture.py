"""
mitmproxy addon to capture VS Code GitHub Copilot requests.
Usage:
    mitmdump -s copilot_capture.py

This script logs Copilot-related HTTP(S) requests to the console
and saves them to a log directory.
"""

import json
import os
import time
from datetime import datetime
from pathlib import Path

from mitmproxy import http, ctx


# Domains associated with GitHub Copilot
COPILOT_DOMAINS = [
    "api.github.com",
    "copilot-proxy.githubusercontent.com",
    "api.individual.githubcopilot.com",
    "api.business.githubcopilot.com",
    "default.exp-tas.com",
    "copilot-telemetry.githubusercontent.com",
    "githubcopilot.com",
]

LOG_DIR = Path(__file__).parent / "captured_logs"


def get_minute_directory() -> Path:
    now = datetime.now()
    dir_name = now.strftime("%Y%m%d_%H%M00")
    dir_path = LOG_DIR / dir_name
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


def get_request_directory(method: str, url_path: str) -> Path:
    timestamp = int(time.time() * 1000)
    safe_path = url_path.lstrip("/").replace("/", "%2F").replace("?", "_")[:200] or "root"
    dir_name = f"{timestamp}_{method}_{safe_path}"
    minute_dir = get_minute_directory()
    req_dir = minute_dir / dir_name
    req_dir.mkdir(parents=True, exist_ok=True)
    return req_dir


def is_copilot_request(host: str) -> bool:
    return any(domain in host for domain in COPILOT_DOMAINS)


def save_body(dir_path: Path, prefix: str, content_type: str | None, data: bytes):
    """Save body with appropriate extension."""
    if not data:
        return

    if content_type and "json" in content_type:
        try:
            parsed = json.loads(data.decode("utf-8", errors="replace"))
            (dir_path / f"{prefix}_body.json").write_text(
                json.dumps(parsed, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            return
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass

    if content_type and ("text" in content_type or "javascript" in content_type):
        (dir_path / f"{prefix}_body.txt").write_bytes(data)
    else:
        (dir_path / f"{prefix}_body.bin").write_bytes(data)


class CopilotCapture:
    def response(self, flow: http.HTTPFlow):
        host = flow.request.pretty_host
        if not is_copilot_request(host):
            return

        method = flow.request.method
        url = flow.request.pretty_url
        path = flow.request.path
        status = flow.response.status_code if flow.response else "N/A"

        ctx.log.info(f"[Copilot] {method} {url} -> {status}")

        # Save to disk
        req_dir = get_request_directory(method, path)

        # Request metadata
        req_metadata = {
            "method": method,
            "url": url,
            "host": host,
            "path": path,
            "headers": dict(flow.request.headers),
            "timestamp": datetime.now().isoformat(),
        }
        (req_dir / "request_metadata.json").write_text(
            json.dumps(req_metadata, indent=2, ensure_ascii=False), encoding="utf-8"
        )

        # Request body
        save_body(
            req_dir,
            "request",
            flow.request.headers.get("content-type"),
            flow.request.raw_content or b"",
        )

        # Response metadata & body
        if flow.response:
            resp_metadata = {
                "statusCode": flow.response.status_code,
                "headers": dict(flow.response.headers),
                "timestamp": datetime.now().isoformat(),
            }
            (req_dir / "response_metadata.json").write_text(
                json.dumps(resp_metadata, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            save_body(
                req_dir,
                "response",
                flow.response.headers.get("content-type"),
                flow.response.raw_content or b"",
            )


addons = [CopilotCapture()]
