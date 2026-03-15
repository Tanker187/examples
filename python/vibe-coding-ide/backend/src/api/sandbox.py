from typing import Any
import os
import httpx
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from vercel.oidc.aio import get_vercel_oidc_token
from vercel.sandbox import AsyncSandbox as Sandbox
import ipaddress
import socket
from urllib.parse import urlparse

from src.agent.utils import make_ignore_predicate
from src.run_store import get_user_project_sandboxes


router = APIRouter(prefix="/api/play", tags=["play"])

# Restrict which hosts can be probed by this endpoint to reduce SSRF risk.
# Adjust this tuple to the domains that are legitimate for your deployment.
ALLOWED_PROBE_HOST_SUFFIXES: tuple[str, ...] = (
    "example.com",
    "example.org",
)


def _is_private_address(ip_str: str) -> bool:
    """Return True if the given IP string is not suitable for public probing."""
    try:
        ip_obj = ipaddress.ip_address(ip_str)
    except ValueError:
        # If it's not a valid IP, treat as unsafe.
        return True

    return (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_reserved
    )


def validate_public_url(raw_url: str) -> str:
    """Validate that the URL is HTTP(S), targets an allowed host, and does not resolve to a private IP."""
    parsed = urlparse(raw_url)

    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Only http and https URLs are allowed.")

    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="URL must include a hostname.")

    hostname = parsed.hostname.lower()

    # Enforce that the hostname is within a configured allowlist of domains.
    if not any(
        hostname == suffix.lower() or hostname.endswith("." + suffix.lower())
        for suffix in ALLOWED_PROBE_HOST_SUFFIXES
    ):
        raise HTTPException(status_code=400, detail="URL host is not in the allowed domain list.")

    try:
        addr_info = socket.getaddrinfo(parsed.hostname, parsed.port, type=socket.SOCK_STREAM)
    except OSError:
        raise HTTPException(status_code=400, detail="URL hostname cannot be resolved.")

    for family, _, _, _, sockaddr in addr_info:
        if family in (socket.AF_INET, socket.AF_INET6):
            ip_str = sockaddr[0]
            if _is_private_address(ip_str):
                raise HTTPException(status_code=400, detail="URL host resolves to a disallowed address.")

    # If all resolved addresses and the hostname are acceptable, consider the URL safe to probe.
    return raw_url


class SyncRequest(BaseModel):
    """Sync current editor project files into an existing sandbox for a user.

    If name is omitted, the first sandbox mapping for the user will be used.
    """

    user_id: str
    project_id: str
    project: dict[str, str]
    name: str | None = None


@router.get("/probe")
async def probe_url(url: str) -> dict[str, Any]:
    """Server-side URL probe.

    Attempts a HEAD request first to avoid downloading the body.
    Some servers do not support HEAD; in that case, fall back to a
    streamed GET to obtain only the status code.
    """
    # Validate URL to reduce SSRF risk before making any outbound request.
    safe_url = validate_public_url(url)

    status_code: int | None = None
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=8.0) as client:
            try:
                resp = await client.request("HEAD", safe_url)
                status_code = int(resp.status_code)
            except Exception:
                # Fall back to a minimal GET (streamed, do not read body)
                try:
                    async with client.stream("GET", safe_url) as resp2:
                        status_code = int(resp2.status_code)
                except Exception:
                    status_code = None
    except Exception:
        status_code = None

    return {"ok": status_code is not None, "status": status_code}


@router.post("/sync")
async def sync_existing_sandbox(request: SyncRequest) -> dict[str, Any]:
    """Push editor project files into ALL mapped sandboxes for this user (or a specific name if provided).

    This enables a project-level "Sync sandbox" action to refresh multiple live sandboxes at once.
    """
    oidc_token = await get_vercel_oidc_token()
    os.environ["VERCEL_OIDC_TOKEN"] = oidc_token

    mappings = {}
    mappings = await get_user_project_sandboxes(request.user_id, request.project_id)
    if not mappings:
        raise HTTPException(status_code=404, detail="no sandboxes mapped for user")

    # Filter project once (respect ignore rules server-side)
    is_ignored = make_ignore_predicate(request.project or {})
    filtered: dict[str, str] = {
        p: c for p, c in (request.project or {}).items() if (not is_ignored(p)) or (p in {".gitignore", ".agentignore"})
    }

    targets: dict[str, str] = mappings
    if request.name:
        sid = mappings.get(request.name)
        if not sid:
            return {"ok": False, "error": f"sandbox not found for name '{request.name}'"}
        targets = {request.name: sid}

    results: dict[str, Any] = {}
    total_writes = 0
    for name, sid in targets.items():
        try:
            sandbox = await Sandbox.get(sandbox_id=sid)
            files_payload = []
            for path, content in filtered.items():
                try:
                    files_payload.append({"path": path, "content": content.encode("utf-8")})
                except Exception:
                    files_payload.append({"path": path, "content": bytes(str(content), "utf-8")})
            wrote = 0
            touched_paths: list[str] = []
            if files_payload:
                for i in range(0, len(files_payload), 64):
                    chunk = files_payload[i : i + 64]
                    await sandbox.write_files(chunk)
                    wrote += len(chunk)
                    try:
                        # accumulate paths for touch to bump mtimes and trigger watchers
                        for e in chunk:
                            p = e.get("path")
                            if isinstance(p, str):
                                touched_paths.append(p)
                    except Exception:
                        pass
            total_writes += wrote
            # Best-effort: update mtimes for written files to trigger file watchers
            try:
                if touched_paths:
                    # quote paths safely and touch them
                    def _sh_quote(p: str) -> str:
                        return "'" + p.replace("'", "'\"'\"'") + "'"
                    quoted = " ".join(_sh_quote(p) for p in touched_paths)
                    base_cwd = sandbox.sandbox.cwd
                    touch_cmd = await sandbox.run_command_detached(
                        "bash",
                        ["-lc", f"cd {base_cwd} && touch -cm -- {quoted}"],
                    )
                    await touch_cmd.wait()
            except Exception:
                pass
            # Preview hint (first port)
            url = None
            try:
                ports = getattr(sandbox, "ports", None)
                if isinstance(ports, list) and len(ports) > 0 and isinstance(ports[0], int):
                    url = sandbox.domain(ports[0])
            except Exception:
                url = None
            results[name] = {"ok": True, "sandbox_id": sid, **({"preview_url": url} if url else {}), "synced": wrote}
        except Exception as e:
            results[name] = {"ok": False, "error": str(e)}

    return {"ok": True, "by_sandbox": results, "total_synced": total_writes}
