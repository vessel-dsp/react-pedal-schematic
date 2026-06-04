import { useMemo, useState, type CSSProperties } from 'react';
import {
    parseCircuitDocument,
    validateDocument,
    type CircuitDocument,
} from 'react-pedal-schematic';
import { SchematicView, type WireFlowMode } from 'react-pedal-schematic/ui';

type CircuitPreviewProps = Readonly<{
    sourceText: string;
    filename: string;
}>;

export function CircuitPreviewWithFlowToggle(props: CircuitPreviewProps) {
    const [wireFlow, setWireFlow] = useState<WireFlowMode>('none');
    const document = useMemo(
        () => parseCircuitDocument(props.sourceText, { filename: props.filename }),
        [props.sourceText, props.filename],
    );
    const issues = useMemo(() => validateDocument(document), [document]);

    return (
        <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                    type="button"
                    aria-pressed={wireFlow === 'all'}
                    onClick={() => setWireFlow((mode) => mode === 'all' ? 'none' : 'all')}
                >
                    Signal flow
                </button>
                <span>{issues.length} issues</span>
            </div>

            <SchematicFrame document={document} wireFlow={wireFlow} />
        </section>
    );
}

function SchematicFrame(props: {
    document: CircuitDocument;
    wireFlow: WireFlowMode;
}) {
    const style: CSSProperties & Record<'--cpe-wire-flow' | '--cpe-wire-flow-base', string> = {
        width: '100%',
        height: 560,
        color: '#1f2937',
        background: '#ffffff',
        border: '1px solid #d1d5db',
        borderRadius: 6,
        '--cpe-wire-flow-base': '#cbd5e1',
        '--cpe-wire-flow': '#7dd3fc',
    };

    return (
        <SchematicView
            document={props.document}
            wireFlow={props.wireFlow}
            style={style}
        />
    );
}
