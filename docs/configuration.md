# Configuration

Voyagestar stores all of its state under `~/.voyagestar/`. The directory is created
on first server start (or by `voyagestar init` / `voyagestar run`).

## Filesystem layout

```
~/.voyagestar/
├── config.json              # process-level settings (host, port, CORS, DB, TLS, …)
├── env                      # optional dotenv (VOYAGESTAR_DATABASE_*, API keys, …); loaded at server start
├── voyagestar.db                 # SQLite — users, agents, providers, sessions, audit
├── cli_state.json           # CLI token + pinned defaults (`voyagestar user login`)
├── repl_history             # readline-style history for `voyagestar chats repl`
├── secrets/
│   └── jwt_secret           # 32-byte random; rotate with `voyagestar admin rotate-jwt-secret`
├── agents/<agent_id>/       # per-agent workspace (LangGraph state, attachments, …)
├── plugins/                 # installed third-party plugins
├── ssl/                     # self-signed certs when `voyagestar run --ssl` is used without --cert/--key
├── logs/                    # rotating log files (when `voyagestar service start` writes a logfile)
└── voyagestar.log                # default foreground log path
```

`env` is dotenv format, applied before `config.json` is loaded
(`VoyagestarServer.start` → `apply_env_file`). Dashboard **Advanced → Environment
variables** writes this file. Saving **replaces** the file and drops removed
keys from the process environment (host/systemd keys that were never in the
file are left alone). Every running agent inherits those keys:

- **Local shell** — live process env (including this file) plus the agent's
  workspace `.env` (workspace wins on the same key; `VOYAGESTAR_*` / `HOME` / `USER`
  cannot be overridden from `.env`). New agents store that file at
  `{workspace}/.voyagestar/.env`; existing agents keep `{workspace}/.env` when
  their stored internal system-files prefix uses the legacy layout. Remote
  object-store workspaces are not read from the host path — Voyagestar/harness
  also reads `.env` through the agent backend on each execute. Voyagestar also
  injects `VOYAGESTAR_AGENT_ID`, `VOYAGESTAR_AUTH_DIR` (under `{workspace}/.voyagestar/auth`
  for new agents; legacy agents keep `{workspace}/.voyagestar-auth`),
  and `VOYAGESTAR_HOME` into shell/sandbox env.
- **Docker sandbox** — re-reads `~/.voyagestar/env` on execute, plus workspace `.env`
  and a minimal `PATH` (not the full host environment). Admin `PATH`/`HOME`
  cannot override the container toolchain; workspace `.env` may set `PATH`.
- **Web search tools** (Tavily, Brave, …) register at agent start from process
  env. Put search API keys in the global file, not only in an agent's `.env`.
  Changing search keys triggers a background agent reload; other keys take
  effect on the next execute without reload.

Per-agent secrets belong in `{workspace}/.env` or, for new agents,
`{workspace}/.voyagestar/.env` (also writable via the `write_env_file` tool).
That file is excluded from published-expert snapshots.

The root can be overridden with `VOYAGESTAR_HOME` (absolute path). Most
sub-paths are exposed as properties on `PathLayout` in
`voyagestar.infra.utils.paths`.

## `config.json`

Generated with defaults on first run; merged with environment overrides
on each start. Schema (`VoyagestarConfig` in `voyagestar/config.py`):

```json
{
  "bind_host": "127.0.0.1",
  "port": 8088,
  "log_level": "info",
  "access_token_ttl_seconds": 86400,
  "login_max_attempts": 5,
  "login_lockout_seconds": 900,
  "cors_origins": [],
  "default_timezone": "Asia/Shanghai",
  "enable_dashboard": true,
  "enable_api_docs": false,
  "require_setup_password": true,
  "max_upload_mb": 100,
  "database": {
    "driver": "sqlite",
    "sqlite_path": "voyagestar.db",
    "host": "127.0.0.1",
    "port": 5432,
    "database": "voyagestar",
    "user": "voyagestar"
  },
  "tls": {
    "enabled": false,
    "mode": "",
    "domains": [],
    "cert_file": "",
    "key_file": "",
    "issued_at": "",
    "expires_at": "",
    "acme_staging": false,
    "http_port": 80
  }
}
```

Notes:

- `default_timezone` is the process default for dashboard timestamps, cron
  scheduling, and harness. Legacy `cron_timezone` in `config.json` and
  `VOYAGESTAR_CRON_TIMEZONE` are still accepted; the new key/env wins when both
  are set.
- `database.password`：向导用离散字段配置 PostgreSQL 时**可能**写入
  `config.json`（便于本机首次启动）。生产环境更推荐只用
  `VOYAGESTAR_DATABASE_PASSWORD` 或带密码的 `VOYAGESTAR_DATABASE_URL`，并限制
  `config.json` 文件权限。环境变量始终覆盖文件中的同名配置。
- `enable_api_docs=false` keeps `/api/docs` (Scalar) off in production
  while still serving `/api/openapi.json` to the dashboard.
- `require_setup_password=true` adds the wizard password gate to the
  first-run setup flow; set `false` for unattended bootstraps via
  `VOYAGESTAR_ADMIN_USERNAME` / `VOYAGESTAR_ADMIN_PASSWORD`.
- `max_upload_mb` is the process-wide ceiling for dashboard chat
  attachments, IM inbound files, and knowledge-base documents (default
  100). Existing `config.json` files that omit the key pick up the
  default on load. Change it and restart; reverse proxies may still
  impose their own body-size limit (for example nginx
  `client_max_body_size`). Agent workspace file upload, plugin ZIPs,
  and backup archives use separate limits and are not this setting.
- `plugins.<id>.enabled` is the **global** plugin switch (Dashboard Admin →
  Plugins). Bundled plugins are copied into `~/.voyagestar/plugins/` on init and
  server start with `enabled: false`. `bundled_plugins_seeded` lists ids
  already offered so uninstall does not come back on the next start.

## Environment overrides

Each variable, when set, takes precedence over the matching key in
`config.json`. Unset variables leave the on-disk value untouched.

| Variable | Type | Default | Effect |
|----------|------|---------|--------|
| `VOYAGESTAR_HOME` | path | `~/.voyagestar` | Install root (DB, secrets, workspaces, plugins) |
| `VOYAGESTAR_BIND_HOST` | string | `127.0.0.1` | Listen address (use `0.0.0.0` for LAN access) |
| `VOYAGESTAR_PORT` | int | `8088` | Listen port |
| `VOYAGESTAR_LOG_LEVEL` | string | `info` | One of `debug` `info` `warning` `error` |
| `VOYAGESTAR_LOG_RETENTION_DAYS` | int | `14` | Keep rotated `voyagestar.log.YYYY-MM-DD` files for this many days |
| `VOYAGESTAR_LOG_MAX_BYTES` | int | `104857600` (100 MiB) | Roll the active log when it exceeds this size (in addition to daily rotation) |
| `VOYAGESTAR_LOG_COMPRESS` | bool | `true` | logrotate-style `compress` + `delaycompress`: gzip prior rotated plains on the next cycle (`voyagestar.log.YYYY-MM-DD.gz`); the newest rotated file stays uncompressed until then |
| `VOYAGESTAR_ACCESS_TOKEN_TTL` | int (seconds) | `86400` | JWT access-token lifetime |
| `VOYAGESTAR_LOGIN_MAX_ATTEMPTS` | int | `5` | Failed-login attempts before lockout |
| `VOYAGESTAR_LOGIN_LOCKOUT_SECONDS` | int | `900` | Lockout duration after `VOYAGESTAR_LOGIN_MAX_ATTEMPTS` failures |
| `VOYAGESTAR_CAPTCHA_PROVIDER` | slug | `slider` | Login captcha (`slider`, `turnstile`, `hcaptcha`, `recaptcha-v3`, `tencent`; `recaptcha` v2 stays resolvable for existing configs but is unlisted). Boot snapshot; restart after change |
| `VOYAGESTAR_CAPTCHA_SITE_KEY` | string | empty | Public site key (Tencent: CaptchaAppId; required when the env snapshot is a strong provider) |
| `VOYAGESTAR_CAPTCHA_SECRET` | string | empty | Siteverify secret (Tencent: AppSecretKey; never logged; `GET /api/envs` redacts it) |
| `VOYAGESTAR_CAPTCHA_CAM_SECRET_ID` | string | empty | Tencent only: CAM API SecretId signing `DescribeCaptchaResult`; required when the env snapshot is `tencent` |
| `VOYAGESTAR_CAPTCHA_CAM_SECRET_KEY` | string | empty | Tencent only: CAM API SecretKey; never logged; `GET /api/envs` redacts it |
| `VOYAGESTAR_CAPTCHA_V3_MIN_SCORE` | float | `0.5` | Minimum `recaptcha-v3` score; admin UI is read-only |
| `VOYAGESTAR_DEFAULT_TIMEZONE` | IANA tz | `Asia/Shanghai` | Default timezone for display, scheduling, and harness (`cron_timezone` / `VOYAGESTAR_CRON_TIMEZONE` still accepted) |
| `VOYAGESTAR_CORS_ORIGINS` | comma-sep list | empty | Permitted CORS origins for the dashboard / external callers |
| `VOYAGESTAR_ENABLE_DASHBOARD` | bool | `true` | Serve the built React SPA at `/` |
| `VOYAGESTAR_ENABLE_API_DOCS` | bool | `false` | Expose Scalar API docs at `/api/docs` |
| `VOYAGESTAR_REQUIRE_SETUP_PASSWORD` | bool | `true` | Require wizard password during initial setup |
| `VOYAGESTAR_MAX_UPLOAD_MB` | int | `100` | Max upload size in MiB for chat attachments, IM inbound, and knowledge documents (1–1024) |
| `VOYAGESTAR_DATABASE_URL` | string | empty | Full DSN — overrides the `VOYAGESTAR_DATABASE_*` fields below |
| `VOYAGESTAR_DATABASE_DRIVER` | `sqlite` \| `postgresql` | `sqlite` | Storage backend |
| `VOYAGESTAR_DATABASE_SQLITE_PATH` | path | `voyagestar.db` | SQLite file path (relative to `VOYAGESTAR_HOME` unless absolute) |
| `VOYAGESTAR_DATABASE_HOST` | string | `127.0.0.1` | PostgreSQL host (when `driver=postgresql`) |
| `VOYAGESTAR_DATABASE_PORT` | int | `5432` | PostgreSQL port |
| `VOYAGESTAR_DATABASE_NAME` | string | `voyagestar` | PostgreSQL database name |
| `VOYAGESTAR_DATABASE_USER` | string | `voyagestar` | PostgreSQL user |
| `VOYAGESTAR_DATABASE_PASSWORD` | string | empty | PostgreSQL password (overrides file; prefer env in production) |
| `VOYAGESTAR_ADMIN_USERNAME` | string | empty | Pre-fills the first-admin username in `voyagestar init` |
| `VOYAGESTAR_ADMIN_PASSWORD` | string | empty | Pre-fills the first-admin password in `voyagestar init` |
| `VOYAGESTAR_ADMIN_DISPLAY_NAME` | string | empty | Pre-fills the admin display name |
| `VOYAGESTAR_USER` | string | empty | Default `--user` for CLI subcommands |
| `VOYAGESTAR_AGENT` | string | empty | Default `--agent` for CLI subcommands |
| `VOYAGESTAR_SERVICE_MODE` | `systemd` \| `launchd` | auto | Override the service backend (used by `voyagestar service`) |
| `VOYAGESTAR_SERVICE_SCOPE` | `user` \| `system` | auto | systemd `--user` vs system unit (Linux only) |

Invalid integer values are logged and ignored — the on-disk default
remains in effect. `database_env_configured()` returns `True` when any
`VOYAGESTAR_DATABASE_*` is set, which lets `VoyagestarServer.start()` pick the
configured backend at boot.

**Docker Compose:** put `VOYAGESTAR_DATABASE_*` in `docker/.env` *and* ensure
they are listed under `environment:` in `docker/docker-compose.yml`
(Compose uses `.env` for interpolation only; unset keys do not enter the
container). Writing the same keys to the mounted `~/.voyagestar/env` also works.

### Agent memory vs control plane

Control-plane `database` and agent memory are separate layers. Defaults:

- Control plane SQLite → agent memory stays `{workspace}/memory.sqlite`
  (or `{workspace}/.voyagestar/memory.sqlite` for new agents).
- Control plane PostgreSQL → agent memory **defaults to the same DSN**
  (harness-memory per-agent PG schema `agent_<id>`). Runtime also needs
  ``langgraph-checkpoint-postgres`` (pulled in via
  ``harness-memory[langgraph-postgres]``) so LangGraph checkpoints work.
  To keep file memory while the control plane is PG, set on the agent:

```json
"memory": { "backend": { "type": "sqlite" } }
```

Or point at another DSN with `"type": "postgres", "dsn": "…"`. There is
no automatic SQLite→PG memory data migration.

PostgreSQL **extensions** (e.g. `vector`) are instance-level ops, not
control-plane migrations. Local compose enables `vector` via
`docker/postgres/init-vector.sql`; managed databases need a DBA /
provider toggle. See [ADR 002](./adr/002-database-backends.md).

## First-boot wizard

The first request to a fresh install lands on the setup page. Greenfield
SQLite installs **defer** opening the control-plane DB until the database
step; password verification works without a pool. The modern flow uses
`/api/setup/*`:

1. `POST /api/setup/begin` (or `POST /api/setup/verify-password` when
   `require_setup_password=true`) — issues a short-lived wizard token.
2. `POST /api/setup/test-database` / `POST /api/setup/database` — choose
   SQLite or PostgreSQL, probe, persist `config.json`, bind pool + migrate.
3. `POST /api/setup/initial-admin` — creates the seed admin (requires DB).
4. `POST /api/setup/test-provider` — pings an optional provider draft.
5. `POST /api/setup/finish` — bootstraps default `main` agent and unlocks
   the rest of the API.

`GET /api/setup/status` returns `setup_required`, wizard password fields,
plus `database_bound` / `database_driver`. `setup_lockdown` middleware
blocks non-setup routes until the wizard completes.

For unattended installs, use `voyagestar init --yes` with
`VOYAGESTAR_ADMIN_USERNAME` / `VOYAGESTAR_ADMIN_PASSWORD` (and
`VOYAGESTAR_REQUIRE_SETUP_PASSWORD=false` if the env-var path is used). This
runs the same migrations + admin creation without the HTTP wizard.

## Secrets

The JWT secret is generated on first start and stored in
`~/.voyagestar/secrets/jwt_secret`. Rotate it with:

```bash
voyagestar admin rotate-jwt-secret
```

Rotation invalidates every outstanding access token immediately. The
old secret is overwritten in place — no zero-downtime rotation today.

Per-agent provider credentials (e.g. API keys) live in the SQLite
`providers` table and are surfaced through
`infra/connectors/credential_crypto.py` for connector OAuth flows.

## 可选分段历史归档

`history_v2_enabled` 默认 `false`，可用 `VOYAGESTAR_HISTORY_V2_ENABLED=true` 开启。
该开关只决定下一完整回合的写入格式，关闭后仍读取已经保存的新格式。
启用前请阅读 [分段历史归档与回退](versioned-history.md)，尤其是配套版本与备份恢复边界。
