import { describe, expect, test } from 'bun:test';
import { VERSION } from '../src/index';
import { UI_VERSION } from '../src/ui/index';

describe('entrypoints', () => {
    test('headless exposes a version string', () => {
        expect(typeof VERSION).toBe('string');
        expect(VERSION.length).toBeGreaterThan(0);
    });

    test('ui exposes a version string', () => {
        expect(typeof UI_VERSION).toBe('string');
        expect(UI_VERSION.length).toBeGreaterThan(0);
    });
});

describe('headless boundary', () => {
    test('src/index.ts does not import from src/ui', async () => {
        const file = Bun.file(new URL('../src/index.ts', import.meta.url));
        const source = await file.text();
        expect(source).not.toMatch(/from\s+['"][^'"]*\/ui[\/'"]/);
        expect(source).not.toMatch(/from\s+['"]react['"]/);
        expect(source).not.toMatch(/from\s+['"]react-dom['"]/);
    });
});
