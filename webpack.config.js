require('dotenv').config();
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');

module.exports = {
  entry: './src/index.js',
  target: 'electron-renderer',
  resolve: {
    fallback: { fs: false, path: false },
  },
  devtool: 'hidden-source-map',
  plugins: [
    sentryWebpackPlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // @sentry/electron's normalizePathsIntegration converts file:// paths to app:///
      // before events reach Sentry, so debug IDs (which are keyed by the raw file:// path)
      // never match. Disable debug ID injection/upload and use legacy release-based matching instead.
      sourcemaps: { disable: true },
      release: {
        name: process.env.SENTRY_RELEASE,
        uploadLegacySourcemaps: {
          paths: ['./dist'],
          // Stack frames arrive as app:///dist/main.js, so upload under that prefix.
          urlPrefix: 'app:///dist/',
        },
      },
    }),
  ],
};
