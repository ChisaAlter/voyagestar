"""In-process MCP gateway for Voyagestar-hosted connector adapters."""

from voyagestar.infra.connectors.gateway.langchain import build_gateway_langchain_tools
from voyagestar.infra.connectors.gateway.protocol import handle_mcp_request
from voyagestar.infra.connectors.gateway.registry import mcp_tools_for_kind

__all__ = [
    "build_gateway_langchain_tools",
    "handle_mcp_request",
    "mcp_tools_for_kind",
]
