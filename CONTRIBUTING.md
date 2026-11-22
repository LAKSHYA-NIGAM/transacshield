# Contributing to transacshield

Thank you for your interest in contributing to **transacshield**! This document outlines the guidelines for contributing to this project.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/transacshield.git
   cd transacshield
   ```
3. **Install** dependencies:
   ```bash
   npm install
   ```
4. Create a **feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Before You Code

- Check the [Issues](https://github.com/LAKSHYA-NIGAM/transacshield/issues) for existing bugs or feature requests.
- For large changes, open an issue first to discuss the approach.

### Code Standards

- Follow the existing code style and naming conventions used in the project.
- Keep functions small, focused, and well-documented with JSDoc / docstrings where applicable.
- Avoid introducing unnecessary dependencies.

### Testing

- Write or update tests to cover your changes.
- All existing tests must continue to pass:
  ```bash
  npm test
  ```
- Aim for meaningful test coverage — not just line coverage.

### Commit Messages

Use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`, `ci`

**Examples:**
```
feat(auth): add JWT refresh token rotation
fix(api): handle null response from upstream service
test(utils): add edge case tests for date formatter
docs: update API endpoint documentation
```

### Pull Request Process

1. Update the `README.md` if your change affects public-facing behaviour.
2. Ensure your branch is up to date with `main` before opening a PR:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
3. Open a Pull Request with:
   - A clear title following the commit message convention.
   - A description explaining **what** changed and **why**.
   - Reference to any related issues (`Closes #123`).

## Code of Conduct

- Be respectful and constructive in all interactions.
- Provide helpful, specific feedback in code reviews.
- Disagreements on approach should be resolved through discussion, not personal attacks.

## Reporting Bugs

Please open an [Issue](https://github.com/LAKSHYA-NIGAM/transacshield/issues/new) with:
- A clear, descriptive title.
- Steps to reproduce the issue.
- Expected vs. actual behaviour.
- Environment details (OS, Node/Python/Java version, etc.).

---

By contributing, you agree that your contributions will be licensed under the same license as this project.
