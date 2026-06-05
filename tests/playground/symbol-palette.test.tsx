import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyPaletteDragImage, SymbolPalette } from '../../playground/src/components/symbol-palette';

function tileMarkup(markup: string, label: string): string {
    const start = markup.indexOf(`title="${label} — drag onto canvas"`);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = markup.indexOf('<span', start);
    expect(end).toBeGreaterThan(start);
    return markup.slice(start, end);
}

describe('SymbolPalette drag preview', () => {
    test('renders offscreen symbol-only drag preview elements for palette tiles', () => {
        const markup = renderToStaticMarkup(createElement(SymbolPalette));

        expect(markup).toContain('data-drag-preview="symbol"');
        expect(markup).toContain('-left-[1000px]');
        expect(markup).toContain('-top-[1000px]');
    });

    test('keeps the symbol library internally scrollable instead of growing the page', () => {
        const markup = renderToStaticMarkup(createElement(SymbolPalette));

        expect(markup).toContain('data-symbol-library-scroll="true"');
        expect(markup).toContain('overflow-y-auto');
        expect(markup).toContain('max-h-[calc(100vh-18rem)]');
    });

    test('renders potentiometer palette icons on the same square scale as neighboring passives', () => {
        const markup = renderToStaticMarkup(createElement(SymbolPalette));
        const potentiometer = tileMarkup(markup, 'Potentiometer');

        expect(potentiometer).toContain('<svg viewBox="-25 -25 50 50"');
        expect(potentiometer).toContain('<rect x="-24" y="-24" width="48" height="48"');
        expect(potentiometer).not.toContain('viewBox="-25 -45 50 90"');
    });

    test('uses the symbol-only preview as the browser drag image', () => {
        const preview = {} as Element;
        const calls: Array<{ element: Element; x: number; y: number }> = [];
        const dataTransfer = {
            setDragImage(element: Element, x: number, y: number): void {
                calls.push({ element, x, y });
            },
        } as DataTransfer;

        applyPaletteDragImage({ dataTransfer }, preview);

        expect(calls).toEqual([{ element: preview, x: 20, y: 20 }]);
    });
});
