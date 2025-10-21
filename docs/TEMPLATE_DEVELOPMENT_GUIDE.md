# Template Development Guide

## Overview

This guide explains how to create custom code generation templates for the CRUD generator. Templates use Handlebars for dynamic content generation.

## Template Structure

### Required Files

Every template directory must contain:

```
my-template/
├── template.config.json     # ✅ Required - Template metadata
├── controller.hbs           # Template files (Handlebars)
├── service.hbs
├── repository.hbs
├── schema.hbs
└── ...
```

### template.config.json

This file defines template metadata:

```json
{
  "name": "my-template", // Template identifier (lowercase, hyphens)
  "version": "1.0.0", // Semantic version
  "description": "My custom template", // Human-readable description
  "default": false, // Is this the default template?
  "deprecated": false, // Mark template as deprecated
  "type": "backend", // "backend" or "frontend"
  "framework": "fastify", // Framework name (fastify, angular, etc.)
  "author": "Your Name", // Optional: Template author
  "license": "MIT" // Optional: Template license
}
```

## Template Context

Templates receive a rich context object with database schema information and configuration options.

### Available Context Variables

```handlebars
{{! Entity Information }}
{{entityName}}
// Singular name (e.g., "user")
{{EntityName}}
// PascalCase (e.g., "User")
{{ENTITY_NAME}}
// Uppercase (e.g., "USER")
{{entityNamePlural}}
// Plural name (e.g., "users")
{{EntityNamePlural}}
// PascalCase plural (e.g., "Users")

{{! Database Schema }}
{{tableName}}
// Database table name
{{columns}}
// Array of column objects
{{primaryKey}}
// Primary key column object

{{! Feature Flags }}
{{withEvents}}
// Boolean: Include WebSocket events
{{bulkOperations}}
// Boolean: Include bulk operations
{{export}}
// Boolean: Include export features
{{import}}
// Boolean: Include import features

{{! Package Type }}
{{package}}
// "standard", "enterprise", or "full"

{{! Configuration }}
{{templateVersion}}
// Selected template name
{{generationType}}
// "backend", "frontend", "fullstack"
```

### Column Object Structure

Each column in `{{columns}}` has:

```javascript
{
  name: "user_id",              // Column name
  type: "uuid",                 // Database type
  nullable: false,              // Is nullable?
  defaultValue: null,           // Default value
  isPrimaryKey: false,          // Is primary key?
  isForeignKey: true,           // Is foreign key?
  references: {                 // Foreign key reference (if applicable)
    table: "users",
    column: "id"
  },
  tsType: "string",             // TypeScript type
  typeboxType: "Type.String()", // TypeBox schema type
  isTimestamp: false,           // Is timestamp field?
  isUuid: true                  // Is UUID field?
}
```

## Handlebars Helpers

### Built-in Helpers

```handlebars
{{!-- Conditionals --}}
{{#if condition}}...{{/if}}
{{#unless condition}}...{{/unless}}

{{!-- Loops --}}
{{#each columns}}
  {{this.name}}: {{this.tsType}}
{{/each}}

{{!-- Case Conversion --}}
{{pascalCase entityName}}      // UserProfile
{{camelCase entityName}}       // userProfile
{{snakeCase entityName}}       // user_profile
{{kebabCase entityName}}       // user-profile
{{upperCase entityName}}       // USERPROFILE
{{lowerCase entityName}}       // userprofile

{{!-- Equality --}}
{{#ifEquals type "backend"}}...{{/ifEquals}}

{{!-- Array Helpers --}}
{{#isFirst @index}}...{{/isFirst}}
{{#isLast @index ../columns}}...{{/isLast}}
```

## Example Templates

### Backend Controller Template

```handlebars
/**
 * {{EntityName}} Controller
 *
 * Handles HTTP requests for {{entityNamePlural}}
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { {{EntityName}}Service } from '../services/{{kebabCase entityName}}.service';
import {
  {{EntityName}}Schema,
  Create{{EntityName}}Schema,
  Update{{EntityName}}Schema
} from '../schemas/{{kebabCase entityName}}.schemas';

export class {{EntityName}}Controller {
  constructor(private service: {{EntityName}}Service) {}

  /**
   * Get all {{entityNamePlural}}
   */
  async findAll(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.service.findAll(request.query);
    return reply.send(result);
  }

  /**
   * Get {{entityName}} by ID
   */
  async findOne(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const result = await this.service.findOne(request.params.id);
    if (!result) {
      return reply.code(404).send({ error: '{{EntityName}} not found' });
    }
    return reply.send(result);
  }

  /**
   * Create new {{entityName}}
   */
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body;
    const result = await this.service.create(data);
    return reply.code(201).send(result);
  }

  /**
   * Update {{entityName}}
   */
  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const result = await this.service.update(request.params.id, request.body);
    return reply.send(result);
  }

  /**
   * Delete {{entityName}}
   */
  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    await this.service.delete(request.params.id);
    return reply.code(204).send();
  }

{{#if bulkOperations}}
  /**
   * Bulk create {{entityNamePlural}}
   */
  async bulkCreate(request: FastifyRequest, reply: FastifyReply) {
    const items = request.body as any[];
    const result = await this.service.bulkCreate(items);
    return reply.code(201).send(result);
  }

  /**
   * Bulk update {{entityNamePlural}}
   */
  async bulkUpdate(request: FastifyRequest, reply: FastifyReply) {
    const items = request.body as any[];
    const result = await this.service.bulkUpdate(items);
    return reply.send(result);
  }

  /**
   * Bulk delete {{entityNamePlural}}
   */
  async bulkDelete(
    request: FastifyRequest<{ Body: { ids: string[] } }>,
    reply: FastifyReply
  ) {
    await this.service.bulkDelete(request.body.ids);
    return reply.code(204).send();
  }
{{/if}}
}
```

### Frontend Service Template (Angular)

```handlebars
/**
 * {{EntityName}} Service
 *
 * Handles API communication for {{entityNamePlural}}
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { {{EntityName}} } from '../models/{{kebabCase entityName}}.model';

@Injectable({
  providedIn: 'root'
})
export class {{EntityName}}Service {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/{{kebabCase entityNamePlural}}';

  /**
   * Get all {{entityNamePlural}}
   */
  findAll(params?: any): Observable<{{EntityName}}[]> {
    return this.http.get<{{EntityName}}[]>(this.baseUrl, { params });
  }

  /**
   * Get {{entityName}} by ID
   */
  findOne(id: string): Observable<{{EntityName}}> {
    return this.http.get<{{EntityName}}>(`${this.baseUrl}/${id}`);
  }

  /**
   * Create new {{entityName}}
   */
  create(data: Partial<{{EntityName}}>): Observable<{{EntityName}}> {
    return this.http.post<{{EntityName}}>(this.baseUrl, data);
  }

  /**
   * Update {{entityName}}
   */
  update(id: string, data: Partial<{{EntityName}}>): Observable<{{EntityName}}> {
    return this.http.put<{{EntityName}}>(`${this.baseUrl}/${id}`, data);
  }

  /**
   * Delete {{entityName}}
   */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

{{#if bulkOperations}}
  /**
   * Bulk create {{entityNamePlural}}
   */
  bulkCreate(items: Partial<{{EntityName}}[]>): Observable<{{EntityName}}[]> {
    return this.http.post<{{EntityName}}[]>(`${this.baseUrl}/bulk`, items);
  }

  /**
   * Bulk update {{entityNamePlural}}
   */
  bulkUpdate(items: Partial<{{EntityName}}[]>): Observable<{{EntityName}}[]> {
    return this.http.put<{{EntityName}}[]>(`${this.baseUrl}/bulk`, items);
  }

  /**
   * Bulk delete {{entityNamePlural}}
   */
  bulkDelete(ids: string[]): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/bulk`, { body: { ids } });
  }
{{/if}}
}
```

## Testing Your Template

### 1. Create Template Directory

```bash
mkdir -p /path/to/my-custom-template
cd /path/to/my-custom-template
```

### 2. Add template.config.json

```json
{
  "name": "my-custom",
  "version": "1.0.0",
  "description": "My custom template",
  "type": "backend",
  "framework": "fastify"
}
```

### 3. Add Template Files

Create `.hbs` files for each component (controller, service, etc.)

### 4. Register Template

```bash
# Interactive registration
npx aegisx-crud templates add

# Or manually edit .crudgen.json
```

```json
{
  "customTemplates": {
    "backend": {
      "my-custom": {
        "path": "/path/to/my-custom-template",
        "description": "My custom template"
      }
    }
  }
}
```

### 5. Test Generation

```bash
# Use interactive mode and select your template
npx aegisx-crud generate

# Or dry-run to preview
npx aegisx-crud generate users --dry-run
```

## Best Practices

### 1. Template Organization

```
my-template/
├── template.config.json
├── controllers/
│   └── controller.hbs
├── services/
│   └── service.hbs
├── repositories/
│   └── repository.hbs
└── schemas/
    └── schema.hbs
```

### 2. Documentation

Add comments in templates to explain context usage:

```handlebars
{{!
  This template generates a Fastify controller

  Required context:
  - entityName: Singular entity name
  - columns: Array of table columns
  - withEvents: Boolean for WebSocket support
}}
```

### 3. Conditional Features

Use feature flags to make templates flexible:

```handlebars
{{#if withEvents}}
  // WebSocket event emission await this.eventHelper.emitCreated(result);
{{/if}}

{{#ifEquals package 'full'}}
  // Advanced features only in full package async getStatistics() { ... }
{{/ifEquals}}
```

### 4. Type Safety

Generate TypeScript types from schema:

```handlebars
export interface
{{EntityName}}
{
{{#each columns}}
  {{camelCase this.name}}{{#if this.nullable}}?{{/if}}:
  {{this.tsType}};
{{/each}}
}
```

### 5. Error Handling

Include proper error handling in templates:

```handlebars
try { const result = await this.service.{{methodName}}(...); return reply.send(result); } catch (error) { request.log.error(error); return reply.code(500).send({ error: 'Failed to {{actionName}} {{entityName}}' }); }
```

## Common Patterns

### Loop with Comma Separation

```handlebars
{
{{#each columns}}
  {{this.name}}:
  {{this.tsType}}{{#unless @last}},{{/unless}}
{{/each}}
}
```

### Conditional Imports

```handlebars
{{#if withEvents}}
  import { EventHelper } from '../helpers/event.helper';
{{/if}}
```

### Schema Generation

```handlebars
export const
{{EntityName}}Schema = Type.Object({
{{#each columns}}
  {{this.name}}:
  {{this.typeboxType}}{{#unless @last}},{{/unless}}
{{/each}}
});
```

## Sharing Templates

To share your template with others:

1. **Package as npm module**

   ```json
   {
     "name": "crud-template-my-custom",
     "version": "1.0.0",
     "main": "index.js"
   }
   ```

2. **Publish to registry**

   ```bash
   npm publish
   ```

3. **Users install and register**
   ```bash
   npm install crud-template-my-custom
   npx aegisx-crud templates add
   # Path: node_modules/crud-template-my-custom
   ```

## Troubleshooting

### Template Not Found

- Check `template.config.json` exists
- Verify `name` field matches directory name
- Run `npx aegisx-crud templates list` to confirm registration

### Context Variables Not Working

- Check variable names match available context
- Use `{{#log this}}` helper to debug context
- Review template renderer logs

### Syntax Errors

- Validate Handlebars syntax
- Check for unmatched `{{#if}}...{{/if}}` blocks
- Test with `--dry-run` flag

---

**Happy template development!** 🎨 Share your templates with the community!
