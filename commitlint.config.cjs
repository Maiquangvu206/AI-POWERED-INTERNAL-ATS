module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // tính năng mới
        'fix', // sửa bug
        'docs', // tài liệu
        'style', // format, không đổi logic
        'refactor', // tái cấu trúc
        'perf', // tối ưu hiệu năng
        'test', // thêm/sửa test
        'build', // build system, dependency
        'ci', // CI/CD
        'chore', // việc lặt vặt
        'revert', // revert commit
      ],
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};
