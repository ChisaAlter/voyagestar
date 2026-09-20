"""voyagestar version command."""

from __future__ import annotations

import click


@click.command("version")
def version() -> None:
    """Show the installed voyagestar version."""
    try:
        from importlib.metadata import version as _v

        v = _v("voyagestar")
    except Exception:
        v = "unknown"
    click.echo(f"voyagestar v{v}")
