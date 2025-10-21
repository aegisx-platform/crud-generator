# Development Workflow

This package lives in a **monorepo** but is **published as a standalone package**. Here's the complete workflow:

## 📦 Repository Structure

```
🏢 Monorepo (aegisx-starter)
└── libs/aegisx-crud-generator/     ← 🎯 Work here (Source of Truth)

📦 Standalone Repo (crud-generator)  ← 🔄 Auto-synced mirror for distribution
```

## 🔄 Complete Workflow

### 1️⃣ Development (in Monorepo)

```bash
cd libs/aegisx-crud-generator

# Make your changes
vim lib/some-file.js

# Test locally
node bin/cli.js templates list
node bin/cli.js --help
```

### 2️⃣ Commit (in Monorepo)

```bash
# Stage changes
git add .

# Commit
git commit -m "feat(crud-generator): your awesome feature"

# Push to monorepo
git push origin develop
```

### 3️⃣ Sync to Standalone Repo

```bash
# Sync changes to standalone repository
./sync-to-repo.sh main
```

**⚠️ IMPORTANT:** After **EVERY** commit that modifies `libs/aegisx-crud-generator/`, you MUST run `./sync-to-repo.sh main`

### 4️⃣ Publish to npm (for releases only)

```bash
# Update version
npm version patch  # or minor/major

# Publish (requires OTP)
./publish.sh <otp-code>

# Sync version update to standalone repo
./sync-to-repo.sh main
```

## 🚀 Quick Commands

```bash
# Development
node bin/cli.js generate                # Test generator
node bin/cli.js templates list          # List templates
npm pack --dry-run                      # Preview package

# Publishing
npm version patch                       # Bump version
./publish.sh 123456                     # Publish with OTP
./sync-to-repo.sh main                  # Sync to GitHub

# Verification
npm view @aegisx/crud-generator         # Check published package
npx @aegisx/crud-generator --version    # Test installation
```

## 📋 Checklist Before Publishing

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Committed and pushed to monorepo
- [ ] Synced to standalone repo
- [ ] Published to npm
- [ ] Created GitHub release
- [ ] Tested installation: `npx @aegisx/crud-generator --version`

## 🔍 Troubleshooting

### "I committed but changes aren't in standalone repo"

→ Run `./sync-to-repo.sh main`

### "I published but version is wrong"

→ Check `package.json` version, update with `npm version patch`, then republish

### "OTP required"

→ Get code from your authenticator app and use `./publish.sh <otp>`

### "E402 Payment Required"

→ Add `--access public` flag: `npm publish --access public --otp=<code>`

## 💡 Pro Tips

1. **Always work in monorepo** - The standalone repo is just a mirror
2. **Sync after every commit** - Keep repos in sync
3. **Use semantic versioning** - patch/minor/major
4. **Test before publishing** - Use `npm pack --dry-run`
5. **Keep CHANGELOG updated** - Document all changes

## 🔗 Links

- **Monorepo**: https://github.com/aegisx-platform/aegisx-starter
- **Standalone**: https://github.com/aegisx-platform/crud-generator
- **npm Package**: https://www.npmjs.com/package/@aegisx/crud-generator
