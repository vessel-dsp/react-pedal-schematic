import { describe, expect, test } from 'bun:test';
import {
    EMPTY_DOCUMENT,
    parseCircuitDocument,
    parseInterchangeYaml,
    serializeInterchangeYaml,
    type CircuitDocument,
} from '../../../src';

const source = `<?xml version="1.0" encoding="utf-8"?>
<Schematic Name="Test filter">
  <Element Type="Circuit.Symbol, Circuit" Position="0,0" Rotation="0" Flip="false">
    <Component _Type="Circuit.Resistor, Circuit" Name="R1" Resistance="10 kΩ" Wipe="0.5" />
  </Element>
  <Element Type="Circuit.Symbol, Circuit" Position="0,80" Rotation="0" Flip="false">
    <Component _Type="Circuit.Ground, Circuit" Name="GND" />
  </Element>
  <Element Type="Circuit.Wire, Circuit" A="0,20" B="0,80" />
</Schematic>`;

const runtimeDescriptorSource = `<?xml version="1.0" encoding="utf-8"?>
<Schematic Name="Runtime descriptor">
  <Element Type="Circuit.Symbol, Circuit" Position="-300,140" Rotation="0" Flip="false">
    <Component _Type="Circuit.Input, Circuit" Name="V1" />
  </Element>
  <Element Type="Circuit.Symbol, Circuit" Position="0,140" Rotation="0" Flip="false">
    <Component _Type="Circuit.MicroBlockDelayChip, Circuit" Name="U1" Profile="BbdMn3007Style" StereoOutputMode="WetDry" Feedback="1e-12" Level="1.0" />
  </Element>
  <Element Type="Circuit.Symbol, Circuit" Position="200,140" Rotation="0" Flip="false">
    <Component _Type="Circuit.MicroBlockReverb, Circuit" Name="U2" Profile="hall-style" StereoOutputMode="Spread" Decay="0.72" />
  </Element>
  <Element Type="Circuit.Symbol, Circuit" Position="400,140" Rotation="0" Flip="false">
    <Component _Type="Circuit.Speaker, Circuit" Name="S1" />
  </Element>
  <Element Type="Circuit.Wire, Circuit" A="-300,120" B="0,120" />
  <Element Type="Circuit.Wire, Circuit" A="0,160" B="200,120" />
  <Element Type="Circuit.Wire, Circuit" A="200,160" B="400,120" />
</Schematic>`;

describe('parseInterchangeYaml', () => {
    test('round-trips stompbox grid panel placement metadata', () => {
        const doc: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            metadata: {
                name: 'Three knob drive',
                description: 'Grid-annotated stompbox control surface.',
                partNumber: '',
            },
            components: [{
                id: 'LEVEL',
                kind: 'potentiometer',
                name: 'Level',
                origin: { x: 0, y: 0 },
                rotation: 0,
                flipped: false,
                terminals: [
                    { name: 'a', position: { x: 0, y: -20 } },
                    { name: 'wiper', position: { x: 20, y: 0 } },
                    { name: 'b', position: { x: 0, y: 20 } },
                ],
                properties: {
                    Resistance: { raw: '100 kΩ', value: 100_000, unit: 'Ω' },
                    Wipe: '0.8',
                    Sweep: 'Logarithmic',
                },
                sourceTypeName: 'Circuit.Potentiometer',
            }],
            panel: {
                layout: {
                    kind: 'stompbox-grid',
                    rows: 2,
                    columns: 3,
                    indexing: 'one-based',
                    rowOrder: 'top-to-bottom',
                    columnOrder: 'left-to-right',
                },
                controls: [{
                    componentId: 'LEVEL',
                    controlKind: 'knob',
                    grid: {
                        row: 1,
                        column: 3,
                        rowSpan: 1,
                        columnSpan: 1,
                    },
                    label: 'Level',
                }],
            },
        };

        const yaml = serializeInterchangeYaml(doc);
        const parsed = parseInterchangeYaml(yaml);

        expect(yaml).toContain('panel:');
        expect(yaml).toContain('kind: stompbox-grid');
        expect(yaml).toContain('indexing: one-based');
        expect(yaml).toContain('componentId: LEVEL');
        expect(yaml).toContain('rowSpan: 1');
        expect(parsed.panel).toEqual(doc.panel);
    });

    test('round-trips external control interface metadata', () => {
        const doc: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            metadata: {
                name: 'Boss DD-3 external controls',
                description: 'Runtime controls that are not panel toggles.',
                partNumber: '',
            },
            controlInterfaces: [
                {
                    id: 'trigger-input',
                    name: 'TRIGGER external',
                    role: 'trigger',
                    controlRole: 'sampler-trigger',
                    interface: 'external-control-input',
                    connector: '1/4-inch-mono-ts',
                    assignmentHint: 'momentary-or-latching',
                    polarity: 'normally-open',
                    binding: {
                        sourceComponentId: 'U1',
                        controlId: 'U1:sampler-trigger',
                        controlName: 'TRIGGER',
                        property: 'SamplerTriggerControl',
                    },
                    description: 'Sampler record/play trigger input.',
                },
                {
                    id: 'reset-input',
                    name: 'RESET external',
                    role: 'reset',
                    controlRole: 'reset',
                    interface: 'external-control-input',
                    connector: '1/4-inch-mono-ts',
                    assignmentHint: 'momentary-or-latching',
                    polarity: 'normally-open',
                    binding: {
                        sourceComponentId: 'U1',
                        controlId: 'U1:reset',
                        controlName: 'RESET',
                        property: 'ResetControl',
                    },
                },
            ],
        };

        const yaml = serializeInterchangeYaml(doc);
        const parsed = parseInterchangeYaml(yaml);

        expect(yaml).toContain('controlInterfaces:');
        expect(parsed.controlInterfaces).toEqual(doc.controlInterfaces);
    });

    test('rejects unsupported panel grid indexing annotations', () => {
        const yaml = `schema: circuit-interchange/v1
metadata:
  name: Bad panel
  description: ""
  partNumber: ""
source: {}
panel:
  layout:
    kind: stompbox-grid
    rows: 1
    columns: 1
    indexing: diagonal
  controls: []
components: []
nodes: []
wires: []
directives: []
diagnostics: []
rawAttributes: {}`;

        expect(() => parseInterchangeYaml(yaml)).toThrow('panel.layout.indexing');
    });

    test('validates panel grid coordinates against the declared indexing mode', () => {
        const oneBasedWithZero = `schema: circuit-interchange/v1
metadata:
  name: Bad panel coordinate
  description: ""
  partNumber: ""
source: {}
panel:
  layout:
    kind: stompbox-grid
    rows: 1
    columns: 1
    indexing: one-based
  controls:
    - componentId: LEVEL
      controlKind: knob
      grid:
        row: 0
        column: 1
components: []
nodes: []
wires: []
directives: []
diagnostics: []
rawAttributes: {}`;

        const zeroBased = oneBasedWithZero.replace('indexing: one-based', 'indexing: zero-based').replace('column: 1', 'column: 0');

        expect(() => parseInterchangeYaml(oneBasedWithZero)).toThrow('panel.controls[0].grid.row');
        expect(parseInterchangeYaml(zeroBased).panel?.controls[0]?.grid).toEqual({ row: 0, column: 0 });
    });

    test('parses the project interchange YAML shape back into a CircuitDocument', () => {
        const original = parseCircuitDocument(source, { filename: 'test-filter.schx' });
        const yaml = serializeInterchangeYaml(original, {
            filename: 'test-filter.schx',
            sourceFormat: 'schx',
        }).replace('name: "Test filter"', 'name: "Edited source"');

        const parsed = parseInterchangeYaml(yaml);

        expect(parsed.metadata.name).toBe('Edited source');
        expect(parsed.components).toHaveLength(2);
        expect(parsed.components[0]?.id).toBe('R1');
        expect(parsed.components[0]?.kind).toBe('resistor');
        expect(parsed.components[0]?.terminals[0]?.name).toBe('a');
        expect(parsed.components[0]?.terminals[0]?.position).toEqual({ x: 0, y: -20 });
        expect(parsed.wires).toEqual([{ id: 'wire-1', endpoints: [{ x: 0, y: 20 }, { x: 0, y: 80 }] }]);
    });

    test('preserves scalar component properties as strings even when they look numeric', () => {
        const original = parseCircuitDocument(source, { filename: 'test-filter.schx' });
        const yaml = serializeInterchangeYaml(original, {
            filename: 'test-filter.schx',
            sourceFormat: 'schx',
        });

        const parsed = parseInterchangeYaml(yaml);

        expect(parsed.components[0]?.properties.Wipe).toBe('0.5');
    });

    test('round-trips runtime descriptor metadata and numeric-looking raw strings', () => {
        const original = parseCircuitDocument(runtimeDescriptorSource, { filename: 'runtime-descriptor.schx' });
        const yaml = serializeInterchangeYaml(original, {
            filename: 'runtime-descriptor.schx',
            sourceFormat: 'schx',
        });

        const parsed = parseInterchangeYaml(yaml);
        const delay = parsed.components.find((component) => component.id === 'U1');
        const reverb = parsed.components.find((component) => component.id === 'U2');
        const feedback = delay?.properties.Feedback;

        expect(delay?.sourceTypeName).toBe('Circuit.MicroBlockDelayChip');
        expect(reverb?.sourceTypeName).toBe('Circuit.MicroBlockReverb');
        expect(delay?.terminals.map((terminal) => terminal.name)).toEqual(['input', 'output']);
        expect(reverb?.terminals.map((terminal) => terminal.name)).toEqual(['input', 'output']);
        expect(delay?.properties.RuntimeDescriptor).toBe('true');
        expect(reverb?.properties.RuntimeDescriptor).toBe('true');
        expect(delay?.properties.StereoOutputMode).toBe('WetDry');
        expect(reverb?.properties.StereoOutputMode).toBe('Spread');
        expect(delay?.properties.Level).toBe('1.0');
        if (feedback === undefined || typeof feedback === 'string') {
            throw new Error('Feedback should parse as a quantity');
        }
        expect(feedback.raw).toBe('1e-12');
        expect(parsed.warnings.filter((warning) => warning.code === 'runtime-descriptor-imported')).toHaveLength(2);
    });

    test('preserves source provenance fields through parse and serialize', () => {
        const yaml = `schema: circuit-interchange/v1
metadata:
  name: Boss DM-3
  description: Source-visible analog delay graph.
  partNumber: ''
source:
  format: schx
  filename: schematics/livespice/boss-dm-3.schx
  version: "sha256:0123456789abcdef"
  url: "https://example.test/BOSS-DM3_Schematic.pdf"
components: []
nodes: []
wires: []
directives: []
diagnostics: []
rawAttributes: {}`;

        const parsed = parseInterchangeYaml(yaml);
        const serialized = serializeInterchangeYaml(parsed);
        const reparsed = parseInterchangeYaml(serialized);

        expect(parsed.source).toEqual({
            format: 'schx',
            filename: 'schematics/livespice/boss-dm-3.schx',
            version: 'sha256:0123456789abcdef',
            url: 'https://example.test/BOSS-DM3_Schematic.pdf',
        });
        expect(reparsed.source).toEqual(parsed.source);
    });

    test('rejects YAML without the supported interchange schema', () => {
        expect(() => parseInterchangeYaml('schema: something-else\ncomponents: []\n')).toThrow(
            'unsupported interchange schema',
        );
    });
});
