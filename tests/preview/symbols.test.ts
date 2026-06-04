import { describe, expect, test } from 'bun:test';
import { COMPONENT_KINDS, symbolFor } from '../../src/preview/symbols';

function countOccurrences(haystack: string, needle: string): number {
    let n = 0;
    let i = 0;
    while ((i = haystack.indexOf(needle, i)) !== -1) {
        n += 1;
        i += needle.length;
    }
    return n;
}

describe('symbolFor', () => {
    test('returns SVG content for every ComponentKind', () => {
        for (const kind of COMPONENT_KINDS) {
            const def = symbolFor(kind);
            expect(def).toBeDefined();
            expect(typeof def.content).toBe('string');
            expect(typeof def.viewBox).toBe('string');
            if (kind === 'label') {
                // label is text-only; its SVG body is empty by design.
                continue;
            }
            expect(def.content.length).toBeGreaterThan(0);
        }
    });

    test('distinguishes Input vs Speaker jacks via sourceTypeName', () => {
        const input = symbolFor('jack', 'Circuit.Input, Circuit, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null');
        const speaker = symbolFor('jack', 'Circuit.Speaker, Circuit, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null');
        expect(input.content).toContain('INPUT');
        expect(speaker.content).toContain('OUTPUT');
    });

    test('distinguishes LTspice input vs output jacks via sourceTypeName', () => {
        const input = symbolFor('jack', 'ltspice:InputJack');
        const output = symbolFor('jack', 'ltspice:OutputJack');
        expect(input.content).toContain('INPUT');
        expect(output.content).toContain('OUTPUT');
    });

    test('renders output jacks as the horizontal mirror of input jacks', () => {
        const input = symbolFor('jack', 'ltspice:InputJack');
        const output = symbolFor('jack', 'ltspice:OutputJack');

        expect(input.content).toContain('<rect x="-15" y="-7" width="6" height="14"');
        expect(input.content).toContain('<line x1="-9" y1="-3" x2="0" y2="-3"');
        expect(output.content).toContain('<rect x="9" y="-7" width="6" height="14"');
        expect(output.content).toContain('<line x1="0" y1="-3" x2="9" y2="-3"');
    });

    test('renders SPDT and 3PDT switch source types as multi-contact switch glyphs', () => {
        const generic = symbolFor('switch');
        const spdt = symbolFor('switch', 'Circuit.SPDT, Circuit, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null');
        const threePdt = symbolFor('switch', 'Circuit.3PDT, Circuit, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null');

        expect(countOccurrences(generic.content, '<circle')).toBe(2);
        expect(countOccurrences(spdt.content, '<circle')).toBe(3);
        expect(countOccurrences(threePdt.content, '<circle')).toBe(9);
    });

    test('distinguishes BJT NPN vs PNP via sourceTypeName', () => {
        const npn = symbolFor('bjt', 'Circuit.NpnBjt, Circuit, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null');
        const pnp = symbolFor('bjt', 'Circuit.PnpBjt, Circuit, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null');
        expect(npn.content).not.toBe(pnp.content);
        expect(pnp.content).toContain('PNP variant');
        expect(npn.content).toContain('NPN variant');
    });

    test('renders LED with emission arrow primitives', () => {
        const diode = symbolFor('diode');
        const led = symbolFor('led');
        // LED has the diode body plus two emission arrows (each ~3 lines: shaft + 2 head wings).
        const diodeLines = countOccurrences(diode.content, '<line');
        const ledLines = countOccurrences(led.content, '<line');
        expect(ledLines).toBeGreaterThan(diodeLines);
        expect(ledLines - diodeLines).toBeGreaterThanOrEqual(4);
    });

    test('falls back to a question-mark badge for unsupported', () => {
        const def = symbolFor('unsupported');
        expect(def.content).toContain('?');
    });
});
