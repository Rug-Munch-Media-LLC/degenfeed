// commitlint config — relaxed conventional commits
const config = {
  rules: {
    'header-max-length': [2, 'always', 120],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'refactor', 'security', 'perf', 'test', 'ci', 'style'],
    ],
    'subject-case': [0, 'never'],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
  },
};

module.exports = config;
