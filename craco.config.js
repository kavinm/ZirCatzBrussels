module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      const sourceMapLoader = webpackConfig.module.rules.find((rule) =>
        rule.oneOf?.some((innerRule) =>
          innerRule.loader?.includes("source-map-loader")
        )
      );

      if (sourceMapLoader) {
        sourceMapLoader.exclude = [
          /node_modules\/@metamask\/safe-event-emitter/,
          /node_modules\/@safe-global\/safe-gateway-typescript-sdk/,
          /node_modules\/@walletconnect\/environment/,
          /node_modules\/@walletconnect\/events/,
          /node_modules\/@walletconnect\/jsonrpc-utils/,
          /node_modules\/@walletconnect\/relay-auth/,
          /node_modules\/@walletconnect\/safe-json/,
          /node_modules\/@walletconnect\/time/,
          /node_modules\/@walletconnect\/window-getters/,
          /node_modules\/@walletconnect\/window-metadata/,
          /node_modules\/eth-rpc-errors/,
          /node_modules\/json-rpc-engine/,
          /node_modules\/superstruct/,
        ];
      }

      return webpackConfig;
    },
  },
};
