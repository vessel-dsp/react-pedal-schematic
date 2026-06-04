import { describe, expect, test } from 'bun:test';
import { FIXTURES } from '../../playground/src/lib/fixtures';

describe('playground fixtures', () => {
    test('does not expose the focused ProCo RAT output-stage subset', () => {
        expect(FIXTURES.map((fixture) => fixture.id)).not.toContain('proco-rat-output-stage');
    });
});
