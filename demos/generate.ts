#!/usr/bin/env bun
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Generate demo scenarios in the shape POST /api/import accepts.
 *
 * The project ids here are labels only — import always mints fresh ones and
 * returns the mapping, so loading the same file twice gives two independent
 * projects rather than colliding.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const DAYS = 30

interface EventSpec {
  category: string
  titles: string[]
  icon: string
  perDay: [number, number]
  describe?: (index: number) => string
  tags?: () => Record<string, string>
}

interface Scenario {
  file: string
  id: string
  name: string
  insights: Array<{ title: string; value: string; icon: string }>
  events: EventSpec[]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

const BAKERS = ['Noor', 'Emil', 'Rosa', 'Kenji']
const REGULARS = ['Hattie', 'Obi', 'Lena', 'Marco', 'Sunita', 'Pavel', 'June', 'Idris', 'Maeve', 'Tariq']
const BREADS = ['country sourdough', 'rye & caraway', 'seeded spelt', 'olive fougasse', 'brioche loaf', 'cardamom buns']
const PLAYERS = ['xX_moth_Xx', 'lanternjaw', 'quietfern', 'duskrunner', 'pebble42', 'NotAGhost', 'wickwire', 'saltmoon']
const HOSTS = ['nas-01', 'pi-garage', 'mini-pc', 'router', 'pve-node', 'nas-02']
const BEDS = ['bed A1', 'bed A2', 'bed B1', 'bed B3', 'propagation bench', 'hanging rack']
const TEAMS = ['Birchwood Legal', 'Harbor Realty', 'Nimbus Studio', 'Okafor & Lee', 'Pinecrest HR', 'Tidewater Rentals']
const DOCS = ['NDA', 'lease renewal', 'offer letter', 'SOW', 'vendor agreement', 'contractor MSA']
const CROPS = ['basil', 'cherry tomatoes', 'microgreens', 'chillies', 'lettuce', 'strawberries']

const price = () => `$${randomInt(6, 64)}.${pick(['00', '50', '75'])}`
const sha = () => Math.random().toString(16).slice(2, 9)

const SCENARIOS: Scenario[] = [
  {
    file: 'bakery.json',
    id: 'proofing-room',
    name: 'Proofing Room',
    insights: [
      { title: 'Loaves sold (30d)', value: '3,912', icon: '🍞' },
      { title: 'Preorders', value: '1,046', icon: '🧾' },
      { title: 'Usual sell-out', value: '11:40am', icon: '⏰' },
      { title: 'Unsold loaves', value: '2.3%', icon: '🥖' },
    ],
    events: [
      {
        category: 'preorders',
        icon: '🧾',
        perDay: [8, 18],
        titles: ['Preorder Placed', 'Preorder Changed', 'Preorder Cancelled'],
        describe: () => `**${pick(REGULARS)}** wants ${randomInt(1, 4)}× **${pick(BREADS)}**`,
        tags: () => ({ total: price(), pickup: pick(['7–9am', '9–11am', 'after noon']) }),
      },
      {
        category: 'oven',
        icon: '🔥',
        perDay: [3, 7],
        titles: ['Batch In', 'Batch Out', 'Oven Below Temp'],
        describe: () => `${randomInt(12, 48)} × **${pick(BREADS)}**`,
        tags: () => ({ baker: pick(BAKERS), deck: `deck ${randomInt(1, 3)}` }),
      },
      {
        category: 'pickups',
        icon: '🛍️',
        perDay: [6, 15],
        titles: ['Order Collected', 'No-show'],
        describe: () => `**${pick(REGULARS)}** at the counter`,
      },
      {
        category: 'stock',
        icon: '📦',
        perDay: [0, 3],
        titles: ['Sold Out', 'Flour Running Low', 'Starter Fed'],
        describe: () => `**${pick(BREADS)}**`,
      },
    ],
  },
  {
    file: 'game-studio.json',
    id: 'mothlight',
    name: 'Mothlight Games',
    insights: [
      { title: 'Wishlists', value: '48,300', icon: '💜' },
      { title: 'Daily players', value: '2,140', icon: '🎮' },
      { title: 'Crash-free sessions', value: '99.2%', icon: '🛡️' },
      { title: 'Median session', value: '38m', icon: '⏳' },
    ],
    events: [
      {
        category: 'players',
        icon: '🎮',
        perDay: [10, 24],
        titles: ['First Launch', 'Tutorial Finished', 'Chapter 2 Reached', 'Credits Rolled'],
        describe: () => `**${pick(PLAYERS)}**`,
        tags: () => ({ platform: pick(['Steam', 'Steam Deck', 'Switch']) }),
      },
      {
        category: 'achievements',
        icon: '🏆',
        perDay: [4, 12],
        titles: ['Achievement Unlocked', 'Secret Room Found', 'Speedrun Record'],
        describe: () => `**${pick(PLAYERS)}** — ${pick(['Lamplighter', 'No Lantern', 'Moth Whisperer', 'Pacifist'])}`,
      },
      {
        category: 'crashes',
        icon: '💥',
        perDay: [0, 4],
        titles: ['Crash Report', 'Save Corrupted', 'GPU Driver Hang'],
        describe: () => `Build **${sha()}**`,
        tags: () => ({ os: pick(['Windows 11', 'SteamOS', 'macOS']) }),
      },
      {
        category: 'storefront',
        icon: '💜',
        perDay: [2, 8],
        titles: ['Wishlist Spike', 'Review Posted', 'Streamer Went Live'],
        tags: () => ({ source: pick(['Steam Next Fest', 'TikTok', 'Twitch', 'press']) }),
      },
    ],
  },
  {
    file: 'homelab.json',
    id: 'attic-rack',
    name: 'Attic Rack',
    insights: [
      { title: 'Uptime (30d)', value: '99.94%', icon: '🟢' },
      { title: 'Backups run', value: '90', icon: '💾' },
      { title: 'Storage used', value: '71%', icon: '🗄️' },
      { title: 'Power draw', value: '186 W', icon: '🔌' },
    ],
    events: [
      {
        category: 'backups',
        icon: '💾',
        perDay: [3, 4],
        titles: ['Snapshot Taken', 'Offsite Sync Finished', 'Backup Failed'],
        describe: () => `**${pick(HOSTS)}**`,
        tags: () => ({ size: `${randomInt(2, 480)} GB` }),
      },
      {
        category: 'power',
        icon: '🔌',
        perDay: [0, 2],
        titles: ['On Battery', 'Power Restored', 'UPS Self-test Passed'],
        tags: () => ({ battery: `${randomInt(40, 100)}%` }),
      },
      {
        category: 'disks',
        icon: '🌡️',
        perDay: [1, 4],
        titles: ['Scrub Finished', 'Drive Running Hot', 'SMART Warning'],
        describe: () => `**${pick(HOSTS)}** /dev/sd${pick(['a', 'b', 'c', 'd'])}`,
        tags: () => ({ temp: `${randomInt(34, 58)}°C` }),
      },
      {
        category: 'network',
        icon: '📡',
        perDay: [2, 8],
        titles: ['New Device Joined', 'Container Updated', 'Certificate Renewed'],
        describe: () => `**${pick(['jellyfin', 'home-assistant', 'pihole', 'grafana', 'unknown-esp32'])}**`,
      },
    ],
  },
  {
    file: 'greenhouse.json',
    id: 'fernhill',
    name: 'Fernhill Greenhouse',
    insights: [
      { title: 'Avg humidity', value: '68%', icon: '💧' },
      { title: 'Water used (30d)', value: '1,240 L', icon: '🚿' },
      { title: 'Harvested', value: '212 kg', icon: '🧺' },
      { title: 'Frost alerts', value: '3', icon: '🥶' },
    ],
    events: [
      {
        category: 'sensors',
        icon: '🌡️',
        perDay: [6, 16],
        titles: ['Too Warm', 'Humidity Low', 'Soil Dry', 'Light Level Low'],
        describe: () => `**${pick(BEDS)}**`,
        tags: () => ({
          reading: pick([`${randomInt(28, 36)}°C`, `${randomInt(35, 50)}% RH`, `${randomInt(8, 20)}% moisture`]),
        }),
      },
      {
        category: 'irrigation',
        icon: '🚿',
        perDay: [3, 8],
        titles: ['Watering Started', 'Watering Finished', 'Valve Stuck'],
        describe: () => `**${pick(BEDS)}**`,
        tags: () => ({ litres: String(randomInt(4, 60)) }),
      },
      {
        category: 'harvest',
        icon: '🧺',
        perDay: [1, 5],
        titles: ['Harvest Logged', 'Seedlings Potted On'],
        describe: () => `${randomInt(1, 14)} kg **${pick(CROPS)}**`,
      },
      {
        category: 'alerts',
        icon: '🥶',
        perDay: [0, 1],
        titles: ['Frost Warning', 'Vent Motor Fault', 'Door Left Open'],
      },
    ],
  },
  {
    file: 'saas.json',
    id: 'countersign',
    name: 'Countersign',
    insights: [
      { title: 'MRR', value: '$18,760', icon: '📈' },
      { title: 'Paying teams', value: '412', icon: '🏢' },
      { title: 'Docs signed (30d)', value: '9,305', icon: '✍️' },
      { title: 'Median time to sign', value: '3h 20m', icon: '⏱️' },
    ],
    events: [
      {
        category: 'accounts',
        icon: '✨',
        perDay: [3, 9],
        titles: ['Trial Started', 'Teammate Invited', 'Trial Converted', 'Account Closed'],
        describe: () => `**${pick(TEAMS)}**`,
        tags: () => ({ plan: pick(['solo', 'team', 'business']), seats: String(randomInt(1, 25)) }),
      },
      {
        category: 'billing',
        icon: '💳',
        perDay: [2, 6],
        titles: ['Invoice Paid', 'Plan Upgraded', 'Card Declined', 'Plan Downgraded'],
        describe: () => `**${pick(TEAMS)}**`,
        tags: () => ({ amount: `$${pick(['19', '49', '149', '490'])}.00` }),
      },
      {
        category: 'documents',
        icon: '✍️',
        perDay: [12, 28],
        titles: ['Envelope Sent', 'Document Signed', 'Signer Declined', 'Reminder Sent'],
        describe: () => `**${pick(DOCS)}** for ${pick(TEAMS)}`,
        tags: () => ({ signers: String(randomInt(1, 4)) }),
      },
      {
        category: 'integrations',
        icon: '🔗',
        perDay: [1, 5],
        titles: ['Webhook Failing', 'Google Drive Connected', 'Zapier Connected', 'API Key Rotated'],
        describe: () => `**${pick(TEAMS)}**`,
      },
    ],
  },
]

function buildProject(scenario: Scenario) {
  const events: unknown[] = []
  const now = Date.now()

  for (let dayOffset = DAYS - 1; dayOffset >= 0; dayOffset--) {
    for (const spec of scenario.events) {
      const count = randomInt(spec.perDay[0], spec.perDay[1])

      for (let i = 0; i < count; i++) {
        // Spread across the working day rather than uniformly, so the charts
        // have a shape instead of a flat band.
        const hour = randomInt(7, 22)
        const at = new Date(now - dayOffset * 86_400_000)
        at.setHours(hour, randomInt(0, 59), randomInt(0, 59), 0)

        events.push({
          category: spec.category,
          title: pick(spec.titles),
          description: spec.describe?.(i),
          icon: spec.icon,
          tags: spec.tags?.(),
          notify: Math.random() < 0.02,
          favorited: Math.random() < 0.05,
          created_at: Math.floor(at.getTime() / 1000),
        })
      }
    }
  }

  return {
    id: scenario.id,
    name: scenario.name,
    categories: scenario.events.map((spec) => spec.category),
    events,
    insights: scenario.insights,
  }
}

async function main() {
  await mkdir(HERE, { recursive: true })

  const built = SCENARIOS.map((scenario) => ({ scenario, project: buildProject(scenario) }))

  for (const { scenario, project } of built) {
    const document = { version: 1, projects: [project] }
    await writeFile(join(HERE, scenario.file), `${JSON.stringify(document, null, 2)}\n`)
    console.log(`${scenario.file.padEnd(18)} ${project.events.length} events`)
  }

  const all = { version: 1, projects: built.map(({ project }) => project) }
  await writeFile(join(HERE, 'all-scenarios.json'), `${JSON.stringify(all, null, 2)}\n`)

  const total = built.reduce((sum, { project }) => sum + project.events.length, 0)
  console.log(`${'all-scenarios.json'.padEnd(18)} ${total} events`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
