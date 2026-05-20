const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// RN 0.85.x ships VirtualViewNativeComponent and VirtualViewExperimentalNativeComponent
// which use nested Readonly<{...}> Flow event types that the codegen bundled inside
// babel-preset-expo cannot parse, causing "Unable to determine event arguments for
// onModeChange". These components are experimental/opt-in and not used by this app,
// so we redirect them to an empty stub until expo ships a compatible codegen version.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.includes('VirtualViewNativeComponent') ||
    moduleName.includes('VirtualViewExperimentalNativeComponent')
  ) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'scripts/empty-module.js'),
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
