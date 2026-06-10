import { describe, expect, test } from 'bun:test';
import { FIXTURES } from '../../playground/src/lib/fixtures';

describe('playground fixtures', () => {
    test('does not expose the focused ProCo RAT output-stage subset', () => {
        expect(FIXTURES.map((fixture) => fixture.id)).not.toContain('proco-rat-output-stage');
    });

    test('exposes the Fulltone OCD analysis fixture as a curated example', () => {
        const fixture = FIXTURES.find((candidate) => candidate.id === 'fulltone-ocd');

        expect(fixture?.title).toBe('Fulltone OCD analysis');
        expect(fixture?.filename).toBe('fulltone-ocd.schx');
        expect(fixture?.group).toBe('custom');
    });
});
