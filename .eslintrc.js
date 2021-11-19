module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'plugin:vue/essential',
    '@vue/airbnb',
  ],
  parserOptions: {
    parser: 'babel-eslint',
  },
  rules: {
    'no-console': 'off',
    'no-debugger': 'off',
    'max-len': 'off',
    'import/no-extraneous-dependencies': 'off',
    'no-alert': 'off',
    'linebreak-style': 'off',
  },
};
