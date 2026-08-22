import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['@napi-rs/keyring'],
  banner: {
    js: '#!/usr/bin/env node'
  }
});
