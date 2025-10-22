# 🚀 Enhanced CRUD Generator

> **🎯 100% Working Status Achieved** - Complete frontend + backend code generation with zero manual fixes required

Modern CRUD API generator with TypeBox schemas, WebSocket events, and multi-package support.

## 📚 Complete Documentation

**For comprehensive documentation, see:** **[📖 Complete CRUD Generator Documentation](../../docs/crud-generator/README.md)**

- **[📖 README](../../docs/crud-generator/README.md)** - Quick start and overview
- **[📋 Error Handling Guide](../../docs/crud-generator/ERROR_HANDLING_GUIDE.md)** - Automatic error detection and handling
- **[✅ Validation Reference](../../docs/crud-generator/VALIDATION_REFERENCE.md)** - Auto-detected validation rules
- **[🧪 Testing Guide](../../docs/crud-generator/TESTING_GUIDE.md)** - Testing strategies and best practices

---

## ✨ Features

- **🎯 Smart Field Selection** - Automatic dropdown label field detection
- **🔐 Permission Management** - Auto-generates permissions and roles
- **⚡ WebSocket Events** - Real-time CRUD operations
- **📦 Multi-Package Support** - Standard, Enterprise, Full packages
- **🧹 Duplicate Prevention** - Automatic cleanup of duplicate migrations
- **🔍 Dry Run Mode** - Preview before generation
- **📊 TypeBox Integration** - Type-safe schemas with validation

## 🚀 Quick Start

### Interactive Mode (Recommended)

```bash
# Launch interactive wizard - asks step-by-step
npx aegisx-crud generate

# Interactive mode will guide you through:
# 1. Table selection (from your database)
# 2. Generation type (fullstack, backend, frontend, permissions)
# 3. Template selection (backend: domain/standard, frontend: v2/v1)
# 4. Feature selection (events, bulk operations, export, import)
# 5. Advanced options (dry-run, force, etc.)
# 6. Confirmation before generation
```

### Quick Mode (Direct Command)

```bash
# Generate standard CRUD API (no interaction)
npx aegisx-crud generate tableName

# Generate with events (WebSocket)
npx aegisx-crud generate tableName --events

# Preview without creating files
npx aegisx-crud generate tableName --dry-run

# Force regeneration (removes duplicates)
npx aegisx-crud generate tableName --force
```

### Package Options

```bash
# Standard package (basic CRUD)
npx aegisx-crud generate tableName --package standard

# Enterprise package (advanced features)
npx aegisx-crud generate tableName --package enterprise

# Full package (all features)
npx aegisx-crud generate tableName --package full
```

### Template Management

```bash
# List available templates
npx aegisx-crud templates list        # List all templates
npx aegisx-crud templates list backend   # List backend only
npx aegisx-crud templates list frontend  # List frontend only

# Set default template (interactive)
npx aegisx-crud templates set-default

# Add custom template
npx aegisx-crud templates add

# Remove custom template
npx aegisx-crud templates remove

# Configuration
npx aegisx-crud config init     # Create .crudgen.json config file
npx aegisx-crud config show     # Show current configuration
```

## 🎨 Template System

The CRUD generator supports multiple code generation templates with easy switching.

### Available Templates

#### Backend Templates

1. **Domain Template (Default)** ✅
   - Organized by feature domains
   - Clean separation of concerns
   - Recommended for all new projects
   - Location: `templates/backend/domain/`

2. **Standard Template**
   - Flat structure
   - All files in single directory
   - Good for simple APIs
   - Location: `templates/backend/standard/`

#### Frontend Templates

1. **V2 Template (Default)** ✅
   - Angular 19 + Signals
   - Material Design components
   - Modern reactive patterns
   - Location: `templates/frontend/v2/`

2. **V1 Template** (Deprecated)
   - Legacy Angular structure
   - Traditional components
   - Maintained for compatibility
   - Location: `templates/frontend/v1/`

### Using Templates

Templates are automatically selected during interactive mode, or you can configure defaults:

```bash
# View current templates
npx aegisx-crud templates list

# Configure default templates
npx aegisx-crud templates set-default

# View configuration
npx aegisx-crud config show
```

### Custom Templates

Create your own templates by:

1. **Add custom template directory**:

```bash
npx aegisx-crud templates add
# Follow prompts to specify template name, path, and description
```

2. **Configure in .crudgen.json**:

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
  }
}
```

3. **Use in generation**:

```bash
# Interactive mode will show your custom templates
npx aegisx-crud generate
```

### Template Structure

Each template directory must include a `template.config.json`:

```json
{
  "name": "domain",
  "version": "2.0.0",
  "description": "Domain-based structure (Recommended)",
  "default": true,
  "type": "backend",
  "framework": "fastify"
}
```

## 📊 Smart Field Selection

The generator automatically selects the best field for dropdown labels:

1. **Priority 1**: String fields named `name`, `title`, `label`, `description`
2. **Priority 2**: Any string field (non-primary key)
3. **Priority 3**: Second column if exists
4. **Fallback**: Primary key field

## 🔐 Permission System

### Automatic Permission Generation

For each entity, the generator creates:

- `{entity}.create` - Create permission
- `{entity}.read` - Read permission
- `{entity}.update` - Update permission
- `{entity}.delete` - Delete permission

### Role Generation

- **Single Role**: `{entity}` role with all permissions
- **Multiple Roles**: `{entity}_admin`, `{entity}_editor`, `{entity}_viewer`

### Duplicate Handling

- ✅ **Checks existing migrations** before creation
- ✅ **Removes duplicate migration files** automatically
- ✅ **Cleans up database permissions** when regenerating
- ✅ **Creates fresh migration** with latest timestamp

## ⚡ WebSocket Events

Enable real-time features with `--events` flag:

```typescript
// Auto-generated service with events
export class NotificationsService extends BaseService {
  async create(data) {
    const result = await super.create(data);
    // 🔥 Auto WebSocket broadcast
    await this.eventHelper.emitCreated(result);
    return result;
  }
}
```

### Event Types

- `{entity}.created` - Item created
- `{entity}.updated` - Item updated
- `{entity}.deleted` - Item deleted
- `{entity}.bulk_created` - Bulk creation
- `{entity}.bulk_updated` - Bulk update
- `{entity}.bulk_deleted` - Bulk deletion

## 📦 Package Comparison

| Feature              | Standard | Enterprise | Full |
| -------------------- | -------- | ---------- | ---- |
| Basic CRUD           | ✅       | ✅         | ✅   |
| TypeBox Schemas      | ✅       | ✅         | ✅   |
| WebSocket Events     | ❌       | ✅         | ✅   |
| Bulk Operations      | ❌       | ✅         | ✅   |
| Advanced Validation  | ❌       | ✅         | ✅   |
| Statistics Endpoints | ❌       | ❌         | ✅   |
| Search & Filtering   | ❌       | ✅         | ✅   |
| Export Features      | ❌       | ❌         | ✅   |

## 🎯 Example: Notifications CRUD

### Generate Complete API

```bash
# Generate full notifications CRUD with events (interactive)
npx aegisx-crud generate

# Or quick mode
npx aegisx-crud generate notifications --package full --events

# Generated structure:
apps/api/src/modules/notifications/
├── controllers/notifications.controller.ts  # Complete CRUD endpoints
├── services/notifications.service.ts        # Business logic + events
├── repositories/notifications.repository.ts # Data access layer
├── schemas/notifications.schemas.ts         # TypeBox validation
├── types/notifications.types.ts            # TypeScript interfaces
├── routes/index.ts                         # Fastify routes
├── __tests__/notifications.test.ts        # Comprehensive tests
└── index.ts                               # Module exports

# Plus auto-generated:
apps/api/src/database/migrations/
└── 20250928_add_notifications_permissions.ts # Permissions migration
```

### Generated Endpoints

```typescript
// Standard CRUD
POST   /api/notifications          // Create
GET    /api/notifications/:id      // Read one
GET    /api/notifications          // Read list
PUT    /api/notifications/:id      // Update
DELETE /api/notifications/:id      // Delete

// Enhanced endpoints (Enterprise+)
GET    /api/notifications/dropdown     // Dropdown options
POST   /api/notifications/bulk         // Bulk create
PUT    /api/notifications/bulk         // Bulk update
DELETE /api/notifications/bulk         // Bulk delete
POST   /api/notifications/validate     // Validate data
GET    /api/notifications/check/:field // Check uniqueness

// Advanced endpoints (Full package)
GET    /api/notifications/stats        // Statistics
GET    /api/notifications/export       // Export data
GET    /api/notifications/search       // Advanced search
```

## 🧹 Cleanup Features

### Migration Duplicate Prevention

```bash
# Before: Multiple duplicate files
apps/api/src/database/migrations/
├── 20250928042718_add_notifications_permissions.ts  # Duplicate
├── 20250928043342_add_notifications_permissions.ts  # Duplicate
├── 20250928043648_add_notifications_permissions.ts  # Duplicate
└── 20250928050932_add_notifications_permissions.ts  # Latest

# After: Clean single migration
apps/api/src/database/migrations/
└── 20250928060151_add_notifications_permissions.ts  # Fresh, latest
```

### Database Permission Cleanup

- ✅ Removes existing permissions for entity
- ✅ Removes role_permissions links
- ✅ Removes related roles
- ✅ Creates fresh permissions with latest schema

## 🔧 Advanced Options

### Force Regeneration

```bash
# Force regenerate (removes all duplicates)
npx aegisx-crud generate notifications --force

# Console output:
# ⚠️  Found existing permissions migration(s) for notifications
# 🧹 Removing 3 duplicate migration(s)...
# ✅ Created fresh migration file
```

### Database Direct Write (Development)

```bash
# Write directly to database (skip migration)
npx aegisx-crud generate notifications --direct-db

# ⚠️  Development only - not recommended for production
```

### Multiple Roles Strategy

```bash
# Generate multiple granular roles
npx aegisx-crud generate notifications --multiple-roles

# Creates:
# - notifications_admin (full access)
# - notifications_editor (create, read, update)
# - notifications_viewer (read only)
```

## 🎯 Best Practices

### 1. Use Appropriate Package

```bash
# Simple APIs
--package standard

# Business applications
--package enterprise

# Complex systems with analytics
--package full
```

### 2. Start with Interactive Mode

```bash
# ✅ Recommended for new users
npx aegisx-crud generate
# Interactive wizard guides you through all options

# ⚡ Quick mode for experienced users
npx aegisx-crud generate notifications --package full --events
```

### 3. Always Use Migration Files

```bash
# ✅ Recommended (production-safe)
npx aegisx-crud generate notifications

# ❌ Avoid in production
npx aegisx-crud generate notifications --direct-db
```

### 4. Enable Events for Real-time Apps

```bash
# For dashboards, live updates
npx aegisx-crud generate notifications --events
```

### 5. Preview Before Generation

```bash
# Always preview first
npx aegisx-crud generate notifications --dry-run

# Then execute
npx aegisx-crud generate notifications
```

### 6. Configure Templates Once

```bash
# Set your preferred defaults
npx aegisx-crud config init
npx aegisx-crud templates set-default

# Future generations use your preferences
npx aegisx-crud generate
```

## 🚀 Integration with Frontend

The generated APIs are designed to work seamlessly with:

- **Angular Frontend CRUD Generator** (coming soon)
- **Real-time WebSocket integration**
- **Type-safe client libraries**
- **Consistent API patterns**

## 📚 Related Documentation

- [API Development Guide](../../docs/development/api-development.md)
- [WebSocket System](../../docs/websocket-system.md)
- [TypeBox Schema Standard](../../docs/05c-typebox-schema-standard.md)
- [Permission System](../../docs/rbac-system.md)

---

## 🎯 Next Steps

With notifications as our test case, you can:

1. **Test the API** - Use generated endpoints
2. **Generate Frontend** - Use Frontend CRUD Generator
3. **Enable Real-time** - Test WebSocket events
4. **Customize Templates** - Modify for your needs

**Ready to generate your CRUD API!** 🚀
