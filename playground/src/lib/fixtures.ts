import passiveDivider from '../fixtures/passive-divider.schx?raw';
import passiveLowpass from '../fixtures/passive-lowpass.schx?raw';
import lpb1Boost from '../fixtures/lpb-1-style-boost.schx?raw';
import spdtBypassPedal from '../fixtures/spdt-bypass-pedal.schx?raw';
import threePdtTrueBypassPedal from '../fixtures/3pdt-true-bypass-pedal.schx?raw';
import vrefBias from '../fixtures/vref-bias.schx?raw';
import bigMuffToneStack from '../fixtures/big-muff-tone-stack.schx?raw';
import dcJackPower from '../fixtures/dc-jack-power-section.schx?raw';
import fuzzFacePnp from '../fixtures/fuzz-face-pnp.schx?raw';
import pt2399Delay from '../fixtures/pt2399-delay.schx?raw';
import rubyAmp from '../fixtures/ruby-amp-lm386.schx?raw';
import cd4066BufferBypass from '../fixtures/cd4066-buffer-bypass.schx?raw';
import cd4013Suboctave from '../fixtures/cd4013-suboctave.schx?raw';
import lm13700Compressor from '../fixtures/lm13700-compressor.schx?raw';
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

let ltspiceGuitarPedals: Record<string, string> = {};
try {
    ltspiceGuitarPedals = import.meta.glob(
        '../../../tests/fixtures/asc/ltspice-guitar-pedals/*.asc',
        { query: '?raw', import: 'default', eager: true },
    ) as Record<string, string>;
} catch {
    ltspiceGuitarPedals = {};
}

let spiceNetlists: Record<string, string> = {};
try {
    spiceNetlists = import.meta.glob(
        '../../../tests/fixtures/cir/*.cir',
        { query: '?raw', import: 'default', eager: true },
    ) as Record<string, string>;
} catch {
    spiceNetlists = {};
}

export type FixtureGroup =
    | 'custom'
    | 'livespice-examples'
    | 'ltspice-examples'
    | 'ltspice-guitar-pedals'
    | 'spice-netlists';

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
        id: 'spdt-bypass-pedal',
        title: 'SPDT bypass pedal',
        description: 'BJT boost with an SPDT footswitch selecting boost vs raw bypass; 9V battery, DC rail, always-on LED.',
        filename: 'spdt-bypass-pedal.schx',
        source: spdtBypassPedal,
        group: 'custom',
    },
    {
        id: '3pdt-true-bypass-pedal',
        title: '3PDT true bypass pedal',
        description: 'Same boost wrapped in a 3PDT footswitch — input, output, and LED ground are switched together.',
        filename: '3pdt-true-bypass-pedal.schx',
        source: threePdtTrueBypassPedal,
        group: 'custom',
    },
    {
        id: 'vref-bias',
        title: 'Vref mid-rail bias',
        description: 'Two-resistor divider + smoothing cap for op-amp pedals running on a single 9V supply.',
        filename: 'vref-bias.schx',
        source: vrefBias,
        group: 'custom',
    },
    {
        id: 'big-muff-tone-stack',
        title: 'Big Muff tone stack',
        description: 'Single TONE pot blending a treble path (C+R) and a bass path (R+C). Standalone topology.',
        filename: 'big-muff-tone-stack.schx',
        source: bigMuffToneStack,
        group: 'custom',
    },
    {
        id: 'dc-jack-power-section',
        title: 'DC jack power section',
        description: 'Switching 9V DC jack interrupting the battery + Schottky reverse-polarity diode + smoothing cap.',
        filename: 'dc-jack-power-section.schx',
        source: dcJackPower,
        group: 'custom',
    },
    {
        id: 'fuzz-face-pnp',
        title: 'Fuzz Face (PNP positive-ground)',
        description: 'Two-PNP fuzz with positive ground; supply rail at −9V. 2N3906 / 2N5087.',
        filename: 'fuzz-face-pnp.schx',
        source: fuzzFacePnp,
        group: 'custom',
    },
    {
        id: 'pt2399-delay',
        title: 'PT2399 simple delay',
        description: 'PT2399 echo IC + 78L05 regulator + 3-pot panel (TIME / REPEATS / MIX).',
        filename: 'pt2399-delay.schx',
        source: pt2399Delay,
        group: 'custom',
    },
    {
        id: 'ruby-amp-lm386',
        title: 'Ruby amp (LM386)',
        description: 'Runoffgroove Ruby mini-amp — JFET buffer + LM386 with GAIN pot at pins 1&8, Zobel network, VOLUME pot.',
        filename: 'ruby-amp-lm386.schx',
        source: rubyAmp,
        group: 'custom',
    },
    {
        id: 'cd4066-buffer-bypass',
        title: 'CD4066 buffer bypass',
        description: 'CMOS bilateral-switch bypass — two CD4066 elements routed by complementary control, JFET buffers, Vref bias.',
        filename: 'cd4066-buffer-bypass.schx',
        source: cd4066BufferBypass,
        group: 'custom',
    },
    {
        id: 'cd4013-suboctave',
        title: 'CD4013 sub-octave',
        description: 'Comparator-driven CD4013 D flip-flop in toggle mode for divide-by-2 sub-octave. SUB + DRY + VOLUME pots.',
        filename: 'cd4013-suboctave.schx',
        source: cd4013Suboctave,
        group: 'custom',
    },
    {
        id: 'lm13700-compressor',
        title: 'LM13700 OTA compressor',
        description: 'Ross/Dyna Comp topology — 2N3904 buffer → LM13700 OTA → envelope detector → Iabc feedback. SUSTAIN + LEVEL pots.',
        filename: 'lm13700-compressor.schx',
        source: lm13700Compressor,
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
    return filename.replace(/\.(schx|asc|cir|net|spice)$/, '');
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

const LTSPICE_GUITAR_PEDAL_FIXTURES: readonly Fixture[] = Object.entries(ltspiceGuitarPedals)
    .map(([path, source]) => {
        const filename = basename(path);
        const title = stem(filename);
        return {
            id: `ltspice-pedal-${toId(title)}`,
            title,
            description: 'Guitar pedal from cushychicken/ltspice-guitar-pedals.',
            filename,
            source,
            group: 'ltspice-guitar-pedals' as const,
        };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

const SPICE_NETLIST_FIXTURES: readonly Fixture[] = Object.entries(spiceNetlists)
    .map(([path, source]) => {
        const filename = basename(path);
        const title = stem(filename);
        return {
            id: `spice-${toId(title)}`,
            title,
            description: 'SPICE-style netlist (.cir).',
            filename,
            source,
            group: 'spice-netlists' as const,
        };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

export const FIXTURES: readonly Fixture[] = [
    ...CUSTOM_FIXTURES,
    ...LIVESPICE_FIXTURES,
    ...LTSPICE_FIXTURES,
    ...LTSPICE_GUITAR_PEDAL_FIXTURES,
    ...SPICE_NETLIST_FIXTURES,
];

export const FIXTURE_GROUPS: readonly { id: FixtureGroup; label: string }[] = [
    { id: 'custom', label: 'Curated examples' },
    { id: 'livespice-examples', label: 'LiveSPICE examples' },
    { id: 'ltspice-examples', label: 'LTspice examples' },
    { id: 'ltspice-guitar-pedals', label: 'LTspice guitar pedals' },
    { id: 'spice-netlists', label: 'SPICE netlists' },
];

export function findFixture(id: string): Fixture | undefined {
    return FIXTURES.find((f) => f.id === id);
}
