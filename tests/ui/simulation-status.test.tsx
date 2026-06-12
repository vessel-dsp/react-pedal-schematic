import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationStatus, type SimulationStatusProps } from '../../packages/react-component/src/simulation-status';

function renderStatus(props: SimulationStatusProps): string {
    return renderToStaticMarkup(createElement(SimulationStatus, props));
}

describe('SimulationStatus', () => {
    test('renders a ready program summary', () => {
        const markup = renderStatus({
            ready: true,
            runtimeState: 'ready',
            diagnostics: [],
            componentSupport: new Map([
                ['R1', 'static-netlist'],
                ['C1', 'realtime-mna'],
            ]),
        });

        expect(markup).toContain('data-simulation-status-state="ready"');
        expect(markup).toContain('Ready');
        expect(markup).toContain('0 diagnostics');
        expect(markup).toContain('Static netlist');
        expect(markup).toContain('Realtime MNA');
    });

    test('renders unsupported diagnostics as a blocked state', () => {
        const markup = renderStatus({
            ready: false,
            diagnostics: [{
                code: 'unsupported-component',
                severity: 'error',
                message: 'U1: ltspice:foo is not supported by simulation V1',
                componentId: 'U1',
            }],
            componentSupport: new Map([
                ['U1', 'unsupported'],
            ]),
        });

        expect(markup).toContain('data-simulation-status-state="unsupported"');
        expect(markup).toContain('Unsupported');
        expect(markup).toContain('unsupported-component');
        expect(markup).toContain('U1: ltspice:foo is not supported by simulation V1');
    });

    test('renders missing runtime for a ready document without an adapter', () => {
        const markup = renderStatus({
            ready: true,
            runtimeState: 'missing-runtime',
            diagnostics: [],
            componentSupport: new Map(),
        });

        expect(markup).toContain('data-simulation-status-state="missing-runtime"');
        expect(markup).toContain('Missing runtime');
        expect(markup).toContain('No runtime adapter');
    });

    test('renders running state', () => {
        const markup = renderStatus({
            ready: true,
            runtimeState: 'running',
            diagnostics: [],
            componentSupport: new Map(),
        });

        expect(markup).toContain('data-simulation-status-state="running"');
        expect(markup).toContain('Running');
    });

    test('renders failed runtime state with its error', () => {
        const markup = renderStatus({
            ready: true,
            runtimeState: 'failed',
            runtimeError: 'WASM boot failed',
            diagnostics: [],
            componentSupport: new Map(),
        });

        expect(markup).toContain('data-simulation-status-state="failed"');
        expect(markup).toContain('Failed');
        expect(markup).toContain('WASM boot failed');
    });
});
