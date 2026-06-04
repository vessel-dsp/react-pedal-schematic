import { describe, expect, test } from 'bun:test';
import { detectCircuitFormat, parseCircuitDocument } from '../../src/formats/document';

const SIMPLE_ASC_URL = new URL('../fixtures/asc/simple-rc.asc', import.meta.url);

describe('circuit format dispatch', () => {
    test('detects supported file extensions', () => {
        expect(detectCircuitFormat('gain-stage.schx')).toBe('schx');
        expect(detectCircuitFormat('gain-stage.cir')).toBe('spice');
        expect(detectCircuitFormat('gain-stage.net')).toBe('spice');
        expect(detectCircuitFormat('gain-stage.spice')).toBe('spice');
        expect(detectCircuitFormat('gain-stage.ASC')).toBe('ltspice-asc');
        expect(detectCircuitFormat('README.md')).toBeNull();
    });

    test('parses an LTspice .asc file by extension', async () => {
        const source = await Bun.file(SIMPLE_ASC_URL).text();
        const doc = parseCircuitDocument(source, { filename: 'simple-rc.asc' });

        expect(doc.rawAttributes.format).toBe('ltspice-asc');
        expect(doc.components.some((component) => component.id === 'R1' && component.kind === 'resistor')).toBe(true);
    });

    test('throws on unsupported file extensions', () => {
        expect(() => parseCircuitDocument('', { filename: 'notes.txt' })).toThrow(/unsupported circuit format/i);
    });
});
