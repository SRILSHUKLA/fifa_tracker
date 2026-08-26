const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  // Auto-generated className typings (regenerated whenever Metro runs).
  dtsFile: "./uniwind-env.d.ts",
});
