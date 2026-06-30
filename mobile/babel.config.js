module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // SDK 54's babel-preset-expo auto-adds the worklets/reanimated plugin when
    // reanimated is installed — no manual plugin entry needed.
  };
};
