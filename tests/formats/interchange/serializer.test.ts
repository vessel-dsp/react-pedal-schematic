import { describe, expect, test } from 'bun:test';
import { EMPTY_DOCUMENT, parseCircuitDocument, serializeInterchangeYaml, type CircuitDocument } from '../../../src';

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

    test('serializes external control interface metadata with binding details', () => {
        const doc: CircuitDocument = {
            ...EMPTY_DOCUMENT,
            metadata: {
                name: 'DD-3 control interface',
                description: 'External trigger/reset controls.',
                partNumber: '',
            },
            controlInterfaces: [{
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
                description: 'External sampler record/play trigger input.',
            }],
        };

        const yaml = serializeInterchangeYaml(doc);

        expect(yaml).toContain('controlInterfaces:');
        expect(yaml).toContain('id: trigger-input');
        expect(yaml).toContain('role: trigger');
        expect(yaml).toContain('controlRole: sampler-trigger');
        expect(yaml).toContain('interface: external-control-input');
        expect(yaml).toContain('connector: "1/4-inch-mono-ts"');
        expect(yaml).toContain('assignmentHint: momentary-or-latching');
        expect(yaml).toContain('polarity: normally-open');
        expect(yaml).toContain('sourceComponentId: U1');
        expect(yaml).toContain('controlId: "U1:sampler-trigger"');
        expect(yaml).toContain('controlName: TRIGGER');
        expect(yaml).toContain('property: SamplerTriggerControl');
    });
});
