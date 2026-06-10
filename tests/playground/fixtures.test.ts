import { describe, expect, test } from 'bun:test';
import { FIXTURES } from '../../playground/src/lib/fixtures';

describe('playground fixtures', () => {
    test('does not expose the focused ProCo RAT output-stage subset', () => {
        expect(FIXTURES.map((fixture) => fixture.id)).not.toContain('proco-rat-output-stage');
    });

    test('exposes the Fulltone OCD revision 3 fixture as a curated example', () => {
        const fixture = FIXTURES.find((candidate) => candidate.id === 'fulltone-ocd');

        expect(fixture?.title).toBe('Fulltone OCD revision 3');
        expect(fixture?.filename).toBe('fulltone-ocd.schx');
        expect(fixture?.group).toBe('custom');
    });

    test('exposes the TC Electronic Dark Matter fixture as a curated example', () => {
        const fixture = FIXTURES.find((candidate) => candidate.id === 'tc-electronic-dark-matter');

        expect(fixture?.title).toBe('TC Electronic Dark Matter Distortion');
        expect(fixture?.filename).toBe('tc-electronic-dark-matter.schx');
        expect(fixture?.group).toBe('custom');
    });
});
