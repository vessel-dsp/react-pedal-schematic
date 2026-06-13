import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    CONVERSION_DOC_FUNCTIONS,
    buildPages,
    renderPagesHtml,
} from '../../scripts/build-pages';

const CORE_CONVERSION_FUNCTIONS = [
    'detectCircuitDocumentFileFormat',
    'parseCircuitDocumentFile',
    'serializeCircuitDocumentFile',
    'convertCircuitDocumentFile',
    'convertCircuitDocumentFileWithReport',
    'serializeCircuitJsonDocument',
    'parseCircuitJsonDocument',
    'validateCircuitJsonDocument',
    'serializeLtspiceAsc',
    'parseVdspCircuitDocument',
    'serializeVdspCircuitDocument',
] as const;

describe('GitHub Pages core conversion docs', () => {
    test('documents only the core conversion functions', () => {
        expect(CONVERSION_DOC_FUNCTIONS.map((entry) => entry.name)).toEqual([...CORE_CONVERSION_FUNCTIONS]);

        const html = renderPagesHtml();

        for (const name of CORE_CONVERSION_FUNCTIONS) {
            expect(html).toContain(name);
        }

        expect(html).toContain('.vdsp');
        expect(html).toContain('circuit-interchange/v3');
        expect(html).toContain('drop-with-diagnostics');
        expect(html).toContain('board realizations');
        expect(html).toContain('.asc');
        expect(html).toContain('.schx');
        expect(html).toContain('.circuit.json');
        expect(html).not.toMatch(/playground/i);
        expect(html).not.toMatch(/workbench/i);
        expect(html).not.toMatch(/upload fixture/i);
        expect(html).not.toMatch(/@tscircuit\/runframe/i);
    });

    test('buildPages writes a static gh-pages index', async () => {
        const outputDir = mkdtempSync(join(tmpdir(), 'vessel-dsp-pages-'));
        try {
            await buildPages(outputDir);
            const html = readFileSync(join(outputDir, 'index.html'), 'utf8');

            expect(html).toContain('<!doctype html>');
            expect(html).toContain('@vessel-dsp/core');
            expect(html).toContain('convertCircuitDocumentFile');
            expect(html).toContain('convertCircuitDocumentFileWithReport');
            expect(html).not.toMatch(/<script\b/i);
        } finally {
            rmSync(outputDir, { recursive: true, force: true });
        }
    });
});
