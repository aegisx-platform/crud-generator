const fs = require('fs').promises;
const path = require('path');

/**
 * Validate generated CRUD module
 */
async function validateModule(moduleName, options = {}) {
  const { outputDir = './apps/api/src/modules' } = options;

  const modulePath = path.join(outputDir, moduleName);
  const errors = [];
  const warnings = [];

  try {
    // Check if module directory exists
    await fs.access(modulePath);
  } catch {
    errors.push(`Module directory not found: ${modulePath}`);
    return { valid: false, errors, warnings };
  }

  // Required files to check
  const requiredFiles = [
    `${moduleName}.controller.ts`,
    `${moduleName}.service.ts`,
    `${moduleName}.routes.ts`,
    `${moduleName}.schemas.ts`,
    `${moduleName}.types.ts`,
    `${moduleName}.plugin.ts`,
  ];

  // Check if all required files exist
  for (const fileName of requiredFiles) {
    const filePath = path.join(modulePath, fileName);
    try {
      await fs.access(filePath);

      // Validate file content
      const content = await fs.readFile(filePath, 'utf8');

      // Basic content validation
      if (content.length === 0) {
        errors.push(`File is empty: ${fileName}`);
      }

      // Check for basic TypeScript syntax
      if (!content.includes('export') && !content.includes('import')) {
        warnings.push(`File may not be properly formatted: ${fileName}`);
      }
    } catch (error) {
      errors.push(`Required file missing: ${fileName}`);
    }
  }

  // Check test file
  const testFilePath = path.join(
    modulePath,
    '__tests__',
    `${moduleName}.test.ts`,
  );
  try {
    await fs.access(testFilePath);
  } catch {
    warnings.push('Test file not found - consider adding tests');
  }

  // Additional validations
  try {
    // Check controller file for basic structure
    const controllerPath = path.join(modulePath, `${moduleName}.controller.ts`);
    const controllerContent = await fs.readFile(controllerPath, 'utf8');

    if (
      !controllerContent.includes('class') ||
      !controllerContent.includes('Controller')
    ) {
      errors.push('Controller class not found or improperly named');
    }

    if (
      !controllerContent.includes('create') ||
      !controllerContent.includes('findOne')
    ) {
      errors.push('Controller missing required CRUD methods');
    }
  } catch (error) {
    // Already reported as missing file
  }

  // Check service file
  try {
    const servicePath = path.join(modulePath, `${moduleName}.service.ts`);
    const serviceContent = await fs.readFile(servicePath, 'utf8');

    if (
      !serviceContent.includes('class') ||
      !serviceContent.includes('Service')
    ) {
      errors.push('Service class not found or improperly named');
    }

    if (!serviceContent.includes('BaseRepository')) {
      warnings.push(
        'Service does not extend BaseRepository - may not follow AegisX patterns',
      );
    }
  } catch (error) {
    // Already reported as missing file
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate that module follows AegisX conventions
 */
async function validateConventions(moduleName, options = {}) {
  const result = await validateModule(moduleName, options);

  if (!result.valid) {
    return result;
  }

  const { outputDir = './apps/api/src/modules' } = options;
  const modulePath = path.join(outputDir, moduleName);

  // Additional convention checks
  try {
    // Check naming conventions
    const files = await fs.readdir(modulePath);
    const expectedPattern = new RegExp(
      `^${moduleName}\\.(controller|service|routes|schemas|types|plugin)\\.ts$`,
    );

    files.forEach((file) => {
      if (
        file.endsWith('.ts') &&
        !file.includes('test') &&
        !expectedPattern.test(file)
      ) {
        result.warnings.push(`File does not follow naming convention: ${file}`);
      }
    });

    // Check TypeBox usage in schemas
    const schemasPath = path.join(modulePath, `${moduleName}.schemas.ts`);
    const schemasContent = await fs.readFile(schemasPath, 'utf8');

    if (!schemasContent.includes('@sinclair/typebox')) {
      result.errors.push('Schemas file does not import TypeBox');
    }

    if (!schemasContent.includes('Type.Object')) {
      result.warnings.push('Schemas may not be using TypeBox properly');
    }
  } catch (error) {
    result.warnings.push('Could not validate conventions fully');
  }

  return {
    valid: result.errors.length === 0,
    errors: result.errors,
    warnings: result.warnings,
  };
}

module.exports = {
  validateModule,
  validateConventions,
};
