/* eslint-env node */
const path = require("path");
const webpack = require("webpack");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");
const Webpack2Polyfill = require("webpack2-polyfill-plugin");
// const CopyPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const StyleLintPlugin = require("stylelint-webpack-plugin");

const pkgJson = require("../package.json");

const basePath = path.resolve(__dirname, "../");
const buildPath = path.resolve(basePath, "./build");
const distPath = path.resolve(basePath, "./dist");

const babelOptions = {
  compact: false,
  plugins: [
    "dynamic-import-webpack",
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-transform-runtime"
  ],
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          chrome: "56",
          ie: "10",
          edge: "13",
          firefox: "45"
        }
      }
    ]
  ]
};

module.exports = {
  entry: {
    // vendor: [path.resolve(basePath, './dist/lib/WebModule.js'),
    //   path.resolve(basePath, './dist/lib/ADTS.js'),
    //   path.resolve(basePath, './dist/lib/mux.js'),
    //   path.resolve(basePath, './dist/lib/jmuxer.js')
    // ],
    h265player: [
      path.resolve(basePath, "./src/entry") // string | object | array
    ],
    events: [path.resolve(basePath, "./src/config/EventsConfig")],
    "h265player-polyfill": [
      "@babel/polyfill",
      path.resolve(basePath, "./src/index") // string | object | array
    ]
  },
  // Here the application starts executing
  // and webpack starts bundling
  output: {
    // options related to how webpack emits results
    filename: "[name].js",
    chunkFilename: "[name].js",
    path: distPath, // string
    // the target directory for all output files
    // must be an absolute path (use the Node.js path module)

    library: "h265player", // string,
    // the name of the exported library

    libraryTarget: "umd" // universal module definition
    // the type of the exported library
    // libraryTarget: "amd",
    // libraryExport: "default",
    /* Advanced output configuration (click to show) */
  },
  optimization: {
    // minimize: true,
  },
  resolve: {},
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "babel-loader",
          options: babelOptions
        }
      },
      {
        test: /\.ts$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          {
            loader: "babel-loader",
            options: babelOptions
          },
          {
            loader: "ts-loader"
          }
        ]
      },

      {
        test: /\.(css|pcss)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "style-loader"
          },
          {
            loader: "css-loader",
            options: {
              // modules: true,
              importLoaders: 1
            }
          },
          {
            loader: "postcss-loader",
            options: {
              sourceMap: true,
              config: {
                path: buildPath + "/postcss.config.js"
              }
            }
          }
        ]
      }
    ]
  },

  // performance: {
  // 	hints: "warning", // enum
  // 	maxAssetSize: 200000, // int (in bytes),
  // 	maxEntrypointSize: 800000, // int (in bytes)
  // 	assetFilter: function(assetFilename) {
  // 		// Function predicate that provides asset filenames
  // 		return assetFilename.endsWith('.css') || assetFilename.endsWith('.js');
  // 	}
  // },

  devtool: "source-map", // enum
  // enhance debugging by adding meta info for the browser devtools
  // source-map most detailed at the expense of build speed.

  context: __dirname, // string (absolute path!)
  // the home directory for webpack
  // the entry and module.rules.loader option
  //   is resolved relative to this directory

  target: "web", // enum
  // the environment in which the bundle should run
  // changes chunk loading behavior and available modules

  // externals: ["react", /^@angular\//],
  // // Don't follow/bundle these modules, but request them at runtime from the environment

  stats: "normal",
  // lets you precisely control what bundle information gets displayed

  // devServer: {
  // 	// proxy: { // proxy URLs to backend development server
  // 	// 	'/api': 'http://localhost:3000'
  // 	// },
  // 	contentBase: path.join(__dirname), // boolean | string | array, static file location
  // 	compress: true, // enable gzip compression
  // 	historyApiFallback: true, // true for index.html upon 404, object for multiple paths
  // 	hot: true, // hot module replacement. Depends on HotModuleReplacementPlugin
  // 	https: false, // true for self-signed, object for cert authority
  // 	noInfo: true, // only errors & warns on hot reload
  // 	// ...
  // },

  resolve: {
    extensions: [".ts", ".js", ".json"],
    // Use our versions of Node modules.
    alias: {
      fsGlobal: "browserfs/dist/shims/fs.js",
      // buffer: 'browserfs/dist/shims/buffer.js',
      // path: 'browserfs/dist/shims/path.js',
      // processGlobal: 'browserfs/dist/shims/process.js',
      bufferGlobal: "browserfs/dist/shims/bufferGlobal.js",
      bfsGlobal: require.resolve("browserfs")
    }
  },

  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [distPath + "/*.js"]
    }),

    new webpack.DefinePlugin({
      __VERSION__: JSON.stringify(pkgJson.version)
    }),

    // new Webpack2Polyfill(),

    new webpack.BannerPlugin(
      "h265player built @" + new Date().toLocaleString()
    ),
    // new CopyPlugin([
    //   {
    //     from: path.resolve(basePath, './src/lib/mux.js'),
    //     to: path.resolve(basePath, './dist'),
    //     // toType: 'file',
    //   },
    // ]),
    new StyleLintPlugin({
      configFile: path.resolve(buildPath, "stylelint.config.js"),
      context: path.resolve(basePath, "./src/themes"),
      files: "**/*.css",
      failOnError: false,
      quiet: false
    }),
    new webpack.ProvidePlugin({
      BrowserFS: "bfsGlobal",
      // process: 'processGlobal',
      fs: "fsGlobal",
      Buffer: "bufferGlobal"
    })
  ],
  // list of additional plugins

  node: {
    fs: false
  }

  /* Advanced configuration (click to show) */
};
