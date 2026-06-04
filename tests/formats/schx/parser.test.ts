import { describe, expect, test } from 'bun:test';
import { parseSchx } from '../../../src/formats/schx/parser';

const ASSEMBLY = 'Circuit, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null';
const SYMBOL_T = `Circuit.Symbol, ${ASSEMBLY}`;
const WIRE_T = `Circuit.Wire, ${ASSEMBLY}`;

function makeSchx(body: string, attrs = 'Name="test" Description="" PartNumber=""'): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<Schematic ${attrs}>
${body}
</Schematic>`;
}

describe('parseSchx', () => {
    test('rejects input without a Schematic root', () => {
        expect(() => parseSchx('<NotASchematic />')).toThrow(/Schematic/);
    });

    test('parses metadata attributes on the root', () => {
        const doc = parseSchx(makeSchx('', 'Name="My Circuit" Description="A test" PartNumber="PN-001"'));
        expect(doc.metadata.name).toBe('My Circuit');
        expect(doc.metadata.description).toBe('A test');
        expect(doc.metadata.partNumber).toBe('PN-001');
    });

    test('strips a UTF-8 BOM', () => {
        const xml = '﻿' + makeSchx('');
        expect(() => parseSchx(xml)).not.toThrow();
    });

    test('parses a single resistor element', () => {
        const xml = makeSchx(`  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="100,200">
    <Component _Type="Circuit.Resistor, ${ASSEMBLY}" Resistance="10 kΩ" Name="R1" />
  </Element>`);
        const doc = parseSchx(xml);
        expect(doc.components).toHaveLength(1);
        const r = doc.components[0]!;
        expect(r.kind).toBe('resistor');
        expect(r.name).toBe('R1');
        expect(r.origin).toEqual({ x: 100, y: 200 });
        expect(r.rotation).toBe(0);
        expect(r.flipped).toBe(false);
        expect(r.terminals).toHaveLength(2);
        const resistance = r.properties.Resistance;
        expect(typeof resistance).toBe('object');
        expect(resistance).toHaveProperty('value', 10000);
        expect(resistance).toHaveProperty('unit', 'Ω');
    });

    test('parses a wire element', () => {
        const xml = makeSchx(`  <Element Type="${WIRE_T}" A="0,0" B="100,0" />`);
        const doc = parseSchx(xml);
        expect(doc.wires).toHaveLength(1);
        expect(doc.wires[0]?.endpoints).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    });

    test('normalizes negative rotation values', () => {
        const xml = makeSchx(`  <Element Type="${SYMBOL_T}" Rotation="-1" Flip="false" Position="0,0">
    <Component _Type="Circuit.Resistor, ${ASSEMBLY}" Resistance="10 kΩ" Name="R1" />
  </Element>`);
        const doc = parseSchx(xml);
        expect(doc.components[0]?.rotation).toBe(3);
    });

    test('treats unknown _Type as unsupported with a warning', () => {
        const xml = makeSchx(`  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="0,0">
    <Component _Type="Circuit.SomeMysteryThing, ${ASSEMBLY}" Name="X1" />
  </Element>`);
        const doc = parseSchx(xml);
        expect(doc.components[0]?.kind).toBe('unsupported');
        expect(doc.components[0]?.sourceTypeName).toContain('Circuit.SomeMysteryThing');
        expect(doc.warnings.some((w) => w.code === 'unknown-component-type')).toBe(true);
    });

    test('preserves unknown attributes on the inner Component', () => {
        const xml = makeSchx(`  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="0,0">
    <Component _Type="Circuit.Resistor, ${ASSEMBLY}" Resistance="1k" Tolerance="5%" PartCode="RC-101" Name="R1" />
  </Element>`);
        const doc = parseSchx(xml);
        const props = doc.components[0]?.properties ?? {};
        expect(props.Tolerance).toBe('5%');
        expect(props.PartCode).toBe('RC-101');
    });

    test('keeps Speaker with unparseable Impedance as a string property', () => {
        const xml = makeSchx(`  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="0,0">
    <Component _Type="Circuit.Speaker, ${ASSEMBLY}" Impedance="∞ Ω" Name="O1" />
  </Element>`);
        const doc = parseSchx(xml);
        const speaker = doc.components[0]!;
        expect(speaker.kind).toBe('jack');
        expect(speaker.properties.Impedance).toBe('∞ Ω');
    });

    test('maps LiveSPICE Diode Type=LED to LED kind', () => {
        const xml = makeSchx(`  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="0,0">
    <Component _Type="Circuit.Diode, ${ASSEMBLY}" Type="LED" IS="10 fA" Name="LED1" />
  </Element>`);
        const doc = parseSchx(xml);
        const led = doc.components[0]!;
        expect(led.kind).toBe('led');
        expect(led.sourceTypeName).toContain('Circuit.Diode');
        expect(led.properties.Type).toBe('LED');
        const saturationCurrent = led.properties.IS;
        if (saturationCurrent === undefined || typeof saturationCurrent === 'string') {
            throw new Error('LED IS should parse as a quantity');
        }
        expect(saturationCurrent.value).toBeCloseTo(1e-14);
        expect(saturationCurrent.unit).toBe('A');
        expect(led.terminals.map((terminal) => terminal.name)).toEqual(['anode', 'cathode']);
    });

    test('assigns unique ids when multiple components share a name', () => {
        const xml = makeSchx(`  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="0,0">
    <Component _Type="Circuit.Resistor, ${ASSEMBLY}" Resistance="1k" Name="R" />
  </Element>
  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="20,0">
    <Component _Type="Circuit.Resistor, ${ASSEMBLY}" Resistance="1k" Name="R" />
  </Element>`);
        const doc = parseSchx(xml);
        expect(doc.components.map((c) => c.id)).toEqual(['R', 'R-2']);
    });

    test('terminal positions reflect origin + rotation', () => {
        const xml = makeSchx(`  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="100,100">
    <Component _Type="Circuit.Resistor, ${ASSEMBLY}" Resistance="1k" Name="R1" />
  </Element>`);
        const doc = parseSchx(xml);
        const r = doc.components[0]!;
        // Resistor terminals: a at local (0,20), b at local (0,-20). Default y-flip: y = -local.y.
        // So a_world = (100, 100 - 20) = (100, 80), b_world = (100, 100 + 20) = (100, 120)
        expect(r.terminals[0]?.position).toEqual({ x: 100, y: 80 });
        expect(r.terminals[1]?.position).toEqual({ x: 100, y: 120 });
    });

    test('ignores XML comments', () => {
        const xml = makeSchx(`  <!-- this is a comment -->
  <Element Type="${WIRE_T}" A="0,0" B="10,0" />`);
        const doc = parseSchx(xml);
        expect(doc.wires).toHaveLength(1);
    });

    test('skips a malformed wire with a warning', () => {
        const xml = makeSchx(`  <Element Type="${WIRE_T}" A="not,coords" B="10,0" />`);
        const doc = parseSchx(xml);
        expect(doc.wires).toHaveLength(0);
        expect(doc.warnings.some((w) => w.code === 'invalid-wire')).toBe(true);
    });
});
