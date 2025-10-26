const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

// Register Handlebars helpers
// Note: Don't register PascalCase as helper since templates use {{PascalCase}} as context variable

// IMPORTANT: Do NOT register camelCase, kebabCase, or PascalCase as helpers
// These are used as context variables in templates and registering them as helpers
// causes conflicts where Handlebars invokes the helper (with no args) instead of
// reading the context variable, resulting in empty strings.

Handlebars.registerHelper('pascalCaseHelper', function (str) {
  if (!str || typeof str !== 'string') return '';
  return (
    str.charAt(0).toUpperCase() +
    str.slice(1).replace(/[-_](.)/g, (_, char) => char.toUpperCase())
  );
});

Handlebars.registerHelper('camelCaseHelper', function (str) {
  if (!str || typeof str !== 'string') return '';
  return (
    str.charAt(0).toLowerCase() +
    str.slice(1).replace(/[-_](.)/g, (_, char) => char.toUpperCase())
  );
});

Handlebars.registerHelper('kebabCaseHelper', function (str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes
});

Handlebars.registerHelper('titleCase', function (str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
    )
    .replace(/_/g, ' ');
});

// Helper to convert camelCase moduleName back to kebab-case table name
Handlebars.registerHelper('tableNameToKebab', function (camelCaseModuleName) {
  if (!camelCaseModuleName || typeof camelCaseModuleName !== 'string')
    return '';
  // Convert camelCase to snake_case then to kebab-case
  const snakeCase = camelCaseModuleName
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
  return snakeCase.replace(/_/g, '-');
});

Handlebars.registerHelper('isStringType', function (type) {
  return type === 'string' || type === 'text';
});

Handlebars.registerHelper('capitalize', function (str) {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('capitalizeFirst', function (str) {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('lowercase', function (str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase();
});

// Removed custom 'each' helper to avoid conflicts with built-in Handlebars helper

// Conditional helpers
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

Handlebars.registerHelper('contains', function (str, substring) {
  if (!str || !substring) return false;
  return str.toString().includes(substring.toString());
});

Handlebars.registerHelper('or', function (...args) {
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i]) return true;
  }
  return false;
});

Handlebars.registerHelper('and', function (...args) {
  for (let i = 0; i < args.length - 1; i++) {
    if (!args[i]) return false;
  }
  return true;
});

Handlebars.registerHelper('unless', function (conditional, options) {
  if (!conditional) {
    return options.fn(this);
  }
  return options.inverse(this);
});

// Date field helpers
Handlebars.registerHelper('isDateField', function (column) {
  const { dataType, tsType } = column;
  return (
    tsType === 'Date' ||
    (dataType &&
      (dataType.includes('timestamp') ||
        dataType.includes('date') ||
        dataType.includes('datetime')))
  );
});

Handlebars.registerHelper('isDateTime', function (column) {
  const { dataType } = column;
  return dataType && dataType.includes('timestamp');
});

Handlebars.registerHelper('hasDateFields', function (columns) {
  if (!Array.isArray(columns)) return false;
  return columns.some((column) => {
    const { dataType, tsType } = column;
    return (
      tsType === 'Date' ||
      (dataType &&
        (dataType.includes('timestamp') ||
          dataType.includes('date') ||
          dataType.includes('datetime')))
    );
  });
});

Handlebars.registerHelper('isExactMatchField', function (column) {
  const { tsType } = column;
  return tsType === 'boolean' || tsType === 'string' || tsType === 'number';
});

Handlebars.registerHelper('isRangeField', function (column) {
  const { tsType } = column;
  return tsType === 'number';
});

Handlebars.registerHelper('getFormName', function () {
  return this.formName;
});

class FrontendGenerator {
  constructor(toolsDir = null, projectRoot = null, options = {}) {
    this.toolsDir = toolsDir || path.resolve(__dirname, '..');
    this.projectRoot = projectRoot || path.resolve(this.toolsDir, '..', '..');

    // Template version selection: v1, v2, or default to v2
    const templateVersion = options.templateVersion || 'v2';

    // Templates are now at templates/frontend/v1 or templates/frontend/v2
    this.templatesDir = path.join(
      this.toolsDir,
      'templates',
      'frontend',
      templateVersion,
    );
    this.templateVersion = templateVersion;
    this.outputDir = path.resolve(
      this.projectRoot,
      'apps',
      'web',
      'src',
      'app',
      'features',
    );

    console.log(
      `📋 Using ${templateVersion.toUpperCase()} templates from: templates/frontend/${templateVersion}`,
    );
  }

  /**
   * Extract TypeScript types from backend TypeBox schemas
   */
  extractTypesFromBackendModule(moduleName) {
    // Convert moduleName to camelCase to match backend module naming
    const camelCaseModuleName = this.toCamelCase(moduleName);
    // Convert to kebab-case for file paths since files are now kebab-case
    const kebabCaseModuleName = this.toKebabCase(moduleName);
    const backendModulePath = path.resolve(
      this.toolsDir,
      '..',
      '..',
      'apps',
      'api',
      'src',
      'modules',
      camelCaseModuleName,
    );

    try {
      // Read the schemas file - now use kebab-case file names
      const schemasPath = path.join(
        backendModulePath,
        'schemas',
        `${kebabCaseModuleName}.schemas.ts`,
      );
      // Use kebab-case for types file consistency with backend
      const typeFileName = `${kebabCaseModuleName}.types.ts`;
      const typesPath = path.join(backendModulePath, 'types', typeFileName);

      if (!fs.existsSync(schemasPath)) {
        throw new Error(`Backend schemas file not found: ${schemasPath}`);
      }

      // Read and parse schema file for type information
      const schemasContent = fs.readFileSync(schemasPath, 'utf8');
      const typesContent = fs.existsSync(typesPath)
        ? fs.readFileSync(typesPath, 'utf8')
        : '';

      return this.parseBackendTypes(schemasContent, typesContent, moduleName);
    } catch (error) {
      console.error('Error extracting types from backend:', error.message);
      throw error;
    }
  }

  /**
   * Parse backend TypeBox schemas to extract TypeScript interface definitions
   */
  parseBackendTypes(schemasContent, typesContent, moduleName) {
    const pascalName = this.toPascalCase(moduleName);

    // Extract basic schema structure
    const types = {};

    // Use the singular form for the main entity (e.g., "Notification" not "Notifications")
    const singularPascalName = pascalName.endsWith('s')
      ? pascalName.slice(0, -1)
      : pascalName;

    // Define the main entity type based on the schema (backend uses PLURAL names)
    const mainEntityFields = this.extractSchemaFields(
      schemasContent,
      `${pascalName}Schema`,
    );
    const createFields = this.extractSchemaFields(
      schemasContent,
      `Create${pascalName}Schema`,
    );
    const updateFields = this.extractSchemaFields(
      schemasContent,
      `Update${pascalName}Schema`,
    );
    const queryFields = this.extractSchemaFields(
      schemasContent,
      `List${pascalName}QuerySchema`,
    );

    types[singularPascalName] = mainEntityFields;
    types[`Create${singularPascalName}Request`] = createFields;
    types[`Update${singularPascalName}Request`] = updateFields;
    types[`List${pascalName}Query`] = queryFields; // Keep plural for List query to match backend

    return types;
  }

  /**
   * Extract field definitions from actual TypeScript interface files
   */
  extractSchemaFields(content, schemaName) {
    try {
      // Parse TypeBox schema from backend content
      if (content && content.includes(schemaName)) {
        const fields = this.parseTypeBoxSchema(content, schemaName);
        if (fields && Object.keys(fields).length > 0) {
          return fields;
        }
      }

      // Fallback: return empty for now to avoid hardcoded mismatches
      console.warn(
        `No type definition found for ${schemaName}, returning empty fields`,
      );
      return {};
    } catch (error) {
      console.warn(`Could not parse schema ${schemaName}:`, error.message);
    }

    return {};
  }

  /**
   * Parse TypeBox schema definition to extract field types
   */
  parseTypeBoxSchema(content, schemaName) {
    try {
      // Find the start of schema definition
      const startPattern = `export const ${schemaName} = `;
      const startIndex = content.indexOf(startPattern);

      if (startIndex === -1) {
        return {};
      }

      // Extract the schema definition by finding the matching braces
      const start = startIndex + startPattern.length;
      let braceCount = 0;
      let inBraces = false;
      let schemaContent = '';

      for (let i = start; i < content.length; i++) {
        const char = content[i];

        if (char === '{') {
          braceCount++;
          inBraces = true;
        } else if (char === '}') {
          braceCount--;
        }

        if (inBraces) {
          schemaContent += char;
        }

        // Stop when we've closed all braces
        if (inBraces && braceCount === 0) {
          break;
        }
      }

      const fields = {};

      // More robust field parsing - handle multiline definitions and Optional wrapper
      // Updated regex to capture format information for date/datetime detection
      const fieldPattern =
        /(\w+):\s*Type\.(?:Optional\(Type\.(\w+)(?:\(\{[^}]*format:\s*['"]([^'"]+)['"][^}]*\}\))?|(\w+)(?:\(\{[^}]*format:\s*['"]([^'"]+)['"][^}]*\}\))?)/g;
      let fieldMatch;

      while ((fieldMatch = fieldPattern.exec(schemaContent)) !== null) {
        const [
          ,
          fieldName,
          optionalType,
          optionalFormat,
          directType,
          directFormat,
        ] = fieldMatch;
        const typeboxType = optionalType || directType;
        const format = optionalFormat || directFormat;
        const isOptional = !!optionalType;

        // Map TypeBox types to TypeScript types
        let tsType = 'string';
        if (typeboxType === 'Integer' || typeboxType === 'Number') {
          tsType = 'number';
        } else if (typeboxType === 'Boolean') {
          tsType = 'boolean';
        }

        // Include format information in the type string for date/datetime detection
        let typeString = tsType;
        if (format) {
          typeString = `${tsType}:${format}`;
        }

        fields[fieldName] = isOptional
          ? `${typeString} | undefined`
          : typeString;
      }

      return fields;
    } catch (error) {
      console.error(`Error parsing TypeBox schema ${schemaName}:`, error);
      return {};
    }
  }

  /**
   * Extract module name from schema name (e.g., "ListAuthorQuery" -> "authors")
   */
  extractModuleNameFromSchema(schemaName) {
    if (schemaName.includes('Notification')) return 'notifications';
    if (schemaName.includes('Author')) return 'authors';
    if (schemaName.includes('Book')) return 'books';
    if (schemaName.includes('Article')) return 'articles';
    return null;
  }

  /**
   * Read types from actual generated TypeScript file
   */
  readTypesFromFile(moduleName, schemaName) {
    try {
      const typesFileName =
        moduleName === 'notifications'
          ? 'notification.types'
          : `${this.toKebabCase(moduleName)}.types`;
      const typesPath = path.join(
        this.outputDir,
        this.toKebabCase(moduleName),
        'types',
        `${typesFileName}.ts`,
      );

      if (!fs.existsSync(typesPath)) {
        console.warn(`Types file not found: ${typesPath}`);
        return {};
      }

      const content = fs.readFileSync(typesPath, 'utf8');

      // Simple regex to extract interface fields (basic implementation)
      const interfaceRegex = new RegExp(
        `export interface ${schemaName} \\{([^}]+)\\}`,
        's',
      );
      const match = content.match(interfaceRegex);

      if (!match) {
        console.warn(`Interface ${schemaName} not found in ${typesPath}`);
        return {};
      }

      const fieldsContent = match[1];
      const fields = {};

      // Parse field definitions (basic parsing)
      const fieldLines = fieldsContent
        .split('\n')
        .filter((line) => line.trim() && !line.trim().startsWith('//'));

      for (const line of fieldLines) {
        const fieldMatch = line.match(/(\w+)\??:\s*([^;]+);?/);
        if (fieldMatch) {
          const [, fieldName, fieldType] = fieldMatch;
          fields[fieldName] = fieldType.trim();
        }
      }

      return fields;
    } catch (error) {
      console.warn(`Error reading types from file:`, error.message);
      return {};
    }
  }

  /**
   * Map TypeBox types to TypeScript types
   */
  mapTypeBoxToTypeScript(typeboxType, params = '') {
    const mapping = {
      String: 'string',
      Number: 'number',
      Boolean: 'boolean',
      Optional: 'string | undefined', // Default for optional
      Union: 'string | number', // Default union
      Array: 'any[]',
      Record: 'Record<string, any>',
      Any: 'any',
    };

    // Handle optional fields
    if (params.includes('Optional')) {
      return mapping[typeboxType] + ' | undefined';
    }

    // Handle UUID format
    if (params.includes('uuid')) {
      return 'string';
    }

    // Handle date-time format
    if (params.includes('date-time')) {
      return 'string';
    }

    return mapping[typeboxType] || 'any';
  }

  /**
   * Analyze backend API structure to determine features
   */
  analyzeBackendAPI(moduleName) {
    // Convert moduleName to camelCase to match backend module naming
    const camelCaseModuleName = this.toCamelCase(moduleName);
    const backendModulePath = path.resolve(
      this.toolsDir,
      '..',
      '..',
      'apps',
      'api',
      'src',
      'modules',
      camelCaseModuleName,
    );

    try {
      // Check routes file to determine available endpoints
      const routesPath = path.join(backendModulePath, 'routes', 'index.ts');

      if (!fs.existsSync(routesPath)) {
        throw new Error(`Backend routes file not found: ${routesPath}`);
      }

      const routesContent = fs.readFileSync(routesPath, 'utf8');

      return {
        hasEnhancedOps: this.hasEnhancedOperations(routesContent),
        hasFullOps: this.hasFullOperations(routesContent),
        hasEvents: this.hasWebSocketEvents(backendModulePath),
        searchFields: this.extractSearchFields(routesContent),
        endpoints: this.extractEndpoints(routesContent),
      };
    } catch (error) {
      console.error('Error analyzing backend API:', error.message);
      return {
        hasEnhancedOps: false,
        hasFullOps: false,
        hasEvents: false,
        searchFields: [],
        endpoints: [],
      };
    }
  }

  /**
   * Check if backend has enhanced operations (bulk operations)
   */
  hasEnhancedOperations(routesContent) {
    return (
      routesContent.includes('/bulk') || routesContent.includes('/dropdown')
    );
  }

  /**
   * Check if backend has full operations (validation, stats, etc.)
   */
  hasFullOperations(routesContent) {
    return (
      routesContent.includes('/validate') ||
      routesContent.includes('/stats') ||
      routesContent.includes('/check/:field')
    );
  }

  /**
   * Check if backend has WebSocket events
   */
  hasWebSocketEvents(backendModulePath) {
    // Convert the module directory name to kebab-case for service file lookup
    const moduleName = path.basename(backendModulePath);
    const kebabCaseModuleName = this.toKebabCase(moduleName);
    const serviceFile = path.join(
      backendModulePath,
      'services',
      `${kebabCaseModuleName}.service.ts`,
    );

    if (!fs.existsSync(serviceFile)) {
      return false;
    }

    const serviceContent = fs.readFileSync(serviceFile, 'utf8');
    return (
      serviceContent.includes('EventService') ||
      serviceContent.includes('websocket')
    );
  }

  /**
   * Extract search fields from backend
   */
  extractSearchFields(routesContent) {
    // This is a simplified approach - in a real implementation,
    // you'd parse the schema more thoroughly
    return ['title', 'name', 'description']; // Common search fields
  }

  /**
   * Extract available endpoints
   */
  extractEndpoints(routesContent) {
    const endpoints = [];

    // Standard CRUD
    if (routesContent.includes("fastify.post('/'")) endpoints.push('create');
    if (routesContent.includes("fastify.get('/:id'")) endpoints.push('read');
    if (routesContent.includes("fastify.get('/'")) endpoints.push('list');
    if (routesContent.includes("fastify.put('/:id'")) endpoints.push('update');
    if (routesContent.includes("fastify.delete('/:id'"))
      endpoints.push('delete');

    // Enhanced operations
    if (routesContent.includes('/dropdown')) endpoints.push('dropdown');
    if (routesContent.includes('/bulk')) endpoints.push('bulk');

    // Full operations
    if (routesContent.includes('/validate')) endpoints.push('validate');
    if (routesContent.includes('/check/:field')) endpoints.push('uniqueness');
    if (routesContent.includes('/stats')) endpoints.push('stats');

    return endpoints;
  }

  /**
   * Generate HTML for a single table column
   */
  generateColumnHtml(column, entityVar, isFirst) {
    const {
      name,
      label,
      isDate,
      isBoolean,
      isTruncated,
      truncateLength,
      showEllipsis,
    } = column;

    let cellContent = '';

    if (isFirst) {
      // First column gets special treatment with expand/collapse button
      cellContent = `
                <div class="flex items-center gap-2">
                  @if (${entityVar}.description) {
                    <button
                      type="button"
                      (click)="toggleExpandRow(${entityVar}); $event.stopPropagation()"
                      class="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
                      [attr.aria-label]="
                        isRowExpanded(${entityVar})
                          ? 'Collapse description'
                          : 'Expand description'
                      "
                    >
                      <mat-icon class="text-lg leading-none">{{
                        isRowExpanded(${entityVar}) ? 'expand_less' : 'expand_more'
                      }}</mat-icon>
                    </button>
                  } @else {
                    <div class="w-6 flex-shrink-0"></div>
                  }
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-gray-900">
                      ${
                        isTruncated
                          ? `{{ ${entityVar}.${name} | slice: 0 : ${truncateLength} }}${showEllipsis ? '...' : ''}`
                          : isDate
                            ? `{{ ${entityVar}.${name} | date: 'short' }}`
                            : `{{ ${entityVar}.${name} }}`
                      }
                    </div>
                    @if (${entityVar}.description && !isRowExpanded(${entityVar})) {
                      <div class="text-xs text-gray-500 mt-0.5 truncate">
                        {{ ${entityVar}.description | slice: 0 : 80 }}...
                      </div>
                    }
                  </div>
                </div>`;
    } else if (isBoolean) {
      cellContent = `
                @if (${entityVar}.${name}) {
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 text-md font-medium text-green-700 bg-green-50 rounded"
                    ><span class="w-2 h-2 bg-green-600 rounded-full"></span
                    >Active</span
                  >
                } @else {
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 text-md font-medium text-gray-700 bg-gray-100 rounded"
                    ><span class="w-2 h-2 bg-gray-400 rounded-full"></span
                    >Inactive</span
                  >
                }`;
    } else if (isDate) {
      cellContent = `
                <span class="text-md text-gray-600">
                  {{ ${entityVar}.${name} | date: 'short' }}
                </span>`;
    } else if (isTruncated) {
      cellContent = `
                <span class="text-md text-gray-600">
                  {{ ${entityVar}.${name} | slice: 0 : ${truncateLength} }}${showEllipsis ? '...' : ''}
                </span>`;
    } else {
      cellContent = `
                <span class="text-md text-gray-600">
                  {{ ${entityVar}.${name} }}
                </span>`;
    }

    return `            <!-- ${label} Column -->
            <ng-container matColumnDef="${name}">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>${label}</th>
              <td mat-cell *matCellDef="let ${entityVar}"${isFirst ? ' class="!py-3"' : ''}>${cellContent}
              </td>
            </ng-container>
`;
  }

  /**
   * Generate display columns for table
   */
  generateDisplayColumns(types, entityName, context = {}) {
    const entityType = types[entityName];
    if (!entityType) return [];

    const columns = [];

    Object.keys(entityType).forEach((fieldName) => {
      // Skip certain fields from display
      if (['id', 'created_at', 'updated_at'].includes(fieldName)) {
        return;
      }

      const fieldType = entityType[fieldName];
      const column = {
        name: fieldName,
        label: this.fieldNameToLabel(fieldName),
        isDate:
          fieldType.includes(':date') && !fieldType.includes(':date-time'),
        isBoolean: fieldType.includes('boolean'),
        isTruncated:
          fieldType.includes('string') &&
          ['description', 'message', 'content'].includes(fieldName),
        truncateLength: 50,
        showEllipsis: true,
        // Add context variables for template access
        camelCase: context.camelCase || entityName.toLowerCase(),
        moduleName: context.moduleName || entityName.toLowerCase(),
      };

      columns.push(column);
    });

    return columns.slice(0, 6); // Limit to 6 columns for better UX
  }

  /**
   * Generate form fields for dialog components with enhanced database detection
   */
  generateFormFields(
    types,
    entityName,
    isCreate = true,
    enhancedSchema = null,
  ) {
    const typeKey = isCreate
      ? `Create${entityName}Request`
      : `Update${entityName}Request`;
    const entityType = types[typeKey] || types[entityName];

    if (!entityType || Object.keys(entityType).length === 0) {
      // Fallback: generate basic fields from known schema
      console.log(
        `⚠️  No type definition found for ${typeKey} or ${entityName}, using fallback form fields`,
      );
      return this.generateFallbackFormFields(entityName);
    }

    const fields = [];

    Object.keys(entityType).forEach((fieldName) => {
      // Skip auto-generated fields but include audit user fields
      if (['id', 'created_at', 'updated_at'].includes(fieldName)) {
        return;
      }

      const fieldType = entityType[fieldName];
      const isOptional = fieldType.includes('undefined');
      const baseType = fieldType.replace(' | undefined', '');

      // Get enhanced field info if available
      const enhancedColumn = enhancedSchema?.columns?.find(
        (col) => col.name === fieldName,
      );

      // Determine required status from database schema (more reliable than TS types)
      let isRequired = !isOptional; // fallback to TS type
      if (enhancedColumn && typeof enhancedColumn.isNullable === 'boolean') {
        isRequired =
          !enhancedColumn.isNullable &&
          !enhancedColumn.isPrimaryKey &&
          !enhancedColumn.defaultValue;
      }

      const field = {
        name: fieldName,
        label: this.fieldNameToLabel(fieldName),
        type: this.getFormFieldType(fieldName, baseType, enhancedColumn),
        inputType: this.getFormInputType(fieldName, baseType, enhancedColumn),
        required: isRequired,
        placeholder: this.generatePlaceholder(fieldName),
        defaultValue: this.getDefaultValue(fieldName, baseType),
      };

      // Add validation rules
      field.maxLength = this.getMaxLength(fieldName, baseType);
      field.min = this.getMinValue(fieldName, baseType);
      field.max = this.getMaxValue(fieldName, baseType);

      // Add step attribute for decimal/numeric fields
      if (enhancedColumn && enhancedColumn.fieldType === 'decimal') {
        field.step = '0.01';
      }

      // Enhanced field type handling
      if (enhancedColumn) {
        // Foreign key dropdown
        if (
          enhancedColumn.fieldType === 'foreign-key-dropdown' &&
          enhancedColumn.dropdownInfo
        ) {
          const referencedTable = enhancedColumn.foreignKeyInfo.referencedTable;

          // Check if service exists
          const servicePath = path.resolve(
            this.outputDir,
            this.toKebabCase(referencedTable),
            'services',
            `${this.toKebabCase(referencedTable)}.service.ts`,
          );
          const serviceExists = fs.existsSync(servicePath);

          field.type = serviceExists ? 'dropdown' : 'string';
          field.inputType = serviceExists ? 'dropdown' : 'text';
          field.dropdownEndpoint = enhancedColumn.dropdownInfo.endpoint;
          field.dropdownDisplayFields =
            enhancedColumn.dropdownInfo.displayFields;
          field.referencedTable = referencedTable;
          field.serviceExists = serviceExists;
          field.serviceName = this.toCamelCase(referencedTable) + 'Service';

          // Add fallback info for template
          if (!serviceExists) {
            field.fallbackMessage = `Service for ${referencedTable} not found. Using text input. Generate ${referencedTable} service for dropdown functionality.`;
          }
        }
        // Enum select
        else if (enhancedColumn.fieldType === 'enum-select') {
          field.type = 'select';
          field.options = enhancedColumn.enumInfo
            ? enhancedColumn.enumInfo.values.map((val) => ({
                value: val,
                label: this.formatEnumLabel(val),
              }))
            : enhancedColumn.constraintValues?.map((val) => ({
                value: val,
                label: this.formatEnumLabel(val),
              })) || [];
        }
        // Convention-based select fields (for fields like priority, status, type)
        else if (this.isSelectField(fieldName, baseType)) {
          field.type = 'select';
          field.options = this.getSelectOptions(fieldName, enhancedColumn);
        }
      }
      // Fallback to original logic if no enhanced schema
      else if (this.isSelectField(fieldName, baseType)) {
        field.type = 'select';
        field.options = this.getSelectOptions(fieldName);
      }

      fields.push(field);
    });

    return fields;
  }

  /**
   * Generate fallback form fields when types are not available
   */
  generateFallbackFormFields(entityName) {
    // Basic form fields based on common entity patterns
    const fields = [];
    const entityCamelCase = this.toCamelCase(entityName);

    // Articles specific fields
    if (entityName.toLowerCase().includes('article')) {
      fields.push(
        {
          name: 'title',
          label: 'Title',
          type: 'string',
          inputType: 'text',
          required: true,
          placeholder: 'Enter article title',
          tsType: 'string',
          formControlName: 'title',
        },
        {
          name: 'content',
          label: 'Content',
          type: 'string',
          inputType: 'textarea',
          required: false,
          placeholder: 'Enter article content',
          tsType: 'string',
          formControlName: 'content',
        },
        {
          name: 'author_id',
          label: 'Author ID',
          type: 'string',
          inputType: 'text',
          required: true,
          placeholder: 'Enter author ID',
          tsType: 'string',
          formControlName: 'author_id',
        },
        {
          name: 'published',
          label: 'Published',
          type: 'boolean',
          required: false,
          defaultValue: false,
          tsType: 'boolean',
          formControlName: 'published',
        },
        {
          name: 'published_at',
          label: 'Published At',
          type: 'datetime',
          required: false,
          tsType: 'string',
          formControlName: 'published_at',
        },
        {
          name: 'view_count',
          label: 'View Count',
          type: 'number',
          inputType: 'number',
          required: false,
          defaultValue: 0,
          min: 0,
          tsType: 'number',
          formControlName: 'view_count',
        },
      );
    }

    // Books specific fields
    if (entityName.toLowerCase().includes('book')) {
      fields.push(
        {
          name: 'title',
          label: 'Title',
          type: 'string',
          inputType: 'text',
          required: true,
          placeholder: 'Enter book title',
          tsType: 'string',
          formControlName: 'title',
          maxLength: 255,
        },
        {
          name: 'description',
          label: 'Description',
          type: 'string',
          inputType: 'textarea',
          required: false,
          placeholder: 'Enter book description',
          tsType: 'string',
          formControlName: 'description',
          maxLength: 1000,
        },
        {
          name: 'author_id',
          label: 'Author',
          type: 'dropdown',
          required: true,
          referencedTable: 'authors',
          placeholder: 'Select author',
          tsType: 'string',
          formControlName: 'author_id',
          serviceExists: true,
          serviceName: 'authorsService',
        },
        {
          name: 'isbn',
          label: 'ISBN',
          type: 'string',
          inputType: 'text',
          required: false,
          placeholder: 'Enter ISBN',
          tsType: 'string',
          formControlName: 'isbn',
        },
        {
          name: 'pages',
          label: 'Pages',
          type: 'number',
          inputType: 'number',
          required: false,
          placeholder: 'Enter number of pages',
          tsType: 'number',
          formControlName: 'pages',
        },
        {
          name: 'published_date',
          label: 'Published Date',
          type: 'date',
          required: false,
          placeholder: 'Select published date',
          tsType: 'string',
          formControlName: 'published_date',
        },
        {
          name: 'price',
          label: 'Price',
          type: 'number',
          inputType: 'number',
          required: false,
          placeholder: 'Enter price',
          tsType: 'number',
          formControlName: 'price',
          step: '0.01',
        },
        {
          name: 'genre',
          label: 'Genre',
          type: 'string',
          inputType: 'text',
          required: false,
          placeholder: 'Enter genre',
          tsType: 'string',
          formControlName: 'genre',
        },
        {
          name: 'available',
          label: 'Available',
          type: 'boolean',
          required: false,
          defaultValue: true,
          tsType: 'boolean',
          formControlName: 'available',
        },
      );
    }

    return fields;
  }

  /**
   * Generate view fields for view dialog
   */
  generateViewFields(types, entityName, context = {}) {
    const entityType = types[entityName];
    if (!entityType) return [];

    const fields = [];

    Object.keys(entityType).forEach((fieldName) => {
      // Skip user_id but include everything else
      if (['user_id'].includes(fieldName)) {
        return;
      }

      const fieldType = entityType[fieldName];
      const baseType = fieldType.replace(' | undefined', '');

      const field = {
        name: fieldName,
        label: this.fieldNameToLabel(fieldName),
        type: this.getViewFieldType(fieldName, baseType),
        inputType: this.getFormInputType(fieldName, baseType),
        // Add context variables for template access
        camelCase: context.camelCase || entityName.toLowerCase(),
        moduleName: context.moduleName || entityName.toLowerCase(),
      };

      fields.push(field);
    });

    return fields;
  }

  /**
   * Group view fields into sections for better organization
   */
  groupViewFields(fields) {
    if (!Array.isArray(fields) || fields.length === 0) {
      return [];
    }

    const basicFields = [];
    const metadataFields = [];

    fields.forEach((field) => {
      if (!field || !field.name) return; // Skip invalid fields

      if (['id', 'created_at', 'updated_at'].includes(field.name)) {
        metadataFields.push({
          ...field,
          type: field.name === 'id' ? 'code' : 'datetime',
          trueLabel: 'Active',
          falseLabel: 'Inactive',
        });
      } else if (field.type === 'boolean') {
        basicFields.push({
          ...field,
          trueLabel: 'Yes',
          falseLabel: 'No',
        });
      } else {
        basicFields.push(field);
      }
    });

    const groups = [];

    if (basicFields.length > 0) {
      groups.push({
        title: 'Basic Information',
        fields: basicFields,
        isMetadata: false,
      });
    }

    if (metadataFields.length > 0) {
      groups.push({
        title: 'Record Information',
        fields: metadataFields,
        isMetadata: true,
      });
    }

    return groups;
  }

  /**
   * Format enum label for display
   */
  formatEnumLabel(enumValue) {
    if (!enumValue) return '';
    return enumValue
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get form field type for form generation
   */
  getFormFieldType(fieldName, fieldType, enhancedColumn = null) {
    // Use enhanced column info if available
    if (enhancedColumn) {
      switch (enhancedColumn.fieldType) {
        case 'foreign-key-dropdown':
          return 'dropdown';
        case 'enum-select':
          return 'select';

        // Text Types
        case 'email':
          return 'string';
        case 'password':
          return 'string';
        case 'url':
          return 'string';
        case 'phone':
          return 'string';
        case 'textarea':
          return 'string';
        case 'varchar':
          return 'string';
        case 'char':
          return 'string';
        case 'search':
          return 'string';
        case 'slug':
          return 'string';

        // Date/Time Types
        case 'datetime':
          return 'datetime';
        case 'date':
          return 'date';
        case 'timestamp':
          return 'datetime';
        case 'timestamptz':
          return 'datetime-tz';
        case 'time':
          return 'time';
        case 'timetz':
          return 'time-tz';
        case 'interval':
          return 'interval';

        // Numeric Types
        case 'number':
        case 'integer':
        case 'int':
        case 'int4':
        case 'smallint':
        case 'int2':
          return 'number';
        case 'bigint':
        case 'int8':
          return 'bigint';
        case 'decimal':
        case 'numeric':
          return 'number';
        case 'real':
        case 'float4':
        case 'double precision':
        case 'float':
        case 'float8':
          return 'number';
        case 'money':
          return 'currency';
        case 'serial':
        case 'serial4':
        case 'bigserial':
        case 'serial8':
          return 'number';
        case 'percentage':
          return 'percentage';

        // Boolean
        case 'boolean':
          return 'boolean';

        // Special Types
        case 'uuid':
          return 'string';
        case 'json':
          return 'json';
        case 'jsonb':
          return 'json';
        case 'xml':
          return 'xml';
        case 'bytea':
          return 'binary';
        case 'bit':
        case 'bit varying':
        case 'varbit':
          return 'string';
        case 'tsvector':
        case 'tsquery':
        case 'pg_lsn':
        case 'pg_snapshot':
          return 'string';
        case 'color':
          return 'color';

        // Array Types
        case 'array':
          return 'array';

        // Network Types
        case 'inet':
        case 'cidr':
        case 'macaddr':
        case 'macaddr8':
          return 'string';

        // Binary Types
        case 'binary':
          return 'binary';
        case 'file':
          return 'file';
        case 'image':
          return 'image';

        // Geometric Types
        case 'point':
        case 'line':
        case 'lseg':
        case 'box':
        case 'path':
        case 'polygon':
        case 'circle':
          return 'string';

        // Bit Types (already handled above)
        // case 'bit':
        //   return 'bit';
        // case 'varbit':
        //   return 'varbit';

        default:
          return 'string';
      }
    }

    // Fallback to original logic
    if (fieldType.includes('boolean')) return 'boolean';
    if (fieldType.includes('number')) return 'number';
    if (fieldName.includes('_at') || fieldName.includes('date')) return 'date';
    if (fieldName.includes('url')) return 'string';
    if (fieldName === 'message' || fieldName === 'description') return 'string';
    if (
      fieldType.includes('Record<') ||
      fieldType.includes('object') ||
      fieldName === 'data'
    )
      return 'json';
    return 'string';
  }

  /**
   * Get view field type for view dialog
   */
  getViewFieldType(fieldName, fieldType) {
    if (fieldType.includes('boolean')) return 'boolean';
    if (fieldType.includes('number')) return 'number';
    if (fieldName.includes('_at') || fieldName.includes('date')) return 'date';
    if (fieldName.includes('url')) return 'url';
    if (fieldType.includes('Record<') || fieldName === 'data') return 'json';
    return 'string';
  }

  /**
   * Get form input type
   */
  getFormInputType(fieldName, fieldType, enhancedColumn = null) {
    // Use enhanced column info if available
    if (enhancedColumn) {
      switch (enhancedColumn.fieldType) {
        case 'foreign-key-dropdown':
          return 'dropdown';
        case 'enum-select':
          return 'select';
        case 'email':
          return 'email';
        case 'password':
          return 'password';
        case 'url':
          return 'url';
        case 'textarea':
          return 'textarea';
        case 'datetime':
          return 'datetime';
        case 'boolean':
          return 'checkbox';
        case 'number':
          return 'number';
        case 'decimal':
          return 'number';
        default:
          return 'text';
      }
    }

    // Direct PostgreSQL type mapping for form inputs
    switch (fieldType) {
      // Numeric types
      case 'bigint':
      case 'int8':
        return 'number';
      case 'currency':
      case 'money':
        return 'number';
      case 'real':
      case 'float4':
      case 'double precision':
      case 'float':
      case 'float8':
        return 'number';
      case 'percentage':
        return 'number';

      // Special types
      case 'binary':
      case 'bytea':
        return 'file';
      case 'xml':
        return 'textarea';
      case 'uuid':
        return 'text';
      case 'bit':
      case 'varbit':
        return 'text';
      case 'color':
        return 'color';
      case 'image':
        return 'file';

      // Date/Time types
      case 'date':
        return 'date';
      case 'datetime':
      case 'timestamp':
        return 'datetime-local';
      case 'datetime-tz':
      case 'timestamptz':
        return 'datetime-local';
      case 'time':
        return 'time';
      case 'time-tz':
      case 'timetz':
        return 'time';

      // Network/Geometric types
      case 'inet':
      case 'cidr':
      case 'macaddr':
      case 'macaddr8':
      case 'point':
      case 'line':
      case 'lseg':
      case 'box':
      case 'path':
      case 'polygon':
      case 'circle':
        return 'text';

      // Array types
      case 'array':
        return 'textarea';

      // JSON types
      case 'json':
      case 'jsonb':
        return 'textarea';

      default:
        // Fallback to original logic
        if (fieldType.includes('number')) return 'number';
        if (fieldName.includes('email')) return 'email';
        if (fieldName.includes('password')) return 'password';
        if (fieldName.includes('url')) return 'url';
        if (['message', 'description', 'content'].includes(fieldName))
          return 'textarea';
        return 'text';
    }
  }

  /**
   * Generate placeholder text
   */
  generatePlaceholder(fieldName) {
    const placeholders = {
      title: 'Enter title',
      name: 'Enter name',
      email: 'Enter email address',
      message: 'Enter message',
      description: 'Enter description',
      type: 'Select type',
      priority: 'Select priority',
      status: 'Select status',
    };

    return (
      placeholders[fieldName] ||
      `Enter ${this.fieldNameToLabel(fieldName).toLowerCase()}`
    );
  }

  /**
   * Get default value for field
   */
  getDefaultValue(fieldName, fieldType) {
    if (fieldType.includes('boolean')) return false;
    if (fieldType.includes('number')) return null;
    return null;
  }

  /**
   * Get max length for string fields
   */
  getMaxLength(fieldName, fieldType) {
    if (!fieldType.includes('string')) return null;

    const maxLengths = {
      title: 255,
      name: 255,
      email: 255,
      message: 1000,
      description: 1000,
      type: 50,
      priority: 20,
      status: 20,
    };

    return maxLengths[fieldName] || null;
  }

  /**
   * Get min value for number fields
   */
  getMinValue(fieldName, fieldType) {
    if (!fieldType.includes('number')) return null;
    return 0; // Default minimum
  }

  /**
   * Get max value for number fields
   */
  getMaxValue(fieldName, fieldType) {
    if (!fieldType.includes('number')) return null;
    return null; // No default maximum
  }

  /**
   * Generate query filters for the list component
   */
  generateQueryFilters(types, entityName, enhancedSchema = null) {
    const queryType = types[`List${entityName}Query`];
    if (!queryType) return [];

    const filters = {
      boolean: [],
      foreignKey: [],
      string: [],
      number: [],
      date: [],
      datetime: [],
    };

    Object.keys(queryType).forEach((fieldName) => {
      // Skip pagination, search and system fields
      if (
        ['page', 'limit', 'search', 'include', 'sort', 'fields'].includes(
          fieldName,
        )
      ) {
        return;
      }

      // Skip range fields (min/max) as they're handled separately
      if (fieldName.endsWith('_min') || fieldName.endsWith('_max')) {
        return;
      }

      const fieldType = queryType[fieldName];

      // Get enhanced column info for constraint values
      const enhancedColumn = enhancedSchema?.columns?.find(
        (col) => col.name === fieldName,
      );

      // Detect field types based on schema type information
      const isBoolean = fieldType.includes('boolean');
      const isNumeric = fieldType.includes('number');
      const isForeignKey = fieldName.endsWith('_id') && fieldName !== 'id';
      const isString = fieldType.includes('string') && !isForeignKey;

      const filter = {
        name: fieldName,
        label: this.fieldNameToLabel(fieldName),
        type: fieldType,
        placeholder: this.generatePlaceholder(fieldName),
        inputType: this.getInputType(fieldType),
      };

      // Categorize filters by type
      if (isBoolean) {
        filters.boolean.push(filter);
      } else if (isForeignKey) {
        // Check if we have min/max variants in query type
        const hasRange =
          queryType[`${fieldName}_min`] || queryType[`${fieldName}_max`];
        if (!hasRange) {
          filter.isForeignKey = true;

          // Try to get the actual referenced table from enhanced schema first
          let referencedTable = fieldName.replace('_id', '');
          if (enhancedColumn && enhancedColumn.foreignKeyInfo) {
            referencedTable = enhancedColumn.foreignKeyInfo.referencedTable;
          }

          // Keep table name as-is for folder paths (e.g., 'authors' stays 'authors')
          filter.referencedTable = referencedTable;

          // Generate proper service name using SINGULAR form (e.g., 'authors' -> 'author')
          // This matches how services are generated: AuthorService, not AuthorsService
          const singularTable = referencedTable.endsWith('s')
            ? referencedTable.slice(0, -1)
            : referencedTable;
          filter.serviceName = this.toCamelCase(singularTable);
          filters.foreignKey.push(filter);
        }
      } else if (isNumeric) {
        // Number fields will use range inputs
        const hasMin = !!queryType[`${fieldName}_min`];
        const hasMax = !!queryType[`${fieldName}_max`];
        if (hasMin || hasMax) {
          filter.hasRange = true;
          filters.number.push(filter);
        }
      } else if (isString) {
        // Check for enum/constraint values
        filter.isSelect =
          this.isSelectField(fieldName, fieldType) ||
          (enhancedColumn &&
            (enhancedColumn.constraintValues?.length > 0 ||
              enhancedColumn.enumInfo?.values?.length > 0));

        if (filter.isSelect) {
          filter.options = this.getSelectOptions(fieldName, enhancedColumn);
        }

        filters.string.push(filter);
      }
    });

    // Handle date/datetime fields separately by checking for _min/_max pairs
    Object.keys(queryType).forEach((fieldName) => {
      if (fieldName.endsWith('_min')) {
        const baseName = fieldName.replace('_min', '');
        const hasMax = !!queryType[`${baseName}_max`];

        if (hasMax) {
          const fieldType = queryType[fieldName];
          // Check for format in type string (e.g., "string:date" or "string:date-time")
          const isDateTime =
            fieldType.includes(':date-time') || fieldType.includes('date-time');
          const isDate =
            (fieldType.includes(':date') && !isDateTime) ||
            (fieldType.includes('date') && !isDateTime);

          const filter = {
            name: baseName,
            label: this.fieldNameToLabel(baseName),
            type: fieldType,
            isDateTime: isDateTime,
            isDate: isDate,
          };

          if (isDateTime) {
            filters.datetime.push(filter);
          } else if (isDate) {
            filters.date.push(filter);
          }
        }
      }
    });

    return filters;
  }

  /**
   * Generate the Angular service
   */
  async generateService(moduleName, options = {}) {
    try {
      console.log(`🎯 Generating Angular service for ${moduleName}...`);

      // Extract types and analyze API
      const types = this.extractTypesFromBackendModule(moduleName);
      const apiInfo = this.analyzeBackendAPI(moduleName);

      // Get enhanced database schema if available
      let enhancedSchema = null;
      try {
        const { getEnhancedSchema } = require('../utils/database.js');
        enhancedSchema = await getEnhancedSchema(moduleName);
        console.log(`✅ Enhanced schema loaded for ${moduleName} service`);
      } catch (error) {
        console.warn(
          `⚠️ Could not load enhanced schema for ${moduleName} service:`,
          error.message,
        );
      }

      const pascalName = this.toPascalCase(moduleName);
      const camelName = this.toCamelCase(moduleName);
      const kebabName = this.toKebabCase(moduleName);

      // Prepare template context
      const typesFileName =
        moduleName === 'notifications'
          ? 'notification.types'
          : `${kebabName}.types`;
      // Use singular form for entity types (e.g., "Notification" not "Notifications")
      const singularPascalName = pascalName.endsWith('s')
        ? pascalName.slice(0, -1)
        : pascalName;
      const singularCamelName = camelName.endsWith('s')
        ? camelName.slice(0, -1)
        : camelName;

      // Extract dropdown dependencies from enhanced schema
      const dropdownDependencies = [];
      if (enhancedSchema) {
        enhancedSchema.columns.forEach((column) => {
          if (
            column.fieldType === 'foreign-key-dropdown' &&
            column.dropdownInfo
          ) {
            dropdownDependencies.push({
              field: column.name,
              referencedTable: column.foreignKeyInfo.referencedTable,
              endpoint: column.dropdownInfo.endpoint,
              displayFields: column.dropdownInfo.displayFields,
              pascalCase: this.toPascalCase,
            });
          }
        });
      }

      const context = {
        moduleName,
        PascalCase: singularPascalName,
        camelCase: camelName,
        kebabCase: kebabName,
        singularCamelName: singularCamelName,
        typesFileName,
        types,
        columns: enhancedSchema ? enhancedSchema.columns : [],
        baseUrlPath: moduleName,
        searchFields: apiInfo.searchFields.length > 0,
        searchFieldsDisplay: apiInfo.searchFields.join(', '),
        queryFilters: this.generateQueryFilters(types, pascalName),
        includeEnhanced:
          options.enhanced ||
          apiInfo.hasEnhancedOps ||
          dropdownDependencies.length > 0,
        includeFull: options.full || apiInfo.hasFullOps,
        dropdownDependencies: dropdownDependencies,
        title: this.fieldNameToLabel(moduleName),
      };

      // Load and compile template
      const templatePath = path.join(this.templatesDir, 'service.hbs');
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = Handlebars.compile(templateContent);

      // Debug context
      console.log('🔍 Template context:', JSON.stringify(context, null, 2));

      // Generate code
      const generatedCode = template(context);

      // Debug generated code length
      console.log('📝 Generated code length:', generatedCode.length);
      if (generatedCode.length < 100) {
        console.log(
          '⚠️ Generated code seems too short:',
          generatedCode.substring(0, 200),
        );
      }

      // Prepare output directory
      const outputDir = path.join(
        this.outputDir,
        this.toKebabCase(moduleName),
        'services',
      );
      this.ensureDirectoryExists(outputDir);

      // Write file
      const outputFile = path.join(
        outputDir,
        `${this.toKebabCase(moduleName)}.service.ts`,
      );
      fs.writeFileSync(outputFile, generatedCode);

      console.log(`✅ Service generated: ${outputFile}`);
      return outputFile;
    } catch (error) {
      console.error(`❌ Error generating service:`, error.message);
      throw error;
    }
  }

  /**
   * Generate the Angular list component
   */
  async generateListComponent(moduleName, options = {}) {
    try {
      console.log(`🎯 Generating Angular list component for ${moduleName}...`);

      // Extract types and analyze API
      const types = this.extractTypesFromBackendModule(moduleName);
      const apiInfo = this.analyzeBackendAPI(moduleName);

      // Get enhanced database schema if available
      let enhancedSchema = null;
      try {
        const { getEnhancedSchema } = require('../utils/database.js');
        enhancedSchema = await getEnhancedSchema(moduleName);
        console.log(
          `✅ Enhanced schema loaded for ${moduleName} list component`,
        );
      } catch (error) {
        console.warn(
          `⚠️ Could not load enhanced schema for ${moduleName} list component:`,
          error.message,
        );
      }

      const pascalName = this.toPascalCase(moduleName);
      const camelName = this.toCamelCase(moduleName);
      const kebabName = this.toKebabCase(moduleName);

      // Prepare template context
      const typesFileName =
        moduleName === 'notifications'
          ? 'notification.types'
          : `${kebabName}.types`;
      // Use singular form for entity types (e.g., "Notification" not "Notifications")
      const singularPascalName = pascalName.endsWith('s')
        ? pascalName.slice(0, -1)
        : pascalName;
      const singularCamelName = camelName.endsWith('s')
        ? camelName.slice(0, -1)
        : camelName;

      // Check if query schema has specific fields
      const queryType = types[`List${pascalName}Query`] || {};
      const hasPublishedField = 'published' in queryType;
      const hasPublishedAtField = 'published_at' in queryType;

      // Field detection helpers for template
      const entityType = types[singularPascalName] || {};
      const fieldNames = Object.keys(entityType);

      const context = {
        moduleName,
        singularName: singularCamelName,
        PascalCase: singularPascalName,
        camelCase: camelName,
        kebabCase: kebabName,
        singularCamelName: singularCamelName,
        singularPascalName: singularPascalName,
        pascalName: pascalName,
        typesFileName,
        title: this.fieldNameToLabel(moduleName),
        types,
        columns: enhancedSchema ? enhancedSchema.columns : [],
        searchFields: apiInfo.searchFields.length > 0,
        searchFieldsDisplay: apiInfo.searchFields.join(', '),
        displayColumns: this.generateDisplayColumns(types, singularPascalName, {
          camelCase: camelName,
          moduleName,
        }),
        filters: this.generateQueryFilters(types, pascalName, enhancedSchema),
        hasPublishedField,
        hasPublishedAtField,
        includeEnhanced: options.enhanced || apiInfo.hasEnhancedOps,
        includeFull: options.full || apiInfo.hasFullOps,
        withImport: options.withImport || false, // Pass withImport option to templates
        withEvents: options.withEvents || false, // Pass withEvents option to templates
        // Field detection helpers
        hasStatusField: fieldNames.includes('status'),
        hasActiveField: fieldNames.includes('active'),
        hasIsActiveField: fieldNames.includes('is_active'),
        hasAvailableField: fieldNames.includes('available'),
        hasIsAvailableField: fieldNames.includes('is_available'),
        hasEnabledField: fieldNames.includes('enabled'),
        hasIsEnabledField: fieldNames.includes('is_enabled'),
      };

      // Prepare output directory
      const outputDir = path.join(
        this.outputDir,
        this.toKebabCase(moduleName),
        'components',
      );
      this.ensureDirectoryExists(outputDir);

      const generatedFiles = [];
      const componentBaseName = `${this.toKebabCase(moduleName)}-list.component`;
      const isV2 = this.templateVersion === 'v2';

      // 1. Generate TypeScript component file (.ts)
      const tsTemplateName = isV2
        ? 'list-component-v2.hbs'
        : 'list-component.hbs';
      const tsTemplatePath = path.join(this.templatesDir, tsTemplateName);
      const tsTemplateContent = fs.readFileSync(tsTemplatePath, 'utf8');
      const tsTemplate = Handlebars.compile(tsTemplateContent);
      const tsCode = tsTemplate(context);
      const tsFile = path.join(outputDir, `${componentBaseName}.ts`);
      fs.writeFileSync(tsFile, tsCode);
      generatedFiles.push(tsFile);

      // 2. Generate HTML template file (.html)
      if (isV2) {
        // V2: Compile HTML template with Handlebars to process all {{#each}} loops
        const htmlTemplatePath = path.join(
          this.templatesDir,
          'list-component.html-v2.hbs',
        );
        const htmlTemplateContent = fs.readFileSync(htmlTemplatePath, 'utf8');

        // Pre-generate column HTML from displayColumns
        const columnsHtml = context.displayColumns
          .map((column, index) => {
            const isFirst = index === 0;
            return this.generateColumnHtml(column, singularCamelName, isFirst);
          })
          .join('\n');

        // Create HTML context with pre-generated columns
        const htmlContext = {
          ...context,
          columnsHtml: columnsHtml,
        };

        // Compile and generate HTML with Handlebars
        const htmlTemplate = Handlebars.compile(htmlTemplateContent);
        const htmlContent = htmlTemplate(htmlContext);

        const htmlFile = path.join(outputDir, `${componentBaseName}.html`);
        fs.writeFileSync(htmlFile, htmlContent);
        generatedFiles.push(htmlFile);
      } else {
        // V1: Use inline template in TypeScript (no separate HTML file)
        // V1 template has HTML inline, so no separate file needed
      }

      // 3. Generate SCSS styles file (.scss)
      if (isV2) {
        // V2: Use separate SCSS file
        const scssTemplatePath = path.join(
          this.templatesDir,
          'list-component.scss-v2.hbs',
        );
        const scssTemplateContent = fs.readFileSync(scssTemplatePath, 'utf8');
        const scssTemplate = Handlebars.compile(scssTemplateContent);
        const scssCode = scssTemplate(context);
        const scssFile = path.join(outputDir, `${componentBaseName}.scss`);
        fs.writeFileSync(scssFile, scssCode);
        generatedFiles.push(scssFile);
      } else {
        // V1: Styles inline in TypeScript (no separate file)
      }

      // 4. Generate child components (filters and header) for V2
      if (isV2) {
        // Generate list-filters component
        const filtersTemplatePath = path.join(
          this.templatesDir,
          'list-filters-component-v2.hbs',
        );
        if (fs.existsSync(filtersTemplatePath)) {
          const filtersTemplateContent = fs.readFileSync(
            filtersTemplatePath,
            'utf8',
          );
          const filtersTemplate = Handlebars.compile(filtersTemplateContent);
          const filtersCode = filtersTemplate(context);
          const filtersFile = path.join(
            outputDir,
            `${kebabName}-list-filters.component.ts`,
          );
          fs.writeFileSync(filtersFile, filtersCode);
          generatedFiles.push(filtersFile);
        }

        // Generate list-header component
        const headerTemplatePath = path.join(
          this.templatesDir,
          'list-header-component-v2.hbs',
        );
        if (fs.existsSync(headerTemplatePath)) {
          const headerTemplateContent = fs.readFileSync(
            headerTemplatePath,
            'utf8',
          );
          const headerTemplate = Handlebars.compile(headerTemplateContent);
          const headerCode = headerTemplate(context);
          const headerFile = path.join(
            outputDir,
            `${kebabName}-list-header.component.ts`,
          );
          fs.writeFileSync(headerFile, headerCode);
          generatedFiles.push(headerFile);
        }
      }

      console.log(
        `✅ List component generated: ${generatedFiles.length} files`,
      );
      generatedFiles.forEach((file) => console.log(`   - ${file}`));
      return generatedFiles;
    } catch (error) {
      console.error(`❌ Error generating list component:`, error.message);
      throw error;
    }
  }

  /**
   * Generate dialog components (Create, Edit, View)
   */
  async generateDialogComponents(moduleName, options = {}) {
    try {
      console.log(`🎯 Generating dialog components for ${moduleName}...`);

      // Extract types and analyze API
      const types = this.extractTypesFromBackendModule(moduleName);
      const apiInfo = this.analyzeBackendAPI(moduleName);

      // Get enhanced database schema if available
      let enhancedSchema = null;
      try {
        const { getEnhancedSchema } = require('../utils/database.js');
        enhancedSchema = await getEnhancedSchema(moduleName);
        console.log(`✅ Enhanced schema loaded for ${moduleName}`);
      } catch (error) {
        console.warn(
          `⚠️ Could not load enhanced schema for ${moduleName}:`,
          error.message,
        );
      }

      const pascalName = this.toPascalCase(moduleName);
      const camelName = this.toCamelCase(moduleName);
      const kebabName = this.toKebabCase(moduleName);

      const typesFileName =
        moduleName === 'notifications'
          ? 'notification.types'
          : `${kebabName}.types`;
      // Use singular form for entity types (e.g., "Notification" not "Notifications")
      const singularPascalName = pascalName.endsWith('s')
        ? pascalName.slice(0, -1)
        : pascalName;
      const singularCamelName = camelName.endsWith('s')
        ? camelName.slice(0, -1)
        : camelName;

      const baseContext = {
        moduleName,
        singularName: singularCamelName,
        PascalCase: singularPascalName,
        camelCase: camelName,
        kebabCase: kebabName,
        singularCamelName: singularCamelName,
        typesFileName,
        title: this.fieldNameToLabel(moduleName),
        types,
      };

      const generatedFiles = [];
      const outputDir = path.join(
        this.outputDir,
        this.toKebabCase(moduleName),
        'components',
      );
      this.ensureDirectoryExists(outputDir);

      // 1. Generate Create Dialog
      const createFormFields = this.generateFormFields(
        types,
        singularPascalName,
        true,
        enhancedSchema,
      );
      const createContext = {
        ...baseContext,
        formFields: createFormFields,
        hasJsonFields: createFormFields.some((field) => field.type === 'json'),
        hasDateTimeFields: createFormFields.some((field) =>
          ['datetime', 'datetime-tz'].includes(field.type),
        ),
        hasDateFields: createFormFields.some((field) => field.type === 'date'),
        hasNewFieldTypes: createFormFields.some((field) =>
          [
            'uuid',
            'array',
            'inet',
            'cidr',
            'macaddr',
            'binary',
            'xml',
            'point',
            'box',
            'polygon',
          ].includes(field.type),
        ),
      };

      // Determine which template to use based on version
      const createDialogTemplate =
        this.templateVersion === 'v2'
          ? 'create-dialog-v2.hbs'
          : 'create-dialog.hbs';
      const createTemplateContent = fs.readFileSync(
        path.join(this.templatesDir, createDialogTemplate),
        'utf8',
      );
      const createTemplate = Handlebars.compile(createTemplateContent);
      const createCode = createTemplate(createContext);
      const createFile = path.join(outputDir, `${kebabName}-create.dialog.ts`);
      fs.writeFileSync(createFile, createCode);
      generatedFiles.push(createFile);

      // 2. Generate Edit Dialog
      const editFormFields = this.generateFormFields(
        types,
        singularPascalName,
        false,
        enhancedSchema,
      );
      const editContext = {
        ...baseContext,
        formFields: editFormFields,
        hasJsonFields: editFormFields.some((field) => field.type === 'json'),
        hasDateTimeFields: editFormFields.some((field) =>
          ['datetime', 'datetime-tz'].includes(field.type),
        ),
        hasDateFields: editFormFields.some((field) => field.type === 'date'),
        hasNewFieldTypes: editFormFields.some((field) =>
          [
            'uuid',
            'array',
            'inet',
            'cidr',
            'macaddr',
            'binary',
            'xml',
            'point',
            'box',
            'polygon',
          ].includes(field.type),
        ),
      };

      // Determine which template to use based on version
      const editDialogTemplate =
        this.templateVersion === 'v2'
          ? 'edit-dialog-v2.hbs'
          : 'edit-dialog.hbs';
      const editTemplateContent = fs.readFileSync(
        path.join(this.templatesDir, editDialogTemplate),
        'utf8',
      );
      const editTemplate = Handlebars.compile(editTemplateContent);
      const editCode = editTemplate(editContext);
      const editFile = path.join(outputDir, `${kebabName}-edit.dialog.ts`);
      fs.writeFileSync(editFile, editCode);
      generatedFiles.push(editFile);

      // 3. Generate Shared Form Component
      const sharedFormFields = this.generateFormFields(
        types,
        singularPascalName,
        false,
        enhancedSchema,
      );
      const foreignKeyServices = this.extractForeignKeyServices(
        sharedFormFields,
        enhancedSchema,
      );

      const sharedFormContext = {
        ...baseContext,
        fields: sharedFormFields, // Template expects 'fields' not 'formFields'
        formFields: sharedFormFields, // Keep for backward compatibility
        hasForeignKeys: foreignKeyServices.length > 0,
        foreignKeys: foreignKeyServices, // Template expects 'foreignKeys'
        foreignKeyServices: foreignKeyServices, // Keep for backward compatibility
        hasJsonFields: sharedFormFields.some((field) => field.type === 'json'),
        hasDateTimeFields: sharedFormFields.some((field) =>
          ['datetime', 'datetime-tz'].includes(field.type),
        ),
        hasDateFields: sharedFormFields.some((field) => field.type === 'date'),
        dateFields: sharedFormFields.filter((field) => field.type === 'date'),
        // Add form name directly to avoid nested helper calls in template
        formName: camelName + 'Form',
        hasNewFieldTypes: sharedFormFields.some((field) =>
          [
            'uuid',
            'array',
            'inet',
            'cidr',
            'macaddr',
            'binary',
            'xml',
            'point',
            'box',
            'polygon',
          ].includes(field.type),
        ),
      };

      // Determine which shared form template to use based on version
      const sharedFormTemplateName =
        this.templateVersion === 'v2'
          ? 'shared-form-v2.hbs'
          : 'shared-form.hbs';
      const sharedFormTemplateContent = fs.readFileSync(
        path.join(this.templatesDir, sharedFormTemplateName),
        'utf8',
      );
      const sharedFormTemplate = Handlebars.compile(sharedFormTemplateContent);
      let sharedFormCode = sharedFormTemplate(sharedFormContext);

      // Fix template issues - replace missing form names (only for V1)
      if (this.templateVersion !== 'v2') {
        const formName = camelName + 'Form';
        sharedFormCode = sharedFormCode.replace(/\.get\(/g, `${formName}.get(`);
      }

      const sharedFormFile = path.join(
        outputDir,
        `${kebabName}-form.component.ts`,
      );
      fs.writeFileSync(sharedFormFile, sharedFormCode);
      generatedFiles.push(sharedFormFile);

      // 4. Generate View Dialog
      const viewFields = this.generateViewFields(types, singularPascalName, {
        camelCase: camelName,
        moduleName,
      });

      const viewContext = {
        ...baseContext,
        viewFields: viewFields,
        fieldGroups: this.groupViewFields(viewFields),
      };

      // Determine which template to use based on version
      const viewDialogTemplate =
        this.templateVersion === 'v2'
          ? 'view-dialog-v2.hbs'
          : 'view-dialog.hbs';
      const viewTemplateContent = fs.readFileSync(
        path.join(this.templatesDir, viewDialogTemplate),
        'utf8',
      );
      const viewTemplate = Handlebars.compile(viewTemplateContent);
      const viewCode = viewTemplate(viewContext);
      const viewFile = path.join(outputDir, `${kebabName}-view.dialog.ts`);
      fs.writeFileSync(viewFile, viewCode);
      generatedFiles.push(viewFile);

      // 5. Generate Import Dialog (if withImport option is set)
      if (options.withImport) {
        console.log(`🎯 Generating import dialog for ${moduleName}...`);

        const importContext = {
          ...baseContext,
          displayColumns: this.generateDisplayColumns(
            types,
            singularPascalName,
            {
              camelCase: camelName,
              moduleName,
            },
          ).slice(0, 3), // Limit to first 3 columns for import preview
        };

        // Debug: Log context to verify variables
        console.log(
          '🔍 Import Dialog Context:',
          JSON.stringify(
            {
              PascalCase: importContext.PascalCase,
              camelCase: importContext.camelCase,
              kebabCase: importContext.kebabCase,
              typesFileName: importContext.typesFileName,
              title: importContext.title,
            },
            null,
            2,
          ),
        );

        const importDialogTemplate = 'import-dialog.hbs';
        const importTemplatePath = path.join(
          this.templatesDir,
          importDialogTemplate,
        );

        if (fs.existsSync(importTemplatePath)) {
          const importTemplateContent = fs.readFileSync(
            importTemplatePath,
            'utf8',
          );
          const importTemplate = Handlebars.compile(importTemplateContent);

          try {
            const importCode = importTemplate(importContext);
            const importFile = path.join(
              outputDir,
              `${kebabName}-import.dialog.ts`,
            );
            fs.writeFileSync(importFile, importCode);
            generatedFiles.push(importFile);
            console.log(`✅ Import dialog generated: ${importFile}`);
          } catch (templateError) {
            console.error(
              '❌ Error compiling import dialog template:',
              templateError,
            );
            console.error(
              'Template context:',
              JSON.stringify(importContext, null, 2),
            );
            throw templateError;
          }
        } else {
          console.warn(
            `⚠️ Import dialog template not found: ${importTemplatePath}`,
          );
        }
      }

      console.log(
        `✅ Dialog components generated: ${generatedFiles.length} files`,
      );
      return generatedFiles;
    } catch (error) {
      console.error(`❌ Error generating dialog components:`, error.message);
      throw error;
    }
  }

  /**
   * Generate routes file
   */
  async generateRoutes(moduleName, options = {}) {
    try {
      console.log(`🎯 Generating routes for ${moduleName}...`);

      const pascalName = this.toPascalCase(moduleName);
      const camelName = this.toCamelCase(moduleName);
      const kebabName = this.toKebabCase(moduleName);

      const typesFileName =
        moduleName === 'notifications'
          ? 'notification.types'
          : `${kebabName}.types`;
      // Use singular form for entity types (e.g., "Notification" not "Notifications")
      const singularPascalName = pascalName.endsWith('s')
        ? pascalName.slice(0, -1)
        : pascalName;
      const singularCamelName = camelName.endsWith('s')
        ? camelName.slice(0, -1)
        : camelName;

      const context = {
        moduleName,
        PascalCase: singularPascalName,
        camelCase: camelName,
        kebabCase: kebabName,
        singularCamelName: singularCamelName,
        typesFileName,
        title: this.fieldNameToLabel(moduleName),
      };

      // Load and compile template
      const templatePath = path.join(this.templatesDir, 'routes.hbs');
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = Handlebars.compile(templateContent);

      // Generate code
      const generatedCode = template(context);

      // Prepare output directory
      const outputDir = path.join(this.outputDir, this.toKebabCase(moduleName));
      this.ensureDirectoryExists(outputDir);

      // Write file
      const outputFile = path.join(
        outputDir,
        `${this.toKebabCase(moduleName)}.routes.ts`,
      );
      fs.writeFileSync(outputFile, generatedCode);

      console.log(`✅ Routes generated: ${outputFile}`);
      return outputFile;
    } catch (error) {
      console.error(`❌ Error generating routes:`, error.message);
      throw error;
    }
  }

  /**
   * Generate state manager service for real-time features
   */
  async generateStateManager(moduleName, options = {}) {
    try {
      console.log(`🎯 Generating state manager for ${moduleName}...`);

      const pascalName = this.toPascalCase(moduleName);
      const camelName = this.toCamelCase(moduleName);
      const kebabName = this.toKebabCase(moduleName);

      // Use singular form for entity types
      const singularPascalName = pascalName.endsWith('s')
        ? pascalName.slice(0, -1)
        : pascalName;
      const singularCamelName = camelName.endsWith('s')
        ? camelName.slice(0, -1)
        : camelName;
      const singularKebabName = kebabName.endsWith('s')
        ? kebabName.slice(0, -1)
        : kebabName;

      const context = {
        moduleName,
        PascalCase: singularPascalName,
        camelCase: camelName,
        kebabCase: kebabName,
        singularCamelName: singularCamelName,
        singularKebabCase: singularKebabName,
        pluralKebabCase: kebabName,
        singularLowerCase: singularCamelName.toLowerCase(),
        pluralLowerCase: camelName.toLowerCase(),
        typesFileName: `${kebabName}.types`,
        title: this.fieldNameToLabel(moduleName),
      };

      // Debug: Log context to verify variables
      console.log(
        '🔍 State Manager Context:',
        JSON.stringify(
          {
            PascalCase: context.PascalCase,
            camelCase: context.camelCase,
            kebabCase: context.kebabCase,
            pluralKebabCase: context.pluralKebabCase,
            singularKebabCase: context.singularKebabCase,
            singularLowerCase: context.singularLowerCase,
            pluralLowerCase: context.pluralLowerCase,
          },
          null,
          2,
        ),
      );

      // Load and compile template
      const templatePath = path.join(this.templatesDir, 'state-manager.hbs');

      if (!fs.existsSync(templatePath)) {
        throw new Error(`State manager template not found: ${templatePath}`);
      }

      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = Handlebars.compile(templateContent);

      // Generate code
      const generatedCode = template(context);

      // Prepare output directory
      const outputDir = path.join(
        this.outputDir,
        this.toKebabCase(moduleName),
        'services',
      );
      this.ensureDirectoryExists(outputDir);

      // Write file
      const outputFile = path.join(
        outputDir,
        `${this.toKebabCase(moduleName)}-state-manager.service.ts`,
      );
      fs.writeFileSync(outputFile, generatedCode);

      console.log(`✅ State manager generated: ${outputFile}`);
      return outputFile;
    } catch (error) {
      console.error(`❌ Error generating state manager:`, error.message);
      throw error;
    }
  }

  /**
   * Generate complete frontend module
   */
  async generateFrontendModule(moduleName, options = {}) {
    try {
      console.log(`\n🚀 Starting frontend generation for: ${moduleName}`);
      console.log(`📊 Options:`, options);

      const generatedFiles = [];

      // Generate types file first (required by other components)
      const typesFile = await this.generateTypes(moduleName, options);
      generatedFiles.push(typesFile);

      // Generate service
      const serviceFile = await this.generateService(moduleName, options);
      generatedFiles.push(serviceFile);

      // Generate dialog components
      const dialogFiles = await this.generateDialogComponents(
        moduleName,
        options,
      );
      generatedFiles.push(...dialogFiles);

      // Generate list component (must be after dialogs for imports)
      const listComponentFile = await this.generateListComponent(
        moduleName,
        options,
      );
      generatedFiles.push(listComponentFile);

      // Generate routes
      const routesFile = await this.generateRoutes(moduleName, options);
      generatedFiles.push(routesFile);

      // Generate State Manager (if withEvents option is set)
      if (options.withEvents) {
        const stateManagerFile = await this.generateStateManager(
          moduleName,
          options,
        );
        generatedFiles.push(stateManagerFile);
      }

      console.log(`\n✅ Frontend module generation completed!`);
      console.log(`📁 Generated files:`, generatedFiles.length);
      generatedFiles.forEach((file) => console.log(`   - ${file}`));

      return generatedFiles;
    } catch (error) {
      console.error(`\n❌ Frontend generation failed:`, error.message);
      throw error;
    }
  }

  // ===== UTILITY METHODS =====

  toPascalCase(str) {
    return (
      str.charAt(0).toUpperCase() +
      str.slice(1).replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    );
  }

  toCamelCase(str) {
    return (
      str.charAt(0).toLowerCase() +
      str.slice(1).replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    );
  }

  toKebabCase(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
      .replace(/--+/g, '-'); // Replace multiple dashes with single dash
  }

  fieldNameToLabel(fieldName) {
    // Ensure fieldName is a string
    if (typeof fieldName !== 'string') {
      console.warn('fieldNameToLabel received non-string:', fieldName);
      return String(fieldName || '');
    }

    return fieldName
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  getInputType(fieldType) {
    if (fieldType.includes('number')) return 'number';
    if (fieldType.includes('date')) return 'date';
    if (fieldType.includes('boolean')) return 'checkbox';
    return 'text';
  }

  isSelectField(fieldName, fieldType) {
    const selectFields = ['status', 'type', 'priority', 'role'];
    return selectFields.some((field) => fieldName.includes(field));
  }

  getSelectOptions(fieldName, enhancedColumn = null) {
    // Use constraint values from database first (highest priority)
    if (enhancedColumn) {
      // Use enum values first
      if (enhancedColumn.enumInfo && enhancedColumn.enumInfo.values) {
        return enhancedColumn.enumInfo.values.map((value) => ({
          value: value,
          label: this.formatLabel(value),
        }));
      }

      // Use constraint values second
      if (
        enhancedColumn.constraintValues &&
        enhancedColumn.constraintValues.length > 0
      ) {
        return enhancedColumn.constraintValues.map((value) => ({
          value: value,
          label: this.formatLabel(value),
        }));
      }
    }

    // Fallback to hardcoded options (for backward compatibility only)
    const optionsMap = {
      type: [
        { value: 'info', label: 'Info' },
        { value: 'warning', label: 'Warning' },
        { value: 'error', label: 'Error' },
      ],
    };

    const key = Object.keys(optionsMap).find((k) => fieldName.includes(k));
    return optionsMap[key] || [];
  }

  formatLabel(value) {
    // Convert 'draft' -> 'Draft', 'published' -> 'Published'
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Generate TypeScript types file
   */
  async generateTypes(moduleName, options = {}) {
    try {
      console.log(`🎯 Generating TypeScript types for ${moduleName}...`);

      // Get enhanced database schema
      let enhancedSchema = null;
      try {
        const { getEnhancedSchema } = require('../utils/database.js');
        enhancedSchema = await getEnhancedSchema(moduleName);
        console.log(`✅ Enhanced schema loaded for ${moduleName} types`);
      } catch (error) {
        console.warn(
          `⚠️ Could not load enhanced schema for ${moduleName} types:`,
          error.message,
        );
        throw new Error('Enhanced schema required for types generation');
      }

      const pascalName = this.toPascalCase(moduleName);
      const camelName = this.toCamelCase(moduleName);
      const kebabName = this.toKebabCase(moduleName);

      // Use singular form for entity types
      const singularPascalName = pascalName.endsWith('s')
        ? pascalName.slice(0, -1)
        : pascalName;

      // Prepare context for template
      const context = {
        moduleName,
        PascalCase: singularPascalName,
        pluralPascalCase: pascalName,
        singularPascalCase: singularPascalName,
        camelCase: camelName,
        kebabCase: kebabName,
        columns: enhancedSchema.columns,
        searchFields:
          enhancedSchema.searchFields && enhancedSchema.searchFields.length > 0,
        includeEnhanced:
          options.enhanced ||
          options.package === 'enterprise' ||
          options.package === 'full',
        includeFull: options.full || options.package === 'full',
      };

      // Load and compile template
      const templatePath = path.join(this.templatesDir, 'types.hbs');
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = Handlebars.compile(templateContent);

      // Generate code
      const generatedCode = template(context);

      // Prepare output directory
      const outputDir = path.join(
        this.outputDir,
        this.toKebabCase(moduleName),
        'types',
      );
      this.ensureDirectoryExists(outputDir);

      // Write file
      const typesFileName =
        moduleName === 'notifications'
          ? 'notification.types.ts'
          : `${kebabName}.types.ts`;
      const outputFile = path.join(outputDir, typesFileName);
      fs.writeFileSync(outputFile, generatedCode);

      console.log(`✅ Types file generated: ${outputFile}`);
      return outputFile;
    } catch (error) {
      console.error(`❌ Error generating types:`, error.message);
      throw error;
    }
  }

  /**
   * Extract foreign key services needed for the shared form
   */
  extractForeignKeyServices(formFields, enhancedSchema) {
    const services = [];

    if (!enhancedSchema) return services;

    formFields.forEach((field) => {
      if (field.type === 'dropdown' && field.referencedTable) {
        const referencedTable = field.referencedTable;
        const serviceName = this.toCamelCase(referencedTable) + 'Service';
        // Use singular form for service class name
        const singularTable = referencedTable.endsWith('s')
          ? referencedTable.slice(0, -1)
          : referencedTable;
        const serviceClass = this.toPascalCase(singularTable) + 'Service';

        // Find the enhanced column for more details
        const enhancedColumn = enhancedSchema.columns.find(
          (col) => col.name === field.name,
        );
        const dropdownFields = enhancedColumn?.dropdownInfo?.displayFields || [
          'id',
        ];

        // Check if service exists
        const servicePath = path.resolve(
          this.outputDir,
          this.toKebabCase(referencedTable),
          'services',
          `${this.toKebabCase(referencedTable)}.service.ts`,
        );
        const serviceExists = fs.existsSync(servicePath);

        if (!services.find((s) => s.serviceName === serviceName)) {
          services.push({
            serviceName: serviceName,
            serviceClass: serviceClass,
            referencedTable: referencedTable,
            displayFields: dropdownFields,
            import: `../../${this.toKebabCase(referencedTable)}/services/${this.toKebabCase(referencedTable)}.service`,
            exists: serviceExists,
            fallbackType: serviceExists ? 'dropdown' : 'text',
          });
        }
      }
    });

    return services;
  }

  /**
   * Auto-register frontend route in app.routes.ts
   */
  async autoRegisterRoute(moduleName) {
    const appRoutesPath = path.join(
      this.projectRoot,
      'apps/web/src/app/app.routes.ts',
    );

    try {
      // Check if file exists
      if (!fs.existsSync(appRoutesPath)) {
        console.warn('⚠️ app.routes.ts not found - skipping auto-registration');
        return false;
      }

      const kebabName = this.toKebabCase(moduleName);
      const camelName = this.toCamelCase(moduleName);
      const title = this.fieldNameToLabel(moduleName);

      let content = fs.readFileSync(appRoutesPath, 'utf8');

      // Check if already registered
      if (content.includes(`path: '${kebabName}'`)) {
        console.log(
          `⚠️ ${moduleName} route already registered in app.routes.ts`,
        );
        return false;
      }

      // Find wildcard route (path: '**') to insert before it
      const wildcardIndex = content.indexOf(`path: '**'`);
      let insertPosition;

      if (wildcardIndex !== -1) {
        // Find the opening brace of wildcard route entry
        let braceCount = 0;
        let position = wildcardIndex;

        // Search backwards for the opening brace
        while (position >= 0) {
          if (content[position] === '}') braceCount++;
          if (content[position] === '{') {
            if (braceCount === 0) {
              // Found the opening brace of wildcard route
              // Find start of line (after previous },\n or [\n)
              let lineStart = position;
              while (lineStart > 0 && content[lineStart - 1] !== '\n') {
                lineStart--;
              }
              insertPosition = lineStart;
              break;
            }
            braceCount--;
          }
          position--;
        }
      }

      // Fallback: insert before routes array closing bracket if wildcard not found
      if (!insertPosition) {
        const routesArrayEnd = content.lastIndexOf('];');
        if (routesArrayEnd === -1) {
          console.error('❌ Cannot find routes array in app.routes.ts');
          return false;
        }
        insertPosition = routesArrayEnd;
      }

      // Create route entry with proper AuthGuard and permissions
      const routeEntry = `  {\n    path: '${kebabName}',\n    loadChildren: () =>\n      import('./features/${kebabName}/${kebabName}.routes').then((m) => m.${camelName}Routes),\n    canActivate: [AuthGuard],\n    data: {\n      title: '${title}',\n      description: '${title} Management System',\n      requiredPermissions: ['${kebabName}.read', 'admin.*'],\n    },\n  },\n`;

      // Insert at determined position
      content =
        content.slice(0, insertPosition) +
        routeEntry +
        content.slice(insertPosition);

      // Write back
      fs.writeFileSync(appRoutesPath, content);

      console.log(`✅ Auto-registered ${moduleName} route in app.routes.ts:`);
      console.log(`   - Path: /${kebabName}`);
      console.log(`   - Route: ${camelName}Routes`);
      console.log(`   - Title: ${title}`);

      return true;
    } catch (error) {
      console.error('❌ Failed to auto-register route:', error.message);
      console.log('💡 Please register manually in app.routes.ts');
      return false;
    }
  }
}

// Main execution
if (require.main === module) {
  const moduleName = process.argv[2];

  if (!moduleName) {
    console.error('Usage: node frontend-generator.js <module-name>');
    process.exit(1);
  }

  const generator = new FrontendGenerator();
  generator
    .generateFrontendModule(moduleName)
    .then(() => {
      console.log(`✅ Frontend generated successfully for ${moduleName}`);
    })
    .catch((error) => {
      console.error('❌ Frontend generation failed:', error.message);
      process.exit(1);
    });
}

module.exports = FrontendGenerator;
