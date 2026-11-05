import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import * as esbuild from 'esbuild';
import path from 'path';

function extensionScriptsPlugin(): Plugin {
  return {
    name: 'build-extension-scripts',
    async closeBundle() {
      // 1. Content Script (IIFE auto-contido para não vazar variáveis no escopo global dos sites)
      await esbuild.build({
        entryPoints: [path.resolve(__dirname, 'src/content.ts')],
        bundle: true,
        outfile: path.resolve(__dirname, 'dist/content.js'),
        target: 'es2020',
        format: 'iife',
        minify: true,
      });

      // 2. Background Service Worker
      await esbuild.build({
        entryPoints: [path.resolve(__dirname, 'src/background.ts')],
        bundle: true,
        outfile: path.resolve(__dirname, 'dist/background.js'),
        target: 'es2020',
        minify: true,
      });

      console.log('⚡ Extension content.js and background.js successfully generated in dist/');
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), extensionScriptsPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
  },
});