---
name: butters
description: Pushes events, sets KPI insight cards, creates and lists projects, and exports or imports data in Get Butters using the `butters` CLI. Use when the user wants to log or track an event in Get Butters, report a job result or error to a feed, update a dashboard metric, back up or restore a Get Butters organization, or load demo data.
---

# butters

`butters` is a thin HTTP client for the Get Butters API. Every command needs a
reachable server and an API key; the key decides which organization you act on.

## Before running anything

1. Check it is installed: `butters --version`. If not, it installs with
   `curl -fsSL https://raw.githubusercontent.com/freekrai/getbutters-cli/main/scripts/install.sh | bash`
   (into `~/.local/bin`). Ask before running it.
2. Check a key is set: `GETBUTTERS_API_KEY` (or the older `EVENTS_API_KEY`).
   Never echo, log, or commit the key. If none is set, ask the user to export
   one; keys are created at `/app/api` in the app.
3. Default server is `https://app.getbutters.com`. For self-hosted or local,
   add `--url <base>`.

Options go **after** the command name: `butters list --url http://localhost:3000`,
not `butters --url ... list`.

## Quick start

```bash
butters list                                   # "<id>  <name>" per project
butters init --name "my-store"                 # prints "  id: <id>"
butters push --project <id> --category orders --title "Order Placed" --icon "📦"
butters insight --project <id> --title "24h Sales" --value '$1,449'
```

The project id from `list` or `init` is what every `--project` means. Look it
up with `butters list` rather than guessing.

## Workflows

**Report a script result or failure**

```bash
butters push --project <id> --category errors --title 'Nightly build failed' \
  --metadata '{"job":"nightly","exit":1}' --notify
```

- Single-quote `--metadata` JSON so inner double quotes survive. It is parsed
  locally, so bad JSON fails before any request is sent.
- `--link <url>` sets the URL the event opens. Do not use `--url` for that; it
  is the server address.
- Only add `--notify` when the user wants to be alerted: it sends to the
  project's ntfy and webhook destinations.

**Keep a metric current**

`insight` upserts by title within a project: same title, same card. Single-quote
values containing `$`. There is no delete command; cards are deleted from the
dashboard.

**Back up and restore**

```bash
butters export --file "backup-$(date +%F).json"
butters load --file backup.json
```

`load` only ever adds. It mints new project ids every time, so loading the same
file twice creates duplicate projects. Confirm with the user before loading,
and keep the printed `was -> now` id mapping.

**Demo data**

`demos/*.json` in the CLI repo are ready-made 30-day scenarios for `load`. Each
one counts against the plan's monthly event allowance and exceeds the free tier,
so confirm before loading.

## Reading results

- Success prints one short line per command (`pushed #<n> <title>`,
  `set <title> = <value>`, `wrote <file> — N projects, M events`).
- Failure prints `error: <message>` to stderr and exits non-zero. The message
  is `<status>: <reason>` from the API, or "could not reach <url>" when the
  server is down or `--url` is wrong. Report it to the user; don't retry
  `push` or `load` blindly, since a retry after a timeout can duplicate data.

Full option tables: [REFERENCE.md](REFERENCE.md).
