# CLI Reference

`voyagestar` is a single Click app installed as `voyagestar` on `pip install voyagestar`.
It is registered in `src/voyagestar/cli/main.py`; commands are loaded
lazily from `src/voyagestar/cli/registry.py`.

```
$ voyagestar --help
Usage: voyagestar [OPTIONS] COMMAND [ARGS]...

  Voyagestar command-line interface.

Options:
  -v, --version           Show the installed voyagestar version.
  --user TEXT             Default --user for subcommands (admin acting on behalf
                          of a user). [env: VOYAGESTAR_USER]
  --agent TEXT            Default --agent for subcommands. [env: VOYAGESTAR_AGENT]
  --json                  Emit machine-readable JSON for list-style commands.
  -h, --help              Show this message and exit.

Commands:
  acp        Run Voyagestar agent as ACP server (stdio).
  admin      Admin commands.
  agent      Agent lifecycle commands.
  backup     Export and restore Voyagestar backups.
  chat       [deprecated] Alias for `voyagestar chats`.
  chats      Chat REPL and session management.
  channel    Channel management commands.
  clean      Remove CLI state or wipe all of ~/.voyagestar.
  completion Shell completion utilities.
  config     CLI state (base URL, defaults).
  cron       Cron job management commands.
  init       Bootstrap an Voyagestar server install.
  models     Model catalog and active-model settings.
  plugin     Install and manage plugins.
  provider   Provider management (admin write).
  run        Run voyagestar-server in the foreground.
  service    System service lifecycle (start/stop/restart/status).
  skills     Per-agent skill enable/disable.
  update     Check for and install a newer Voyagestar release.
  user       User management commands.
  version    Show the installed voyagestar version.
```

> **Tip.** Regenerate the per-subcommand listings below with
> `make docs-cli` (each `voyagestar <cmd> --help` is captured to stdout).

## Global options

| Option | Env | Effect |
|--------|-----|--------|
| `--user NAME` | `VOYAGESTAR_USER` | Default `--user` for subcommands (admin acting on behalf of a user) |
| `--agent ID` | `VOYAGESTAR_AGENT` | Default `--agent` for subcommands |
| `--json` | — | Emit machine-readable JSON for list-style commands |
| `-v, --version` | — | Print version and exit |

## Transport layers

Voyagestar commands pick one of three transports:

| Layer | When | Login? | Examples |
|-------|------|--------|----------|
| **Offline** (local DB only) | Need to read/write `~/.voyagestar` without a running server | No | `init`, `backup`, `plugin`, `agent list`, `chats list/get/create/update/delete`, `cron list`, `user *`, `admin overview/audit`, `models presets/list/active` |
| **Attach** (HTTP / WS) | Need a live `voyagestar run` process (IM, streams, model pulls) | Yes (`voyagestar user login`) | `chats send/repl`, `channel test/probe`, `models ollama-*`, `skills enable/disable`, `provider test` |
| **Embedded** (in-process) | CLI boots `VoyagestarServer` for a single command | No | `voyagestar acp`, `voyagestar chats repl`, `voyagestar chats send` (defaults to embedded), `voyagestar agent create/from-expert/start/stop/reload` |

The dashboards and HTTP callers manage their own JWTs and do **not**
share `~/.voyagestar/cli_state.json`.

## `voyagestar init`

Bootstrap a fresh install (DB migrations, JWT secret, first admin).
Idempotent on the DB; pass `--force` to wipe `~/.voyagestar` first.

```
Usage: voyagestar init [OPTIONS]

  Bootstrap an Voyagestar server (~/.voyagestar dir, DB migrations, JWT secret, first admin).

Options:
  --admin-username TEXT       [env: VOYAGESTAR_ADMIN_USERNAME]
  --admin-password TEXT       [env: VOYAGESTAR_ADMIN_PASSWORD]
  --admin-display-name TEXT   [env: VOYAGESTAR_ADMIN_DISPLAY_NAME]
  --force                     Wipe existing ~/.voyagestar contents before bootstrapping.
  --yes                       Skip all interactive prompts.
  -h, --help                  Show this message and exit.
```

## `voyagestar run`

Start the FastAPI app in the foreground (delegates to
`voyagestar.launch.run_foreground_blocking`).

```
Usage: voyagestar run [OPTIONS]

  Start the Voyagestar server (foreground; uvicorn).

Options:
  --host TEXT                 Override VOYAGESTAR_BIND_HOST.
  --port INTEGER              Override VOYAGESTAR_PORT.
  --reload / --no-reload      Enable uvicorn auto-reload (dev only).
  --ssl / --no-ssl            Enable HTTPS with a self-signed cert (or a real one).
  --certfile PATH             TLS certificate (PEM).
  --keyfile PATH              TLS private key (PEM).
  --log-level [debug|info|warning|error]
  -h, --help                  Show this message and exit.
```

## `voyagestar service`

Install and manage the Voyagestar system service. The backend is detected
automatically (systemd on Linux, launchd on macOS); the scope
(`user` vs `system`) can be forced via `--scope` or
`VOYAGESTAR_SERVICE_SCOPE`.

```
Usage: voyagestar service [OPTIONS] COMMAND [ARGS]...

  Manage the Voyagestar system service (systemd on Linux, launchd on macOS).

Commands:
  start     Install (if missing) and start the service.
  stop      Stop the service.
  restart   Restart the service.
  status    Print whether the service is installed / running / healthy.
```

`status` probes the HTTP health endpoint and prints journal/log hints
on failure.

On Linux, `start` and `restart` install a systemd drop-in
(`voyagestar.service.d/10-nofile.conf`) with `LimitNOFILE=65535` (user
units are capped to the process hard rlimit so systemd cannot fail to
spawn). The main unit file is not rewritten unless it is missing or
you pass `--force-install`. `restart` always runs `systemctl restart`
even if writing the drop-in fails, so an upgrade that only restarts
still comes back. To undo: delete the drop-in, then
`systemctl daemon-reload && systemctl restart voyagestar`.

## `voyagestar user`

Local-DB user management. `login` requires a running server; the
rest are offline.

```
Usage: voyagestar user [OPTIONS] COMMAND [ARGS]...

  User management commands (local DB; no server login required).

Commands:
  create    Create a new user.
  list      List all users.
  passwd    Reset a user's password (admin).
  role      Set a user's role.
  disable   Disable a user.
  delete    Delete a user.
  login     Login against a running server; stores JWT for optional remote HTTP attach.
```

## `voyagestar agent`

Lifecycle and templates. Most commands boot an embedded
`VoyagestarServer` to operate on the local DB without a remote round-trip.

```
Usage: voyagestar agent [OPTIONS] COMMAND [ARGS]...

  Agent lifecycle commands.

Commands:
  create        Create a new agent.
  from-expert   Create an agent from a bundled expert template.
  list          List agents.
  use           Pin this agent as the default for subsequent commands.
  start         Start the agent runtime.
  stop          Stop the agent runtime.
  reload        Reload the agent runtime.
  delete        Delete the agent row (and runtime).
  experts       List bundled expert templates.
```

`create` and `from-expert` accept `--user` (admin only) to create
agents on behalf of another user. `use` writes the agent id into
`~/.voyagestar/cli_state.json` so subsequent commands default to it.

## `voyagestar chats`

Thread CRUD + interactive REPL. The REPL and `send` use an embedded
server (no separate `voyagestar run` needed); `list` / `get` / `create` /
`update` / `delete` work fully offline against `~/.voyagestar/voyagestar.db`.

```
Usage: voyagestar chats [OPTIONS] COMMAND [ARGS]...

  Thread list/history and interactive chat (CLI channel / local DB).

Commands:
  list        List conversation threads for an agent.
  get         Show message history for a thread.
  create      Start a new thread (/new equivalent).
  update      Rename or pin a thread.
  delete      Delete a thread.
  send        Send one message and stream the response.
  repl        Interactive chat REPL (embedded server + CLI gateway channel).
```

`voyagestar chat` is a deprecated alias that prints a stderr warning and
forwards to `chats`.

## `voyagestar channel`

Local DB channel CRUD plus platform-specific bot creators. The
`wecom` / `weixin` / `feishu-setup` subcommands drive the QR-code
bot-creator flows; `config` is the offline config editor.

```
Usage: voyagestar channel [OPTIONS] COMMAND [ARGS]...

  Channel management commands.

Commands:
  list          List channels for an agent.
  get           Show one channel row.
  create        Create a channel.
  patch         Update a channel.
  delete        Delete a channel.
  test          Test a channel (instantiate → start → stop).
  config        Edit channel config offline.
  feishu-setup  Drive the Feishu bot-creator flow.
  bind          Bind-group helper for WeCom / Weixin (QR login, etc.).
```

## `voyagestar cron`

Local DB cron management. `run-now` requires a running `voyagestar run`
because the actual fire is dispatched through the live
`CronManager`.

```
Usage: voyagestar cron [OPTIONS] COMMAND [ARGS]...

  Cron job management commands.

Commands:
  list        List cron jobs for an agent.
  create      Create a cron job.
  delete      Delete a cron job.
  run-now     Trigger a cron job immediately.
```

`create --trigger` accepts cron expressions (`"0 9 * * *"`) and the
`interval:N` / `date:ISO8601` aliases. `--task-type text` pushes the
prompt verbatim; `--task-type agent` (default) runs the LLM and
pushes the reply. `--prompt` is required, must be non-empty and ≤
2000 characters.

## `voyagestar provider`

Local DB provider CRUD. `test` requires a running server.

```
Usage: voyagestar provider [OPTIONS] COMMAND [ARGS]...

  Provider management commands (local DB).

Commands:
  list      List providers.
  create    Create a provider.
  delete    Delete a provider.
  test      Ping the provider (requires running server).
```

## `voyagestar models`

Provider presets and active model management.

```
Usage: voyagestar models [OPTIONS] COMMAND [ARGS]...

  Model catalog and active-model settings.

Commands:
  presets       List built-in provider templates from harness-agent.
  list          List all resolved models across enabled providers.
  active        Show or set the global default model (admin).
  config        Interactively create a provider from presets and set the active model.
  ollama-list   List local Ollama models (requires a running server).
  ollama-pull   Pull a model via Ollama (requires a running server).
  ollama-rm     Remove a local Ollama model (requires a running server).
```

## `voyagestar skills`

Per-agent skill enable / disable. All subcommands need a running
server (the dashboard's Skill Hub and bundled `~/.voyagestar/skills/`
library are queried at boot).

```
Usage: voyagestar skills [OPTIONS] COMMAND [ARGS]...

  Manage agent skills (enable / disable / list).

Commands:
  list      List skills for an agent.
  enable    Enable a skill for the agent.
  disable   Disable a skill for the agent.
  config    Show / edit the per-agent skills config.
```

## `voyagestar admin`

Local DB admin operations. `rotate-jwt-secret` works without a
running server (it edits the SQLite secret row directly).

```
Usage: voyagestar admin [OPTIONS] COMMAND [ARGS]...

  Admin commands (local DB).

Commands:
  overview             Show admin overview (user count, agent state distribution).
  audit                Show audit log entries.
  providers            Global (admin) providers.
  rotate-jwt-secret    Rotate the JWT secret directly via the local DB.
```

## `voyagestar backup`

Export and restore Voyagestar backups. Works fully offline.

```
Usage: voyagestar backup [OPTIONS] COMMAND [ARGS]...

  Backup and restore database + local agent workspaces.

Commands:
  create     Create a backup archive (DB + workspaces + config).
  restore    Restore a backup archive into ~/.voyagestar.
  auto       Automatic backup status and one-shot run.
```

### `voyagestar backup auto`

Automatic backups are scheduled **inside** a running `voyagestar run` process
(via the same system-job mechanism as TLS renewal). Configure in
`config.json` under `backup`, with env overrides
`VOYAGESTAR_BACKUP_AUTO_ENABLED`, `VOYAGESTAR_BACKUP_SCHEDULE`,
`VOYAGESTAR_BACKUP_RETENTION_COUNT`, or via the dashboard Backup settings.

```
Usage: voyagestar backup auto [OPTIONS] COMMAND [ARGS]...

Commands:
  status  Print automatic backup settings from config.json.
  run     Create one automatic backup now and prune by retention.
```

Default schedule when enabled: `cron:0 4 * * *` (daily 04:00, server
timezone). Automatic archives are named `voyagestar-auto-backup-*.tar.gz`;
retention only deletes those files and never touches manual
`voyagestar-backup-*.tar.gz` archives.

## `voyagestar update`

Check for and install a newer Voyagestar release from the configured
channel (PyPI by default).

```
Usage: voyagestar update [OPTIONS]

  Check for and install a newer Voyagestar release.

Options:
  --check / --no-check     Only check; do not install.
  --channel TEXT           Release channel (pypi, testpypi, custom index).
  -h, --help               Show this message and exit.
```

## `voyagestar plugin`

Install and manage third-party plugins (drop into `~/.voyagestar/plugins/`).
The same plugin manager powers the dashboard's "Plugins" page.

Voyagestar also **seeds bundled plugins** into `~/.voyagestar/plugins/` during
`voyagestar init` and every `voyagestar run` start. They are listed in Admin →
Plugins but stay **globally disabled** until you turn them on. An id
already recorded in `config.json` → `bundled_plugins_seeded` is not
copied again after uninstall.

```
Usage: voyagestar plugin [OPTIONS] COMMAND [ARGS]...

  Install and manage plugins.

Commands:
  list       List installed plugins.
  install    Install a plugin (local path or git URL).
  uninstall  Remove an installed plugin.
  reload     Reload all installed plugins without restart.
```

## `voyagestar acp`

Expose an Voyagestar agent as a stdio JSON-RPC ACP server. Boots a
standalone `VoyagestarServer` (reads `~/.voyagestar`); does **not** require
`voyagestar run` to be running.

```
Usage: voyagestar acp [OPTIONS]

  Run Voyagestar agent as ACP server (stdio).

Options:
  --agent TEXT   Agent to expose (default: VOYAGESTAR_AGENT or first agent).
  --debug        Log to stderr.
  -h, --help     Show this message and exit.
```

See [ACP integration](./acp.md) for the Zed setup example and the
runner object schema.

## `voyagestar clean`

Reset CLI state or wipe the whole `~/.voyagestar` tree. Destructive — read
the help carefully.

```
Usage: voyagestar clean [OPTIONS]

  Remove CLI state or wipe all of ~/.voyagestar.

Options:
  --state / --all       What to remove.
  --yes                 Skip the confirmation prompt.
  -h, --help            Show this message and exit.
```

## `voyagestar config`

Inspect / edit `~/.voyagestar/cli_state.json` (default base URL, user,
agent).

```
Usage: voyagestar config [OPTIONS] COMMAND [ARGS]...

  CLI state (base URL, defaults).

Commands:
  show       Print the current CLI state.
  set-user   Pin the default --user.
```

## `voyagestar completion` / `voyagestar version`

```text
$ voyagestar completion show bash   # dump a shell snippet
$ voyagestar completion install     # append to ~/.zshrc / ~/.bashrc
$ voyagestar version                # print the installed voyagestar version
```

## CLI state file

`~/.voyagestar/cli_state.json` stores:

```json
{
  "base_url": "http://127.0.0.1:8088",
  "token": null,
  "default_user": null,
  "default_agent": null
}
```

The path is exposed as `voyagestar.cli.support.state.default_state_path()`
and can be overridden via `VOYAGESTAR_HOME`. Delete the file to log out
the CLI without hitting the server. The dashboard and HTTP callers
do not share this file — they manage their own tokens.
