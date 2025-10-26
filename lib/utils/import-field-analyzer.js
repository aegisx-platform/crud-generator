/**
 * Import Field Analyzer
 * Analyzes database schema to generate intelligent import field configurations
 */

/**
 * Analyze table schema and generate import field configurations
 * @param {Object} schema - Table schema from database
 * @param {string} tableName - Table name
 * @param {string} moduleName - Module name (camelCase)
 * @param {string} ModuleName - Module name (PascalCase)
 * @returns {Object} Import configuration data for templates
 */
function analyzeImportFields(schema, tableName, moduleName, ModuleName) {
  const importFields = [];
  const uniqueFields = [];
  const customValidators = [];
  const transformers = [];
  const transformFields = [];

  // Fields to skip in import
  const skipFields = new Set([
    'id',
    'created_at',
    'updated_at',
    'deleted_at',
    'created_by',
    'updated_by',
    'deleted_by',
  ]);

  schema.columns.forEach((column) => {
    const fieldName = column.name;

    // Skip auto-generated fields
    if (skipFields.has(fieldName)) {
      return;
    }

    // Detect field characteristics
    const fieldType = detectFieldType(column);
    const isUnique = detectUniqueField(column, fieldName);
    const isEmail = detectEmailField(fieldName, column);
    const isPhone = detectPhoneField(fieldName);
    const isUrl = detectUrlField(fieldName);
    const isBoolean = column.type === 'boolean';
    const isDate = column.type === 'date' || column.type === 'timestamp';

    // Create base field config
    const fieldConfig = {
      name: fieldName,
      label: generateFieldLabel(fieldName),
      required: column.nullable === false,
      type: fieldType,
      description: generateFieldDescription(fieldName, column),
      exampleValue: generateExampleValue(fieldName, column, fieldType),
      hasExampleGenerator: false,
      hasValidator: false,
      hasTransformer: false,
    };

    // Add maxLength for string fields
    if (
      fieldType === 'string' &&
      column.maxLength &&
      column.maxLength < 10000
    ) {
      fieldConfig.maxLength = column.maxLength;
    }

    // Handle unique fields (add async validator)
    if (isUnique) {
      fieldConfig.hasValidator = true;
      fieldConfig.validatorName = `validate${toPascalCase(fieldName)}Uniqueness`;

      uniqueFields.push({
        name: fieldName,
        validatorName: fieldConfig.validatorName,
        pascalCase: toPascalCase(fieldName),
        upperCase: fieldName.toUpperCase(),
        ModuleName,
        moduleName,
      });
    }

    // Handle email fields
    if (isEmail) {
      fieldConfig.type = 'email';
      if (!fieldConfig.hasValidator) {
        fieldConfig.hasValidator = true;
        fieldConfig.validatorName = `validateEmail`;
      }

      // Add email validator if not already added
      if (!customValidators.find((v) => v.name === 'email')) {
        customValidators.push({
          name: 'email',
          validatorName: 'validateEmail',
          description: 'Validate email format',
          validationLogic: `
      // Basic email validation
      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      if (!emailRegex.test(value)) {
        return {
          field: 'email',
          message: 'Invalid email format',
          code: 'INVALID_EMAIL',
          severity: ImportValidationSeverity.ERROR,
          value,
        };
      }`,
        });
      }
    }

    // Handle phone fields
    if (isPhone) {
      if (!customValidators.find((v) => v.name === 'phone')) {
        customValidators.push({
          name: 'phone',
          validatorName: `validate${toPascalCase(fieldName)}`,
          description: 'Validate phone number format',
          validationLogic: `
      // Basic phone validation (adjust regex as needed)
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\\s.]?[(]?[0-9]{1,4}[)]?[-\\s.]?[0-9]{1,9}$/;
      if (!phoneRegex.test(value)) {
        return {
          field: '${fieldName}',
          message: 'Invalid phone number format',
          code: 'INVALID_PHONE',
          severity: ImportValidationSeverity.ERROR,
          value,
        };
      }`,
        });
      }
    }

    // Handle URL fields
    if (isUrl) {
      fieldConfig.type = 'url';
    }

    // Handle boolean fields (add transformer)
    if (isBoolean) {
      fieldConfig.hasTransformer = true;
      fieldConfig.transformerName = `transform${toPascalCase(fieldName)}`;

      transformers.push({
        name: fieldName,
        transformerName: fieldConfig.transformerName,
        returnType: 'boolean',
        transformLogic: `
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (lower === 'true' || lower === 'yes' || lower === '1') return true;
      if (lower === 'false' || lower === 'no' || lower === '0') return false;
    }
    if (typeof value === 'number') return value !== 0;
    return false;`,
      });
    }

    // Handle date fields (add transformer)
    if (isDate) {
      fieldConfig.hasTransformer = true;
      fieldConfig.transformerName = `transform${toPascalCase(fieldName)}`;

      if (
        !transformers.find((t) => t.transformerName === 'transformDateField')
      ) {
        transformers.push({
          name: 'dateField',
          transformerName: 'transformDateField',
          returnType: 'Date | null',
          transformLogic: `
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;`,
        });
      }
    }

    // Add error messages if validators exist
    if (fieldConfig.hasValidator || isUnique) {
      fieldConfig.errorMessages = {};

      if (fieldConfig.required) {
        fieldConfig.errorMessages.required = {
          isErrorCode: true,
          code: 'REQUIRED_FIELD',
        };
      }

      if (isUnique) {
        fieldConfig.errorMessages.unique = {
          isErrorCode: true,
          code: `DUPLICATE_${fieldName.toUpperCase()}`,
        };
      }

      if (isEmail) {
        fieldConfig.errorMessages.invalid = 'Invalid email format';
      }
    }

    importFields.push(fieldConfig);

    // Add to transform fields for row transformer
    let transformExpression = `row.${fieldName}`;

    if (fieldConfig.hasTransformer) {
      transformExpression = `${ModuleName}ImportService.${fieldConfig.transformerName}(row.${fieldName}, row)`;
    } else if (isDate) {
      transformExpression = `${ModuleName}ImportService.transformDateField(row.${fieldName}, row)`;
    }

    transformFields.push({
      name: fieldName,
      transformExpression,
    });
  });

  return {
    importFields,
    uniqueFields,
    customValidators,
    transformers,
    transformFields,
    ModuleName,
    moduleName,
  };
}

/**
 * Detect field type for import configuration
 */
function detectFieldType(column) {
  const type = column.type.toLowerCase();

  if (
    type.includes('int') ||
    type.includes('float') ||
    type.includes('decimal') ||
    type.includes('numeric')
  ) {
    return 'number';
  }

  if (type === 'boolean' || type === 'bool') {
    return 'boolean';
  }

  if (
    type.includes('date') ||
    type.includes('timestamp') ||
    type.includes('time')
  ) {
    return 'date';
  }

  if (type === 'uuid') {
    return 'uuid';
  }

  return 'string';
}

/**
 * Detect if field should have uniqueness validation
 */
function detectUniqueField(column, fieldName) {
  // Check database unique constraint
  if (column.unique === true) {
    return true;
  }

  // Check common unique field patterns
  const uniquePatterns = [
    'email',
    'username',
    'code',
    'slug',
    'sku',
    'isbn',
    'serial',
    'license',
  ];

  return uniquePatterns.some((pattern) =>
    fieldName.toLowerCase().includes(pattern),
  );
}

/**
 * Detect email field
 */
function detectEmailField(fieldName, column) {
  return (
    fieldName.toLowerCase().includes('email') ||
    (column.type === 'string' && fieldName.toLowerCase() === 'email')
  );
}

/**
 * Detect phone field
 */
function detectPhoneField(fieldName) {
  const phonePatterns = ['phone', 'mobile', 'tel', 'fax'];
  return phonePatterns.some((pattern) =>
    fieldName.toLowerCase().includes(pattern),
  );
}

/**
 * Detect URL field
 */
function detectUrlField(fieldName) {
  const urlPatterns = ['url', 'website', 'link', 'uri'];
  return urlPatterns.some((pattern) =>
    fieldName.toLowerCase().includes(pattern),
  );
}

/**
 * Generate human-readable field label
 */
function generateFieldLabel(fieldName) {
  return fieldName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate field description
 */
function generateFieldDescription(fieldName, column) {
  const label = generateFieldLabel(fieldName);
  let desc = `${label} value`;

  if (column.nullable === false) {
    desc += ' (required)';
  }

  if (column.maxLength && column.maxLength < 10000) {
    desc += ` (max ${column.maxLength} characters)`;
  }

  return desc;
}

/**
 * Generate example value based on field name and type
 */
function generateExampleValue(fieldName, column, fieldType) {
  const lowerName = fieldName.toLowerCase();

  // Email fields
  if (lowerName.includes('email')) {
    return 'user@example.com';
  }

  // Name fields
  if (lowerName === 'name' || lowerName === 'title') {
    return 'Example Name';
  }
  if (lowerName === 'first_name' || lowerName === 'firstname') {
    return 'John';
  }
  if (lowerName === 'last_name' || lowerName === 'lastname') {
    return 'Doe';
  }

  // Description fields
  if (lowerName.includes('description') || lowerName.includes('bio')) {
    return 'Sample description text';
  }

  // Phone fields
  if (lowerName.includes('phone') || lowerName.includes('mobile')) {
    return '+1234567890';
  }

  // URL fields
  if (lowerName.includes('url') || lowerName.includes('website')) {
    return 'https://example.com';
  }

  // Code/SKU fields
  if (lowerName.includes('code') || lowerName.includes('sku')) {
    return 'ABC123';
  }

  // Boolean fields
  if (fieldType === 'boolean') {
    return 'true';
  }

  // Number fields
  if (fieldType === 'number') {
    if (lowerName.includes('price') || lowerName.includes('amount')) {
      return '99.99';
    }
    if (lowerName.includes('quantity') || lowerName.includes('count')) {
      return '10';
    }
    return '1';
  }

  // Date fields
  if (fieldType === 'date') {
    return '2024-01-01';
  }

  // Default string
  return 'Sample value';
}

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str) {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

module.exports = {
  analyzeImportFields,
};
