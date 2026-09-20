"""tests/unit/test_shared.py"""

from __future__ import annotations

from pathlib import Path

from voyagestar.config import VoyagestarConfig
from voyagestar.infra.db.migrate import run_migrations
from voyagestar.infra.db.pool import SqlitePool
from voyagestar.infra.db.repos.sso import SsoRepo
from voyagestar.infra.db.services import SharedServices, build_shared_services
from voyagestar.infra.utils.paths import PathLayout


def test_build_shared_services(tmp_path: Path):
    cfg = VoyagestarConfig()
    paths = PathLayout(tmp_path / ".voyagestar")
    paths.ensure_root()
    db = SqlitePool(paths.db)
    run_migrations(db)
    services = build_shared_services(db=db, paths=paths, config=cfg)
    assert isinstance(services, SharedServices)
    assert services.db is db
    assert services.paths is paths
    assert services.config is cfg
    # all repos resolved
    assert services.user_repo.count() == 0
    assert isinstance(services.sso_repo, SsoRepo)
