import { mkdir, rm } from 'node:fs/promises'
import { $ } from 'bun'

/**
 * Compiles a standalone `butters` binary for every platform Bun can target,
 * into dist/, with a SHA256SUMS file alongside. Pass target names to build a
 * subset: `bun run build:all bun-darwin-arm64`.
 */

const TARGETS = ['bun-darwin-arm64', 'bun-darwin-x64', 'bun-linux-x64', 'bun-linux-arm64', 'bun-windows-x64'] as const

const requested = process.argv.slice(2)
const unknown = requested.filter((target) => !(TARGETS as readonly string[]).includes(target))
if (unknown.length > 0) {
  console.error(`unknown target: ${unknown.join(', ')}\n  known: ${TARGETS.join(', ')}`)
  process.exit(1)
}
const targets = requested.length > 0 ? requested : TARGETS

await rm('dist', { recursive: true, force: true })
await mkdir('dist')

const outputs: string[] = []
for (const target of targets) {
  // bun-darwin-arm64 -> butters-darwin-arm64
  const name = `butters-${target.replace(/^bun-/, '')}${target.includes('windows') ? '.exe' : ''}`
  await $`bun build ./src/index.ts --compile --minify --target=${target} --outfile dist/${name}`.quiet()
  outputs.push(name)
  console.log(`built dist/${name}`)
}

const sums = await Promise.all(
  outputs.map(async (name) => {
    const hash = new Bun.CryptoHasher('sha256').update(await Bun.file(`dist/${name}`).arrayBuffer()).digest('hex')
    return `${hash}  ${name}`
  }),
)
await Bun.write('dist/SHA256SUMS', `${sums.join('\n')}\n`)
console.log('wrote dist/SHA256SUMS')
