import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Star } from 'lucide-react';
import {
    applyEditorCommand,
    canRedo,
    canUndo,
    createEditorState,
    findWireChain,
    parseCircuitDocumentFile,
    parseCircuitDocument,
    serializeSchx,
    serializeSpiceNetlist,
    serializeVdspCircuitDocument,
    toNetlistView,
    validateDocument,
    VERSION,
    type EditorCommand,
    type EditorState,
    type NetlistView,
    type Point,
    type ValidationIssue,
    type Warning,
} from '@vessel-dsp/react-pedal-schematic';
import { SchematicView } from '@vessel-dsp/react-pedal-schematic/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { FIXTURES, FIXTURE_GROUPS, findFixture } from '@/lib/fixtures';
import { Inspector } from '@/components/inspector';
import { SymbolPalette, readPalettePayload } from '@/components/symbol-palette';
import { cn } from '@/lib/utils';
import canvasDotBg from '@/assets/canvas-dot-bg.png';

type EditorReducer = (state: EditorState, command: EditorCommand) => EditorState;
export type SelectedSchematicComponent = EditorState['document']['components'][number] | null;
type SelectedComponent = SelectedSchematicComponent;
export type SourceOutputFormat = 'schx' | 'vdsp' | 'spice';

const sourceOutputFormats: ReadonlyArray<Readonly<{ value: SourceOutputFormat; label: string }>> = [
    { value: 'vdsp', label: '.vdsp' },
    { value: 'schx', label: '.schx' },
    { value: 'spice', label: '.cir' },
];

const editorReducer: EditorReducer = (state, command) => applyEditorCommand(state, command);
const reactDependencyExample = `npm install @vessel-dsp/react-pedal-schematic`;
const githubRepositoryUrl = 'https://github.com/vessel-dsp/react-pedal-schematic';

const reactIntegrationExample = `import { parseCircuitDocument, validateDocument } from '@vessel-dsp/react-pedal-schematic';
import { SchematicView } from '@vessel-dsp/react-pedal-schematic/ui';

export function CircuitPreview(props: { source: string; filename: string }) {
  const document = parseCircuitDocument(props.source, { filename: props.filename });
  const issues = validateDocument(document);

  return (
    <section>
      <SchematicView
        document={document}
        className="h-[520px] w-full rounded-md border"
        showLabels
      />
      {issues.length > 0 && <p>{issues.length} diagnostics</p>}
    </section>
  );
}`;

export function App(): React.ReactElement {
    const [fixtureId, setFixtureId] = useState<string>(FIXTURES[0]?.id ?? '');

    return (
        <FixtureSession
            fixtureId={fixtureId}
            onFixtureChange={setFixtureId}
        />
    );
}

export function FixtureSession(props: {
    fixtureId: string;
    onFixtureChange: (id: string) => void;
}): React.ReactElement {
    const { fixtureId, onFixtureChange } = props;
    const fixture = findFixture(fixtureId);
    const initialDocument = useMemo(
        () => parseFixtureDocument(fixture),
        [fixture],
    );

    const [editorState, setEditorState] = useState(() => createEditorState(initialDocument));
    const dispatch = useCallback<React.Dispatch<EditorCommand>>((command) => {
        setEditorState((state) => editorReducer(state, command));
    }, []);

    useEffect(() => {
        setEditorState(createEditorState(initialDocument));
    }, [initialDocument]);

    const document = editorState.document;
    const view: NetlistView = useMemo(() => toNetlistView(document), [document]);
    const issues: readonly ValidationIssue[] = useMemo(() => validateDocument(document), [document]);
    const selectedComponent = editorState.selectedId
        ? document.components.find((c) => c.id === editorState.selectedId) ?? null
        : null;

    return (
        <PlaygroundShell
            fixtureId={fixtureId}
            fixture={fixture}
            onFixtureChange={onFixtureChange}
            editorState={editorState}
            dispatch={dispatch}
            document={document}
            view={view}
            issues={issues}
            selectedComponent={selectedComponent}
        />
    );
}

export function parseFixtureDocument(fixture: ReturnType<typeof findFixture>): EditorState['document'] {
    if (fixture === undefined) {
        return parseCircuitDocument('<?xml version="1.0"?><Schematic></Schematic>', { format: 'schx' });
    }

    return parseCircuitDocumentFile(fixture.source, { filename: fixture.filename });
}

type PlaygroundShellProps = Readonly<{
    fixtureId: string;
    fixture: ReturnType<typeof findFixture>;
    onFixtureChange: (id: string) => void;
    editorState: EditorState;
    dispatch: React.Dispatch<EditorCommand>;
    document: EditorState['document'];
    view: NetlistView;
    issues: readonly ValidationIssue[];
    selectedComponent: SelectedComponent;
}>;

type SchematicWorkspaceContextValue = Readonly<{
    editorState: EditorState;
    dispatch: React.Dispatch<EditorCommand>;
    selectedComponent: SelectedComponent;
}>;

const SchematicWorkspaceContext = createContext<SchematicWorkspaceContextValue | null>(null);

export function useSchematicWorkspace(): SchematicWorkspaceContextValue {
    const value = useContext(SchematicWorkspaceContext);
    if (value === null) {
        throw new Error('Schematic workspace panels must be rendered inside <SchematicWorkspace>.');
    }
    return value;
}

export function PlaygroundShell(props: PlaygroundShellProps): React.ReactElement {
    const { fixture, onFixtureChange, fixtureId, editorState, dispatch, document, view, issues, selectedComponent } = props;
    const diagnostics = useMemo(
        () => buildDisplayDiagnostics(document.warnings, issues, view.warnings),
        [document.warnings, issues, view.warnings],
    );
    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b border-border">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="break-words text-lg font-semibold tracking-tight">@vessel-dsp/react-pedal-schematic</h1>
                        <p className="text-sm text-muted-foreground">
                            Web circuit editor library for audio electronics — playground &amp; docs.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button asChild variant="outline" size="sm">
                            <a
                                href={githubRepositoryUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Star @vessel-dsp/react-pedal-schematic on GitHub"
                            >
                                <Star aria-hidden="true" />
                                Star
                            </a>
                        </Button>
                        <Badge variant="outline" className="font-mono">v{VERSION}</Badge>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Bundled fixtures</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <Select value={fixtureId} onValueChange={onFixtureChange}>
                                    <SelectTrigger className="sm:w-72">
                                        <SelectValue placeholder="Choose a fixture" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FIXTURE_GROUPS.map((group) => {
                                            const items = FIXTURES.filter((f) => f.group === group.id);
                                            if (items.length === 0) {
                                                return null;
                                            }
                                            return (
                                                <SelectGroup key={group.id}>
                                                    <SelectLabel>{group.label}</SelectLabel>
                                                    {items.map((f) => (
                                                        <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                                {fixture && (
                                    <p className="hidden text-sm text-muted-foreground sm:block">{fixture.description}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="schematic" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="schematic">Schematic</TabsTrigger>
                        <TabsTrigger value="integration">Integration</TabsTrigger>
                        <TabsTrigger value="source">Source</TabsTrigger>
                        <TabsTrigger value="netlist">
                            Netlist <Badge variant="secondary" className="ml-2">{view.components.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="warnings">
                            Warnings <IssueBadge count={diagnostics.count} />
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="schematic" className="m-0">
                        <SchematicWorkspace
                            editorState={editorState}
                            dispatch={dispatch}
                            selectedComponent={selectedComponent}
                        />
                    </TabsContent>

                    <TabsContent value="integration" className="m-0" forceMount>
                        <IntegrationDocs />
                    </TabsContent>

                    <TabsContent value="netlist" className="m-0">
                        <NetlistPanel netlist={view} />
                    </TabsContent>

                    <TabsContent value="source" className="m-0" forceMount>
                        <SourcePanel fixture={fixture} document={document} />
                    </TabsContent>

                    <TabsContent value="warnings" className="m-0" forceMount>
                        <WarningsPanel
                            parseWarnings={diagnostics.parseWarnings}
                            validationIssues={diagnostics.validationIssues}
                            netlistWarnings={diagnostics.netlistWarnings}
                        />
                    </TabsContent>

                </Tabs>
            </main>
        </div>
    );
}

function IntegrationDocs(): React.ReactElement {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">React integration</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Install from npm, then import from the root package or the typed subpaths.
                </p>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <section className="space-y-3">
                    <div>
                        <h3 className="text-sm font-medium">Current dependency</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Use <span className="font-mono">@vessel-dsp/react-pedal-schematic</span> from npm for
                            application integrations.
                        </p>
                    </div>
                    <pre className="overflow-auto rounded-md bg-muted p-4 font-mono text-xs text-muted-foreground">
                        {reactDependencyExample}
                    </pre>
                </section>

                <section className="space-y-3">
                    <div>
                        <h3 className="text-sm font-medium">Minimal React preview</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Parse source text with <span className="font-mono">parseCircuitDocument</span>, then pass
                            the resulting document into <span className="font-mono">SchematicView</span>.
                        </p>
                    </div>
                    <pre className="overflow-auto rounded-md bg-muted p-4 font-mono text-xs text-muted-foreground">
                        {reactIntegrationExample}
                    </pre>
                </section>
            </CardContent>
        </Card>
    );
}

function SourcePanel(props: {
    fixture: ReturnType<typeof findFixture>;
    document: EditorState['document'];
}): React.ReactElement {
    const { fixture, document } = props;
    const [sourceFormat, setSourceFormat] = useState<SourceOutputFormat>('vdsp');
    const source = useMemo(
        () => sourceTextForFormat(sourceFormat, fixture, document),
        [sourceFormat, fixture, document],
    );

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Source</CardTitle>
                <div className="flex items-center gap-2" data-source-format-value={labelForSourceFormat(sourceFormat)}>
                    <Label htmlFor="source-format" className="sr-only">Source format</Label>
                    <Select
                        value={sourceFormat}
                        onValueChange={(value) => {
                            if (isSourceOutputFormat(value)) {
                                setSourceFormat(value);
                            }
                        }}
                    >
                        <SelectTrigger id="source-format" data-source-format-select="true" className="w-28">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {sourceOutputFormats.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <Label htmlFor="source-output" className="sr-only">Converted source</Label>
                <textarea
                    id="source-output"
                    data-source-output-view="true"
                    value={source}
                    readOnly
                    spellCheck={false}
                    className="min-h-140 w-full resize-y rounded-md border border-input bg-muted p-4 font-mono text-xs text-muted-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40"
                />
            </CardContent>
        </Card>
    );
}

function isSourceOutputFormat(value: string): value is SourceOutputFormat {
    return sourceOutputFormats.some((option) => option.value === value);
}

function labelForSourceFormat(format: SourceOutputFormat): string {
    return sourceOutputFormats.find((option) => option.value === format)?.label ?? '.vdsp';
}

export function sourceTextForFormat(
    format: SourceOutputFormat,
    fixture: ReturnType<typeof findFixture>,
    document: EditorState['document'],
): string {
    switch (format) {
        case 'schx':
            return serializeSchx(document);
        case 'vdsp':
            return sourceVdsp(fixture, document);
        case 'spice':
            return serializeSpiceNetlist(document);
    }
}

function sourceVdsp(
    fixture: ReturnType<typeof findFixture>,
    document: EditorState['document'],
): string {
    if (fixture === undefined) {
        return serializeVdspCircuitDocument(document);
    }

    return serializeVdspCircuitDocument(document, {
        filename: fixture.filename,
    });
}

function findComponent(state: EditorState): SelectedComponent {
    if (state.selectedId === null) {
        return null;
    }
    return state.document.components.find((c) => c.id === state.selectedId) ?? null;
}

export type SchematicWorkspaceProps = Readonly<{
    editorState: EditorState;
    dispatch: React.Dispatch<EditorCommand>;
    selectedComponent: SelectedComponent;
    className?: string | undefined;
    children?: ReactNode | undefined;
}>;

export function SchematicWorkspace(props: SchematicWorkspaceProps): React.ReactElement {
    const { editorState, dispatch, selectedComponent, className, children } = props;
    const value = useMemo<SchematicWorkspaceContextValue>(
        () => ({ editorState, dispatch, selectedComponent }),
        [editorState, dispatch, selectedComponent],
    );

    return (
        <SchematicWorkspaceContext.Provider value={value}>
            <div
                data-schematic-workspace="true"
                className={cn('grid gap-4 lg:grid-cols-[240px_1fr_320px]', className)}
            >
                {children ?? (
                    <>
                        <SchematicLeftPanel />
                        <SchematicCanvasPanel />
                        <SchematicRightPanel />
                    </>
                )}
            </div>
        </SchematicWorkspaceContext.Provider>
    );
}

export type SchematicLeftPanelProps = Readonly<{
    className?: string | undefined;
    contentClassName?: string | undefined;
}>;

export function SchematicLeftPanel(props: SchematicLeftPanelProps): React.ReactElement {
    return <SymbolPalette className={props.className} contentClassName={props.contentClassName} />;
}

export type SchematicCanvasPanelProps = Readonly<{
    className?: string | undefined;
    canvasClassName?: string | undefined;
}>;

export function SchematicCanvasPanel(props: SchematicCanvasPanelProps): React.ReactElement {
    const { editorState, dispatch, selectedComponent } = useSchematicWorkspace();
    return (
        <SchematicCard
            editorState={editorState}
            dispatch={dispatch}
            selectedComponent={selectedComponent}
            className={props.className}
            canvasClassName={props.canvasClassName}
        />
    );
}

export type SchematicRightPanelProps = Readonly<{
    className?: string | undefined;
}>;

export function SchematicRightPanel(props: SchematicRightPanelProps): React.ReactElement {
    const { selectedComponent, dispatch } = useSchematicWorkspace();
    return (
        <Inspector
            component={selectedComponent}
            dispatch={(cmd) => dispatch(cmd)}
            editMode={true}
            className={props.className}
        />
    );
}

export function SchematicCard(props: {
    editorState: EditorState;
    dispatch: React.Dispatch<EditorCommand>;
    selectedComponent: SelectedComponent;
    className?: string | undefined;
    canvasClassName?: string | undefined;
}): React.ReactElement {
    const { editorState, dispatch, selectedComponent, className, canvasClassName } = props;
    const [wireFlow, setWireFlow] = useState(false);

    useEffect(() => {
        function handleKey(event: KeyboardEvent): void {
            if (event.key !== 'Delete' && event.key !== 'Backspace') {
                return;
            }
            const target = event.target as HTMLElement | null;
            // Don't steal Delete from form inputs in the Inspector.
            if (target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }
            if (editorState.selectedWireId !== null) {
                event.preventDefault();
                const chain = findWireChain(editorState.selectedWireId, editorState.document);
                dispatch({ type: 'delete-wires', wireIds: chain });
                return;
            }
            if (selectedComponent !== null) {
                event.preventDefault();
                dispatch({ type: 'delete-component', componentId: selectedComponent.id });
            }
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [editorState.selectedWireId, editorState.document, selectedComponent, dispatch]);

    return (
        <Card className={className}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Edit canvas</CardTitle>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={!canUndo(editorState)}
                        onClick={() => dispatch({ type: 'undo' })}
                    >
                        Undo
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={!canRedo(editorState)}
                        onClick={() => dispatch({ type: 'redo' })}
                    >
                        Redo
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => dispatch({ type: 'tidy-layout' })}
                    >
                        Tidy up
                    </Button>
                    <Button
                        size="sm"
                        variant={wireFlow ? 'secondary' : 'outline'}
                        aria-pressed={wireFlow}
                        onClick={() => setWireFlow((enabled) => !enabled)}
                    >
                        Signal flow
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={selectedComponent === null && editorState.selectedWireId === null}
                        onClick={() => {
                            if (selectedComponent !== null) {
                                dispatch({ type: 'delete-component', componentId: selectedComponent.id });
                                return;
                            }
                            if (editorState.selectedWireId !== null) {
                                const chain = findWireChain(editorState.selectedWireId, editorState.document);
                                dispatch({ type: 'delete-wires', wireIds: chain });
                            }
                        }}
                    >
                        Delete
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-2 sm:p-4">
                <SchematicView
                    document={editorState.document}
                    className={cn(
                        'block h-140 w-full rounded-md border border-border bg-card text-foreground [--cpe-bg:var(--card)]',
                        canvasClassName,
                    )}
                    style={{
                        backgroundImage: `url(${canvasDotBg})`,
                        backgroundRepeat: 'repeat',
                        backgroundPosition: '0 0',
                    }}
                    wireFlow={wireFlow ? 'all' : 'none'}
                    editMode={true}
                    selectedId={editorState.selectedId}
                    selectedWireId={editorState.selectedWireId}
                    onSelect={(id) => dispatch({ type: 'select', componentId: id })}
                    onSelectWire={(wireId) => dispatch({ type: 'select-wire', wireId })}
                    onMoveComponent={(id, origin) => handleMove(dispatch, id, origin)}
                    onCanvasDrop={(event, origin) => handleCanvasDrop(dispatch, event, origin)}
                    onCreateWire={(from, to) => dispatch({ type: 'add-wire', from, to })}
                    onSplitWire={(wireId, at) => dispatch({ type: 'split-wire', wireId, at })}
                    onMergeCorner={(at) => dispatch({ type: 'merge-wires', at })}
                />
                <SelectionInfo selectedComponent={selectedComponent} selectedWireId={editorState.selectedWireId} />
            </CardContent>
        </Card>
    );
}

function handleMove(dispatch: React.Dispatch<EditorCommand>, id: string, origin: Point): void {
    dispatch({ type: 'move-component', componentId: id, origin });
}

function handleCanvasDrop(
    dispatch: React.Dispatch<EditorCommand>,
    event: React.DragEvent,
    origin: Point,
): void {
    const payload = readPalettePayload(event);
    if (payload === null) {
        return;
    }
    dispatch({
        type: 'add-component',
        kind: payload.kind,
        origin,
        sourceTypeName: payload.sourceTypeName,
    });
}

function SelectionInfo(props: {
    selectedComponent: ReturnType<typeof findComponent>;
    selectedWireId: string | null;
}): React.ReactElement {
    const { selectedComponent, selectedWireId } = props;
    if (selectedComponent === null && selectedWireId === null) {
        return (
            <p className="mt-2 text-xs text-muted-foreground">
                Click to select · drag from a terminal to draw a wire · Shift+click a wire to add a bend, Shift+click a bend to remove it · Delete removes the selection.
            </p>
        );
    }
    if (selectedWireId !== null) {
        return (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span><span className="font-medium text-foreground">Selected wire:</span> {selectedWireId}</span>
                <span className="text-muted-foreground">Press Delete to remove.</span>
            </div>
        );
    }
    return (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span><span className="font-medium text-foreground">Selected:</span> {selectedComponent!.id}</span>
            <span>kind: <span className="font-mono">{selectedComponent!.kind}</span></span>
            <span>origin: <span className="font-mono">({selectedComponent!.origin.x}, {selectedComponent!.origin.y})</span></span>
            <span>terminals: <span className="font-mono">{selectedComponent!.terminals.length}</span></span>
        </div>
    );
}

function IssueBadge({ count }: { count: number }): React.ReactElement {
    const variant = count === 0 ? 'secondary' : 'destructive';
    return <Badge variant={variant} className="ml-2">{count}</Badge>;
}

type DisplayDiagnostics = Readonly<{
    parseWarnings: readonly Warning[];
    validationIssues: readonly ValidationIssue[];
    netlistWarnings: readonly string[];
    count: number;
}>;

function buildDisplayDiagnostics(
    parseWarnings: readonly Warning[],
    validationIssues: readonly ValidationIssue[],
    netlistWarnings: readonly string[],
): DisplayDiagnostics {
    const seenUnsupported = new Set<string>();
    const displayParseWarnings: Warning[] = [];
    const displayValidationIssues: ValidationIssue[] = [];
    const displayNetlistWarnings: string[] = [];

    for (const warning of parseWarnings) {
        const key = unsupportedParserKey(warning);
        if (key !== null && seenUnsupported.has(key)) {
            continue;
        }
        if (key !== null) {
            seenUnsupported.add(key);
        }
        displayParseWarnings.push(warning);
    }

    for (const issue of validationIssues) {
        const key = unsupportedValidationKey(issue);
        if (key !== null && seenUnsupported.has(key)) {
            continue;
        }
        if (key !== null) {
            seenUnsupported.add(key);
        }
        displayValidationIssues.push(issue);
    }

    for (const warning of netlistWarnings) {
        const key = unsupportedNetlistKey(warning);
        if (key !== null && seenUnsupported.has(key)) {
            continue;
        }
        if (key !== null) {
            seenUnsupported.add(key);
        }
        displayNetlistWarnings.push(warning);
    }

    return {
        parseWarnings: displayParseWarnings,
        validationIssues: displayValidationIssues,
        netlistWarnings: displayNetlistWarnings,
        count: displayParseWarnings.length + displayValidationIssues.length + displayNetlistWarnings.length,
    };
}

function unsupportedParserKey(warning: Warning): string | null {
    if (warning.code !== 'unknown-ltspice-symbol' || warning.componentId === undefined) {
        return null;
    }
    return `unsupported:${warning.componentId}`;
}

function unsupportedValidationKey(issue: ValidationIssue): string | null {
    if (issue.code !== 'unsupported-component' || issue.componentId === undefined) {
        return null;
    }
    return `unsupported:${issue.componentId}`;
}

function unsupportedNetlistKey(message: string): string | null {
    const match = message.match(/^([^:]+): unsupported source type /);
    if (match?.[1] === undefined) {
        return null;
    }
    return `unsupported:${match[1]}`;
}

function NetlistPanel({ netlist }: { netlist: NetlistView }): React.ReactElement {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">
                    Flat netlist projection
                    <span className="ml-3 text-sm font-normal text-muted-foreground">
                        {netlist.nodeCount} nodes · ground = {netlist.groundNodeId ?? '—'}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
                                <th className="px-4 py-2 font-medium">SPICE</th>
                                <th className="px-4 py-2 font-medium">ID</th>
                                <th className="px-4 py-2 font-medium">Kind</th>
                                <th className="px-4 py-2 font-medium">Nodes</th>
                                <th className="px-4 py-2 font-medium">Value</th>
                                <th className="px-4 py-2 font-medium">Model</th>
                            </tr>
                        </thead>
                        <tbody>
                            {netlist.components.map((c) => (
                                <tr key={c.id} className="border-b border-border/60 last:border-b-0">
                                    <td className="px-4 py-2 font-mono text-xs">
                                        {c.spiceLetter ?? <span className="text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-4 py-2 font-mono text-xs">{c.id}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{c.kind}</td>
                                    <td className="px-4 py-2 font-mono text-xs">[{c.nodes.join(', ')}]</td>
                                    <td className="px-4 py-2 font-mono text-xs">{c.value?.raw ?? ''}</td>
                                    <td className="px-4 py-2 font-mono text-xs">{c.model ?? ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

function WarningsPanel(props: {
    parseWarnings: readonly Warning[];
    validationIssues: readonly ValidationIssue[];
    netlistWarnings: readonly string[];
}): React.ReactElement {
    const { parseWarnings, validationIssues, netlistWarnings } = props;
    const empty =
        parseWarnings.length === 0 && validationIssues.length === 0 && netlistWarnings.length === 0;
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Diagnostics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {empty && <p className="text-sm text-muted-foreground">No warnings or validation issues.</p>}
                {parseWarnings.length > 0 && (
                    <Section title="Parser warnings" count={parseWarnings.length}>
                        {parseWarnings.map((w, i) => (
                            <DiagnosticRow key={`p-${i}`} code={w.code} message={w.message} severity="warning" />
                        ))}
                    </Section>
                )}
                {validationIssues.length > 0 && (
                    <Section title="Validation issues" count={validationIssues.length}>
                        {validationIssues.map((issue, i) => (
                            <DiagnosticRow
                                key={`v-${i}`}
                                code={issue.code}
                                message={issue.message}
                                severity={issue.severity}
                            />
                        ))}
                    </Section>
                )}
                {netlistWarnings.length > 0 && (
                    <Section title="Netlist warnings" count={netlistWarnings.length}>
                        {netlistWarnings.map((message, i) => (
                            <DiagnosticRow key={`n-${i}`} code="netlist" message={message} severity="warning" />
                        ))}
                    </Section>
                )}
            </CardContent>
        </Card>
    );
}

function Section(props: { title: string; count: number; children: React.ReactNode }): React.ReactElement {
    return (
        <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-medium">
                {props.title}
                <Badge variant="secondary">{props.count}</Badge>
            </h3>
            <div className="space-y-2">{props.children}</div>
        </div>
    );
}

function DiagnosticRow(props: { code: string; message: string; severity: 'error' | 'warning' }): React.ReactElement {
    return (
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
            <Badge variant={props.severity === 'error' ? 'destructive' : 'outline'}>{props.code}</Badge>
            <p className="text-sm text-foreground">{props.message}</p>
        </div>
    );
}
