#!/usr/bin/env bun
import { readFile, writeFile } from 'node:fs/promises'
import { defineCommand, runMain } from 'citty'
import { version } from '../package.json'

/**
 * GetButters CLI.
 *
 * A remote HTTP client. It never opens the database — everything goes through
 * the same authenticated API an outside integration would use, and the same
 * organization scoping applies.
 */

const DEFAULT_URL = 'https://app.getbutters.com'

interface RequestOptions {
  url: string
  apiKey: string
  path: string
  method?: string
  body?: unknown
}

async function api<T = any>({ url, apiKey, path, method = 'GET', body }: RequestOptions): Promise<T> {
  let response: Response
  try {
    response = await fetch(new URL(path, url), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    throw new Error(`could not reach ${url} — is the server running?\n  ${(error as Error).message}`)
  }

  const text = await response.text()
  let parsed: any
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`${response.status} from ${path}: ${text.slice(0, 200)}`)
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${parsed.error ?? response.statusText}`)
  }

  return parsed as T
}

const shared = {
  url: {
    type: 'string' as const,
    description: 'Base URL of the server',
    default: DEFAULT_URL,
  },
  'api-key': {
    type: 'string' as const,
    description: 'API key (or set GETBUTTERS_API_KEY / EVENTS_API_KEY)',
  },
}

function requireKey(args: Record<string, any>): string {
  // `||`, not `??`: an exported-but-empty variable should fall through to the
  // next source rather than count as a key.
  // EVENTS_API_KEY is the name from before the rename, kept so existing setups work.
  const key = args['api-key'] || process.env.GETBUTTERS_API_KEY || process.env.EVENTS_API_KEY
  if (!key) {
    throw new Error('an API key is required — pass --api-key or set GETBUTTERS_API_KEY')
  }
  return key
}

/**
 * citty's runMain prints a thrown error whole — stack and all, which in a
 * compiled binary includes a dump of the minified source. Every failure here
 * is meant for the person at the terminal, so print just the message.
 */
function guard<T>(run: (context: T) => Promise<void>) {
  return async (context: T) => {
    try {
      await run(context)
    } catch (error) {
      console.error(`error: ${(error as Error).message}`)
      process.exit(1)
    }
  }
}

const init = defineCommand({
  meta: { name: 'init', description: 'Create a project' },
  args: { ...shared, name: { type: 'string', description: 'Project name', required: true } },
  run: guard(async ({ args }) => {
    const project = await api({
      url: args.url,
      apiKey: requireKey(args),
      path: '/api/projects',
      method: 'POST',
      body: { name: args.name },
    })
    console.log(`created ${project.name}`)
    console.log(`  id: ${project.id}`)
  }),
})

const push = defineCommand({
  meta: { name: 'push', description: 'Push an event' },
  args: {
    ...shared,
    project: { type: 'string', description: 'Project id', required: true },
    category: { type: 'string', description: 'Category', required: true },
    title: { type: 'string', description: 'Event title', required: true },
    description: { type: 'string', description: 'Supports **bold** and [text](url)' },
    icon: { type: 'string', description: 'Emoji icon' },
    // Not `--url`: that is already the server's base URL.
    link: { type: 'string', description: 'URL the event title opens' },
    'user-id': { type: 'string', description: 'External user identifier' },
    metadata: { type: 'string', description: 'JSON object or array, viewable in the feed' },
    notify: { type: 'boolean', description: 'Highlight and notify', default: false },
  },
  run: guard(async ({ args }) => {
    // Parsed here rather than posted as a string, so a typo in a shell quote
    // is named on the spot instead of coming back as a 400 from the API.
    let metadata: unknown
    if (args.metadata) {
      try {
        metadata = JSON.parse(args.metadata)
      } catch (error) {
        throw new Error(`--metadata is not valid JSON: ${(error as Error).message}`)
      }
    }

    const event = await api({
      url: args.url,
      apiKey: requireKey(args),
      path: '/api/events',
      method: 'POST',
      body: {
        project: args.project,
        category: args.category,
        title: args.title,
        description: args.description,
        icon: args.icon,
        url: args.link,
        user_id: args['user-id'],
        metadata,
        notify: args.notify,
      },
    })
    console.log(`pushed #${event.id} ${event.title}`)
  }),
})

const list = defineCommand({
  meta: { name: 'list', description: 'List projects' },
  args: shared,
  run: guard(async ({ args }) => {
    const projects = await api<any[]>({
      url: args.url,
      apiKey: requireKey(args),
      path: '/api/projects',
    })

    if (projects.length === 0) {
      console.log('no projects yet')
      return
    }
    for (const project of projects) console.log(`${project.id}  ${project.name}`)
  }),
})

const exportCommand = defineCommand({
  meta: { name: 'export', description: 'Export this team’s data to JSON' },
  args: { ...shared, file: { type: 'string', description: 'Output file', required: true } },
  run: guard(async ({ args }) => {
    const data = await api({ url: args.url, apiKey: requireKey(args), path: '/api/export' })
    await writeFile(args.file, `${JSON.stringify(data, null, 2)}\n`)

    const events = data.projects.reduce((sum: number, p: any) => sum + p.events.length, 0)
    console.log(`wrote ${args.file} — ${data.projects.length} projects, ${events} events`)
  }),
})

const load = defineCommand({
  meta: { name: 'load', description: 'Load a JSON export into this team' },
  args: { ...shared, file: { type: 'string', description: 'Input file', required: true } },
  run: guard(async ({ args }) => {
    const raw = await readFile(args.file, 'utf8')
    const document = JSON.parse(raw)

    const result = await api({
      url: args.url,
      apiKey: requireKey(args),
      path: '/api/import',
      method: 'POST',
      body: document,
    })

    const { projects, events, insights } = result.imported
    console.log(`imported ${projects} projects, ${events} events, ${insights} insight cards`)
    // Import always mints fresh ids, so the mapping is the only way back to
    // whatever the file called them.
    for (const [was, now] of Object.entries(result.idMap)) console.log(`  ${was} -> ${now}`)
  }),
})

const main = defineCommand({
  meta: {
    name: 'butters',
    version,
    description: 'Push events and manage projects from the command line',
  },
  subCommands: { init, push, list, export: exportCommand, load },
})

runMain(main)
