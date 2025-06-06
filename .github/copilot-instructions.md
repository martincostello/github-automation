# Copilot Instructions

When any TypeScript files in `src` are changed or if `package.json` is modified, run `npm run publish` to regenerate the files in `dist`
and ensure any changes to those files are committed. This should be done last when all other changes have been completed.

Ensure that any new files that are added to `src` or `tests` end with a newline, as specified in the `.editorconfig` configuration (see `insert_final_newline = true`).

Jest is used for tests.

Prefer data-driven tests over multiple individual test cases where relevant.
