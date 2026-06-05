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

    test('rejects YAML without the supported interchange schema', () => {
        expect(() => parseInterchangeYaml('schema: something-else\ncomponents: []\n')).toThrow(
            'unsupported interchange schema',
        );
    });
});
