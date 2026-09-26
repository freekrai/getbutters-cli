# butters command reference

Every command also takes `--url <base>` (default `https://app.getbutters.com`)
and `--api-key <key>`. Key lookup order: `--api-key`, then `GETBUTTERS_API_KEY`,
then `EVENTS_API_KEY`. An empty variable counts as unset.

## init

| Option | Required | Notes |
|--------|----------|-------|
| `--name <name>` | yes | Project name |

Prints `created <name>` then `  id: <id>`. Grab the id with
`butters init --name x | awk '/id:/ {print $2}'`.

## push

| Option | Required | Notes |
|--------|----------|-------|
| `--project <id>` | yes | Project id |
| `--category <name>` | yes | Auto-created if new |
| `--title <title>` | yes | |
| `--description <text>` | no | Supports `**bold**` and `[text](url)` |
| `--icon <emoji>` | no | |
| `--link <url>` | no | URL the event title opens |
| `--user-id <id>` | no | External user identifier |
| `--metadata <json>` | no | JSON object or array, validated before sending |
| `--notify` | no | Highlight and send to ntfy/webhook destinations |

No `--tags`; tags can only be set over the API directly.

## insight

| Option | Required | Notes |
|--------|----------|-------|
| `--project <id>` | yes | |
| `--title <title>` | yes | The card's key within the project |
| `--value <value>` | yes | Sent as text; `0` and `""` are valid |
| `--icon <emoji>` | no | Up to 16 characters; left unchanged on update if omitted |

## list

No options. Prints `<id>  <name>` per project, or `no projects yet`.

## export

| Option | Required | Notes |
|--------|----------|-------|
| `--file <path>` | yes | Overwritten if it exists |

## load

| Option | Required | Notes |
|--------|----------|-------|
| `--file <path>` | yes | Same shape `export` writes |

Prints `imported N projects, M events, K insight cards` and a `was -> now` line
per project id.
