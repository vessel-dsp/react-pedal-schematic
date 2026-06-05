import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../playground/src/components/ui/tabs';

describe('playground Tabs', () => {
    test('hides inactive force-mounted tab content', () => {
        const markup = renderToStaticMarkup(
            createElement(
                Tabs,
                { defaultValue: 'source' },
                createElement(
                    TabsList,
                    null,
                    createElement(TabsTrigger, { value: 'source' }, 'Source'),
                    createElement(TabsTrigger, { value: 'live-panel' }, 'Live Panel'),
                ),
                createElement(TabsContent, { value: 'source' }, 'source content'),
                createElement(TabsContent, { value: 'live-panel', forceMount: true }, 'live panel content'),
            ),
        );

        expect(markup).toContain('data-state="inactive"');
        expect(markup).toContain('live panel content');
        expect(markup).toContain('data-[state=inactive]:hidden');
    });
});
