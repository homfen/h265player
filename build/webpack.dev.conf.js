/* eslint-env node */
/* eslint no-console:0 */
const path = require("path");
const webpack = require("webpack");
const merge = require("webpack-merge");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebPackPlugin = require("html-webpack-plugin");
const baseWebpackConfig = require("./webpack.base.conf");

const basePath = path.resolve(__dirname, "../");
// const publicPath = baseWebpackConfig.output.path + path.sep
const publicPath = path.relative(basePath, "../dist/");

module.exports = merge(baseWebpackConfig, {
  entry: ["../demo/debug.js"],
  mode: "development", // "production" | "development" | "none"
  // Chosen mode tells webpack to use its built-in optimizations accordingly.
  output: {
    // options related to how webpack emits results
    filename: "index.js"

    //publicPath: publicPath + '/', // string
    // the url to the output directory resolved relative to the HTML page

    // libraryTarget: "commonjs2"
  },

  module: {},

  devtool: "#check-module-source-map",
  // devtool: 'module-eval-inline-source-map', // enum
  // enhance debugging by adding meta info for the browser devtools
  // source-map most detailed at the expense of build speed.
  // cheap-source-map

  // devServer: {
  // 	contentBase: path.join(__dirname), // boolean | string | array, static file location
  // 	hot: true // hot module replacement. Depends on HotModuleReplacementPlugin
  // 	// ...
  // },

  devServer: {
    // disableHostCheck: true,
    host: "0.0.0.0"
    // port: 80
  },

  plugins: [
    // new webpack.optimize.CommonsChunkPlugin({
    // 	name: 'common' // Specify the common bundle's name.
    // })
    // new webpack.HotModuleReplacementPlugin({
    // 	// Options...
    // })
    new webpack.DefinePlugin({
      __ENV_MODE__: JSON.stringify("development")
    }),
    new HtmlWebPackPlugin({
      template: "../demo/debug.html",
      filename: "index.html",
      inject: false
    }),
    new CopyWebpackPlugin([
      { from: "../lib", to: "../dist/lib" },
      {
        from: "../data",
        to: "../dist/data"
      }
    ])
  ]
  // list of additional plugins

  /* Advanced configuration (click to show) */
});
