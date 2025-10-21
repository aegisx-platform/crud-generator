const fs = require('fs');
const path = require('path');
const {
  getEnhancedSchema,
  validateDropdownEndpoints,
} = require('./database.js');

/**
 * Dependency Validator - ตรวจสอบ API endpoints และ dependencies
 */

class DependencyValidator {
  constructor() {
    this.apiDir = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'apps',
      'api',
      'src',
    );
    this.webDir = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'apps',
      'web',
      'src',
    );
  }

  /**
   * ตรวจสอบว่า dropdown endpoints ที่ต้องการมีอยู่จริงหรือไม่
   */
  async validateDropdownDependencies(moduleName) {
    console.log(`🔍 Validating dropdown dependencies for ${moduleName}...`);

    try {
      // Get enhanced schema
      const enhancedSchema = await getEnhancedSchema(moduleName);

      // Validate dropdown endpoints
      const validation = await validateDropdownEndpoints(enhancedSchema);

      const results = {
        module: moduleName,
        valid: validation.valid,
        missing: validation.missing,
        warnings: validation.warnings,
        availableEndpoints: [],
        recommendations: [],
      };

      // Check which endpoints actually exist
      for (const column of enhancedSchema.columns) {
        if (
          column.fieldType === 'foreign-key-dropdown' &&
          column.dropdownInfo
        ) {
          const { referencedTable } = column.foreignKeyInfo;
          const endpointExists = await this.checkEndpointExists(
            referencedTable,
            'dropdown',
          );

          results.availableEndpoints.push({
            field: column.name,
            referencedTable,
            endpoint: column.dropdownInfo.endpoint,
            exists: endpointExists,
            displayFields: column.dropdownInfo.displayFields,
          });

          // Generate recommendations
          if (!endpointExists) {
            results.recommendations.push({
              type: 'create-endpoint',
              action: `Create dropdown endpoint for ${referencedTable}`,
              command: `node src/generator.js ${referencedTable} --enhanced`,
              priority: 'high',
            });
          }
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Validation failed for ${moduleName}: ${error.message}`);
    }
  }

  /**
   * ตรวจสอบว่า API endpoint มีอยู่จริงหรือไม่
   */
  async checkEndpointExists(moduleName, endpointType = 'dropdown') {
    try {
      // Check routes file
      const routesPath = path.join(
        this.apiDir,
        'modules',
        moduleName,
        'routes',
        'index.ts',
      );
      if (!fs.existsSync(routesPath)) {
        // Try core directory
        const coreRoutesPath = path.join(
          this.apiDir,
          'core',
          moduleName,
          `${moduleName}.routes.ts`,
        );
        if (!fs.existsSync(coreRoutesPath)) {
          return false;
        }

        const content = fs.readFileSync(coreRoutesPath, 'utf8');
        return content.includes(`/${endpointType}`);
      }

      const content = fs.readFileSync(routesPath, 'utf8');
      return content.includes(`/${endpointType}`);
    } catch (error) {
      return false;
    }
  }

  /**
   * ตรวจสอบ frontend service dependencies
   */
  async validateFrontendDependencies(moduleName) {
    console.log(`🎯 Validating frontend dependencies for ${moduleName}...`);

    const results = {
      module: moduleName,
      valid: true,
      issues: [],
      services: {},
      types: {},
      components: {},
    };

    try {
      // Check service file
      const servicePath = path.join(
        this.webDir,
        'app',
        'features',
        moduleName,
        'services',
        `${moduleName}.service.ts`,
      );
      results.services.exists = fs.existsSync(servicePath);

      if (results.services.exists) {
        const serviceContent = fs.readFileSync(servicePath, 'utf8');
        results.services.hasDropdownMethods =
          serviceContent.includes('dropdown');
        results.services.hasCreateMethod = serviceContent.includes('create');
        results.services.hasUpdateMethod = serviceContent.includes('update');
        results.services.hasDeleteMethod = serviceContent.includes('delete');
      }

      // Check types file
      const typesPath = path.join(
        this.webDir,
        'app',
        'features',
        moduleName,
        'types',
        `${moduleName}.types.ts`,
      );
      const altTypesPath = path.join(
        this.webDir,
        'app',
        'features',
        moduleName,
        'types',
        `${moduleName.slice(0, -1)}.types.ts`,
      );

      results.types.exists =
        fs.existsSync(typesPath) || fs.existsSync(altTypesPath);

      if (results.types.exists) {
        const typeContent = fs.readFileSync(
          fs.existsSync(typesPath) ? typesPath : altTypesPath,
          'utf8',
        );
        results.types.hasCreateType = typeContent.includes('Create');
        results.types.hasUpdateType = typeContent.includes('Update');
        results.types.hasListQueryType = typeContent.includes('Query');
      }

      // Check component files
      const componentsDir = path.join(
        this.webDir,
        'app',
        'features',
        moduleName,
        'components',
      );
      if (fs.existsSync(componentsDir)) {
        const files = fs.readdirSync(componentsDir);
        results.components.createDialog = files.some(
          (f) => f.includes('create') && f.includes('dialog'),
        );
        results.components.editDialog = files.some(
          (f) => f.includes('edit') && f.includes('dialog'),
        );
        results.components.viewDialog = files.some(
          (f) => f.includes('view') && f.includes('dialog'),
        );
        results.components.listComponent = files.some(
          (f) => f.includes('list') && f.includes('component'),
        );
      }

      // Validate issues
      if (!results.services.exists) {
        results.valid = false;
        results.issues.push('Missing service file');
      }

      if (!results.types.exists) {
        results.valid = false;
        results.issues.push('Missing types file');
      }

      return results;
    } catch (error) {
      results.valid = false;
      results.issues.push(`Validation error: ${error.message}`);
      return results;
    }
  }

  /**
   * ตรวจสอบ API-Frontend alignment
   */
  async validateApiFrontendAlignment(moduleName) {
    console.log(`🔗 Validating API-Frontend alignment for ${moduleName}...`);

    const results = {
      module: moduleName,
      aligned: true,
      mismatches: [],
      recommendations: [],
    };

    try {
      // Get backend schema info
      const enhancedSchema = await getEnhancedSchema(moduleName);

      // Check frontend service
      const servicePath = path.join(
        this.webDir,
        'app',
        'features',
        moduleName,
        'services',
        `${moduleName}.service.ts`,
      );

      if (fs.existsSync(servicePath)) {
        const serviceContent = fs.readFileSync(servicePath, 'utf8');

        // Check for FK dropdown dependencies
        for (const column of enhancedSchema.columns) {
          if (
            column.fieldType === 'foreign-key-dropdown' &&
            column.dropdownInfo
          ) {
            const dropdownServicePattern = new RegExp(
              `${column.foreignKeyInfo.referencedTable}.*dropdown`,
              'i',
            );

            if (!dropdownServicePattern.test(serviceContent)) {
              results.aligned = false;
              results.mismatches.push({
                type: 'missing-dropdown-service',
                field: column.name,
                referencedTable: column.foreignKeyInfo.referencedTable,
                expectedEndpoint: column.dropdownInfo.endpoint,
              });

              results.recommendations.push({
                action: `Add dropdown service method for ${column.name}`,
                code: `async get${this.toPascalCase(column.foreignKeyInfo.referencedTable)}Dropdown(params = {}) {
  return this.httpClient.get<DropdownOption[]>('${column.dropdownInfo.endpoint}', { params });
}`,
              });
            }
          }
        }
      }

      return results;
    } catch (error) {
      results.aligned = false;
      results.mismatches.push(`Alignment check failed: ${error.message}`);
      return results;
    }
  }

  /**
   * สร้างรายงานสรุป dependency validation
   */
  async generateValidationReport(moduleName) {
    console.log(`📊 Generating validation report for ${moduleName}...`);

    const [dropdownValidation, frontendValidation, alignmentValidation] =
      await Promise.all([
        this.validateDropdownDependencies(moduleName),
        this.validateFrontendDependencies(moduleName),
        this.validateApiFrontendAlignment(moduleName),
      ]);

    const report = {
      module: moduleName,
      timestamp: new Date().toISOString(),
      summary: {
        dropdownsValid: dropdownValidation.valid,
        frontendComplete: frontendValidation.valid,
        apiAligned: alignmentValidation.aligned,
        overallStatus:
          dropdownValidation.valid &&
          frontendValidation.valid &&
          alignmentValidation.aligned
            ? 'PASS'
            : 'FAIL',
      },
      details: {
        dropdowns: dropdownValidation,
        frontend: frontendValidation,
        alignment: alignmentValidation,
      },
      recommendations: [
        ...dropdownValidation.recommendations,
        ...alignmentValidation.recommendations,
      ],
    };

    return report;
  }

  /**
   * แสดงรายงานในรูปแบบที่อ่านง่าย
   */
  displayReport(report) {
    console.log(`\n📋 DEPENDENCY VALIDATION REPORT`);
    console.log(`Module: ${report.module}`);
    console.log(`Status: ${report.summary.overallStatus}`);
    console.log(`Timestamp: ${report.timestamp}`);

    console.log(`\n🔍 Summary:`);
    console.log(
      `  Dropdown Dependencies: ${report.summary.dropdownsValid ? '✅' : '❌'}`,
    );
    console.log(
      `  Frontend Complete: ${report.summary.frontendComplete ? '✅' : '❌'}`,
    );
    console.log(`  API Alignment: ${report.summary.apiAligned ? '✅' : '❌'}`);

    // Show dropdown details
    if (report.details.dropdowns.availableEndpoints.length > 0) {
      console.log(`\n🔗 Dropdown Endpoints:`);
      report.details.dropdowns.availableEndpoints.forEach((endpoint) => {
        const status = endpoint.exists ? '✅' : '❌';
        console.log(`  ${status} ${endpoint.field} -> ${endpoint.endpoint}`);
        if (endpoint.exists) {
          console.log(
            `      Display fields: ${endpoint.displayFields.join(', ')}`,
          );
        }
      });
    }

    // Show issues
    if (report.details.frontend.issues.length > 0) {
      console.log(`\n⚠️ Frontend Issues:`);
      report.details.frontend.issues.forEach((issue) => {
        console.log(`  - ${issue}`);
      });
    }

    // Show mismatches
    if (report.details.alignment.mismatches.length > 0) {
      console.log(`\n🔀 API-Frontend Mismatches:`);
      report.details.alignment.mismatches.forEach((mismatch) => {
        console.log(`  - ${mismatch.type}: ${mismatch.field || mismatch}`);
      });
    }

    // Show recommendations
    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec.action}`);
        if (rec.command) {
          console.log(`     Command: ${rec.command}`);
        }
      });
    }
  }

  // Utility methods
  toPascalCase(str) {
    return (
      str.charAt(0).toUpperCase() +
      str.slice(1).replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    );
  }
}

// Main execution
if (require.main === module) {
  const moduleName = process.argv[2];

  if (!moduleName) {
    console.error('Usage: node dependency-validator.js <module-name>');
    process.exit(1);
  }

  const validator = new DependencyValidator();
  validator
    .generateValidationReport(moduleName)
    .then((report) => {
      validator.displayReport(report);

      if (report.summary.overallStatus === 'FAIL') {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    });
}

module.exports = DependencyValidator;
