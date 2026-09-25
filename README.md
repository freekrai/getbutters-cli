# butters

The command-line client for [GetButters](https://app.getbutters.com): create
projects, push events, and export or import a team's data.

It is a remote HTTP client. It never opens a database — every command goes
through the same authenticated API an outside integration would use, and the
API key decides which organization you are operating on. So the server must be
reachable for every command, including `export` and `load`.

## Install

Download the binary for your platform from the
[latest release](https://github.com/freekrai/getbutters-cli/releases/latest). No runtime needed:

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

On macOS the binaries are unsigned, so Gatekeeper may block the first run.
Clear the quarantine flag with `xattr -d com.apple.quarantine /usr/local/bin/butters`.

If you already have [Bun](https://bun.sh), you can run it from source instead:

```bash
git clone https://github.com/freekrai/getbutters-cli && cd getbutters-cli
bun install
bun run butters --help
```

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

Two things the HTTP API supports that the CLI does not yet — use `curl` if you
need them today:

- there is no `--tags`, so tags can only be set over the API;
- there is no `insight` subcommand, so insight cards are written with
  `POST /api/insight`.

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
| QuickShop | `demos/ecommerce.json` | E-commerce: orders, payments, signups, reviews |
| LaunchPad | `demos/saas.json` | SaaS app: signups, billing, API usage, errors |
| DeployBot | `demos/devops.json` | CI/CD: deploys, builds, incidents |
| BlogWave | `demos/content.json` | Content platform: subscribers, newsletter, traffic, posts |
| All | `demos/all-scenarios.json` | All four combined |

From a clone of this repo:

```bash
# Load everything
butters load --file demos/all-scenarios.json

# Load one scenario
butters load --file demos/ecommerce.json

# Regenerate with fresh random data
bun run demos:generate
```

Or fetch just the one you want:

```bash
curl -fLO https://raw.githubusercontent.com/freekrai/getbutters-cli/main/demos/ecommerce.json
butters load --file ecommerce.json
```

`demos/generate.ts` writes all five files. Event times are stamped relative to
when it runs, so regenerate before a demo if you want the charts to end today.
Event counts move between generations — each category draws a random number of
events per day — so expect roughly 500–800 events per scenario rather than a
fixed figure.

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

Insight cards, until the CLI grows a subcommand for them:

```bash
curl -X POST "https://app.getbutters.com/api/insight" \
  -H "Authorization: Bearer $GETBUTTERS_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"project":"'$PROJECT'","title":"24h Sales","value":"$1,449","icon":"☀️"}'
```

Back up nightly:

```bash
butters export --file "backups/$(date +%F).json"
```

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
reports what comes back; they need no database. Whether the real API agrees
with the CLI is tested in the app's repo.

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
