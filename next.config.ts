import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Keep these out of the bundler:
   *  - `postgres` / `@electric-sql/pglite` load native or WASM assets at
   *    runtime that must not be rewritten by the bundler.
   *  - `exceljs` is large, CommonJS, and only ever loaded inside a route
   *    handler, so bundling it buys nothing.
   */
  serverExternalPackages: ['postgres', '@electric-sql/pglite', 'exceljs'],
};

export default nextConfig;
