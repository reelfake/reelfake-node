const path = require('path');
const webpack = require('webpack');
const NodemonPlugin = require('nodemon-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  mode: 'development',
  entry: './src/server.ts',
  target: 'node',
  externals: [nodeExternals()],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'server.js',
    publicPath: '',
  },
  devtool: 'source-map',
  devServer: {
    port: 8000,
    host: 'localhost',
    devMiddleware: {
      index: 'server.js',
      writeToDisk: true,
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({ 'process.env.BUILD_AT': JSON.stringify(new Date().toISOString()) }),
    new NodemonPlugin(),
    new CleanWebpackPlugin(),
  ],
};
