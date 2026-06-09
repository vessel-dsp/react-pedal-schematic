import { describe, expect, test } from 'bun:test';
import { parseSchx } from '../../../src/formats/schx/parser';
import { getPinNode, resolveConnectivity } from '../../../src/model/connectivity';

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

    test('maps MicroBlockOverdriveStage as an opaque two-terminal IC descriptor', () => {
        const xml = makeSchx(`  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="-300,140">
    <Component _Type="Circuit.Input, ${ASSEMBLY}" V0dBFS="1 V" Name="V1" />
  </Element>
  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="-300,240">
    <Component _Type="Circuit.Ground, ${ASSEMBLY}" Name="GND1" />
  </Element>
  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="0,140">
    <Component _Type="Circuit.MicroBlockOverdriveStage, ${ASSEMBLY}" Chip="JRC4558D" ClipMode="FeedbackSoftClip" ClipThreshold="0.65 V" InputHighpassHz="16 Hz" OutputLowpassHz="1500 Hz" MinDriveGain="1" MaxDriveGain="110" DriveControl="Drive" DriveControlWipe="0.4" DriveControlSweep="Logarithmic" MinToneHz="500" MaxToneHz="5000" ToneControl="Tone" ToneControlWipe="0.5" ToneControlSweep="Linear" Name="U1" />
  </Element>
  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="200,140">
    <Component _Type="Circuit.Speaker, ${ASSEMBLY}" V0dBFS="1 V" Impedance="∞ Ω" Name="S1" />
  </Element>
  <Element Type="${WIRE_T}" A="-300,160" B="-300,240" />
  <Element Type="${WIRE_T}" A="-300,240" B="200,240" />
  <Element Type="${WIRE_T}" A="200,160" B="200,240" />
  <Element Type="${WIRE_T}" A="-300,120" B="0,120" />
  <Element Type="${WIRE_T}" A="0,160" B="40,160" />
  <Element Type="${WIRE_T}" A="40,160" B="40,120" />
  <Element Type="${WIRE_T}" A="40,120" B="200,120" />`);

        const doc = parseSchx(xml);
        const microblock = doc.components.find((component) => component.id === 'U1');

        expect(microblock?.kind).toBe('ic');
        expect(microblock?.sourceTypeName).toContain('Circuit.MicroBlockOverdriveStage');
        expect(microblock?.terminals).toEqual([
            { name: 'in', position: { x: 0, y: 120 } },
            { name: 'out', position: { x: 0, y: 160 } },
        ]);
        expect(doc.warnings.some((warning) => warning.code === 'unknown-component-type')).toBe(false);
        expect(microblock?.properties.Chip).toBe('JRC4558D');
        expect(microblock?.properties.ClipMode).toBe('FeedbackSoftClip');
        expect(microblock?.properties.ClipThreshold).toMatchObject({ value: 0.65, unit: 'V' });
        expect(microblock?.properties.DriveControl).toBe('Drive');
        expect(microblock?.properties.DriveControlWipe).toMatchObject({ value: 0.4, unit: '' });

        const connectivity = resolveConnectivity(doc);
        expect(getPinNode(connectivity, { componentId: 'U1', terminalName: 'in' })).toBe(
            getPinNode(connectivity, { componentId: 'V1', terminalName: 'a' }),
        );
        expect(getPinNode(connectivity, { componentId: 'U1', terminalName: 'out' })).toBe(
            getPinNode(connectivity, { componentId: 'S1', terminalName: 'a' }),
        );
    });

    test('maps other MicroBlock stage descriptors as opaque two-terminal ICs', () => {
        const xml = makeSchx(`  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="-300,140">
    <Component _Type="Circuit.Input, ${ASSEMBLY}" Name="V1" />
  </Element>
  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="0,140">
    <Component _Type="Circuit.MicroBlockReverbStage, ${ASSEMBLY}" Algorithm="DigitalHall" DecaySeconds="2.4 s" MixControl="Mix" MixControlWipe="0.35" Name="U1" />
  </Element>
  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="200,140">
    <Component _Type="Circuit.Speaker, ${ASSEMBLY}" Name="S1" />
  </Element>
  <Element Type="${WIRE_T}" A="-300,120" B="0,120" />
  <Element Type="${WIRE_T}" A="0,160" B="200,120" />`);

        const doc = parseSchx(xml);
        const microblock = doc.components.find((component) => component.id === 'U1');

        expect(microblock?.kind).toBe('ic');
        expect(microblock?.sourceTypeName).toContain('Circuit.MicroBlockReverbStage');
        expect(microblock?.terminals).toEqual([
            { name: 'in', position: { x: 0, y: 120 } },
            { name: 'out', position: { x: 0, y: 160 } },
        ]);
        expect(microblock?.properties.Algorithm).toBe('DigitalHall');
        expect(microblock?.properties.DecaySeconds).toMatchObject({ value: 2.4, unit: 's' });
        expect(microblock?.properties.MixControl).toBe('Mix');
        expect(microblock?.properties.MixControlWipe).toMatchObject({ value: 0.35, unit: '' });
        expect(doc.warnings.some((warning) => warning.code === 'unknown-component-type')).toBe(false);
    });

    test('maps audio-engine runtime descriptors as stable opaque input/output ICs', () => {
        const xml = makeSchx(`  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="-300,140">
    <Component _Type="Circuit.Input, ${ASSEMBLY}" Name="V1" />
  </Element>
  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="0,140">
    <Component _Type="Circuit.MicroBlockDelayChip, ${ASSEMBLY}" Profile="BbdMn3007Style" StereoOutputMode="WetDry" DelayMs="13" Level="1.0" Name="U1" />
  </Element>
  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="200,140">
    <Component _Type="Circuit.MicroBlockReverb, ${ASSEMBLY}" Profile="hall-style" StereoOutputMode="Spread" PreDelayMs="22" Decay="0.72" Name="U2" />
  </Element>
  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="400,140">
    <Component _Type="Circuit.MacroTremolo, ${ASSEMBLY}" RateHz="4" Level="1" Name="U3" />
  </Element>
  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="600,140">
    <Component _Type="Circuit.MacroPhaser, ${ASSEMBLY}" StageCount="4" Feedback="0.15" Name="U4" />
  </Element>
  <Element Type="${SYMBOL_T}" Rotation="0" Flip="false" Position="800,140">
    <Component _Type="Circuit.Speaker, ${ASSEMBLY}" Name="S1" />
  </Element>
  <Element Type="${WIRE_T}" A="-300,120" B="0,120" />
  <Element Type="${WIRE_T}" A="0,160" B="200,120" />
  <Element Type="${WIRE_T}" A="200,160" B="400,120" />
  <Element Type="${WIRE_T}" A="400,160" B="600,120" />
  <Element Type="${WIRE_T}" A="600,160" B="800,120" />`);

        const doc = parseSchx(xml);
        const runtimeDescriptors = ['U1', 'U2', 'U3', 'U4'].map((id) => {
            const component = doc.components.find((candidate) => candidate.id === id);
            if (component === undefined) {
                throw new Error(`Missing runtime descriptor ${id}`);
            }
            return component;
        });

        expect(doc.warnings.some((warning) => warning.code === 'unknown-component-type')).toBe(false);
        expect(doc.warnings.filter((warning) => warning.code === 'runtime-descriptor-imported').map((warning) => warning.componentId)).toEqual([
            'U1',
            'U2',
            'U3',
            'U4',
        ]);

        expect(runtimeDescriptors.map((component) => component?.kind)).toEqual(['ic', 'ic', 'ic', 'ic']);
        expect(runtimeDescriptors.map((component) => component?.sourceTypeName)).toEqual([
            'Circuit.MicroBlockDelayChip',
            'Circuit.MicroBlockReverb',
            'Circuit.MacroTremolo',
            'Circuit.MacroPhaser',
        ]);
        for (const component of runtimeDescriptors) {
            expect(component.terminals).toEqual([
                { name: 'input', position: { x: component.origin.x, y: 120 } },
                { name: 'output', position: { x: component.origin.x, y: 160 } },
            ]);
            expect(component.properties.RuntimeDescriptor).toBe('true');
        }
        expect(doc.components.find((component) => component.id === 'U1')?.properties.StereoOutputMode).toBe('WetDry');
        expect(doc.components.find((component) => component.id === 'U2')?.properties.StereoOutputMode).toBe('Spread');

        const connectivity = resolveConnectivity(doc);
        expect(getPinNode(connectivity, { componentId: 'U1', terminalName: 'input' })).toBe(
            getPinNode(connectivity, { componentId: 'V1', terminalName: 'a' }),
        );
        expect(getPinNode(connectivity, { componentId: 'U4', terminalName: 'output' })).toBe(
            getPinNode(connectivity, { componentId: 'S1', terminalName: 'a' }),
        );
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
