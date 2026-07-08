const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude selenium-tests folder to prevent Metro from scanning its node_modules,
// which can cause EINVAL readlink errors on Windows.
const customBlockList = [
  /[\\/\\\\]selenium-tests[\\/\\\\]/,
];

if (Array.isArray(config.resolver.blockList)) {
  config.resolver.blockList = [...config.resolver.blockList, ...customBlockList];
} else if (config.resolver.blockList instanceof RegExp) {
  config.resolver.blockList = [config.resolver.blockList, ...customBlockList];
} else {
  config.resolver.blockList = customBlockList;
}

module.exports = config;
