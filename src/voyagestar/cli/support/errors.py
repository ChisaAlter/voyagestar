"""CLI error helpers."""

from __future__ import annotations

from typing import NoReturn

import click

from voyagestar.infra.errors import VoyagestarError


def fail_voyagestar(exc: VoyagestarError) -> NoReturn:
    click.echo(f"error: {exc.message}", err=True)
    raise SystemExit(1) from exc
