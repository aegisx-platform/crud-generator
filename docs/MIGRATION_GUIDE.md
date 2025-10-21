# Migration Guide: CLI V2 Update

## Overview

The CRUD generator has been upgraded with a new interactive CLI, template management system, and improved user experience. This guide helps existing users migrate to the new version.

## What's New?

### ✨ Interactive Mode

- **Step-by-step wizard** - No need to remember all flags
- **Table selection** - Browse available database tables
- **Generation type selection** - Fullstack, backend, frontend, or permissions only
- **Template selection** - Choose from available templates
- **Feature selection** - Pick exactly what you need
- **Confirmation** - Preview before generation

### 🎨 Template System

- **Multiple templates** - Domain/standard for backend, v2/v1 for frontend
- **Custom templates** - Add your own code generation templates
- **Default configuration** - Set preferences once, use everywhere
- **Template metadata** - Version info, descriptions, framework tags

### 🛠️ Template Management

- **List templates** - `npx aegisx-crud templates list`
- **Set defaults** - `npx aegisx-crud templates set-default`
- **Add custom** - `npx aegisx-crud templates add`
- **Remove custom** - `npx aegisx-crud templates remove`

### ⚙️ Configuration File

- **`.crudgen.json`** - Project-level configuration
- **Default templates** - Backend and frontend preferences
- **Default features** - Events, bulk operations, export, import
- **Custom templates** - Register external template directories

## Breaking Changes

### ⚠️ None!

The new CLI is **100% backward compatible**. All your existing commands still work:

```bash
# Old commands still work exactly the same
node index.js generate users --events
node index.js generate users --package enterprise
node index.js generate users --dry-run --force
```

## Migration Steps

### Step 1: Try Interactive Mode

The easiest way to explore new features:

```bash
# Launch interactive wizard
npx aegisx-crud generate
```

### Step 2: Configure Defaults (Optional)

Set your preferred templates once:

```bash
# Create configuration file
npx aegisx-crud config init

# Set default templates interactively
npx aegisx-crud templates set-default

# View configuration
npx aegisx-crud config show
```

### Step 3: Use Quick Mode with Defaults

After configuring, quick mode uses your preferences:

```bash
# Uses your default templates automatically
npx aegisx-crud generate users --events
```

## New Commands Reference

### Template Commands

```bash
# List all templates
npx aegisx-crud templates list

# List backend templates only
npx aegisx-crud templates list backend

# List frontend templates only
npx aegisx-crud templates list frontend

# Set default template (interactive)
npx aegisx-crud templates set-default

# Add custom template (interactive)
npx aegisx-crud templates add

# Remove custom template (interactive)
npx aegisx-crud templates remove
```

### Configuration Commands

```bash
# Initialize .crudgen.json
npx aegisx-crud config init

# Show current configuration
npx aegisx-crud config show
```

### Generation Commands

```bash
# Interactive mode (new!)
npx aegisx-crud generate

# Quick mode (same as before)
npx aegisx-crud generate <table-name> [options]
```

## Configuration File Format

Create `.crudgen.json` in your project root:

```json
{
  "defaultTemplates": {
    "backend": "domain",
    "frontend": "v2"
  },
  "customTemplates": {
    "backend": {
      "my-custom": {
        "path": "/path/to/custom/backend/template",
        "description": "My custom backend template"
      }
    },
    "frontend": {
      "my-angular": {
        "path": "/path/to/custom/frontend/template",
        "description": "My custom Angular template"
      }
    }
  },
  "defaultFeatures": {
    "events": true,
    "bulkOperations": true,
    "export": false,
    "import": false
  }
}
```

## Template Directory Structure

Custom templates must follow this structure:

```
my-custom-template/
├── template.config.json     # Required metadata
├── controller.hbs           # Handlebars templates
├── service.hbs
├── repository.hbs
└── ...
```

### template.config.json Format

```json
{
  "name": "my-custom",
  "version": "1.0.0",
  "description": "My custom template",
  "default": false,
  "type": "backend",
  "framework": "fastify"
}
```

## Frequently Asked Questions

### Will my existing scripts break?

**No.** All existing commands work exactly as before. The new CLI is fully backward compatible.

### Do I have to use interactive mode?

**No.** Interactive mode is optional. Quick mode (direct commands with flags) works as always.

### Can I keep using my current workflow?

**Yes.** Nothing changes unless you want to use the new features.

### What happens if I don't create .crudgen.json?

The generator uses sensible defaults (domain for backend, v2 for frontend). Configuration is optional.

### Can I use custom templates?

**Yes.** Add them via `npx aegisx-crud templates add` or manually in `.crudgen.json`.

### How do I switch between templates?

```bash
# Set default for all future generations
npx aegisx-crud templates set-default

# Or specify in interactive mode when generating
npx aegisx-crud generate
# Then select template from the list
```

## Recommended Workflow

### For New Users

1. **Start with interactive mode**

   ```bash
   npx aegisx-crud generate
   ```

2. **Configure preferences** (optional)

   ```bash
   npx aegisx-crud config init
   npx aegisx-crud templates set-default
   ```

3. **Use quick mode** with configured defaults
   ```bash
   npx aegisx-crud generate users --events
   ```

### For Existing Users

**Option 1: Keep Current Workflow**

- Continue using quick mode commands
- No changes needed

**Option 2: Gradually Adopt New Features**

- Try interactive mode occasionally
- Configure defaults when convenient
- Use new features as needed

**Option 3: Full Migration**

- Configure `.crudgen.json` with team preferences
- Set default templates
- Train team on interactive mode
- Adopt template management for custom needs

## Getting Help

```bash
# Show all available commands
npx aegisx-crud --help

# Show template commands
npx aegisx-crud templates --help

# Show config commands
npx aegisx-crud config --help

# Show generate command options
npx aegisx-crud generate --help
```

## Support

If you encounter issues:

1. Check this migration guide
2. Review the updated [README.md](./README.md)
3. Check template configuration with `npx aegisx-crud config show`
4. Try `--dry-run` to preview changes
5. Raise an issue in the project repository

---

**Remember: The update is 100% backward compatible. Take your time exploring new features!** 🚀
