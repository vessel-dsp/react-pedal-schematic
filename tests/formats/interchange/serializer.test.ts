import { describe, expect, test } from 'bun:test';
import { parseCircuitDocument, serializeInterchangeYaml } from '../../../src';

const source = `<?xml version="1.0" encoding="utf-8"?>
<Schematic Name="Test filter">
  <Element Type="Circuit.Symbol, Circuit" Position="0,0" Rotation="0" Flip="false">
    <Component _Type="Circuit.Resistor, Circuit" Name="R1" Resistance="10 kΩ" />
  </Element>
  <Element Type="Circuit.Symbol, Circuit" Position="0,80" Rotation="0" Flip="false">
    <Component _Type="Circuit.Ground, Circuit" Name="GND" />
  </Element>
  <Element Type="Circuit.Wire, Circuit" A="0,20" B="0,80" />
</Schematic>`;

describe('serializeInterchangeYaml', () => {
    test('emits a versioned LLM-friendly YAML interchange view with explicit nodes', () => {
        const doc = parseCircuitDocument(source, { filename: 'test-filter.schx' });
        const yaml = serializeInterchangeYaml(doc, {
            filename: 'test-filter.schx',
            sourceFormat: 'schx',
        });

        expect(yaml).toContain('schema: circuit-interchange/v1');
        expect(yaml).toContain('format: schx');
        expect(yaml).toContain('filename: test-filter.schx');
        expect(yaml).toContain('components:');
        expect(yaml).toContain('id: R1');
        expect(yaml).toContain('kind: resistor');
        expect(yaml).toContain('node: 0');
        expect(yaml).toContain('raw: "10 kΩ"');
        expect(yaml).toContain('value: 10000');
        expect(yaml).toContain('unit: "Ω"');
        expect(yaml).toContain('nodes:');
        expect(yaml).toContain('role: ground');
        expect(yaml).toContain('members:');
        expect(yaml).toContain('componentId: GND');
    });
});
