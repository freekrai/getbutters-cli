import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The CLI is a remote HTTP client, so these tests stand up a fake API and
 * drive the CLI as a subprocess — the same path a user's shell takes. They
 * check what the CLI sends and how it reports what comes back, not whether the
 * real API agrees; nothing tests that for this copy of the CLI yet.
 */

const CLI = join(import.meta.dir, '..', 'src', 'index.ts')
const VALID_KEY = 'ev_test-key'

interface Recorded {
  method: string
  path: string
  authorization: string | null
  body: any
}

let requests: Recorded[]
let server: ReturnType<typeof Bun.serve>
let baseUrl: string
let workdir: string

const exportDocument = {
  projects: [{ id: 'projaaaaaaaa', name: 'source', events: [{ title: 'Order One' }, { title: 'Order Two' }] }],
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

beforeAll(async () => {
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      const text = await request.text()
      const authorization = request.headers.get('authorization')
      requests.push({ method: request.method, path: url.pathname, authorization, body: text ? JSON.parse(text) : null })

      if (authorization !== `Bearer ${VALID_KEY}`) return json({ error: 'Invalid API key' }, 401)

      switch (`${request.method} ${url.pathname}`) {
        case 'GET /api/projects':
          return json([{ id: 'projaaaaaaaa', name: 'mine' }])
        case 'POST /api/projects':
          return json({ id: 'projnewnewne', name: JSON.parse(text).name })
        case 'POST /api/events':
          return json({ id: 42, title: JSON.parse(text).title })
        case 'POST /api/insight':
          return json({ ok: true })
        case 'GET /api/export':
          return json(exportDocument)
        case 'POST /api/import':
          return json({
            imported: { projects: 1, events: 2, insights: 0 },
            idMap: { projaaaaaaaa: 'projbbbbbbbb' },
          })
        default:
          return new Response('Not found', { status: 404 })
      }
    },
  })

  baseUrl = `http://localhost:${server.port}`
  workdir = await mkdtemp(join(tmpdir(), 'butters-cli-'))
})

afterAll(async () => {
  server?.stop(true)
  if (workdir) await rm(workdir, { recursive: true, force: true })
})

beforeEach(() => {
  requests = []
})

async function run(args: string[], env: Record<string, string> = {}) {
  const proc = Bun.spawn(['bun', CLI, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    // Keep ambient keys from leaking into the tests.
    env: { ...process.env, GETBUTTERS_API_KEY: '', EVENTS_API_KEY: '', ...env },
  })

  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  const exitCode = await proc.exited

  return { stdout, stderr, exitCode }
}

function cli(...args: string[]) {
  return run([...args, '--url', baseUrl, '--api-key', VALID_KEY])
}

describe('butters CLI', () => {
  test('init creates a project', async () => {
    const { stdout, exitCode } = await cli('init', '--name', 'my-app')

    expect(exitCode).toBe(0)
    expect(stdout).toContain('created my-app')
    expect(stdout).toContain('id: projnewnewne')
    expect(requests[0]).toMatchObject({ method: 'POST', path: '/api/projects', body: { name: 'my-app' } })
  })

  test('push sends an event, with --link as the event url', async () => {
    const { stdout, exitCode } = await cli(
      'push',
      '--project',
      'projaaaaaaaa',
      '--category',
      'orders',
      '--title',
      'Order Placed',
      '--description',
      'Order **#1** placed',
      '--link',
      'https://shop.example.com/orders/1',
      '--user-id',
      'user-7',
      '--notify',
    )

    expect(exitCode).toBe(0)
    expect(stdout).toContain('pushed #42 Order Placed')
    expect(requests[0].body).toEqual({
      project: 'projaaaaaaaa',
      category: 'orders',
      title: 'Order Placed',
      description: 'Order **#1** placed',
      url: 'https://shop.example.com/orders/1',
      user_id: 'user-7',
      notify: true,
    })
  })

  test('push --metadata sends a real object', async () => {
    const { exitCode } = await cli(
      'push',
      '--project',
      'projaaaaaaaa',
      '--category',
      'errors',
      '--title',
      'Payment failed',
      '--metadata',
      '{"error":{"message":"declined"},"frames":["a","b"]}',
    )

    expect(exitCode).toBe(0)
    expect(requests[0].body.metadata).toEqual({ error: { message: 'declined' }, frames: ['a', 'b'] })
  })

  test('push rejects --metadata that is not JSON without calling the API', async () => {
    const { stderr, exitCode } = await cli(
      'push',
      '--project',
      'projaaaaaaaa',
      '--category',
      'c',
      '--title',
      't',
      '--metadata',
      '{ not json',
    )

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('--metadata')
    expect(requests).toHaveLength(0)
  })

  test('insight sets a card', async () => {
    const { stdout, exitCode } = await cli(
      'insight',
      '--project',
      'projaaaaaaaa',
      '--title',
      '24h Sales',
      '--value',
      '$1,449',
      '--icon',
      '☀️',
    )

    expect(exitCode).toBe(0)
    expect(stdout).toContain('set 24h Sales = $1,449')
    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: '/api/insight',
      body: { project: 'projaaaaaaaa', title: '24h Sales', value: '$1,449', icon: '☀️' },
    })
  })

  // The API keeps the card's icon when an update leaves it out, so the CLI
  // must not send one it wasn't given.
  test('insight without --icon sends no icon', async () => {
    const { exitCode } = await cli('insight', '--project', 'projaaaaaaaa', '--title', 'Orders', '--value', '23')

    expect(exitCode).toBe(0)
    expect(requests[0].body).toEqual({ project: 'projaaaaaaaa', title: 'Orders', value: '23' })
  })

  // The API accepts 0 and "" as values, so the CLI must not treat them as missing.
  for (const value of ['0', '']) {
    test(`insight accepts --value ${JSON.stringify(value)}`, async () => {
      const { exitCode } = await cli('insight', '--project', 'projaaaaaaaa', '--title', 'Errors', '--value', value)

      expect(exitCode).toBe(0)
      expect(requests[0].body.value).toBe(value)
    })
  }

  test('insight requires --value', async () => {
    const { exitCode } = await cli('insight', '--project', 'projaaaaaaaa', '--title', 'Errors')

    expect(exitCode).not.toBe(0)
    expect(requests).toHaveLength(0)
  })

  test('list prints id and name', async () => {
    const { stdout, exitCode } = await cli('list')

    expect(exitCode).toBe(0)
    expect(stdout).toContain('projaaaaaaaa  mine')
  })

  test('export writes the document and summarises it', async () => {
    const file = join(workdir, 'dump.json')
    const { stdout, exitCode } = await cli('export', '--file', file)

    expect(exitCode).toBe(0)
    expect(stdout).toContain('1 projects, 2 events')
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(exportDocument)
  })

  test('load posts the file and prints the id mapping', async () => {
    const file = join(workdir, 'load.json')
    await writeFile(file, JSON.stringify(exportDocument))

    const { stdout, exitCode } = await cli('load', '--file', file)

    expect(exitCode).toBe(0)
    expect(requests[0]).toMatchObject({ method: 'POST', path: '/api/import', body: exportDocument })
    expect(stdout).toContain('imported 1 projects, 2 events, 0 insight cards')
    expect(stdout).toContain('projaaaaaaaa -> projbbbbbbbb')
  })

  // This only proves each file is valid JSON the CLI will send, not that the
  // real importer accepts it.
  for (const scenario of ['ecommerce', 'saas', 'devops', 'content', 'all-scenarios']) {
    test(`load sends demos/${scenario}.json as-is`, async () => {
      const file = join(import.meta.dir, '..', 'demos', `${scenario}.json`)
      const { exitCode } = await cli('load', '--file', file)

      expect(exitCode).toBe(0)
      expect(requests[0].body).toEqual(await Bun.file(file).json())
    })
  }

  test('fails clearly without an API key', async () => {
    const { stderr, exitCode } = await run(['list', '--url', baseUrl])

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('API key')
    expect(requests).toHaveLength(0)
  })

  test('reads the key from GETBUTTERS_API_KEY', async () => {
    const { exitCode } = await run(['list', '--url', baseUrl], { GETBUTTERS_API_KEY: VALID_KEY })

    expect(exitCode).toBe(0)
    expect(requests[0].authorization).toBe(`Bearer ${VALID_KEY}`)
  })

  test('still reads the key from EVENTS_API_KEY', async () => {
    const { exitCode } = await run(['list', '--url', baseUrl], { EVENTS_API_KEY: VALID_KEY })

    expect(exitCode).toBe(0)
    expect(requests[0].authorization).toBe(`Bearer ${VALID_KEY}`)
  })

  test('GETBUTTERS_API_KEY wins over EVENTS_API_KEY', async () => {
    await run(['list', '--url', baseUrl], { GETBUTTERS_API_KEY: VALID_KEY, EVENTS_API_KEY: 'ev_old' })

    expect(requests[0].authorization).toBe(`Bearer ${VALID_KEY}`)
  })

  test('--api-key wins over the environment', async () => {
    await run(['list', '--url', baseUrl, '--api-key', VALID_KEY], { GETBUTTERS_API_KEY: 'ev_env' })

    expect(requests[0].authorization).toBe(`Bearer ${VALID_KEY}`)
  })

  test('reports a rejected key rather than a stack trace', async () => {
    const { stderr, exitCode } = await run(['list', '--url', baseUrl, '--api-key', 'ev_not-a-real-key'])

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('401')
  })

  test('reports an unreachable server as such', async () => {
    const { stderr, exitCode } = await run(['list', '--url', 'http://localhost:1', '--api-key', VALID_KEY])

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('could not reach')
  })

  test('--version prints the package version', async () => {
    const pkg = await Bun.file(join(import.meta.dir, '..', 'package.json')).json()
    const { stdout, exitCode } = await run(['--version'])

    expect(exitCode).toBe(0)
    expect(stdout.trim()).toBe(pkg.version)
  })
})
