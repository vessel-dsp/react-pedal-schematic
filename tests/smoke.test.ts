import { describe, expect, test } from 'bun:test';
import { VERSION } from '@vessel-dsp/core';
import { UI_VERSION } from '@vessel-dsp/react-component';
import { SIMULATION_VERSION } from '@vessel-dsp/simulation';

describe('entrypoints', () => {
    test('core exposes a version string', () => {
        expect(typeof VERSION).toBe('string');
        expect(VERSION.length).toBeGreaterThan(0);
    });

    test('React package exposes a version string', () => {
        expect(typeof UI_VERSION).toBe('string');
        expect(UI_VERSION.length).toBeGreaterThan(0);
    });

    test('simulation package exposes a version string', () => {
        expect(typeof SIMULATION_VERSION).toBe('string');
        expect(SIMULATION_VERSION.length).toBeGreaterThan(0);
    });
});

describe('headless boundaries', () => {
    test('core entrypoint does not import React or browser audio globals', async () => {
        const source = await Bun.file(new URL('../packages/core/src/index.ts', import.meta.url)).text();
        expect(source).not.toMatch(/from\s+['"][^'"]*react[^'"]*['"]/);
        expect(source).not.toMatch(/from\s+['"][^'"]*react-dom[^'"]*['"]/);
        expect(source).not.toContain('AudioContext');
        expect(source).not.toContain('AudioWorklet');
    });

    test('simulation root entrypoint does not import React or browser audio globals', async () => {
        const source = await Bun.file(new URL('../packages/simulation/src/index.ts', import.meta.url)).text();
        expect(source).not.toMatch(/from\s+['"][^'"]*react[^'"]*['"]/);
        expect(source).not.toMatch(/from\s+['"][^'"]*react-dom[^'"]*['"]/);
        expect(source).not.toContain('AudioContext');
        expect(source).not.toContain('AudioWorklet');
    });
});
