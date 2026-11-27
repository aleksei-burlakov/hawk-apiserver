"""Expose Hawk's sandbox resource actions over MCP stdio."""

import json
import os
import subprocess

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Hawk sandbox")


def call(action: str, payload: str | dict) -> dict:
    url = os.environ["HAWK_URL"].rstrip("/")
    session = os.environ["HAWK_SESSION"]
    args = ["curl", "--silent", "--show-error", "--max-time", "60"]
    if connect_to := os.getenv("HAWK_CONNECT_TO"):
        args += ["--connect-to", connect_to]
    result = subprocess.run(
        args + ["--header", "@-", "--data", json.dumps(payload),
                "--write-out", "\n%{http_code}", f"{url}/api/mcp/v1/resources/{action}"],
        input=f"Cookie: hawk_go_session={session}\nContent-Type: application/json\nAccept: application/json\n",
        capture_output=True,
        text=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    body, _, status = result.stdout.rpartition("\n")
    if not status.startswith("2"):
        raise RuntimeError(f"Hawk returned HTTP {status}: {body.strip()}")
    return json.loads(body)


@mcp.tool()
def resource_start(resource_id: str) -> dict:
    """Request that Pacemaker start a resource."""
    return call("start", resource_id)


@mcp.tool()
def resource_stop(resource_id: str) -> dict:
    """Request that Pacemaker stop a resource."""
    return call("stop", resource_id)


@mcp.tool()
def resource_maintenance_on(resource_id: str) -> dict:
    """Put a resource into maintenance mode."""
    return call("maintenance-on", resource_id)


@mcp.tool()
def resource_maintenance_off(resource_id: str) -> dict:
    """Take a resource out of maintenance mode."""
    return call("maintenance-off", resource_id)


@mcp.tool()
def resource_promote(resource_id: str) -> dict:
    """Request promotion of a promotable clone."""
    return call("promote", resource_id)


@mcp.tool()
def resource_demote(resource_id: str) -> dict:
    """Request demotion of a promotable clone."""
    return call("demote", resource_id)


@mcp.tool()
def resource_migrate(resource_id: str, destination: str = "") -> dict:
    """Move a resource to a node, or away from its current node if destination is empty."""
    return call("migrate", {"ResourceID": resource_id, "Destination": destination})


@mcp.tool()
def resource_cleanup(resource_id: str, destination: str = "") -> dict:
    """Clear resource failure history on a node, or across all nodes if destination is empty."""
    return call("cleanup", {"ResourceID": resource_id, "Destination": destination})


@mcp.tool()
def resource_clear(resource_id: str) -> dict:
    """Clear placement constraints created by resource migration."""
    return call("clear", resource_id)


if __name__ == "__main__":
    mcp.run(transport="stdio")
