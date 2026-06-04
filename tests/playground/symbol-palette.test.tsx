import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyPaletteDragImage, SymbolPalette } from '../../playground/src/components/symbol-palette';

describe('SymbolPalette drag preview', () => {
    test('renders offscreen symbol-only drag preview elements for palette tiles', () => {
        const markup = renderToStaticMarkup(createElement(SymbolPalette));

        expect(markup).toContain('data-drag-preview="symbol"');
        expect(markup).toContain('-left-[1000px]');
        expect(markup).toContain('-top-[1000px]');
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
