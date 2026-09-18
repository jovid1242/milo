// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Quest icons are SVG files: compile them into react-native-svg components.
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};

config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
  // Originals and asset-pipeline scratch folders must never be bundled or watched.
  blockList: [
    ...[config.resolver.blockList].flat().filter(Boolean),
    /[/\\]assets-original[/\\].*/,
    /[/\\]\.assets-(build|previous)[/\\].*/,
  ],
};

module.exports = config;
