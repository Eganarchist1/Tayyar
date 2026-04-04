const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
  {
    ignores: ["dist/*", "android/**", ".expo/**"],
  },
]);
