const path = require('path');
const webpack = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserWebpackPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/server.ts',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  devtool: false,
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          transpileOnly: true,
        },
      },
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      'pg-native': false,
      tedious: false,
      sqlite3: false,
      'pg-hstore': false,
    },
  },
  optimization: {
    minimize: false,
    minimizer: [new TerserWebpackPlugin()],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.BUILD_AT': JSON.stringify(new Date().toISOString()),
      'process.env.NODE_ENV': 'production',
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^pg-native$/,
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^tedious$/,
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^sqlite3$/,
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^pg-hstore$/,
    }),
    new CleanWebpackPlugin(),
  ],
};
