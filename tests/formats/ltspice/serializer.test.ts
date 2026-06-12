import { describe, expect, test } from 'bun:test';
import { parseLtspiceAsc } from '../../../packages/core/src/formats/ltspice/parser';
import { serializeLtspiceAsc } from '../../../packages/core/src/formats/ltspice/serializer';
import { resolveConnectivity, getPinNode } from '../../../packages/core/src/model/connectivity';

const SIMPLE_ASC_URL = new URL('../../fixtures/asc/simple-rc.asc', import.meta.url);

describe('serializeLtspiceAsc', () => {
    test('emits a parseable LTspice schematic with symbols, flags, I/O pins, wires, and directives', async () => {
        const original = parseLtspiceAsc(await Bun.file(SIMPLE_ASC_URL).text());
        const asc = serializeLtspiceAsc(original);

        expect(asc).toContain('Version 4');
        expect(asc).toContain('SHEET 1 880 680');
        expect(asc).toContain('SYMBOL res');
        expect(asc).toContain('SYMATTR InstName R1');
        expect(asc).toContain('SYMBOL cap');
        expect(asc).toContain('FLAG');
        expect(asc).toContain('IOPIN');
        expect(asc).toContain('TEXT');
        expect(asc).toContain('!.tran 100m');

        const rebuilt = parseLtspiceAsc(asc);
        const connectivity = resolveConnectivity(rebuilt);

        expect(rebuilt.components.some((component) => component.id === 'R1' && component.kind === 'resistor')).toBe(true);
        expect(rebuilt.components.some((component) => component.id === 'C1' && component.kind === 'capacitor')).toBe(true);
        expect(rebuilt.components.some((component) => component.id === 'IN' && component.kind === 'jack')).toBe(true);
        expect(getPinNode(connectivity, { componentId: 'C1', terminalName: 'b' })).toBe(
            getPinNode(connectivity, { componentId: 'GND', terminalName: 't' }),
        );
    });
});
