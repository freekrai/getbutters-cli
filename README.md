# butters

The command-line client for [GetButters](https://getbutters.com): create
projects, push events, and export or import a team's data.

It is a remote HTTP client. It never opens a database — every command goes
through the same authenticated API an outside integration would use, and the
API key decides which organization you are operating on. So the server must be
reachable for every command, including `export` and `load`.

- One self-contained binary per platform; no runtime to install
- Includes an [agent skill](#agent-skill) so Claude Code, Codex, Cursor and
  other agents can drive it

## Quick start

```bash
curl -fsSL https://raw.githubusercontent.com/freekrai/getbutters-cli/main/scripts/install.sh | bash
export GETBUTTERS_API_KEY=ev_...   # from /app/api in the app
butters list
```

The installer detects your platform and architecture, downloads the matching
binary from the latest release, checks it against the release's `SHA256SUMS`,
and puts it in `~/.local/bin` (it tells you if that is not on your `PATH`).

Set `BUTTERS_BIN_DIR` to install somewhere else, or `BUTTERS_VERSION` to pin a
release:

```bash
curl -fsSL https://raw.githubusercontent.com/freekrai/getbutters-cli/main/scripts/install.sh \
  | BUTTERS_BIN_DIR=~/bin BUTTERS_VERSION=v0.1.0 bash
```

To let your coding agent use it too:

```bash
npx skills@latest add freekrai/getbutters-cli --skill butters
```

<details>
<summary>Other installation methods</summary>

**Download a binary yourself** from the
[latest release](https://github.com/freekrai/getbutters-cli/releases/latest):

| Platform | File |
|----------|------|
| macOS, Apple silicon | `butters-darwin-arm64` |
| macOS, Intel | `butters-darwin-x64` |
| Linux, x64 | `butters-linux-x64` |
| Linux, arm64 | `butters-linux-arm64` |
| Windows, x64 | `butters-windows-x64.exe` |

```bash
curl -fLo butters https://github.com/freekrai/getbutters-cli/releases/latest/download/butters-darwin-arm64
chmod +x butters
mv butters /usr/local/bin/
```

Each release has a `SHA256SUMS` file for checking the download
(`shasum -a 256 -c SHA256SUMS --ignore-missing`).

On macOS the binaries are unsigned. A binary fetched with `curl` (including by
the installer) runs as is, but one downloaded through a browser may be blocked
by Gatekeeper; clear the quarantine flag with
`xattr -d com.apple.quarantine /usr/local/bin/butters`.

**Run from source** if you already have [Bun](https://bun.sh):

```bash
git clone https://github.com/freekrai/getbutters-cli && cd getbutters-cli
bun install
bun run butters --help
```

</details>

## Authentication

Create a key from the API page in the app (`/app/api` → **New key**). It is
shown once, so put it somewhere before you navigate away:

```bash
export GETBUTTERS_API_KEY=ev_a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6
```

The key is looked up in this order:

1. `--api-key <key>`
2. `GETBUTTERS_API_KEY`
3. `EVENTS_API_KEY` — the name from before the rename, still read so existing
   setups keep working

An empty variable counts as unset.

## Global options

Every command takes these, after the command name:

| Option | Description |
|--------|-------------|
| `--url <url>` | Base URL of the server. Defaults to `https://app.getbutters.com` |
| `--api-key <key>` | API key. See [Authentication](#authentication) |

Pass `--url` to talk to a self-hosted or local server:

```bash
butters list --url http://localhost:3000
```

`butters --version` prints the version; `butters <command> --help` lists a
command's options.

Unreachable servers are reported as such rather than as a stack trace; HTTP
errors surface as `error: <status>: <message>` from the API's own error body.
Every failure exits non-zero.

## Commands

### init

Create a project.

```bash
butters init --name "my-store"
# created my-store
#   id: q4q8nb18qc2i
```

| Option | Required | Description |
|--------|----------|-------------|
| `--name <name>` | yes | Project name |

The id it prints is what every other command means by `--project`.

### push

Push an event.

```bash
butters push \
  --project q4q8nb18qc2i \
  --category orders \
  --title "Order Placed" \
  --description "Order **#1234** by John" \
  --icon "📦" \
  --link "https://shop.example.com/orders/1234" \
  --user-id "user-123" \
  --notify
```

| Option | Required | Description |
|--------|----------|-------------|
| `--project <id>` | yes | Project ID |
| `--category <name>` | yes | Category name (auto-created if new) |
| `--title <title>` | yes | Event title |
| `--description <text>` | no | Supports `**bold**` and `[text](url)` |
| `--icon <emoji>` | no | Emoji icon |
| `--link <url>` | no | URL the event title opens. Not `--url` — that is already the server's base URL |
| `--user-id <id>` | no | External user identifier |
| `--metadata <json>` | no | JSON object or array, opened in a dialog from the feed. Parsed before sending, so a broken quote is reported here rather than as a `400` |
| `--notify` | no | Highlight in the feed and send to the project's ntfy and webhook destinations |

There is no `--tags` yet, so tags can only be set over the API.

`--metadata` is the one to reach for when a script is reporting an error:

```bash
butters push \
  --project q4q8nb18qc2i \
  --category errors \
  --title 'Nightly build failed' \
  --metadata '{"job":"nightly","exit":1,"tail":["make: *** [build] Error 1"]}'
```

Shell quoting is the usual trap — single-quote the whole JSON document so the
double quotes inside it survive.

### insight

Create an insight card, or update the one with the same title, via
`POST /api/insight`.

```bash
butters insight \
  --project q4q8nb18qc2i \
  --title "24h Sales" \
  --value '$1,449' \
  --icon "☀️"
```

| Option | Required | Description |
|--------|----------|-------------|
| `--project <id>` | yes | Project ID |
| `--title <title>` | yes | Card title. It is the card's key within the project: setting the same title again updates that card |
| `--value <value>` | yes | Value to display. Sent as text, so `0` and an empty string both count |
| `--icon <emoji>` | no | Emoji icon, up to 16 characters. Left unchanged when an update leaves it out |

Prints `set <title> = <value>`. Single-quote values with a `$` in them, or the
shell will expand it.

There is no delete command yet: the API deletes insights by id, and nothing
returns those ids. Delete a card from the dashboard.

### list

List the projects in this organization.

```bash
butters list
```

Prints `<id>  <name>` per project, or `no projects yet`.

### export

Write this organization's data to a JSON file, via `GET /api/export`.

```bash
butters export --file backup.json
```

| Option | Required | Description |
|--------|----------|-------------|
| `--file <path>` | yes | Output file |

Prints the project and event counts it wrote.

### load

Load a JSON document into this organization, via `POST /api/import`.

```bash
butters load --file backup.json
```

| Option | Required | Description |
|--------|----------|-------------|
| `--file <path>` | yes | JSON file to load |

This **never replaces** anything; merging is all it does. Import mints fresh
project ids, so loading the same file twice creates two independent projects
rather than overwriting the first. The command prints the `was -> now` id
mapping the API returns, which is the only way back to whatever the file called
things.

## Demo scenarios

Pre-built scenarios live in [`demos/`](demos), each spanning 30 days, each in
exactly the shape `POST /api/import` accepts. They let you show the app off
without using real data.

| Scenario | File | Contents |
|----------|------|----------|
| Proofing Room | `demos/bakery.json` | Micro-bakery: preorders, oven batches, pickups, sell-outs |
| Mothlight Games | `demos/game-studio.json` | Indie game launch: players, achievements, crashes, wishlists |
| Attic Rack | `demos/homelab.json` | Homelab: backups, UPS power, disk health, network |
| Countersign | `demos/saas.json` | E-signature SaaS: trials, billing, signed documents, integrations |
| Fernhill Greenhouse | `demos/greenhouse.json` | Greenhouse sensors: climate, irrigation, harvests, frost alerts |
| All | `demos/all-scenarios.json` | All five combined |

From a clone of this repo:

```bash
# Load everything
butters load --file demos/all-scenarios.json

# Load one scenario
butters load --file demos/bakery.json

# Regenerate with fresh random data
bun run demos:generate
```

Or fetch just the one you want:

```bash
curl -fLO https://raw.githubusercontent.com/freekrai/getbutters-cli/main/demos/bakery.json
butters load --file bakery.json
```

`demos/generate.ts` writes all six files. Event times are stamped relative to
when it runs, so regenerate before a demo if you want the charts to end today.
Event counts move between generations — each category draws a random number of
events per day — so expect roughly 350 to 1,000 events per scenario rather than
a fixed figure.

Loading a scenario counts against your plan's monthly event allowance, and a
single scenario carries more events than the free tier allows.

## Examples

Track an e-commerce order flow:

```bash
export GETBUTTERS_API_KEY=ev_a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6
PROJECT=$(butters init --name "my-store" | awk '/id:/ {print $2}')

butters push --project $PROJECT --category signups  --title "User Registered" --icon "👤" --user-id "user-42"
butters push --project $PROJECT --category orders   --title "Order Placed" --description "Order **#1001**" --icon "🛍️" --user-id "user-42"
butters push --project $PROJECT --category shipping --title "Order Shipped" --icon "🚚"
butters push --project $PROJECT --category shipping --title "Order Delivered" --icon "📦" --notify
```

Keep a KPI card current, e.g. from a nightly job:

```bash
butters insight --project $PROJECT --title "24h Sales" --value '$1,449' --icon "☀️"
butters insight --project $PROJECT --title "Orders Processing" --value 23 --icon "🏭"
```

Back up nightly:

```bash
butters export --file "backups/$(date +%F).json"
```

## Agent skill

[`skills/butters`](skills/butters) is an [Agent Skill](https://agentskills.io)
that teaches coding agents (Claude Code and others) to drive this CLI: finding
project ids, quoting `--metadata`, why `load` duplicates rather than replaces,
and when to ask before notifying or loading demo data.

Install it with the [skills CLI](https://github.com/vercel-labs/skills), which
detects the agents you have and asks where to put it:

```bash
npx skills@latest add freekrai/getbutters-cli --skill butters
```

Add `-g` to install it for every project rather than just the current one, and
`-a claude-code` (or another agent) to skip the agent prompt:

```bash
npx skills@latest add freekrai/getbutters-cli --skill butters -g -a claude-code
```

Or copy it by hand from a clone:

```bash
cp -r skills/butters ~/.claude/skills/
```

The skill assumes `butters` is on the `PATH` and a key is in
`GETBUTTERS_API_KEY`.

## Development

```bash
bun install
bun run butters <command>   # run from source
bun test                    # tests
bun run typecheck
bun run lint:fix
```

The tests stand a fake API up on `Bun.serve` and drive the CLI as a subprocess,
the same path a user's shell takes. They check what the CLI sends and how it
reports what comes back; they need no database. They do not prove the real API
agrees: nothing tests this CLI against the real API yet. The app's repo has an
end-to-end test, but it drives the app's own older copy of the CLI.

`tests/install.test.ts` does the same for `scripts/install.sh`: it serves a
fake release and checks the URLs the script fetches, the checksum check, and
the install. Whether GitHub serves those URLs is only proven by a real release.

### Building

```bash
bun run build                          # ./butters for this machine
bun run build:all                      # every platform, into dist/, with SHA256SUMS
bun run build:all bun-linux-x64        # just the named targets
```

Bun cross-compiles, so any machine can build every target.

### Releasing

1. Bump `version` in `package.json` — `butters --version` reads it.
2. Commit, then tag and push: `git tag v0.2.0 && git push --tags`.

The release workflow checks the tag matches `package.json`, runs the tests,
builds all five binaries, and attaches them and `SHA256SUMS` to a GitHub
release.

## License

MIT
