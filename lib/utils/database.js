const { knex } = require('../config/knex-connection');

/**
 * Get database schema for a specific table
 */
async function getDatabaseSchema(tableName) {
  try {
    // Check if table exists
    const tableExists = await knex.schema.hasTable(tableName);
    if (!tableExists) {
      return null;
    }

    // Get column information
    const columns = await knex.raw(
      `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        udt_name
      FROM information_schema.columns 
      WHERE table_name = ? 
      ORDER BY ordinal_position
    `,
      [tableName],
    );

    // Get primary key information
    const primaryKeys = await knex.raw(
      `
      SELECT column_name
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
      WHERE tc.table_name = ? 
        AND tc.constraint_type = 'PRIMARY KEY'
    `,
      [tableName],
    );

    // Get foreign key information
    const foreignKeys = await knex.raw(
      `
      SELECT 
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.constraint_column_usage ccu
        ON kcu.constraint_name = ccu.constraint_name
      JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
      WHERE kcu.table_name = ? 
        AND tc.constraint_type = 'FOREIGN KEY'
    `,
      [tableName],
    );

    // Get enum types and values
    const enumInfo = await knex.raw(
      `
      SELECT 
        c.column_name,
        t.typname as enum_name,
        array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
      FROM information_schema.columns c
      JOIN pg_type t ON c.udt_name = t.typname
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE c.table_name = ?
        AND t.typtype = 'e'
      GROUP BY c.column_name, t.typname
    `,
      [tableName],
    );

    // Get check constraints that might define enum-like values
    const checkConstraints = await knex.raw(
      `
      SELECT 
        kcu.column_name,
        cc.check_clause
      FROM information_schema.check_constraints cc
      JOIN information_schema.constraint_column_usage kcu
        ON cc.constraint_name = kcu.constraint_name
      WHERE kcu.table_name = ?
        AND (cc.check_clause LIKE '%IN (%' 
             OR cc.check_clause LIKE '%ANY%ARRAY%')
    `,
      [tableName],
    );

    // Process columns with enhanced metadata
    const processedColumns = columns.rows.map((col) => {
      const isFK = foreignKeys.rows.some(
        (fk) => fk.column_name === col.column_name,
      );
      const fkInfo = foreignKeys.rows.find(
        (fk) => fk.column_name === col.column_name,
      );
      const enumData = enumInfo.rows.find(
        (e) => e.column_name === col.column_name,
      );
      const checkConstraint = checkConstraints.rows.find(
        (c) => c.column_name === col.column_name,
      );

      // Extract enum values from check constraints with enhanced patterns
      let constraintValues = null;
      if (checkConstraint) {
        constraintValues = extractConstraintValues(
          checkConstraint.check_clause,
        );
      }

      // Create constraint metadata
      const constraintMetadata = createConstraintMetadata(
        constraintValues,
        enumData,
        col,
      );

      const fieldType = determineFieldType(
        col,
        isFK,
        !!enumData || !!constraintValues,
      );

      // Get filtering strategy for this field
      const filteringStrategy = getFieldFilteringStrategy(col, fieldType);

      return {
        name: col.column_name,
        type: col.data_type,
        udtName: col.udt_name,
        isNullable: col.is_nullable === 'YES',
        defaultValue: col.column_default,
        maxLength: col.character_maximum_length,
        precision: col.numeric_precision,
        scale: col.numeric_scale,
        isPrimaryKey: primaryKeys.rows.some(
          (pk) => pk.column_name === col.column_name,
        ),
        isForeignKey: isFK,
        foreignKeyInfo: fkInfo
          ? {
              referencedTable: fkInfo.foreign_table_name,
              referencedColumn: fkInfo.foreign_column_name,
              constraintName: fkInfo.constraint_name,
            }
          : null,
        isEnum: !!enumData || !!constraintValues,
        enumInfo: enumData
          ? {
              typeName: enumData.enum_name,
              values: enumData.enum_values,
            }
          : null,
        constraintValues: constraintValues,
        constraintMetadata: constraintMetadata,
        // Smart field detection
        fieldType: fieldType,
        filteringStrategy: filteringStrategy,
        tsType: mapPostgresToTypeScript(col.data_type, col.udt_name),
        typeboxType: mapPostgresToTypeBox(
          col.data_type,
          col.udt_name,
          col.is_nullable === 'YES',
        ),
      };
    });

    return {
      tableName,
      columns: processedColumns,
      primaryKey: primaryKeys.rows.map((pk) => pk.column_name),
      foreignKeys: foreignKeys.rows.map((fk) => ({
        column: fk.column_name,
        referencedTable: fk.foreign_table_name,
        referencedColumn: fk.foreign_column_name,
      })),
    };
  } catch (error) {
    console.error(`Full error for table ${tableName}:`, error);
    throw new Error(
      `Failed to get schema for table ${tableName}: ${error.message}`,
    );
  }
}

/**
 * List all tables in the database
 */
async function listTables() {
  try {
    const result = await knex.raw(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    return result.rows.map((row) => ({
      name: row.table_name,
      columns: parseInt(row.column_count),
    }));
  } catch (error) {
    throw new Error(`Failed to list tables: ${error.message}`);
  }
}

/**
 * Field filtering strategy mapping based on PostgreSQL types
 */
const FIELD_FILTERING_STRATEGIES = {
  // Date/Time fields - support equals and range
  date: {
    category: 'date',
    filters: ['equals', 'range'],
    format: 'date',
  },
  timestamp: {
    category: 'datetime',
    filters: ['equals', 'range'],
    format: 'date-time',
  },
  timestamptz: {
    category: 'datetime',
    filters: ['equals', 'range'],
    format: 'date-time',
  },
  time: {
    category: 'time',
    filters: ['equals', 'range'],
    format: 'time',
  },

  // Numeric fields - support equals and range
  number: {
    category: 'numeric',
    filters: ['equals', 'range', 'in_array'],
  },
  decimal: {
    category: 'numeric',
    filters: ['equals', 'range'],
  },
  bigint: {
    category: 'numeric',
    filters: ['equals', 'range', 'in_array'],
  },

  // Text fields - support various text searches
  varchar: {
    category: 'string',
    filters: ['equals', 'contains', 'starts_with', 'ends_with'],
  },
  char: {
    category: 'string',
    filters: ['equals', 'contains'],
  },
  textarea: {
    category: 'text',
    filters: ['contains', 'fulltext'],
  },

  // Boolean fields
  boolean: {
    category: 'boolean',
    filters: ['equals', 'null_check'],
  },

  // UUID fields
  uuid: {
    category: 'uuid',
    filters: ['equals', 'in_array', 'null_check'],
  },

  // Special fields
  'enum-select': {
    category: 'enum',
    filters: ['equals', 'in_array', 'not_in_array'],
  },
  'foreign-key-dropdown': {
    category: 'foreign_key',
    filters: ['equals', 'in_array', 'null_check'],
  },
};

/**
 * Comprehensive PostgreSQL type to form field mapping
 */
const POSTGRES_TYPE_MAPPING = {
  // Numeric Types
  smallint: 'number',
  integer: 'number',
  bigint: 'bigint',
  decimal: 'decimal',
  numeric: 'decimal',
  real: 'float',
  'double precision': 'float',
  serial: 'serial',
  bigserial: 'serial',
  smallserial: 'serial',

  // Character Types
  'character varying': 'varchar',
  varchar: 'varchar',
  character: 'char',
  char: 'char',
  text: 'textarea',

  // Date/Time Types
  'timestamp without time zone': 'timestamp',
  'timestamp with time zone': 'timestamptz',
  timestamp: 'timestamp',
  timestamptz: 'timestamptz',
  date: 'date',
  'time without time zone': 'time',
  'time with time zone': 'timetz',
  time: 'time',
  interval: 'interval',

  // Boolean Type
  boolean: 'boolean',
  bool: 'boolean',

  // Binary Data Types
  bytea: 'binary',

  // JSON Types
  json: 'json',
  jsonb: 'jsonb',

  // UUID Type
  uuid: 'uuid',

  // Network Address Types
  inet: 'inet',
  cidr: 'cidr',
  macaddr: 'macaddr',
  macaddr8: 'macaddr',

  // Bit String Types
  bit: 'bit',
  'bit varying': 'varbit',

  // Geometric Types
  point: 'point',
  line: 'line',
  lseg: 'lseg',
  box: 'box',
  path: 'path',
  polygon: 'polygon',
  circle: 'circle',

  // XML Type
  xml: 'xml',

  // Enumerated Types
  'USER-DEFINED': 'enum', // For custom enum types
};

/**
 * Name-based field type detection patterns
 */
const FIELD_NAME_PATTERNS = {
  email: ['email', 'e_mail', 'mail'],
  password: ['password', 'passwd', 'pwd', 'pass'],
  url: ['url', 'link', 'website', 'homepage'],
  phone: ['phone', 'tel', 'telephone', 'mobile', 'cell'],
  color: ['color', 'colour'],
  textarea: [
    'description',
    'content',
    'body',
    'message',
    'notes',
    'comment',
    'text',
    'bio',
  ],
  slug: ['slug', 'handle'],
  search: ['search', 'query'],
  file: ['file', 'attachment', 'upload'],
  image: ['image', 'img', 'photo', 'picture', 'avatar'],
  currency: ['price', 'cost', 'amount', 'fee', 'salary'],
  percentage: ['percent', 'rate', 'ratio'],
};

/**
 * Determine smart field type based on database metadata and conventions
 * Enhanced version with comprehensive PostgreSQL support and field classification
 */
function determineFieldType(column, isForeignKey, isEnum) {
  const colName = column.column_name.toLowerCase();
  const dataType = column.data_type.toLowerCase();
  const udtName = column.udt_name?.toLowerCase() || '';

  // Primary key fields
  if (colName === 'id') {
    return 'primary-key';
  }

  // Audit fields
  if (['created_at', 'updated_at', 'deleted_at'].includes(colName)) {
    return 'audit-timestamp';
  }

  if (['created_by', 'updated_by', 'deleted_by'].includes(colName)) {
    return 'audit-user';
  }

  // Foreign key fields -> dropdown
  if (isForeignKey) {
    return 'foreign-key-dropdown';
  }

  // Enum fields -> select
  if (isEnum) {
    return 'enum-select';
  }

  // Check PostgreSQL data type mapping first
  if (POSTGRES_TYPE_MAPPING[dataType]) {
    const fieldType = POSTGRES_TYPE_MAPPING[dataType];

    // Special handling for array types
    if (dataType.includes('[]') || udtName.includes('_')) {
      return 'array';
    }

    // Apply name-based refinements for certain types
    if (
      fieldType === 'varchar' ||
      fieldType === 'char' ||
      fieldType === 'textarea'
    ) {
      const nameBasedType = getFieldTypeFromName(colName);
      if (nameBasedType && nameBasedType !== 'text') {
        return nameBasedType;
      }
    }

    return fieldType;
  }

  // Check udt_name for enum types
  if (udtName && POSTGRES_TYPE_MAPPING[udtName]) {
    return POSTGRES_TYPE_MAPPING[udtName];
  }

  // Fallback to name-based detection
  const nameBasedType = getFieldTypeFromName(colName);
  if (nameBasedType) {
    return nameBasedType;
  }

  // Legacy fallback for backward compatibility
  if (
    [
      'timestamp without time zone',
      'timestamp with time zone',
      'date',
    ].includes(dataType)
  ) {
    return 'datetime';
  }

  if (
    [
      'integer',
      'bigint',
      'smallint',
      'decimal',
      'numeric',
      'real',
      'double precision',
    ].includes(dataType)
  ) {
    return 'number';
  }

  // Default to text input
  return 'text';
}

/**
 * Get field type based on column name patterns
 */
function getFieldTypeFromName(columnName) {
  const colName = columnName.toLowerCase();

  // Check each pattern
  for (const [fieldType, patterns] of Object.entries(FIELD_NAME_PATTERNS)) {
    if (patterns.some((pattern) => colName.includes(pattern))) {
      return fieldType;
    }
  }

  return null;
}

/**
 * Get filtering strategy for a field based on its PostgreSQL type and field type
 */
function getFieldFilteringStrategy(column, fieldType) {
  const dataType = column.data_type?.toLowerCase() || '';
  const udtName = column.udt_name?.toLowerCase() || '';

  // Check if the field type has a predefined filtering strategy
  if (FIELD_FILTERING_STRATEGIES[fieldType]) {
    return FIELD_FILTERING_STRATEGIES[fieldType];
  }

  // Check PostgreSQL type mapping
  const mappedType =
    POSTGRES_TYPE_MAPPING[dataType] || POSTGRES_TYPE_MAPPING[udtName];
  if (mappedType && FIELD_FILTERING_STRATEGIES[mappedType]) {
    return FIELD_FILTERING_STRATEGIES[mappedType];
  }

  // Fallback based on data type patterns
  if (dataType.includes('timestamp') || dataType.includes('date')) {
    return FIELD_FILTERING_STRATEGIES['timestamp'];
  }

  if (
    dataType.includes('int') ||
    dataType.includes('numeric') ||
    dataType.includes('decimal')
  ) {
    return FIELD_FILTERING_STRATEGIES['number'];
  }

  if (
    dataType.includes('varchar') ||
    dataType.includes('text') ||
    dataType.includes('char')
  ) {
    return FIELD_FILTERING_STRATEGIES['varchar'];
  }

  if (dataType.includes('bool')) {
    return FIELD_FILTERING_STRATEGIES['boolean'];
  }

  if (dataType.includes('uuid')) {
    return FIELD_FILTERING_STRATEGIES['uuid'];
  }

  // Default strategy for unknown types
  return {
    category: 'unknown',
    filters: ['equals'],
  };
}

/**
 * Get enhanced field configuration based on PostgreSQL type
 */
function getFieldConfiguration(column) {
  const fieldType = determineFieldType(column, false, false);
  const config = {
    type: fieldType,
    required: column.is_nullable === 'NO',
    defaultValue: column.column_default,
    maxLength: column.character_maximum_length,
    precision: column.numeric_precision,
    scale: column.numeric_scale,
  };

  // Add type-specific configurations
  switch (fieldType) {
    case 'bigint':
      config.step = 1;
      config.pattern = '[0-9]*';
      break;

    case 'decimal':
    case 'numeric':
      if (config.scale > 0) {
        config.step = 1 / Math.pow(10, config.scale);
      }
      break;

    case 'float':
      config.step = 'any';
      break;

    case 'array':
      config.elementType = getArrayElementType(column);
      break;

    case 'varchar':
    case 'char':
      if (config.maxLength > 500) {
        config.type = 'textarea';
      }
      break;
  }

  return config;
}

/**
 * Extract array element type from PostgreSQL array column
 */
function getArrayElementType(column) {
  const udtName = column.udt_name;
  if (udtName && udtName.startsWith('_')) {
    const elementType = udtName.substring(1);
    return POSTGRES_TYPE_MAPPING[elementType] || 'text';
  }
  return 'text';
}

/**
 * Get dropdown endpoint for foreign key field
 */
function getDropdownEndpoint(foreignKeyInfo) {
  if (!foreignKeyInfo) return null;

  const { referencedTable } = foreignKeyInfo;

  // Convert table name to API endpoint
  // e.g., 'users' -> '/users/dropdown'
  return `/${referencedTable}/dropdown`;
}

/**
 * Check if a table has a dropdown endpoint available
 */
async function hasDropdownEndpoint(tableName) {
  try {
    // Check if the referenced table exists and has basic structure for dropdown
    const schema = await getDatabaseSchema(tableName);
    if (!schema) return false;

    // Look for common display fields (name, title, etc.)
    const hasDisplayField = schema.columns.some((col) =>
      ['name', 'title', 'first_name', 'username', 'email'].includes(col.name),
    );

    return hasDisplayField;
  } catch (error) {
    return false;
  }
}

/**
 * Get suggested display fields for dropdown
 */
function getDropdownDisplayFields(referencedTableName, referencedSchema) {
  if (!referencedSchema) return ['id'];

  const priorityFields = [
    'name',
    'title',
    'first_name',
    'username',
    'email',
    'description',
    'label',
    'display_name',
  ];

  const availableFields = [];

  // Add priority fields that exist
  priorityFields.forEach((field) => {
    if (referencedSchema.columns.some((col) => col.name === field)) {
      availableFields.push(field);
    }
  });

  // If no priority fields found, use first string field after id
  if (availableFields.length === 0) {
    const firstStringField = referencedSchema.columns.find(
      (col) =>
        col.name !== 'id' &&
        ['character varying', 'varchar', 'text'].includes(col.type),
    );

    if (firstStringField) {
      availableFields.push(firstStringField.name);
    }
  }

  // Always include id as fallback
  if (!availableFields.includes('id')) {
    availableFields.unshift('id');
  }

  return availableFields.slice(0, 3); // Limit to 3 fields for dropdown label
}

/**
 * Map PostgreSQL types to TypeScript types
 */
function mapPostgresToTypeScript(dataType, udtName) {
  const typeMap = {
    integer: 'number',
    bigint: 'number',
    smallint: 'number',
    decimal: 'number',
    numeric: 'number',
    real: 'number',
    'double precision': 'number',
    serial: 'number',
    bigserial: 'number',
    'character varying': 'string',
    varchar: 'string',
    character: 'string',
    char: 'string',
    text: 'string',
    boolean: 'boolean',
    'timestamp without time zone': 'Date',
    'timestamp with time zone': 'Date',
    date: 'Date',
    time: 'string',
    json: 'Record<string, any>',
    jsonb: 'Record<string, any>',
    uuid: 'string',
    bytea: 'Buffer',
    array: 'any[]',
  };

  // Handle arrays
  if (udtName && udtName.startsWith('_')) {
    const baseType = udtName.substring(1);
    const tsBaseType = typeMap[baseType] || 'any';
    return `${tsBaseType}[]`;
  }

  return typeMap[dataType] || typeMap[udtName] || 'any';
}

/**
 * Map PostgreSQL types to TypeBox types
 */
function mapPostgresToTypeBox(dataType, udtName, isNullable) {
  const typeMap = {
    integer: 'Type.Integer()',
    bigint: 'Type.Number()',
    smallint: 'Type.Integer()',
    decimal: 'Type.Number()',
    numeric: 'Type.Number()',
    real: 'Type.Number()',
    'double precision': 'Type.Number()',
    serial: 'Type.Integer()',
    bigserial: 'Type.Number()',
    'character varying': 'Type.String()',
    varchar: 'Type.String()',
    character: 'Type.String()',
    char: 'Type.String()',
    text: 'Type.String()',
    boolean: 'Type.Boolean()',
    'timestamp without time zone': 'Type.String({ format: "date-time" })',
    'timestamp with time zone': 'Type.String({ format: "date-time" })',
    date: 'Type.String({ format: "date" })',
    time: 'Type.String()',
    json: 'Type.Record(Type.String(), Type.Any())',
    jsonb: 'Type.Record(Type.String(), Type.Any())',
    uuid: 'Type.String({ format: "uuid" })',
    bytea: 'Type.String()',
    array: 'Type.Array(Type.Any())',
  };

  let typeboxType = typeMap[dataType] || typeMap[udtName] || 'Type.Any()';

  // Handle arrays
  if (udtName && udtName.startsWith('_')) {
    const baseType = udtName.substring(1);
    const baseTypeBox = typeMap[baseType] || 'Type.Any()';
    typeboxType = `Type.Array(${baseTypeBox})`;
  }

  // Handle nullable types
  if (isNullable) {
    typeboxType = `Type.Optional(${typeboxType})`;
  }

  return typeboxType;
}

/**
 * Get enhanced schema with smart field detection and FK analysis
 */
async function getEnhancedSchema(tableName) {
  try {
    console.log(`🔍 Analyzing table: ${tableName}`);

    // Get basic schema
    const schema = await getDatabaseSchema(tableName);
    if (!schema) {
      throw new Error(`Table ${tableName} not found`);
    }

    // ===== DETECT ERROR HANDLING CONSTRAINTS =====
    console.log(`🔍 Detecting error handling constraints...`);

    // Detect unique constraints (for duplicate detection)
    const uniqueConstraints = await detectUniqueConstraints(tableName);
    schema.uniqueConstraints = uniqueConstraints;

    // Detect foreign key references (for delete validation)
    const foreignKeyReferences = await detectForeignKeyReferences(tableName);
    schema.foreignKeyReferences = foreignKeyReferences;

    // Detect business rules (for validation)
    const businessRules = detectBusinessRules(schema.columns);
    schema.businessRules = businessRules;

    // Generate error codes based on detected constraints
    const errorCodes = generateErrorCodes(tableName, schema);
    schema.errorCodes = errorCodes;

    console.log(`✅ Constraint detection complete`);
    console.log(
      `   - Unique constraints: ${uniqueConstraints.singleField.length} single, ${uniqueConstraints.composite.length} composite`,
    );
    console.log(
      `   - Foreign key references: ${foreignKeyReferences.length} tables`,
    );
    console.log(`   - Business rules: ${businessRules.length} rules`);
    console.log(
      `   - Error codes: ${Object.keys(errorCodes).length} codes generated`,
    );

    // Enhance FK columns with dropdown information
    const enhancedColumns = await Promise.all(
      schema.columns.map(async (column) => {
        if (column.isForeignKey && column.foreignKeyInfo) {
          const { referencedTable } = column.foreignKeyInfo;

          try {
            // Get referenced table schema for dropdown analysis
            const referencedSchema = await getDatabaseSchema(referencedTable);
            const hasDropdown = await hasDropdownEndpoint(referencedTable);
            const displayFields = getDropdownDisplayFields(
              referencedTable,
              referencedSchema,
            );

            return {
              ...column,
              dropdownInfo: {
                endpoint: getDropdownEndpoint(column.foreignKeyInfo),
                hasEndpoint: hasDropdown,
                displayFields: displayFields,
                referencedSchema: referencedSchema,
              },
            };
          } catch (error) {
            console.warn(
              `⚠️ Could not analyze FK table ${referencedTable}:`,
              error.message,
            );
            return {
              ...column,
              dropdownInfo: {
                endpoint: getDropdownEndpoint(column.foreignKeyInfo),
                hasEndpoint: false,
                displayFields: ['id'],
                referencedSchema: null,
              },
            };
          }
        }

        return column;
      }),
    );

    // Analyze table capabilities
    const capabilities = {
      hasAuditFields: enhancedColumns.some(
        (col) => col.fieldType === 'audit-timestamp',
      ),
      hasUserAuditFields: enhancedColumns.some(
        (col) => col.fieldType === 'audit-user',
      ),
      hasForeignKeys: enhancedColumns.some((col) => col.isForeignKey),
      hasEnums: enhancedColumns.some((col) => col.isEnum),
      foreignKeyCount: enhancedColumns.filter((col) => col.isForeignKey).length,
      enumCount: enhancedColumns.filter((col) => col.isEnum).length,
      dropdownFields: enhancedColumns.filter(
        (col) => col.fieldType === 'foreign-key-dropdown',
      ),
      selectFields: enhancedColumns.filter(
        (col) => col.fieldType === 'enum-select',
      ),
    };

    console.log(`✅ Enhanced analysis complete for ${tableName}:`);
    console.log(`   - Foreign Keys: ${capabilities.foreignKeyCount}`);
    console.log(`   - Enums: ${capabilities.enumCount}`);
    console.log(
      `   - Dropdown fields: ${capabilities.dropdownFields.map((f) => f.name).join(', ')}`,
    );
    console.log(
      `   - Select fields: ${capabilities.selectFields.map((f) => f.name).join(', ')}`,
    );

    return {
      ...schema,
      columns: enhancedColumns,
      capabilities,
      enhancedMetadata: {
        analyzedAt: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to get enhanced schema for table ${tableName}: ${error.message}`,
    );
  }
}

/**
 * Validate that required dropdown endpoints exist for FK fields
 */
async function validateDropdownEndpoints(enhancedSchema) {
  const results = {
    valid: true,
    missing: [],
    warnings: [],
  };

  for (const column of enhancedSchema.columns) {
    if (column.fieldType === 'foreign-key-dropdown' && column.dropdownInfo) {
      if (!column.dropdownInfo.hasEndpoint) {
        results.valid = false;
        results.missing.push({
          field: column.name,
          referencedTable: column.foreignKeyInfo.referencedTable,
          suggestedEndpoint: column.dropdownInfo.endpoint,
        });
      }

      if (
        column.dropdownInfo.displayFields.length === 1 &&
        column.dropdownInfo.displayFields[0] === 'id'
      ) {
        results.warnings.push({
          field: column.name,
          referencedTable: column.foreignKeyInfo.referencedTable,
          issue: 'Only ID field available for dropdown display',
        });
      }
    }
  }

  return results;
}

/**
 * Enhanced constraint value extraction with multiple patterns
 */
function extractConstraintValues(checkClause) {
  if (!checkClause) return null;

  // Pattern 1: status IN ('draft', 'published')
  let match = checkClause.match(/IN\s*\(\s*([^)]+)\s*\)/i);
  if (match) {
    return match[1]
      .split(',')
      .map((val) => val.trim().replace(/^['"]|['"]$/g, ''))
      .filter((val) => val.length > 0);
  }

  // Pattern 2: status = ANY(ARRAY['draft', 'published']) - PostgreSQL format with optional type casting
  match = checkClause.match(
    /=\s*ANY\s*\(\s*\(\s*ARRAY\s*\[\s*([^\]]+)\s*\]\s*\)/i,
  );
  if (match) {
    return match[1]
      .split(',')
      .map(
        (val) =>
          val
            .trim()
            .replace(/^['"]|['"]$/g, '') // Remove quotes
            .replace(/'::character\s+varying/g, '') // Remove PostgreSQL type casting
            .replace(/::[\w\s]+/g, ''), // Remove other type casting
      )
      .filter((val) => val.length > 0);
  }

  // Pattern 3: Simple ANY(ARRAY[...]) format (alternative PostgreSQL format)
  match = checkClause.match(/=\s*ANY\s*\(\s*ARRAY\s*\[\s*([^\]]+)\s*\]\s*\)/i);
  if (match) {
    return match[1]
      .split(',')
      .map(
        (val) =>
          val
            .trim()
            .replace(/^['"]|['"]$/g, '') // Remove quotes
            .replace(/'::character\s+varying/g, '') // Remove PostgreSQL type casting
            .replace(/::[\w\s]+/g, ''), // Remove other type casting
      )
      .filter((val) => val.length > 0);
  }

  return null;
}

/**
 * Determine constraint type and confidence
 */
function determineConstraintType(constraintValues, enumData, column) {
  if (enumData && enumData.enum_values) return 'postgres_enum';
  if (constraintValues && constraintValues.length > 0)
    return 'check_constraint';
  if (column.data_type === 'boolean') return 'boolean';
  return 'unknown';
}

/**
 * Calculate confidence level for constraint detection
 */
function calculateConfidence(constraintValues, enumData, column) {
  if (enumData && enumData.enum_values) return 100; // PostgreSQL enums are 100% reliable
  if (constraintValues && constraintValues.length > 0) return 95; // Check constraints are 95% reliable
  if (column.data_type === 'boolean') return 100; // Boolean type is 100% reliable
  return 0; // Unknown type
}

/**
 * Get safe default value from constraints
 */
function getConstraintDefault(constraintValues, enumData, column) {
  // Use enum values first (highest priority)
  if (enumData && enumData.enum_values && enumData.enum_values.length > 0) {
    return enumData.enum_values[0];
  }

  // Use constraint values second
  if (constraintValues && constraintValues.length > 0) {
    return constraintValues[0];
  }

  // Boolean type default
  if (column.data_type === 'boolean') {
    return 'true';
  }

  // No safe default available
  return null;
}

/**
 * Get constraint source information
 */
function getConstraintSource(checkConstraint, enumData) {
  if (enumData) return 'postgres_enum';
  if (checkConstraint) return 'check_constraint';
  return 'inference';
}

/**
 * Create comprehensive constraint metadata
 */
function createConstraintMetadata(constraintValues, enumData, column) {
  const type = determineConstraintType(constraintValues, enumData, column);
  const confidence = calculateConfidence(constraintValues, enumData, column);
  const defaultValue = getConstraintDefault(constraintValues, enumData, column);
  const source = getConstraintSource(null, enumData);

  return {
    type,
    confidence,
    defaultValue,
    source,
    values: constraintValues || enumData?.enum_values || [],
    allowNull: column.is_nullable === 'YES',
  };
}

// ===== ERROR HANDLING: CONSTRAINT DETECTION =====

/**
 * Detect UNIQUE constraints on a table
 * Returns both single-field and composite unique constraints
 *
 * @param {string} tableName - Name of the table to analyze
 * @returns {Promise<Object>} Object with singleField and composite arrays
 */
async function detectUniqueConstraints(tableName) {
  try {
    // Query to get all UNIQUE constraints (including indexes)
    const uniqueConstraints = await knex.raw(
      `
      SELECT
        tc.constraint_name,
        array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as column_names,
        COUNT(*) as column_count
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = ?
        AND tc.constraint_type = 'UNIQUE'
      GROUP BY tc.constraint_name

      UNION

      SELECT
        ix.indexname as constraint_name,
        array_agg(a.attname ORDER BY array_position(ix.indkey_array, a.attnum)) as column_names,
        array_length(ix.indkey_array, 1) as column_count
      FROM (
        SELECT
          indexname,
          tablename,
          string_to_array(indkey::text, ' ')::int[] as indkey_array
        FROM pg_indexes
        JOIN pg_index ON pg_indexes.indexname = pg_index.indexrelid::regclass::text
        WHERE tablename = ?
          AND indisunique = true
          AND indisprimary = false
      ) ix
      JOIN pg_attribute a ON a.attrelid = (SELECT oid FROM pg_class WHERE relname = ix.tablename)
        AND a.attnum = ANY(ix.indkey_array)
      GROUP BY ix.indexname, ix.indkey_array
    `,
      [tableName, tableName],
    );

    const singleField = [];
    const composite = [];

    uniqueConstraints.rows.forEach((constraint) => {
      // PostgreSQL returns array as {col1,col2} string format
      // Need to parse it properly
      let columns = constraint.column_names;

      // If columns is a string like "{email}", parse it to array
      if (typeof columns === 'string') {
        // Remove curly braces and split by comma
        columns = columns
          .replace(/^\{/, '')
          .replace(/\}$/, '')
          .split(',')
          .map((col) => col.trim());
      }

      const columnCount = parseInt(constraint.column_count);

      if (columnCount === 1) {
        // Single field unique constraint
        singleField.push(columns[0]);
      } else if (columnCount > 1) {
        // Composite unique constraint
        composite.push(columns);
      }
    });

    console.log(`✅ Detected unique constraints for ${tableName}:`);
    console.log(`   - Single field: ${singleField.join(', ') || 'none'}`);
    console.log(
      `   - Composite: ${composite.map((c) => `(${c.join(', ')})`).join(', ') || 'none'}`,
    );

    return {
      singleField,
      composite,
    };
  } catch (error) {
    console.warn(
      `⚠️ Failed to detect unique constraints for ${tableName}:`,
      error.message,
    );
    return {
      singleField: [],
      composite: [],
    };
  }
}

/**
 * Detect tables that reference this table (foreign key references)
 * Used for delete validation - prevent deletion if records exist
 *
 * @param {string} tableName - Name of the table to analyze
 * @returns {Promise<Array>} Array of objects describing foreign key references
 */
async function detectForeignKeyReferences(tableName) {
  try {
    const references = await knex.raw(
      `
      SELECT
        tc.table_name as referencing_table,
        kcu.column_name as referencing_column,
        rc.delete_rule as on_delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = ?
      ORDER BY tc.table_name, kcu.column_name
    `,
      [tableName],
    );

    const fkReferences = references.rows.map((ref) => ({
      table: ref.referencing_table,
      field: ref.referencing_column,
      cascade: ref.on_delete_rule === 'CASCADE',
      deleteRule: ref.on_delete_rule,
    }));

    console.log(`✅ Detected foreign key references to ${tableName}:`);
    if (fkReferences.length > 0) {
      fkReferences.forEach((ref) => {
        console.log(
          `   - ${ref.table}.${ref.field} (ON DELETE ${ref.deleteRule})`,
        );
      });
    } else {
      console.log(`   - No foreign key references found`);
    }

    return fkReferences;
  } catch (error) {
    console.warn(
      `⚠️ Failed to detect foreign key references for ${tableName}:`,
      error.message,
    );
    return [];
  }
}

/**
 * Detect business rules based on column types and names
 * Returns validation rules that should be enforced
 *
 * @param {Array} columns - Array of column objects from schema
 * @returns {Array} Array of business rule objects
 */
function detectBusinessRules(columns) {
  const rules = [];

  columns.forEach((column) => {
    const colName = column.name.toLowerCase();
    const dataType = column.type?.toLowerCase() || '';
    const tsType = column.tsType;

    // Rule: Date fields that represent dates in the past (birth_date, etc.)
    if (
      (dataType.includes('date') || tsType === 'Date') &&
      (colName.includes('birth') ||
        colName.includes('dob') ||
        colName.includes('born'))
    ) {
      rules.push({
        field: column.name,
        type: 'date_not_future',
        message: `${column.name} cannot be in the future`,
        errorCode: 'INVALID_DATE',
      });
    }

    // Rule: Positive numbers for prices, amounts, quantities
    if (
      tsType === 'number' &&
      (colName.includes('price') ||
        colName.includes('cost') ||
        colName.includes('amount') ||
        colName.includes('quantity') ||
        colName.includes('count'))
    ) {
      rules.push({
        field: column.name,
        type: 'positive_number',
        message: `${column.name} must be a positive number`,
        errorCode: 'INVALID_VALUE',
      });
    }

    // Rule: Email format validation
    if (
      colName.includes('email') ||
      colName.includes('e_mail') ||
      colName === 'mail'
    ) {
      rules.push({
        field: column.name,
        type: 'email_format',
        message: `${column.name} must be a valid email address`,
        errorCode: 'INVALID_EMAIL',
      });
    }

    // Rule: URL format validation
    if (
      colName.includes('url') ||
      colName.includes('website') ||
      colName.includes('link')
    ) {
      rules.push({
        field: column.name,
        type: 'url_format',
        message: `${column.name} must be a valid URL`,
        errorCode: 'INVALID_URL',
      });
    }

    // Rule: Phone number format
    if (
      colName.includes('phone') ||
      colName.includes('tel') ||
      colName.includes('mobile')
    ) {
      rules.push({
        field: column.name,
        type: 'phone_format',
        message: `${column.name} must be a valid phone number`,
        errorCode: 'INVALID_PHONE',
      });
    }
  });

  if (rules.length > 0) {
    console.log(`✅ Detected ${rules.length} business rules:`);
    rules.forEach((rule) => {
      console.log(`   - ${rule.field}: ${rule.type}`);
    });
  }

  return rules;
}

/**
 * Generate error codes for a table based on detected constraints
 *
 * @param {string} tableName - Name of the table
 * @param {Object} schema - Enhanced schema object with constraints
 * @returns {Object} Object containing error code mappings
 */
function generateErrorCodes(tableName, schema) {
  const pascalName = tableName
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    .replace(/^[a-z]/, (letter) => letter.toUpperCase());
  const upperName = tableName.toUpperCase();

  const errorCodes = {
    NOT_FOUND: `${upperName}_NOT_FOUND`,
    VALIDATION_ERROR: `${upperName}_VALIDATION_ERROR`,
  };

  // Add duplicate error codes for unique constraints
  if (schema.uniqueConstraints) {
    schema.uniqueConstraints.singleField.forEach((field) => {
      const fieldUpper = field.toUpperCase();
      errorCodes[`DUPLICATE_${fieldUpper}`] =
        `${upperName}_DUPLICATE_${fieldUpper}`;
    });

    schema.uniqueConstraints.composite.forEach((fields, index) => {
      const fieldsUpper = fields.map((f) => f.toUpperCase()).join('_');
      errorCodes[`DUPLICATE_${fieldsUpper}`] =
        `${upperName}_DUPLICATE_${fieldsUpper}`;
    });
  }

  // Add cannot delete error if there are foreign key references
  if (schema.foreignKeyReferences && schema.foreignKeyReferences.length > 0) {
    errorCodes.CANNOT_DELETE_HAS_REFERENCES = `${upperName}_CANNOT_DELETE_HAS_REFERENCES`;

    // Add specific error codes for each referencing table
    schema.foreignKeyReferences.forEach((ref) => {
      const refTableUpper = ref.table.toUpperCase();
      errorCodes[`CANNOT_DELETE_HAS_${refTableUpper}`] =
        `${upperName}_CANNOT_DELETE_HAS_${refTableUpper}`;
    });
  }

  // Add business rule error codes
  if (schema.businessRules && schema.businessRules.length > 0) {
    schema.businessRules.forEach((rule) => {
      const fieldUpper = rule.field.toUpperCase();
      errorCodes[`${rule.errorCode}_${fieldUpper}`] =
        `${upperName}_${rule.errorCode}_${fieldUpper}`;
    });
  }

  return errorCodes;
}

module.exports = {
  getDatabaseSchema,
  getEnhancedSchema,
  validateDropdownEndpoints,
  listTables,
  mapPostgresToTypeScript,
  mapPostgresToTypeBox,
  determineFieldType,
  getFieldFilteringStrategy,
  getDropdownEndpoint,
  hasDropdownEndpoint,
  getDropdownDisplayFields,
  extractConstraintValues,
  createConstraintMetadata,
  detectUniqueConstraints,
  detectForeignKeyReferences,
  detectBusinessRules,
  generateErrorCodes,
  FIELD_FILTERING_STRATEGIES,
  POSTGRES_TYPE_MAPPING,
};
