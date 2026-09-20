"""Launch composition root must tolerate deferred control-plane bind."""

from __future__ import annotations

from pathlib import Path

import pytest

from voyagestar.infra.server import VoyagestarServer


@pytest.mark.asyncio
async def test_deferred_start_exposes_config_for_listen(tmp_voyagestar_home: Path) -> None:
    """``voyagestar run`` reads bind host/port from config before the DB is bound."""
    srv = VoyagestarServer(home=tmp_voyagestar_home)
    await srv.start()
    try:
        assert srv.services is None
        cfg = srv.services.config if srv.services is not None else srv.config
        assert cfg is not None
        assert isinstance(cfg.port, int)
        assert cfg.bind_host
    finally:
        await srv.stop()
