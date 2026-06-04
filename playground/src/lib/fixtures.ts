import passiveDivider from '../fixtures/passive-divider.schx?raw';
import passiveLowpass from '../fixtures/passive-lowpass.schx?raw';
import lpb1Boost from '../fixtures/lpb-1-style-boost.schx?raw';
import ltspiceRcLowpass from '../fixtures/ltspice-rc-lowpass.asc?raw';

// `import.meta.glob` is a Vite-only feature transformed at build time.
// Under Bun's test runner the property is undefined, so we wrap each call
// in try/catch — Vite still sees the literal call (and inlines the matches),
// while Bun simply lands in the catch and uses an empty record.
let livespiceExamples: Record<string, string> = {};
try {
    livespiceExamples = import.meta.glob(
        '../../../tests/fixtures/schx/livespice-examples/*.schx',
        { query: '?raw', import: 'default', eager: true },
    ) as Record<string, string>;
} catch {
    livespiceExamples = {};
}

let ltspiceExtraExamples: Record<string, string> = {};
try {
    ltspiceExtraExamples = import.meta.glob(
        '../fixtures/ltspice-examples/*.asc',
        { query: '?raw', import: 'default', eager: true },
    ) as Record<string, string>;
} catch {
    ltspiceExtraExamples = {};
}

export type FixtureGroup = 'custom' | 'livespice-examples' | 'ltspice-examples';

export type Fixture = Readonly<{
    id: string;
    title: string;
    description: string;
    filename: string;
    source: string;
    group: FixtureGroup;
}>;

const CUSTOM_FIXTURES: readonly Fixture[] = [
    {
        id: 'passive-divider',
        title: 'Passive voltage divider',
        description: 'Two resistors and an output jack — the simplest divider.',
        filename: 'passive-divider.schx',
        source: passiveDivider,
        group: 'custom',
    },
    {
        id: 'passive-lowpass',
        title: 'RC low-pass filter',
        description: 'First-order RC filter with explicit ground.',
        filename: 'passive-lowpass.schx',
        source: passiveLowpass,
        group: 'custom',
    },
    {
        id: 'lpb-1-style-boost',
        title: 'LPB-1 style BJT boost',
        description: 'Single-transistor common-emitter clean booster with a level pot.',
        filename: 'lpb-1-style-boost.schx',
        source: lpb1Boost,
        group: 'custom',
    },
    {
        id: 'ltspice-rc-lowpass',
        title: 'LTspice RC low-pass',
        description: 'Small .asc fixture exercising SYMBOL, WIRE, FLAG, IOPIN, TEXT.',
        filename: 'ltspice-rc-lowpass.asc',
        source: ltspiceRcLowpass,
        group: 'custom',
    },
];

function basename(path: string): string {
    const m = path.match(/([^/]+)$/);
    return m?.[1] ?? path;
}

function stem(filename: string): string {
    return filename.replace(/\.(schx|asc)$/, '');
}

function toId(stemValue: string): string {
    return stemValue
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const LIVESPICE_FIXTURES: readonly Fixture[] = Object.entries(livespiceExamples)
    .map(([path, source]) => {
        const filename = basename(path);
        const title = stem(filename);
        return {
            id: `livespice-${toId(title)}`,
            title,
            description: 'Upstream LiveSPICE example schematic.',
            filename,
            source,
            group: 'livespice-examples' as const,
        };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

const LTSPICE_FIXTURES: readonly Fixture[] = Object.entries(ltspiceExtraExamples)
    .map(([path, source]) => {
        const filename = basename(path);
        const title = stem(filename);
        return {
            id: `ltspice-${toId(title)}`,
            title,
            description: 'LTspice .asc example.',
            filename,
            source,
            group: 'ltspice-examples' as const,
        };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

export const FIXTURES: readonly Fixture[] = [
    ...CUSTOM_FIXTURES,
    ...LIVESPICE_FIXTURES,
    ...LTSPICE_FIXTURES,
];

export const FIXTURE_GROUPS: readonly { id: FixtureGroup; label: string }[] = [
    { id: 'custom', label: 'Curated examples' },
    { id: 'livespice-examples', label: 'LiveSPICE upstream examples' },
    { id: 'ltspice-examples', label: 'LTspice examples' },
];

export function findFixture(id: string): Fixture | undefined {
    return FIXTURES.find((f) => f.id === id);
}
