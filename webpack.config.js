const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const fs = require("fs");
module.exports = {
  mode: "development",
  entry: {
    index: "./src/index.js",
  },
  module: {
    rules: [
      {
        test: /\.(?:js|mjs|cjs|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
  devtool: "inline-source-map",
  devServer: {
    static: "./public",
    hot: true,
    server: {
      type: "https",
      options: {
        key: fs.readFileSync("./example.com.key"),
        cert: fs.readFileSync("./example.com.crt"),
      },
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: "Development",
      template: "public/index.html",
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "public/assets"),
          to: path.resolve(__dirname, "dist/assets"),
        },
      ],
    }),
  ],
  output: {
    filename: "[name].bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  optimization: {
    runtimeChunk: "single",
  },
};
