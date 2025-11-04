const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    popup: './src/adapters/ui/popup.ts',
    background: './src/adapters/background/background.ts',
    content: './src/adapters/content/content.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/adapters/ui/popup.html', to: 'popup.html' },
        // Copy icon files
        { from: 'src/icon16.png', to: 'icon16.png' },
        { from: 'src/icon32.png', to: 'icon32.png' },
        { from: 'src/icon48.png', to: 'icon48.png' },
        { from: 'src/icon128.png', to: 'icon128.png' },
      ],
    }),
  ],
};
