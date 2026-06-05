import { describe, expect, test } from 'bun:test';
import { extractPanel } from '../../src/panel';
import { parseSchx } from '../../src/formats/schx/parser';
import { EMPTY_DOCUMENT, type CircuitDocument } from '../../src/model/types';

async function loadFixture(name: string): Promise<string> {
    return Bun.file(new URL(`../fixtures/schx/${name}.schx`, import.meta.url)).text();
}

describe('extractPanel', () => {
    test('extracts a knob with taper/default-position from the LPB-1 boost', async () => {
        const doc = parseSchx(await loadFixture('lpb-1-style-boost'));
        const panel = extractPanel(doc);

        expect(panel.knobs).toHaveLength(1);
        const level = panel.knobs[0]!;
        expect(level.id).toBe('Level');
        expect(level.name).toBe('Level');
        expect(level.taper).toBe('log');
        expect(level.defaultPosition).toBeCloseTo(0.8);
        expect(level.gangGroup).toBe('Level');
        expect(level.resistance?.value).toBe(100_000);
    });

    test('extracts a 3PDT footswitch with 3 poles, 2 positions', async () => {
        const doc = parseSchx(await loadFixture('3pdt-true-bypass-pedal'));
        const panel = extractPanel(doc);

        expect(panel.switches).toHaveLength(1);
        const footswitch = panel.switches[0]!;
        expect(footswitch.id).toBe('SW1');
        expect(footswitch.switchKind).toBe('3pdt');
        expect(footswitch.poles).toBe(3);
        expect(footswitch.positions).toBe(2);
        expect(footswitch.partNumber).toBe('3PDT footswitch');
    });

    test('extracts an SPDT footswitch as 1 pole / 2 positions', async () => {
        const doc = parseSchx(await loadFixture('spdt-bypass-pedal'));
        const panel = extractPanel(doc);

        expect(panel.switches).toHaveLength(1);
        const sw = panel.switches[0]!;
        expect(sw.switchKind).toBe('spdt');
        expect(sw.poles).toBe(1);
        expect(sw.positions).toBe(2);
    });

    test('extracts an LED indicator and infers the colour from part number', async () => {
        const doc = parseSchx(await loadFixture('spdt-bypass-pedal'));
        const panel = extractPanel(doc);

        expect(panel.leds).toHaveLength(1);
        const led = panel.leds[0]!;
        expect(led.id).toBe('LED1');
        expect(led.color).toBe('red');
        expect(led.partNumber).toBe('3mm red');
    });

    test('classifies Input and Speaker jacks by role', async () => {
        const doc = parseSchx(await loadFixture('spdt-bypass-pedal'));
        const panel = extractPanel(doc);

        expect(panel.jacks.map((j) => j.role).sort()).toEqual(['input', 'output']);
        const input = panel.jacks.find((j) => j.role === 'input')!;
        expect(input.id).toBe('IN');
        const output = panel.jacks.find((j) => j.role === 'output')!;
        expect(output.id).toBe('OUT');
        expect(output.impedance?.value).toBe(10_000);
    });

    test('Big Muff tone stack exposes a single TONE knob with Linear taper', async () => {
        const doc = parseSchx(await loadFixture('big-muff-tone-stack'));
        const panel = extractPanel(doc);

        expect(panel.knobs).toHaveLength(1);
        expect(panel.knobs[0]?.id).toBe('TONE');
        expect(panel.knobs[0]?.taper).toBe('linear');
    });

    test('PT2399 fixture exposes three knobs (TIME/REPEATS/MIX) with named groups', async () => {
        const doc = parseSchx(await loadFixture('pt2399-delay'));
        const panel = extractPanel(doc);

        const labels = panel.knobs.map((k) => k.id).sort();
        expect(labels).toEqual(['MIX', 'REPEATS', 'TIME']);
        const mix = panel.knobs.find((k) => k.id === 'MIX')!;
        expect(mix.taper).toBe('log');
        const time = panel.knobs.find((k) => k.id === 'TIME')!;
        expect(time.taper).toBe('linear');
    });

    test('extracts Boss GE-7 style slider controls from potentiometer metadata', () => {
        const doc: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'BAND_800',
                kind: 'potentiometer',
                name: '800Hz',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [
                    { name: 'a', position: { x: 0, y: -20 } },
                    { name: 'wiper', position: { x: 20, y: 0 } },
                    { name: 'b', position: { x: 0, y: 20 } },
                ],
                properties: {
                    Wipe: '0.5',
                    ControlStyle: 'Slider',
                    Orientation: 'Vertical',
                    RangeMin: '-15',
                    RangeMax: '15',
                    Unit: 'dB',
                    Center: '0',
                    Group: 'GE-7',
                    Description: 'Graphic EQ band fader.',
                },
                sourceTypeName: 'Circuit.Potentiometer, Circuit',
            }],
        };

        const panel = extractPanel(doc);
        const sliders = panel.sliders ?? [];
        const slider = sliders[0]!;

        expect(panel.knobs).toEqual([]);
        expect(sliders).toHaveLength(1);
        expect(slider.id).toBe('BAND_800');
        expect(slider.name).toBe('800Hz');
        expect(slider.defaultPosition).toBe(0.5);
        expect(slider.orientation).toBe('vertical');
        expect(slider.gangGroup).toBe('GE-7');
        expect(slider.range).toEqual({ min: -15, max: 15, unit: 'dB', center: 0 });
    });

    test('extracts DigiTech Drop style stepped knob detents from labels', () => {
        const doc: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'DROP',
                kind: 'potentiometer',
                name: 'Drop',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [
                    { name: 'a', position: { x: 0, y: -20 } },
                    { name: 'wiper', position: { x: 20, y: 0 } },
                    { name: 'b', position: { x: 0, y: 20 } },
                ],
                properties: {
                    Wipe: '0.24',
                    Sweep: 'Stepped',
                    StepLabels: '1, 2, 3, 4, 5, 6, 7, OCT, OCT+DRY',
                    Description: 'Drop-tune selector with fixed semitone detents.',
                },
                sourceTypeName: 'Circuit.Potentiometer, Circuit',
            }],
        };

        const panel = extractPanel(doc);
        const drop = panel.knobs[0]!;

        expect(drop.controlMode).toBe('stepped');
        expect(drop.defaultPosition).toBeCloseTo(0.25);
        expect(drop.steps).toHaveLength(9);
        expect(drop.steps?.[0]).toEqual({ index: 0, position: 0, label: '1' });
        expect(drop.steps?.[2]).toEqual({ index: 2, position: 0.25, label: '3' });
        expect(drop.steps?.[8]).toEqual({ index: 8, position: 1, label: 'OCT+DRY' });
    });

    test('extracts unlabeled stepped knobs from numeric detent metadata', () => {
        const doc: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            components: [{
                id: 'MODE',
                kind: 'potentiometer',
                name: 'Mode',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [
                    { name: 'a', position: { x: 0, y: -20 } },
                    { name: 'wiper', position: { x: 20, y: 0 } },
                    { name: 'b', position: { x: 0, y: 20 } },
                ],
                properties: {
                    Wipe: '0.6',
                    Detents: '4',
                },
                sourceTypeName: 'Circuit.Potentiometer, Circuit',
            }],
        };

        const mode = extractPanel(doc).knobs[0]!;

        expect(mode.controlMode).toBe('stepped');
        expect(mode.steps).toEqual([
            { index: 0, position: 0 },
            { index: 1, position: 0.333333333333 },
            { index: 2, position: 0.666666666667 },
            { index: 3, position: 1 },
        ]);
        expect(mode.defaultPosition).toBeCloseTo(0.666666666667);
    });

    test('empty document produces an empty panel', () => {
        const panel = extractPanel({
            metadata: { name: '', description: '', partNumber: '' },
            components: [],
            wires: [],
            directives: [],
            warnings: [],
            rawAttributes: {},
        });

        expect(panel.knobs).toEqual([]);
        expect(panel.switches).toEqual([]);
        expect(panel.leds).toEqual([]);
        expect(panel.jacks).toEqual([]);
    });
});
