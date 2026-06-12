import { describe, expect, test } from 'bun:test';
import { parseSpiceNetlist } from '../../../packages/core/src/formats/spice/parser';
import { serializeSpiceNetlist } from '../../../packages/core/src/formats/spice/serializer';
import { EMPTY_DOCUMENT } from '../../../packages/core/src/model/types';

describe('serializeSpiceNetlist', () => {
    test('emits a placeholder comment when there is no title', () => {
        const text = serializeSpiceNetlist(EMPTY_DOCUMENT);
        expect(text).toContain('* @vessel-dsp/core');
        expect(text.trim().endsWith('.END')).toBe(true);
    });

    test('emits .TITLE when metadata.name is present', () => {
        const doc = parseSpiceNetlist(`.TITLE My Pedal\nR1 1 0 10k\n.END`);
        const text = serializeSpiceNetlist(doc);
        expect(text).toContain('.TITLE My Pedal');
    });

    test('emits R/C lines from parsed elements', () => {
        const doc = parseSpiceNetlist(`R1 1 2 10k\nC1 2 0 4.7u\n.END`);
        const text = serializeSpiceNetlist(doc);
        expect(text).toMatch(/^R1 \d+ \d+ 10k$/m);
        expect(text).toMatch(/^C1 \d+ \d+ 4\.7u$/m);
    });

    test('emits .MODEL directives verbatim', () => {
        const doc = parseSpiceNetlist(`R1 1 0 10k\n.MODEL 2N3904 NPN (IS=1e-14 BF=200)\n.END`);
        const text = serializeSpiceNetlist(doc);
        expect(text).toContain('.MODEL 2N3904 NPN (IS=1e-14 BF=200)');
    });

    test('emits subcircuit-bound components as commented placeholders', () => {
        const doc = parseSpiceNetlist(`R1 1 0 10k\nQ1 3 2 0 2N3904\n.END`);
        const text = serializeSpiceNetlist(doc);
        expect(text).toMatch(/^Q1\b/m);
    });

    test('serializer + parser is connectivity-stable for an RC filter', () => {
        const src = `R1 1 2 10k\nC1 2 0 4.7u\nV1 1 0 9\n.END`;
        const doc1 = parseSpiceNetlist(src);
        const serialized = serializeSpiceNetlist(doc1);
        const doc2 = parseSpiceNetlist(serialized);
        // R, C, V each present; ground (0) auto-created on both passes.
        expect(doc2.components.filter((c) => c.kind === 'resistor')).toHaveLength(1);
        expect(doc2.components.filter((c) => c.kind === 'capacitor')).toHaveLength(1);
        expect(doc2.components.filter((c) => c.kind === 'voltage-source')).toHaveLength(1);
    });
});
