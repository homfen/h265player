/* eslint-env node */
const webpack = require("webpack");
const merge = require("webpack-merge");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebPackPlugin = require("html-webpack-plugin");
const baseWebpackConfig = require("./webpack.base.conf");
const TerserPlugin = require("terser-webpack-plugin");

// const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

process.env.mode = "ONLINE";

module.exports = merge(baseWebpackConfig, {
  mode: "production", // "production" | "development" | "none"
  // Chosen mode tells webpack to use its built-in optimizations accordingly.

  entry: {
    index: "../demo/debug.js"
  },

  output: {
    // options related to how webpack emits results

    path: `${baseWebpackConfig.output.path}/` // string

    // libraryTarget: 'commonjs2'
    // the type of the exported library

    /* Advanced output configuration (click to show) */
  },

  performance: {
    hints: "warning", // enum
    maxAssetSize: 200000, // int (in bytes)
    maxEntrypointSize: 400000, // int (in bytes)
    assetFilter: function (assetFilename) {
      // Function predicate that provides asset filenames
      return assetFilename.endsWith(".css") || assetFilename.endsWith(".js");
    }
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true
          },
          format: {
            comments: false
          },
          output: {
            comments: false
          }
        },
        extractComments: false
      })
    ]
  },
  devtool: false,
  plugins: [
    // new webpack.optimize.CommonsChunkPlugin({
    // 	name: 'common' // Specify the common bundle's name.
    // }),
    // new UglifyJSPlugin({
    //    uglifyOptions: {
    //        ecma: 6,
    //        ie8: true
    //    },
    // 	sourceMap: true
    // })
    new webpack.DefinePlugin({
      __ENV_MODE__: JSON.stringify("production")
    }),
    new CopyWebpackPlugin([{ from: "../lib", to: "../dist/lib" }]),
    new HtmlWebPackPlugin({
      template: "../demo/debug.html",
      filename: "index.html",
      inject: false
    })
  ]
  // list of additional plugins

  /* Advanced configuration (click to show) */
});
