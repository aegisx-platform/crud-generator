# Contributing to @aegisx/crud-generator

Thank you for your interest in contributing to the AegisX CRUD Generator!

## 📌 Important: This is a Monorepo Package

This repository is **auto-synced** from the main AegisX monorepo at:

- **Source**: `aegisx-platform/aegisx-starter` → `libs/aegisx-crud-generator`
- **Published**: `aegisx-platform/crud-generator`

## 🔄 Development Workflow

### For AegisX Team Members (with monorepo access):

**Preferred**: Work directly in the monorepo:

```bash
# Clone the monorepo
git clone git@github.com:aegisx-platform/aegisx-starter.git
cd aegisx-starter

# Navigate to package
cd libs/aegisx-crud-generator

# Make changes and test
pnpm install
node bin/cli.js --help

# Commit to monorepo
git add .
git commit -m "feat(crud-generator): your feature"
git push

# Sync to standalone repo
./sync-to-repo.sh main
```

### For External Contributors:

1. **Fork** this repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Submit** a pull request

**Note**: Changes will be reviewed and merged into the monorepo, then auto-synced back.

## 🧪 Testing Your Changes

```bash
# Run CLI commands
node bin/cli.js templates list
node bin/cli.js config show

# Test programmatic API
node -e "const gen = require('./lib/index.js'); console.log(gen)"

# Test code generation (requires database)
node bin/cli.js generate users --dry-run
```

## 📦 Publishing (Maintainers Only)

```bash
# In monorepo: libs/aegisx-crud-generator
npm version patch  # or minor/major
npm publish --access public

# Sync to standalone repo
./sync-to-repo.sh main
```

## 🤝 Pull Request Guidelines

- Follow existing code style
- Update documentation if needed
- Add tests for new features
- Ensure all tests pass
- Keep commits atomic and well-described

## 📝 Commit Message Convention

Follow Conventional Commits:

```
feat(scope): description     # New feature
fix(scope): description      # Bug fix
docs(scope): description     # Documentation
refactor(scope): description # Code refactoring
test(scope): description     # Tests
```

## 📚 Resources

- [Documentation](./docs/README.md)
- [Template Development Guide](./docs/TEMPLATE_DEVELOPMENT_GUIDE.md)
- [Migration Guide](./docs/MIGRATION_GUIDE.md)

## 💬 Questions?

- Open an issue in this repository
- Contact the AegisX team

---

**Thank you for contributing to @aegisx/crud-generator!** 🚀
