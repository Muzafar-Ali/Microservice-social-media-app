import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\.spec\.ts$',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\.(ts|tsx)$': 'ts-jest',
  },
};

export default jestConfig;
// modulePathIgnorePatterns: ['<rootDir>/dist/'],
// coveragePathIgnorePatterns: [
//   "src/utils/rabbitmq.ts"
// ],
