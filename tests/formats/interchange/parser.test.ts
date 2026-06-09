import { describe, expect, test } from 'bun:test';
import { parseCircuitDocument, parseInterchangeYaml, serializeInterchangeYaml } from '../../../src';

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

    test('rejects YAML without the supported interchange schema', () => {
        expect(() => parseInterchangeYaml('schema: something-else\ncomponents: []\n')).toThrow(
            'unsupported interchange schema',
        );
    });
});
