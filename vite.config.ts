import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const repoBase = '/react-pedal-schematic/';

export default defineConfig(({ command }) => ({
    root: 'playground',
    base: command === 'build' ? repoBase : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'playground/src'),
            '@vessel-dsp/core': resolve(__dirname, 'packages/core/src/index.ts'),
            '@vessel-dsp/react-component/ui': resolve(__dirname, 'packages/react-component/src/ui.tsx'),
            '@vessel-dsp/react-component': resolve(__dirname, 'packages/react-component/src/index.tsx'),
            '@vessel-dsp/simulation/runtime': resolve(__dirname, 'packages/simulation/src/runtime/index.ts'),
            '@vessel-dsp/simulation': resolve(__dirname, 'packages/simulation/src/index.ts'),
        },
    },
    build: {
        outDir: resolve(__dirname, 'gh-pages'),
        emptyOutDir: true,
    },
}));
