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

const FIRST = ['Maria', 'Jonas', 'Aisha', 'Wei', 'Priya', 'Tomas', 'Chloe', 'Sam', 'Iris', 'Diego']
const CITIES = ['Berlin', 'Lisbon', 'Toronto', 'Osaka', 'Nairobi', 'Bogotá', 'Oslo', 'Perth']

const money = () => `$${randomInt(9, 480)}.${String(randomInt(0, 99)).padStart(2, '0')}`

const SCENARIOS: Scenario[] = [
  {
    file: 'ecommerce.json',
    id: 'quickshop',
    name: 'QuickShop',
    insights: [
      { title: 'Revenue (30d)', value: '$48,210', icon: '💰' },
      { title: 'Orders', value: '1,284', icon: '🛍️' },
      { title: 'Avg order', value: '$37.55', icon: '📊' },
      { title: 'Refund rate', value: '1.8%', icon: '↩️' },
    ],
    events: [
      {
        category: 'orders',
        icon: '🛍️',
        perDay: [6, 14],
        titles: ['Order Placed', 'Order Shipped', 'Order Delivered'],
        describe: () => `Order **#${randomInt(1000, 9999)}** from **${pick(FIRST)}**`,
        tags: () => ({ amount: money(), city: pick(CITIES) }),
      },
      {
        category: 'payments',
        icon: '💳',
        perDay: [4, 10],
        titles: ['Payment Captured', 'Payment Failed', 'Refund Issued'],
        describe: () => `Card ending **${randomInt(1000, 9999)}**`,
        tags: () => ({ amount: money() }),
      },
      {
        category: 'signups',
        icon: '👤',
        perDay: [2, 7],
        titles: ['Customer Registered', 'Newsletter Opt-in'],
        describe: () => `**${pick(FIRST).toLowerCase()}@example.com** joined`,
      },
      {
        category: 'reviews',
        icon: '⭐',
        perDay: [1, 5],
        titles: ['Review Posted', 'Review Flagged'],
        describe: () => `${randomInt(1, 5)} stars on **product ${randomInt(10, 99)}**`,
      },
    ],
  },
  {
    file: 'saas.json',
    id: 'launchpad',
    name: 'LaunchPad',
    insights: [
      { title: 'MRR', value: '$12,400', icon: '📈' },
      { title: 'Active teams', value: '318', icon: '👥' },
      { title: 'Trial conversion', value: '24%', icon: '🎯' },
      { title: 'Churn', value: '2.1%', icon: '📉' },
    ],
    events: [
      {
        category: 'signups',
        icon: '✨',
        perDay: [3, 9],
        titles: ['Trial Started', 'Team Created', 'Invite Accepted'],
        describe: () => `**${pick(FIRST)}** started a trial`,
        tags: () => ({ plan: pick(['free', 'pro', 'team']) }),
      },
      {
        category: 'billing',
        icon: '💳',
        perDay: [2, 6],
        titles: ['Subscription Started', 'Plan Upgraded', 'Payment Failed'],
        tags: () => ({ mrr: money() }),
      },
      {
        category: 'api',
        icon: '⚡',
        perDay: [8, 20],
        titles: ['Rate Limit Hit', 'API Key Created', 'Webhook Delivered'],
        tags: () => ({ endpoint: pick(['/v1/events', '/v1/users', '/v1/reports']) }),
      },
      {
        category: 'errors',
        icon: '🐛',
        perDay: [1, 5],
        titles: ['Unhandled Exception', 'Timeout', 'Failed Job'],
        describe: () => `In **worker-${randomInt(1, 8)}**`,
      },
    ],
  },
  {
    file: 'devops.json',
    id: 'deploybot',
    name: 'DeployBot',
    insights: [
      { title: 'Deploys (30d)', value: '212', icon: '🚀' },
      { title: 'Success rate', value: '97.6%', icon: '✅' },
      { title: 'Mean build', value: '4m 12s', icon: '⏱️' },
      { title: 'Open incidents', value: '0', icon: '🔥' },
    ],
    events: [
      {
        category: 'deploys',
        icon: '🚀',
        perDay: [3, 9],
        titles: ['Deploy Started', 'Deploy Succeeded', 'Rollback Triggered'],
        describe: () => `**${pick(['api', 'web', 'worker'])}** to production`,
        tags: () => ({ sha: Math.random().toString(16).slice(2, 9), actor: pick(FIRST) }),
      },
      {
        category: 'builds',
        icon: '🔧',
        perDay: [5, 14],
        titles: ['Build Passed', 'Build Failed', 'Tests Flaked'],
        tags: () => ({ branch: pick(['main', 'release', 'feat/search']) }),
      },
      {
        category: 'incidents',
        icon: '🔥',
        perDay: [0, 2],
        titles: ['Incident Opened', 'Incident Resolved', 'Alert Fired'],
        describe: () => `Severity **${pick(['SEV1', 'SEV2', 'SEV3'])}**`,
      },
    ],
  },
  {
    file: 'content.json',
    id: 'blogwave',
    name: 'BlogWave',
    insights: [
      { title: 'Subscribers', value: '9,842', icon: '📬' },
      { title: 'Posts (30d)', value: '18', icon: '📝' },
      { title: 'Open rate', value: '41%', icon: '👀' },
      { title: 'Top referrer', value: 'Hacker News', icon: '🔗' },
    ],
    events: [
      {
        category: 'subscribers',
        icon: '📬',
        perDay: [4, 12],
        titles: ['Subscriber Joined', 'Subscriber Unsubscribed'],
        describe: () => `**${pick(FIRST).toLowerCase()}@example.com**`,
        tags: () => ({ source: pick(['organic', 'referral', 'newsletter']) }),
      },
      {
        category: 'posts',
        icon: '📝',
        perDay: [0, 2],
        titles: ['Post Published', 'Post Updated'],
        describe: () => `**${pick(['Shipping faster', 'On simplicity', 'What we learned'])}**`,
      },
      {
        category: 'newsletter',
        icon: '✉️',
        perDay: [0, 2],
        titles: ['Newsletter Sent', 'Campaign Scheduled'],
        tags: () => ({ recipients: String(randomInt(4000, 9900)) }),
      },
      {
        category: 'traffic',
        icon: '📊',
        perDay: [6, 16],
        titles: ['Traffic Spike', 'Referral Surge'],
        tags: () => ({ referrer: pick(['news.ycombinator.com', 'reddit.com', 'google.com']) }),
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
