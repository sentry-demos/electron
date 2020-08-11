const path = require('path');
const { map } = require('jquery');
const SentryWebpackPlugin = require('@sentry/webpack-plugin');


module.exports = {
  entry: './src/index.js',
  node: {
    fs: 'empty'
  },
  devtool: "source-map",
  plugins: [
    new SentryWebpackPlugin({
      include: '.',
      release: 'electron-quick-start1.0.0',
      ignoreFile: '.sentrycliignore',
      ignore: ['node_modules', 'webpack.config.js'],
      configFile: 'sentry.properties'
    })
  ],
};