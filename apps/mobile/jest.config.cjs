module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.[jt]s?(x)"],
  moduleNameMapper: {
    "^react$": "<rootDir>/node_modules/react",
    "^react-test-renderer$": "<rootDir>/node_modules/react-test-renderer",
  },
  transformIgnorePatterns: [
    "node_modules/(?!\.pnpm|(?:jest-)?react-native|@react-native|expo|@expo|@react-navigation|react-native-svg)",
  ],
};
