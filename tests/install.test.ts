import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Runs scripts/install.sh against a fake release server. The "binary" it
 * serves is a shell script that answers --version, so the installer's own
 * post-install check runs too. This proves the script's URLs, checksum check
 * and install step; it does not prove GitHub serves those URLs.
 */

const SCRIPT = join(import.meta.dir, '..', 'scripts', 'install.sh')
const ASSET = `butters-${process.platform}-${process.arch === 'arm64' ? 'arm64' : 'x64'}`
const BINARY = '#!/bin/sh\necho 9.9.9\n'

let server: ReturnType<typeof Bun.serve>
let requested: string[]
let sums: string
let bindir: string

function sha256(text: string) {
  return new Bun.CryptoHasher('sha256').update(text).digest('hex')
}

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname
      requested.push(path)
      if (path.endsWith(`/${ASSET}`)) return new Response(BINARY)
      if (path.endsWith('/SHA256SUMS')) return new Response(sums)
      return new Response('not found', { status: 404 })
    },
  })
})

afterAll(() => server.stop(true))

beforeEach(async () => {
  requested = []
  sums = `${sha256('something else')}  butters-other\n${sha256(BINARY)}  ${ASSET}\n`
  bindir = await mkdtemp(join(tmpdir(), 'butters-install-'))
  return () => rm(bindir, { recursive: true, force: true })
})

async function install(env: Record<string, string> = {}) {
  const proc = Bun.spawn(['bash', SCRIPT], {
    env: {
      PATH: process.env.PATH ?? '',
      HOME: bindir,
      BUTTERS_BIN_DIR: bindir,
      BUTTERS_RELEASES_URL: `http://localhost:${server.port}/releases`,
      ...env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, code }
}

describe.skipIf(process.platform === 'win32')('install.sh', () => {
  test('downloads the latest binary for this platform, checks it, and installs it', async () => {
    const result = await install()

    expect(result.code).toBe(0)
    expect(requested).toEqual([`/releases/latest/download/${ASSET}`, '/releases/latest/download/SHA256SUMS'])
    expect(await Bun.file(join(bindir, 'butters')).text()).toBe(BINARY)
    expect((await stat(join(bindir, 'butters'))).mode & 0o111).not.toBe(0)
    expect(result.stdout).toContain(`butters 9.9.9 installed to ${bindir}/butters`)
  })

  test('BUTTERS_VERSION pins a release', async () => {
    const result = await install({ BUTTERS_VERSION: 'v0.1.0' })

    expect(result.code).toBe(0)
    expect(requested[0]).toBe(`/releases/download/v0.1.0/${ASSET}`)
  })

  test('refuses a binary whose checksum does not match', async () => {
    sums = `${sha256('tampered')}  ${ASSET}\n`
    const result = await install()

    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain('checksum mismatch')
    expect(await Bun.file(join(bindir, 'butters')).exists()).toBe(false)
  })

  test('refuses a binary with no checksum listed', async () => {
    sums = `${sha256(BINARY)}  butters-other\n`
    const result = await install()

    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain(`no checksum for ${ASSET}`)
  })

  test('says how to add the install dir to PATH when it is missing', async () => {
    const result = await install()

    expect(result.stdout).toContain(`Add ${bindir} to your PATH`)
  })
})
