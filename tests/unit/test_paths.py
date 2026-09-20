"""tests/unit/test_paths.py"""

from __future__ import annotations

from pathlib import Path

from voyagestar.infra.utils.paths import PathLayout


def test_root_paths(tmp_path: Path):
    p = PathLayout(tmp_path / ".voyagestar")
    assert p.root == tmp_path / ".voyagestar"
    assert p.db == tmp_path / ".voyagestar" / "voyagestar.db"
    assert p.logs_dir == tmp_path / ".voyagestar" / "logs"
    assert p.log == tmp_path / ".voyagestar" / "logs" / "voyagestar.log"
    assert p.config == tmp_path / ".voyagestar" / "config.json"


def test_log_dir_creation(tmp_path: Path):
    p = PathLayout(tmp_path / ".voyagestar")
    assert not (tmp_path / ".voyagestar" / "logs").exists()
    assert p.ensure_log() == tmp_path / ".voyagestar" / "logs" / "voyagestar.log"
    assert (tmp_path / ".voyagestar" / "logs").is_dir()
    assert p.log == tmp_path / ".voyagestar" / "logs" / "voyagestar.log"


def test_user_dir_uses_username(tmp_path: Path):
    p = PathLayout(tmp_path / ".voyagestar")
    assert p.user_dir("alice") == tmp_path / ".voyagestar" / "users" / "alice"


def test_agent_workspace(tmp_path: Path):
    p = PathLayout(tmp_path / ".voyagestar")
    ws = p.agent_workspace("agent01")
    assert ws == tmp_path / ".voyagestar" / "agents" / "agent01"


def test_ensure_root_creates_dir(tmp_path: Path):
    p = PathLayout(tmp_path / ".voyagestar")
    p.ensure_root()
    assert (tmp_path / ".voyagestar").is_dir()


def test_ensure_agent_workspace(tmp_path: Path):
    p = PathLayout(tmp_path / ".voyagestar")
    # New global path
    out = p.ensure_agent_workspace("a1")
    assert out.is_dir()
    assert out == tmp_path / ".voyagestar" / "agents" / "a1"


def test_backups_dir(tmp_path: Path) -> None:
    p = PathLayout(tmp_path / ".voyagestar")
    assert p.backups_dir == tmp_path / ".voyagestar" / "backups"
    assert p.ensure_backups_dir().is_dir()


def test_knowledge_dir(tmp_path: Path) -> None:
    p = PathLayout(tmp_path / ".voyagestar")
    assert p.knowledge_dir == tmp_path / ".voyagestar" / "knowledge"


def test_path_layout_from_env_defaults_to_dot_voyagestar(monkeypatch) -> None:
    monkeypatch.delenv("VOYAGESTAR_HOME", raising=False)
    assert PathLayout.from_env().root == Path.home() / ".voyagestar"


def test_path_layout_from_env_honors_voyagestar_home(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("VOYAGESTAR_HOME", str(tmp_path))
    assert PathLayout.from_env().root == tmp_path
