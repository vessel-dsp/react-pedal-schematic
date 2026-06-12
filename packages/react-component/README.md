# @vessel-dsp/react-component

React components for Vessel DSP circuit and device editing surfaces.

Use `@vessel-dsp/core` for headless parsing, validation, conversion, model,
layout, and panel metadata helpers.

Exports include `SchematicView` and the presentational `SimulationStatus`
component. Runtime and readiness data comes from host code or
`@vessel-dsp/simulation`; the React package does not own an audio engine.
