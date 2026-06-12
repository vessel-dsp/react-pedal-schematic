import type { ReactElement } from 'react';

export type SimulationStatusSupportLevel =
    | 'unsupported'
    | 'static-netlist'
    | 'realtime-runtime-descriptor'
    | 'realtime-mna';

export type SimulationStatusRuntimeState =
    | 'ready'
    | 'missing-runtime'
    | 'running'
    | 'failed';

export type SimulationStatusDiagnostic = Readonly<{
    code: string;
    severity: 'warning' | 'error';
    message: string;
    componentId?: string;
    nodeId?: number;
    directive?: string;
}>;

export type SimulationStatusProps = Readonly<{
    ready: boolean;
    diagnostics: readonly SimulationStatusDiagnostic[];
    componentSupport?: ReadonlyMap<string, SimulationStatusSupportLevel> | undefined;
    runtimeState?: SimulationStatusRuntimeState | undefined;
    runtimeError?: string | undefined;
    className?: string | undefined;
    maxDiagnostics?: number | undefined;
}>;

type DisplayState = SimulationStatusRuntimeState | 'unsupported' | 'blocked';

const SUPPORT_LEVELS: readonly SimulationStatusSupportLevel[] = [
    'unsupported',
    'static-netlist',
    'realtime-runtime-descriptor',
    'realtime-mna',
];

const SUPPORT_LABELS: Readonly<Record<SimulationStatusSupportLevel, string>> = {
    unsupported: 'Unsupported',
    'static-netlist': 'Static netlist',
    'realtime-runtime-descriptor': 'Runtime descriptor',
    'realtime-mna': 'Realtime MNA',
};

const STATE_LABELS: Readonly<Record<DisplayState, string>> = {
    ready: 'Ready',
    'missing-runtime': 'Missing runtime',
    running: 'Running',
    failed: 'Failed',
    unsupported: 'Unsupported',
    blocked: 'Blocked',
};

export function SimulationStatus(props: SimulationStatusProps): ReactElement {
    const {
        ready,
        diagnostics,
        componentSupport,
        runtimeState = 'ready',
        runtimeError,
        className,
        maxDiagnostics = 6,
    } = props;
    const state = displayState(ready, diagnostics, runtimeState);
    const supportCounts = countSupportLevels(componentSupport);
    const visibleDiagnostics = diagnostics.slice(0, maxDiagnostics);
    const hiddenDiagnosticCount = Math.max(0, diagnostics.length - visibleDiagnostics.length);

    return (
        <section
            data-simulation-status-state={state}
            className={cx(
                'rounded-md border border-border bg-card text-card-foreground',
                'p-4 text-sm shadow-xs',
                className,
            )}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={cx('rounded-full px-2 py-0.5 text-xs font-medium', stateClassName(state))}>
                            {STATE_LABELS[state]}
                        </span>
                        <span className="text-xs text-muted-foreground">{diagnosticCountLabel(diagnostics.length)}</span>
                    </div>
                    {state === 'missing-runtime' && (
                        <p className="mt-2 text-sm text-muted-foreground">No runtime adapter</p>
                    )}
                    {state === 'failed' && runtimeError !== undefined && runtimeError.trim().length > 0 && (
                        <p className="mt-2 text-sm text-destructive">{runtimeError}</p>
                    )}
                </div>

                <dl className="grid grid-cols-2 gap-2 sm:min-w-80 sm:grid-cols-4">
                    {SUPPORT_LEVELS.map((level) => (
                        <div key={level} className="rounded-md border border-border bg-muted/40 px-3 py-2">
                            <dt className="text-[11px] font-medium text-muted-foreground">{SUPPORT_LABELS[level]}</dt>
                            <dd className="mt-1 font-mono text-sm">{supportCounts[level]}</dd>
                        </div>
                    ))}
                </dl>
            </div>

            {visibleDiagnostics.length > 0 && (
                <div className="mt-4 space-y-2">
                    {visibleDiagnostics.map((diagnostic, index) => (
                        <div
                            key={`${diagnostic.code}-${index}`}
                            data-simulation-diagnostic-code={diagnostic.code}
                            className="flex items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
                        >
                            <span className={cx('rounded-full px-2 py-0.5 font-mono text-[11px]', severityClassName(diagnostic.severity))}>
                                {diagnostic.code}
                            </span>
                            <p className="min-w-0 text-sm">{diagnostic.message}</p>
                        </div>
                    ))}
                    {hiddenDiagnosticCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                            {hiddenDiagnosticCount} more {hiddenDiagnosticCount === 1 ? 'diagnostic' : 'diagnostics'}
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}

function displayState(
    ready: boolean,
    diagnostics: readonly SimulationStatusDiagnostic[],
    runtimeState: SimulationStatusRuntimeState,
): DisplayState {
    if (runtimeState === 'failed' || runtimeState === 'running') {
        return runtimeState;
    }

    if (!ready) {
        return diagnostics.some((diagnostic) => diagnostic.code === 'unsupported-component')
            ? 'unsupported'
            : 'blocked';
    }

    if (runtimeState === 'missing-runtime') {
        return 'missing-runtime';
    }

    return 'ready';
}

function countSupportLevels(
    componentSupport: ReadonlyMap<string, SimulationStatusSupportLevel> | undefined,
): Record<SimulationStatusSupportLevel, number> {
    const counts: Record<SimulationStatusSupportLevel, number> = {
        unsupported: 0,
        'static-netlist': 0,
        'realtime-runtime-descriptor': 0,
        'realtime-mna': 0,
    };

    if (componentSupport === undefined) {
        return counts;
    }

    for (const level of componentSupport.values()) {
        counts[level] += 1;
    }

    return counts;
}

function diagnosticCountLabel(count: number): string {
    return `${count} ${count === 1 ? 'diagnostic' : 'diagnostics'}`;
}

function stateClassName(state: DisplayState): string {
    switch (state) {
        case 'ready':
        case 'running':
            return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
        case 'missing-runtime':
            return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
        case 'failed':
        case 'unsupported':
        case 'blocked':
            return 'bg-destructive/15 text-destructive';
    }
}

function severityClassName(severity: SimulationStatusDiagnostic['severity']): string {
    return severity === 'error'
        ? 'bg-destructive/15 text-destructive'
        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
}

function cx(...classes: readonly (string | false | null | undefined)[]): string {
    return classes.filter((className): className is string => typeof className === 'string' && className.length > 0).join(' ');
}
