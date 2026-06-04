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
            '@vessel-dsp/react-pedal-schematic/core': resolve(__dirname, 'src/index.ts'),
            '@vessel-dsp/react-pedal-schematic/ui': resolve(__dirname, 'src/ui/index.tsx'),
            '@vessel-dsp/react-pedal-schematic': resolve(__dirname, 'src/ui/index.tsx'),
        },
    },
    build: {
        outDir: resolve(__dirname, 'gh-pages'),
        emptyOutDir: true,
    },
}));
