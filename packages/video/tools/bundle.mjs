import { bundle } from '@remotion/bundler';
import path from 'node:path';

/** Workspace packages are consumed as TypeScript source, including .js ESM specifiers. */
export const bundleVideo = () => bundle({
  entryPoint: path.resolve('packages/video/remotion/index.ts'),
  webpackOverride: config => ({
    ...config,
    resolve: {
      ...config.resolve,
      extensionAlias: { ...config.resolve?.extensionAlias, '.js': ['.ts', '.tsx', '.js'] },
    },
  }),
});
