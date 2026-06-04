import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const repoBase = '/circuit-preview-editor/';

export default defineConfig(({ command }) => ({
    root: 'playground',
    base: command === 'build' ? repoBase : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'playground/src'),
            'circuit-preview-editor/ui': resolve(__dirname, 'src/ui/index.tsx'),
            'circuit-preview-editor': resolve(__dirname, 'src/index.ts'),
        },
    },
    build: {
        outDir: resolve(__dirname, 'gh-pages'),
        emptyOutDir: true,
    },
}));
