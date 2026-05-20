const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// RN 0.85.x ships VirtualViewExperimentalNativeComponent which uses a Flow
// event-type syntax that the codegen bundled inside babel-preset-expo cannot
// parse, causing "Unable to determine event arguments for onModeChange".
// The component is experimental/opt-in and is not used by this app, so we
// redirect it to an empty stub to keep the bundler happy until expo ships a
// compatible codegen version.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.includes('VirtualViewExperimentalNativeComponent')) {
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
