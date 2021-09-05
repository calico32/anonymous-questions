import ForkTsCheckerPlugin from 'fork-ts-checker-webpack-plugin';
import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import { BannerPlugin, Configuration, EnvironmentPlugin } from 'webpack';

const devMode = process.env.NODE_ENV !== 'production';

export default <Configuration>{
  mode: devMode ? 'development' : 'production',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs',
    chunkFilename: '[name].js',
    devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    devtoolFallbackModuleFilenameTemplate: '[absolute-resource-path]?[hash]',
    pathinfo: false,
  },
  cache: { type: 'filesystem', cacheDirectory: path.resolve(__dirname, '.cache') },
  devtool: devMode
    ? process.env.NODEMON
      ? 'eval-cheap-module-source-map'
      : 'inline-source-map'
    : 'source-map',
  resolve: { extensions: ['.ts', '.js'] },
  plugins: [
    new EnvironmentPlugin({ WEBPACK: true }),
    new ForkTsCheckerPlugin({
      typescript: {
        diagnosticOptions: {
          semantic: true,
          syntactic: true,
        },
        configFile: path.resolve(__dirname, 'src/tsconfig.json'),
      },
      eslint: { enabled: true, files: './src/**/*.{ts,js}' },
    }),
    new BannerPlugin({
      banner: 'require("source-map-support").install();',
      raw: true,
      entryOnly: false,
    }),
  ],
  stats: { preset: 'normal', colors: true },
  externalsPresets: { node: true },
  // Every non-relative module is external
  // TODO: improve regexp
  externals: async ({ context, request }: { context: string; request: string }) => {
    if (request.startsWith('@gamerbot/')) return false;
    if (/^[^.][a-z\-0-9@/.]+$/.test(request)) return true;
    else return false;
  },
  // externals: /^[^.][a-z\-0-9@/.]+$/,
  target: 'async-node',
  node: { __dirname: true },
  experiments: { topLevelAwait: true },
  optimization: {
    emitOnErrors: false,
    runtimeChunk: true,
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: {
      chunks: 'all',
    },
    minimize: !devMode,
    minimizer: devMode
      ? undefined
      : [
          new TerserPlugin({
            minify: undefined as any,
            terserOptions: { mangle: false },
          }),
        ],
  },
  module: {
    rules: [
      { test: /\.js$/, enforce: 'pre', loader: require.resolve('source-map-loader') },
      {
        test: /\.ts$/,
        loader: require.resolve('ts-loader'),
        options: { happyPackMode: true },
        include: path.resolve(__dirname, 'src'),
      },
      { test: /\.node$/, use: require.resolve('node-loader') },
      { test: /\.mjs$/, include: /node_modules/, type: 'javascript/auto' },
    ],
  },
};
