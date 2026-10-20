import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import Layout from '@theme/Layout'
import { useState, type ReactNode } from 'react'
import styles from './index.module.css'

type IconProps = { className?: string }

function stroke(children: ReactNode) {
  return function Icon({ className }: IconProps) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    )
  }
}

const IconArchive = stroke(
  <>
    <rect x="2" y="3" width="20" height="5" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </>,
)

const IconFingerprint = stroke(
  <>
    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
    <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
    <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
    <path d="M2 12a10 10 0 0 1 18-6" />
    <path d="M2 16h.01" />
    <path d="M21.8 16c.2-2 .131-5.354 0-6" />
    <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
    <path d="M8.65 22c.21-.66.45-1.32.57-2" />
    <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
  </>,
)

const IconPhone = stroke(
  <>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M12 18h.01" />
  </>,
)

const IconLayers = stroke(
  <>
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </>,
)

const IconWindow = stroke(
  <>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M2 8h20" />
    <path d="M6 4v4" />
    <path d="M10 4v4" />
  </>,
)

const IconTerminal = stroke(
  <>
    <path d="m5 8 4 4-4 4" />
    <path d="M12 16h7" />
    <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" />
  </>,
)

const IconCopy = stroke(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" />
  </>,
)

const IconCheck = stroke(<path d="m4 12 5 5L20 6" />)

const INSTALL_COMMAND = 'npm i -g @rootnative/devhub'

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  const onCopy = () => {
    navigator.clipboard?.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <button
      type="button"
      className={styles.copyCommand}
      onClick={onCopy}
      aria-label="Copy the install command"
    >
      <span className={styles.copyPrompt}>$</span>
      <code className={styles.copyText}>{command}</code>
      <span className={styles.copyIcon}>
        {copied ? (
          <IconCheck className={styles.copyGlyph} />
        ) : (
          <IconCopy className={styles.copyGlyph} />
        )}
      </span>
    </button>
  )
}

type Tone = 'prompt' | 'strong' | 'muted' | 'accent' | 'ok'

const TONE_CLASS: Record<Tone, string> = {
  prompt: styles.termPrompt,
  strong: styles.termStrong,
  muted: styles.termMuted,
  accent: styles.termAccent,
  ok: styles.termOk,
}

type Segment = readonly [text: string, tone?: Tone]

// The real text output of the CLI, the same as the samples of the docs
// pages. Change it only when the CLI output changes.
const TERMINAL_LINES: readonly (readonly Segment[])[] = [
  [
    ['$ ', 'prompt'],
    ['devhub match', 'strong'],
  ],
  [['Project: /Users/me/trail-app (@expo/fingerprint 0.20.13)', 'muted']],
  [],
  [
    ['android', 'strong'],
    ['  3f2a0c9e1b7d4a6f8e2c5b1d9a7f3e6c4b8d2a1f', 'muted'],
  ],
  [
    [
      '  ID        PLATFORM  PROFILE      VERSION  COMMIT   CREATED     EAS EXPIRY',
      'muted',
    ],
  ],
  [
    ['  '],
    ['5d1c9a2e', 'accent'],
    ['  android   development  1.4.0    8b1f2c3  2026-10-12  2026-11-11'],
  ],
  [],
  [
    ['ios', 'strong'],
    ['  9c1b7e4d2a6f0c3e8b5d1a7f4e2c9b6d3a8f1e5c', 'muted'],
  ],
  [['  No stored build matches this fingerprint.', 'muted']],
  [],
  [
    ['$ ', 'prompt'],
    ['devhub install 5d1c', 'strong'],
  ],
  [
    [
      'Installing the build 5d1c9a2e-4b7f-4c1a-9e3d-2f6a8b0c1d2e on Pixel_8_API_35 (emulator-5554).',
      'muted',
    ],
  ],
  [
    [
      'Installed the build 5d1c9a2e-4b7f-4c1a-9e3d-2f6a8b0c1d2e on Pixel_8_API_35 (emulator-5554).',
      'ok',
    ],
  ],
]

function Terminal() {
  return (
    <figure
      className={styles.terminal}
      aria-label="devhub match finds a stored Android build for the current code, and devhub install installs it on an emulator"
    >
      <div className={styles.terminalHeader}>
        <span className={styles.codeDot} data-color="red" />
        <span className={styles.codeDot} data-color="yellow" />
        <span className={styles.codeDot} data-color="green" />
        <span className={styles.terminalTitle}>~/trail-app</span>
      </div>
      <pre className={styles.terminalBody}>
        <code>
          {TERMINAL_LINES.map((line, index) => (
            <span key={index}>
              {line.map(([text, tone], part) => (
                <span
                  key={part}
                  className={tone === undefined ? undefined : TONE_CLASS[tone]}
                >
                  {text}
                </span>
              ))}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  )
}

function Hero() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroGrid} aria-hidden="true" />
      <div className={styles.heroInner}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            For Expo development builds
          </span>
          <h1 className={styles.heroTitle}>Keep every dev build.</h1>
          <p className={styles.heroTagline}>
            DevHub keeps the development builds of all your Expo projects on
            your machine, finds the build that matches your code, and installs
            it on a simulator, an emulator, or a phone. You build again only
            when the native code changes.
          </p>
          <div className={styles.heroCtas}>
            <Link className={styles.ctaPrimary} to="/quick-start">
              Get started
            </Link>
            <Link className={styles.ctaSecondary} to="/introduction">
              Read the docs
            </Link>
          </div>
          <CopyCommand command={INSTALL_COMMAND} />
        </div>
        <div className={styles.heroVisual}>
          <Terminal />
        </div>
      </div>
    </header>
  )
}

const stats = [
  { value: '9', label: 'Commands' },
  { value: '3', label: 'Host systems' },
  { value: '0', label: 'Telemetry' },
  { value: 'MIT', label: 'Licensed' },
]

function Stats() {
  return (
    <section className={styles.stats}>
      <div className={styles.statsInner}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.statItem}>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

const features = [
  {
    title: 'Keep every EAS build',
    description: (
      <>
        <code>devhub sync</code> downloads each dev client build before EAS
        deletes it. A daily sync keeps the builds of all your projects.
      </>
    ),
    to: '/commands/sync',
    Icon: IconArchive,
  },
  {
    title: 'Match by fingerprint',
    description: (
      <>
        <code>devhub match</code> runs the <code>@expo/fingerprint</code> of
        your project. A stored build with the same hash runs your code, so you
        do not build again.
      </>
    ),
    to: '/commands/match',
    Icon: IconFingerprint,
  },
  {
    title: 'Install in one command',
    description: (
      <>
        <code>devhub install</code> puts a stored build on an emulator, an
        Android phone, or an iOS simulator. When adb refuses, DevHub tells you
        why and how to fix it.
      </>
    ),
    to: '/commands/install',
    Icon: IconPhone,
  },
  {
    title: 'Local builds too',
    description: (
      <>
        As the Expo build cache provider, DevHub stores each{' '}
        <code>npx expo run</code> build, and installs it again when the native
        code did not change.
      </>
    ),
    to: '/guides/local-builds',
    Icon: IconLayers,
  },
  {
    title: 'A page for all of it',
    description: (
      <>
        <code>devhub ui</code> shows your builds and devices in the browser,
        with an install button and a sync button. It listens on{' '}
        <code>127.0.0.1</code> only.
      </>
    ),
    to: '/commands/ui',
    Icon: IconWindow,
  },
  {
    title: 'Made for scripts and agents',
    description: (
      <>
        Each command has <code>--json</code> and clear exit codes.{' '}
        <code>llms.txt</code> gives an AI agent the exact API of the installed
        version.
      </>
    ),
    to: '/reference/ai-agents',
    Icon: IconTerminal,
  },
]

function Features() {
  return (
    <section className={styles.features}>
      <div className={styles.sectionInner}>
        <span className={styles.sectionEyebrow}>Why DevHub</span>
        <h2 className={styles.sectionTitle}>
          A native build only when the native code changes.
        </h2>
        <div className={styles.featuresGrid}>
          {features.map(({ title, description, to, Icon }) => (
            <Link key={title} className={styles.featureCard} to={to}>
              <div className={styles.featureIcon}>
                <Icon className={styles.featureGlyph} />
              </div>
              <h3 className={styles.featureTitle}>{title}</h3>
              <p className={styles.featureDescription}>{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

const steps = [
  {
    number: '01',
    title: 'Sync',
    description:
      'Download the dev client builds of your project from EAS, before EAS deletes them.',
    command: 'devhub sync',
  },
  {
    number: '02',
    title: 'Match',
    description:
      'Calculate the native fingerprint of your code, and find the stored builds that run it.',
    command: 'devhub match',
  },
  {
    number: '03',
    title: 'Install',
    description:
      'Install the build on an emulator, a phone, or a simulator. Then start Metro.',
    command: 'devhub install 5d1c',
  },
]

function HowItWorks() {
  return (
    <section className={styles.howItWorks}>
      <div className={styles.sectionInner}>
        <span className={styles.sectionEyebrow}>How it works</span>
        <h2 className={styles.sectionTitle}>Three commands. No new build.</h2>
        <div className={styles.stepsGrid}>
          {steps.map((step) => (
            <div key={step.number} className={styles.stepCard}>
              <span className={styles.stepNumber}>{step.number}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDescription}>{step.description}</p>
              <code className={styles.stepCommand}>{step.command}</code>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CodePreview() {
  return (
    <section className={styles.codePreview}>
      <div className={styles.codePreviewInner}>
        <div className={styles.codePreviewText}>
          <span className={styles.sectionEyebrow}>Local builds</span>
          <h2 className={styles.sectionTitle}>Keep your local builds too.</h2>
          <p className={styles.sectionLead}>
            Add DevHub as the Expo build cache provider. Each{' '}
            <code>npx expo run:android</code> or <code>run:ios</code> stores its
            build. The next run with the same native code installs the stored
            build, and Gradle or Xcode does not run.
          </p>
          <Link className={styles.ctaPrimary} to="/guides/local-builds">
            Set up the cache provider
          </Link>
        </div>
        <div className={styles.codePreviewCode}>
          <div className={styles.codeHeader}>
            <span className={styles.codeDot} data-color="red" />
            <span className={styles.codeDot} data-color="yellow" />
            <span className={styles.codeDot} data-color="green" />
            <span className={styles.codeFilename}>app.json</span>
          </div>
          <pre className={styles.codePre}>
            <code>
              {'{\n  '}
              <span className={styles.codeProp}>&quot;expo&quot;</span>
              {': {\n    '}
              <span className={styles.codeProp}>
                &quot;buildCacheProvider&quot;
              </span>
              {': {\n      '}
              <span className={styles.codeProp}>&quot;plugin&quot;</span>
              {': '}
              <span className={styles.codeString}>
                &quot;@rootnative/devhub/cache-provider&quot;
              </span>
              {'\n    }\n  }\n}'}
            </code>
          </pre>
        </div>
      </div>
    </section>
  )
}

function BottomCta() {
  return (
    <section className={styles.bottomCta}>
      <div className={styles.bottomCtaInner}>
        <h2 className={styles.bottomCtaTitle}>Stop building the same app.</h2>
        <p className={styles.bottomCtaText}>
          Install the CLI, run one sync, and keep each dev build from now on.
        </p>
        <div className={styles.heroCtas}>
          <Link className={styles.ctaPrimary} to="/quick-start">
            Quick start
          </Link>
          <Link className={styles.ctaSecondary} to="/installation">
            Installation
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext()

  return (
    <Layout description={siteConfig.tagline}>
      <Hero />
      <main>
        <Stats />
        <Features />
        <HowItWorks />
        <CodePreview />
        <BottomCta />
      </main>
    </Layout>
  )
}
