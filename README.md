# @aegisx/crud-generator

Professional CRUD Generator for AegisX Platform with interactive CLI and flexible template system.

## ✨ Features

- 🎯 **Interactive Mode** - Step-by-step wizard for easy code generation
- 🎨 **Template System** - Multiple templates with easy switching (domain/standard, v2/v1)
- 🛠️ **Template Management** - CLI commands to manage and customize templates
- ⚙️ **Configuration** - Project-level preferences with `.crudgen.json`
- 📦 **Multi-Package** - Standard, Enterprise, and Full feature packages
- ⚡ **WebSocket Events** - Real-time CRUD operations support
- 🔐 **Permission System** - Auto-generate roles and permissions
- 100% **Backward Compatible** - All existing commands still work

## 🚀 Quick Start

### Interactive Mode (Recommended)

```bash
npx aegisx-crud generate
```

The interactive wizard will guide you through:

1. Table selection (from your database)
2. Generation type (fullstack, backend, frontend, permissions)
3. Template selection (backend: domain/standard, frontend: v2/v1)
4. Feature selection (events, bulk operations, export, import)
5. Advanced options and confirmation

### Quick Mode

```bash
# Generate full CRUD with events
npx aegisx-crud generate users --events --package full

# Generate backend only
npx aegisx-crud generate products --package enterprise

# Preview without creating files
npx aegisx-crud generate orders --dry-run
```

## 📦 Template Management

```bash
# List available templates
npx aegisx-crud templates list

# Set default template
npx aegisx-crud templates set-default

# View configuration
npx aegisx-crud config show

# Initialize config file
npx aegisx-crud config init
```

## 📚 Documentation

For complete documentation, see:

- **[Complete Documentation](./docs/README.md)** - Full user guide
- **[Migration Guide](./docs/MIGRATION_GUIDE.md)** - Upgrading from v1.x
- **[Template Development](./docs/TEMPLATE_DEVELOPMENT_GUIDE.md)** - Creating custom templates

## 🔧 Configuration

Create `.crudgen.json` in your project root:

```json
{
  "defaultTemplates": {
    "backend": "domain",
    "frontend": "v2"
  },
  "defaultFeatures": {
    "events": true,
    "bulkOperations": true,
    "export": false,
    "import": false
  }
}
```

## 📦 Available Packages

- **Standard** - Basic CRUD operations
- **Enterprise** - Advanced features (bulk ops, dropdowns, stats)
- **Full** - All features (validation, export, import)

## 🎯 Examples

```bash
# Interactive mode - easiest way
npx aegisx-crud generate

# Quick generation with all features
npx aegisx-crud generate notifications --package full --events

# Custom output directory
npx aegisx-crud generate users --output ./custom/path

# Force regeneration (removes duplicates)
npx aegisx-crud generate products --force
```

## 🛠️ Programmatic Usage

```javascript
const { generateCrudModule, TemplateManager } = require('@aegisx/crud-generator');

// Generate CRUD module
await generateCrudModule('users', {
  withEvents: true,
  package: 'full',
});

// Use Template Manager
const templateManager = new TemplateManager({
  templatesBasePath: './templates',
});
await templateManager.initialize();
```

## 📄 License

MIT © AegisX Team

---

**Need help?** Check the [complete documentation](./docs/README.md) or [template development guide](./docs/TEMPLATE_DEVELOPMENT_GUIDE.md).
