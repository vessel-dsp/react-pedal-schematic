import { describe, expect, test } from 'bun:test';
import { any_circuit_element } from 'circuit-json';
import {
    convertCircuitDocumentFile,
    parseCircuitDocumentFile,
    serializeCircuitDocumentFile,
} from '../../../packages/core/src/formats/document';
import {
    parseCircuitJsonDocument,
    serializeCircuitJsonDocument,
} from '../../../packages/core/src/formats/circuit-json/serializer';
import { parseSchx } from '../../../packages/core/src/formats/schx/parser';
import { parseLtspiceAsc } from '../../../packages/core/src/formats/ltspice/parser';

const SIMPLE_ASC_URL = new URL('../../fixtures/asc/simple-rc.asc', import.meta.url);
const SIMPLE_SCHX_URL = new URL('../../fixtures/schx/passive-lowpass.schx', import.meta.url);
const SIMPLE_VDSP_URL = new URL('../../fixtures/interchange/voltage-divider.vdsp', import.meta.url);

describe('Circuit JSON conversion round trips', () => {
    test('serializes every emitted element through the official circuit-json schema', async () => {
        const doc = parseCircuitDocumentFile(await Bun.file(SIMPLE_SCHX_URL).text(), {
            filename: 'passive-lowpass.schx',
        });
        const circuitJson = serializeCircuitJsonDocument(doc);

        expect(circuitJson.elements.length).toBeGreaterThan(0);
        for (const element of circuitJson.elements) {
            expect(any_circuit_element.safeParse(element).success).toBe(true);
        }
    });

    test('.vdsp converts through Circuit JSON and back to .vdsp', async () => {
        const vdsp = await Bun.file(SIMPLE_VDSP_URL).text();
        const circuitJsonText = convertCircuitDocumentFile(vdsp, {
            inputFilename: 'voltage-divider-vdsp.vdsp',
            outputFormat: 'circuit-json',
            outputFilename: 'voltage-divider.circuit.json',
        });
        const rebuiltVdsp = convertCircuitDocumentFile(circuitJsonText, {
            inputFilename: 'voltage-divider.circuit.json',
            outputFormat: 'vdsp',
            outputFilename: 'voltage-divider-roundtrip.vdsp',
        });
        const rebuilt = parseCircuitDocumentFile(rebuiltVdsp, { filename: 'voltage-divider-roundtrip.vdsp' });

        expect(rebuilt.components.some((component) => component.kind === 'resistor')).toBe(true);
        expect(rebuilt.components).toHaveLength(3);
    });

    test('.schx converts through Circuit JSON and back to parseable .schx', async () => {
        const source = await Bun.file(SIMPLE_SCHX_URL).text();
        const doc = parseSchx(source);
        const rebuiltSchx = serializeCircuitDocumentFile(parseCircuitJsonDocument(
            serializeCircuitJsonDocument(doc).elements,
        ), { format: 'schx', filename: 'roundtrip.schx' });
        const rebuilt = parseSchx(rebuiltSchx);

        expect(rebuilt.components.length).toBe(doc.components.length);
        expect(rebuilt.wires.length).toBeGreaterThan(0);
    });

    test('.asc converts through Circuit JSON and back to parseable .asc', async () => {
        const source = await Bun.file(SIMPLE_ASC_URL).text();
        const doc = parseLtspiceAsc(source);
        const rebuiltAsc = serializeCircuitDocumentFile(parseCircuitJsonDocument(
            serializeCircuitJsonDocument(doc).elements,
        ), { format: 'ltspice-asc', filename: 'roundtrip.asc' });
        const rebuilt = parseLtspiceAsc(rebuiltAsc);

        expect(rebuilt.components.some((component) => component.id === 'R1' && component.kind === 'resistor')).toBe(true);
        expect(rebuilt.components.some((component) => component.id === 'IN' && component.kind === 'jack')).toBe(true);
        expect(rebuilt.directives).toContain('.tran 100m');
    });
});
