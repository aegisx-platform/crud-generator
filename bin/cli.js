#!/usr/bin/env node

/**
 * CRUD Generator CLI Tool
 * Generates complete CRUD modules for AegisX platform
 */

const { Command } = require('commander');
const path = require('path');
const chalk = require('chalk');
const {
  generateCrudModule,
  generateDomainModule,
  addRouteToDomain,
} = require('../lib/generators/backend-generator');
const FrontendGenerator = require('../lib/generators/frontend-generator');
const { version } = require('../package.json');
const TemplateManager = require('../lib/core/template-manager');
const { promptGenerate } = require('../lib/prompts/generate-prompts');
const {
  promptTemplateType,
  promptSelectTemplate,
  promptNewTemplate,
  promptSetDefault,
  promptRemoveTemplate,
} = require('../lib/prompts/template-prompts');

// Helper function to find project root (where package.json with nx exists)
function findProjectRoot(startDir = __dirname) {
  let currentDir = startDir;
  while (currentDir !== path.dirname(currentDir)) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    try {
      const packageJson = require(packageJsonPath);
      if (packageJson.devDependencies?.nx || packageJson.dependencies?.nx) {
        return currentDir;
      }
    } catch (e) {
      // Continue searching
    }
    currentDir = path.dirname(currentDir);
  }
  return PROJECT_ROOT; // Fallback to current working directory
}

const PROJECT_ROOT = findProjectRoot();

const program = new Command();

program
  .name('crud-generator')
  .description('Generate complete CRUD modules for AegisX platform')
  .version(version || '1.0.0');

program
  .command('generate [table-name]')
  .alias('g')
  .description('Generate CRUD module (interactive mode if no table specified)')
  .option('-e, --with-events', 'Include real-time events integration')
  .option('-d, --dry-run', 'Preview files without creating them')
  .option('-f, --force', 'Force overwrite existing files without confirmation')
  .option('--flat', 'Use flat structure instead of domain structure')
  .option('-a, --app <app>', 'Target app (api, web, admin)', 'api')
  .option('-o, --output <dir>', 'Custom output directory (overrides --app)')
  .option(
    '-t, --target <type>',
    'Generation target (backend, frontend)',
    'backend',
  )
  .option('-c, --config <file>', 'Configuration file path')
  .option('--direct-db', 'Write roles directly to database (development only)')
  .option('--no-roles', 'Skip role generation entirely')
  .option('--migration-only', 'Generate migration file only (no CRUD files)')
  .option(
    '--multiple-roles',
    'Generate multiple roles (admin, editor, viewer) instead of single role',
  )
  .option(
    '--package <type>',
    'Feature package to generate (standard, enterprise, full)',
    'standard',
  )
  .option(
    '--smart-stats',
    'Enable smart statistics detection based on table fields',
    false,
  )
  .option('--no-format', 'Skip auto-formatting generated files', false)
  .option('--with-import', 'Include bulk import functionality (Excel/CSV upload)', false)
  .option('--no-register', 'Skip auto-registration in plugin.loader.ts / app.routes.ts', false)
  .action(async (tableName, options) => {
    try {
      // Interactive mode if no table name provided
      if (!tableName) {
        const templateManager = new TemplateManager({
          templatesBasePath: path.join(__dirname, '../templates'),
        });
        await templateManager.initialize();

        const interactiveOptions = await promptGenerate(templateManager);

        if (!interactiveOptions) {
          // User cancelled
          return;
        }

        // Use interactive options
        tableName = interactiveOptions.tableName;
        options = {
          ...options,
          ...interactiveOptions,
          backendTemplate: interactiveOptions.backendTemplate,
          frontendTemplate: interactiveOptions.frontendTemplate,
        };
      }

      // Validate package option
      const validPackages = ['standard', 'enterprise', 'full'];
      if (!validPackages.includes(options.package)) {
        console.error(`❌ Invalid package type: ${options.package}`);
        console.error(`   Valid options: ${validPackages.join(', ')}`);
        process.exit(1);
      }

      // Determine output directory based on app and target
      let outputDir = options.output;
      if (!outputDir) {
        const appPaths = {
          api: {
            backend: path.resolve(PROJECT_ROOT, 'apps/api/src/modules'),
            // API doesn't have frontend - redirect to web instead
            frontend: path.resolve(PROJECT_ROOT, 'apps/web/src/app/features'),
          },
          web: {
            backend: path.resolve(PROJECT_ROOT, 'apps/web/src/backend'), // if needed
            frontend: path.resolve(PROJECT_ROOT, 'apps/web/src/app/features'),
          },
          admin: {
            backend: path.resolve(PROJECT_ROOT, 'apps/admin/src/backend'), // if needed
            frontend: path.resolve(PROJECT_ROOT, 'apps/admin/src/app/features'),
          },
        };

        outputDir =
          appPaths[options.app]?.[options.target] ||
          path.resolve(PROJECT_ROOT, 'apps/api/src/modules');
      }

      const useFlat = options.flat === true;
      const structureType = useFlat ? 'flat' : 'domain';

      console.log(`🚀 Generating CRUD module for table: ${tableName}`);
      console.log(`📱 Target app: ${options.app}`);
      console.log(`🎯 Target type: ${options.target}`);
      console.log(`🏗️  Structure: ${structureType}`);
      console.log(`📦 With events: ${options.withEvents ? 'Yes' : 'No'}`);
      console.log(
        `🔐 Role generation: ${options.noRoles ? 'Disabled' : options.directDb ? 'Direct DB' : 'Migration file'}`,
      );
      console.log(
        `👥 Role strategy: ${options.multipleRoles ? 'Multiple roles (admin, editor, viewer)' : 'Single role'}`,
      );
      console.log(`📦 Feature package: ${options.package.toUpperCase()}`);
      console.log(
        `📊 Smart stats: ${options.smartStats ? 'Enabled' : 'Disabled'}`,
      );
      console.log(`📁 Output directory: ${outputDir}`);

      if (options.dryRun) {
        console.log('🔍 Dry run mode - no files will be created');
      }

      if (options.migrationOnly) {
        console.log('📝 Migration-only mode - only generating migration file');
      }

      if (options.directDb) {
        console.log(
          '⚠️  WARNING: Direct database mode - roles will be written directly to database',
        );
      }

      // Choose generator based on target type
      let result;

      if (options.target === 'frontend') {
        // Frontend generation using FrontendGenerator
        console.log('\n🎨 Generating Angular frontend module...');

        const toolsDir = path.join(__dirname, '..');
        const frontendGenerator = new FrontendGenerator(
          toolsDir,
          PROJECT_ROOT,
          { templateVersion: 'v2' },
        );

        const generatedFiles = await frontendGenerator.generateFrontendModule(
          tableName,
          {
            enhanced:
              options.package === 'enterprise' || options.package === 'full',
            full: options.package === 'full',
            dryRun: options.dryRun,
            force: options.force,
            withImport: options.withImport,
          },
        );

        // Format result to match backend generator structure
        // Handle both string paths and comma-separated path lists
        const filePaths = generatedFiles.flatMap((file) => {
          if (typeof file === 'string') {
            // Split comma-separated paths if present
            return file.includes(',') ? file.split(',').map(p => p.trim()) : [file.trim()];
          }
          // If it's already an object with path property, extract the path
          const filePath = file.path || file;
          return typeof filePath === 'string' ? [filePath.trim()] : [String(filePath).trim()];
        });

        result = {
          files: filePaths.map((path) => ({ path })),
          warnings: [],
        };
      } else {
        // Backend generation using backend-generator
        result = useFlat
          ? await generateCrudModule(tableName, {
              withEvents: options.withEvents,
              dryRun: options.dryRun,
              force: options.force,
              outputDir: outputDir,
              configFile: options.config,
              app: options.app,
              target: options.target,
              directDb: options.directDb,
              noRoles: options.noRoles,
              migrationOnly: options.migrationOnly,
              multipleRoles: options.multipleRoles,
              package: options.package,
              smartStats: options.smartStats,
            })
          : await generateDomainModule(tableName, {
              withEvents: options.withEvents,
              dryRun: options.dryRun,
              force: options.force,
              outputDir: outputDir,
              configFile: options.config,
              app: options.app,
              target: options.target,
              directDb: options.directDb,
              noRoles: options.noRoles,
              migrationOnly: options.migrationOnly,
              multipleRoles: options.multipleRoles,
              package: options.package,
              smartStats: options.smartStats,
              withImport: options.withImport,
            });
      }

      if (options.dryRun) {
        console.log('\n📋 Files that would be generated:');
        result.files.forEach((file) => {
          console.log(`  ✓ ${file.path}`);
        });
      } else {
        console.log('\n✅ CRUD module generated successfully!');
        console.log('📂 Generated files:');
        result.files.forEach((file) => {
          console.log(`  ✓ ${file.path}`);
        });

        // Auto-format generated TypeScript files
        const tsFiles = result.files
          .filter((file) => file.path.endsWith('.ts'))
          .map((file) => file.path);

        if (tsFiles.length > 0 && !options.noFormat) {
          console.log('\n🎨 Formatting generated TypeScript files...');
          try {
            const { execSync } = require('child_process');

            // Format files individually to avoid command line length issues
            for (const file of tsFiles) {
              try {
                execSync(`npx prettier --write "${file}"`, {
                  cwd: PROJECT_ROOT,
                  stdio: 'pipe',
                  timeout: 10000, // 10 second timeout
                });
              } catch (error) {
                console.log(`⚠️  Could not format ${file}`);
              }
            }
            console.log('✅ Code formatting completed!');
          } catch (error) {
            console.log('⚠️  Formatting skipped - prettier not available');
            console.log(
              '💡 Run manually: npx prettier --write ' + tsFiles.join(' '),
            );
          }
        }

        // Auto-registration (if not disabled)
        if (!options.noRegister) {
          console.log('\n📝 Auto-registration...');

          if (options.target === 'backend') {
            const { autoRegisterBackendPlugin } = require('../lib/generators/backend-generator');
            await autoRegisterBackendPlugin(tableName, PROJECT_ROOT);
          } else if (options.target === 'frontend') {
            // Frontend auto-registration
            const frontendGenerator = new FrontendGenerator(
              path.join(__dirname, '..'),
              PROJECT_ROOT,
              { templateVersion: 'v2' },
            );
            await frontendGenerator.autoRegisterRoute(tableName);
          }
        }
      }

      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach((warning) => {
          console.log(`  • ${warning}`);
        });
      }
    } catch (error) {
      console.error('\n❌ Error generating CRUD module:');
      console.error(error.message);
      // Cleanup database connection
      const { knex } = require('../lib/config/knex-connection');
      await knex.destroy();
      process.exit(1);
    } finally {
      // Always cleanup database connection
      const { knex } = require('../lib/config/knex-connection');
      await knex.destroy();
    }
  });

program
  .command('domain')
  .alias('d')
  .description('Generate domain module with organized structure')
  .argument('<domain-name>', 'Domain name to generate')
  .option(
    '-r, --routes <routes>',
    'Comma-separated list of routes (e.g., "core,profiles,preferences")',
  )
  .option('-e, --with-events', 'Include real-time events integration')
  .option('-d, --dry-run', 'Preview files without creating them')
  .option('-f, --force', 'Force overwrite existing files without confirmation')
  .option('--flat', 'Use flat structure instead of domain structure')
  .option('-a, --app <app>', 'Target app (api, web, admin)', 'api')
  .option('-o, --output <dir>', 'Custom output directory (overrides --app)')
  .option(
    '-t, --target <type>',
    'Generation target (backend, frontend)',
    'backend',
  )
  .option('-c, --config <file>', 'Configuration file path')
  .action(async (domainName, options) => {
    try {
      // Determine output directory based on app and target
      let outputDir = options.output;
      if (!outputDir) {
        const appPaths = {
          api: {
            backend: path.resolve(PROJECT_ROOT, 'apps/api/src/modules'),
            frontend: path.resolve(PROJECT_ROOT, 'apps/api/src/frontend'),
          },
          web: {
            backend: path.resolve(PROJECT_ROOT, 'apps/web/src/backend'),
            frontend: path.resolve(PROJECT_ROOT, 'apps/web/src/app/features'),
          },
          admin: {
            backend: path.resolve(PROJECT_ROOT, 'apps/admin/src/backend'),
            frontend: path.resolve(PROJECT_ROOT, 'apps/admin/src/app/features'),
          },
        };

        outputDir =
          appPaths[options.app]?.[options.target] ||
          path.resolve(PROJECT_ROOT, 'apps/api/src/modules');
      }

      const useFlat = options.flat === true;
      const structureType = useFlat ? 'flat' : 'domain';
      const routes = options.routes
        ? options.routes.split(',').map((r) => r.trim())
        : ['core'];

      console.log(`🚀 Generating domain: ${domainName}`);
      console.log(`📱 Target app: ${options.app}`);
      console.log(`🎯 Target type: ${options.target}`);
      console.log(`🏗️  Structure: ${structureType}`);
      console.log(`🛣️  Routes: ${routes.join(', ')}`);
      console.log(`📦 With events: ${options.withEvents ? 'Yes' : 'No'}`);
      console.log(`📁 Output directory: ${outputDir}`);

      if (options.dryRun) {
        console.log('🔍 Dry run mode - no files will be created');
      }

      // Choose generator based on structure type
      const result = useFlat
        ? await generateCrudModule(domainName, {
            withEvents: options.withEvents,
            dryRun: options.dryRun,
            force: options.force,
            outputDir: outputDir,
            configFile: options.config,
            app: options.app,
            target: options.target,
          })
        : await generateDomainModule(domainName, {
            routes: routes,
            withEvents: options.withEvents,
            dryRun: options.dryRun,
            force: options.force,
            outputDir: outputDir,
            configFile: options.config,
            app: options.app,
            target: options.target,
          });

      if (options.dryRun) {
        console.log('\n📋 Files that would be generated:');
        result.files.forEach((file) => {
          console.log(`  ✓ ${file.path}`);
        });
      } else {
        console.log('\n✅ Domain module generated successfully!');
        console.log('📂 Generated files:');
        result.files.forEach((file) => {
          console.log(`  ✓ ${file.path}`);
        });

        // Auto-format generated TypeScript files
        const tsFiles = result.files
          .filter((file) => file.path.endsWith('.ts'))
          .map((file) => file.path);

        if (tsFiles.length > 0 && !options.noFormat) {
          console.log('\n🎨 Formatting generated TypeScript files...');
          try {
            const { execSync } = require('child_process');

            // Format files individually to avoid command line length issues
            for (const file of tsFiles) {
              try {
                execSync(`npx prettier --write "${file}"`, {
                  cwd: PROJECT_ROOT,
                  stdio: 'pipe',
                  timeout: 10000, // 10 second timeout
                });
              } catch (error) {
                console.log(`⚠️  Could not format ${file}`);
              }
            }
            console.log('✅ Code formatting completed!');
          } catch (error) {
            console.log('⚠️  Formatting skipped - prettier not available');
            console.log(
              '💡 Run manually: npx prettier --write ' + tsFiles.join(' '),
            );
          }
        }
      }

      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach((warning) => {
          console.log(`  • ${warning}`);
        });
      }
    } catch (error) {
      console.error('\n❌ Error generating domain module:');
      console.error(error.message);
      // Cleanup database connection
      const { knex } = require('../lib/config/knex-connection');
      await knex.destroy();
      process.exit(1);
    } finally {
      // Always cleanup database connection
      const { knex } = require('../lib/config/knex-connection');
      await knex.destroy();
    }
  });

program
  .command('route')
  .alias('r')
  .description('Add route to existing domain module')
  .argument(
    '<route-path>',
    'Route path in format "domain/route" (e.g., "users/sessions")',
  )
  .option('-e, --with-events', 'Include real-time events integration')
  .option('-d, --dry-run', 'Preview files without creating them')
  .option('-f, --force', 'Force overwrite existing files without confirmation')
  .option('-a, --app <app>', 'Target app (api, web, admin)', 'api')
  .option('-o, --output <dir>', 'Custom output directory (overrides --app)')
  .option(
    '-t, --target <type>',
    'Generation target (backend, frontend)',
    'backend',
  )
  .action(async (routePath, options) => {
    try {
      // Parse domain/route from path
      const pathParts = routePath.split('/');
      if (pathParts.length !== 2) {
        throw new Error(
          'Route path must be in format "domain/route" (e.g., "users/sessions")',
        );
      }

      const [domainName, routeName] = pathParts;

      // Determine output directory based on app and target
      let outputDir = options.output;
      if (!outputDir) {
        const appPaths = {
          api: {
            backend: path.resolve(PROJECT_ROOT, 'apps/api/src/modules'),
            frontend: path.resolve(PROJECT_ROOT, 'apps/api/src/frontend'),
          },
          web: {
            backend: path.resolve(PROJECT_ROOT, 'apps/web/src/backend'),
            frontend: path.resolve(PROJECT_ROOT, 'apps/web/src/app/features'),
          },
          admin: {
            backend: path.resolve(PROJECT_ROOT, 'apps/admin/src/backend'),
            frontend: path.resolve(PROJECT_ROOT, 'apps/admin/src/app/features'),
          },
        };

        outputDir =
          appPaths[options.app]?.[options.target] ||
          path.resolve(PROJECT_ROOT, 'apps/api/src/modules');
      }

      console.log(`🚀 Adding route: ${routeName} to domain: ${domainName}`);
      console.log(`📱 Target app: ${options.app}`);
      console.log(`🎯 Target type: ${options.target}`);
      console.log(`📦 With events: ${options.withEvents ? 'Yes' : 'No'}`);
      console.log(`📁 Output directory: ${outputDir}`);

      if (options.dryRun) {
        console.log('🔍 Dry run mode - no files will be created');
      }

      const result = await addRouteToDomain(domainName, routeName, {
        withEvents: options.withEvents,
        dryRun: options.dryRun,
        force: options.force,
        outputDir: outputDir,
        app: options.app,
        target: options.target,
      });

      if (options.dryRun) {
        console.log('\n📋 Files that would be generated:');
        result.files.forEach((file) => {
          console.log(`  ✓ ${file.path}`);
        });
      } else {
        console.log('\n✅ Route added successfully!');
        console.log('📂 Generated files:');
        result.files.forEach((file) => {
          console.log(`  ✓ ${file.path}`);
        });

        // Auto-format generated TypeScript files
        const tsFiles = result.files
          .filter((file) => file.path.endsWith('.ts'))
          .map((file) => file.path);

        if (tsFiles.length > 0 && !options.noFormat) {
          console.log('\n🎨 Formatting generated TypeScript files...');
          try {
            const { execSync } = require('child_process');

            // Format files individually to avoid command line length issues
            for (const file of tsFiles) {
              try {
                execSync(`npx prettier --write "${file}"`, {
                  cwd: PROJECT_ROOT,
                  stdio: 'pipe',
                  timeout: 10000, // 10 second timeout
                });
              } catch (error) {
                console.log(`⚠️  Could not format ${file}`);
              }
            }
            console.log('✅ Code formatting completed!');
          } catch (error) {
            console.log('⚠️  Formatting skipped - prettier not available');
            console.log(
              '💡 Run manually: npx prettier --write ' + tsFiles.join(' '),
            );
          }
        }
      }

      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach((warning) => {
          console.log(`  • ${warning}`);
        });
      }
    } catch (error) {
      console.error('\n❌ Error adding route:');
      console.error(error.message);
      // Cleanup database connection
      const { knex } = require('../lib/config/knex-connection');
      await knex.destroy();
      process.exit(1);
    } finally {
      // Always cleanup database connection
      const { knex } = require('../lib/config/knex-connection');
      await knex.destroy();
    }
  });

program
  .command('list-tables')
  .alias('ls')
  .description('List available database tables')
  .action(async () => {
    try {
      const { listTables } = require('../lib/utils/database');
      const tables = await listTables();

      console.log('📊 Available database tables:');
      tables.forEach((table) => {
        console.log(`  • ${table.name} (${table.columns} columns)`);
      });
    } catch (error) {
      console.error('❌ Error listing tables:', error.message);
      // Cleanup database connection
      const { knex } = require('../lib/config/knex-connection');
      await knex.destroy();
      process.exit(1);
    } finally {
      // Always cleanup database connection
      const { knex } = require('../lib/config/knex-connection');
      await knex.destroy();
    }
  });

program
  .command('validate')
  .description('Validate generated module')
  .argument('<module-name>', 'Module name to validate')
  .action(async (moduleName) => {
    try {
      const { validateModule } = require('../lib/utils/validator');
      const result = await validateModule(moduleName);

      if (result.valid) {
        console.log(`✅ Module '${moduleName}' is valid`);
      } else {
        console.log(`❌ Module '${moduleName}' has issues:`);
        result.errors.forEach((error) => {
          console.log(`  • ${error}`);
        });
      }
    } catch (error) {
      console.error('❌ Error validating module:', error.message);
      // Cleanup database connection
      const { knex } = require('../lib/config/knex-connection');
      await knex.destroy();
      process.exit(1);
    } finally {
      // Always cleanup database connection
      const { knex } = require('../lib/config/knex-connection');
      await knex.destroy();
    }
  });

program
  .command('packages')
  .alias('pkg')
  .description('Show available feature packages')
  .action(() => {
    console.log('📦 Available Feature Packages:\n');

    console.log('🟢 STANDARD (default)');
    console.log('   • Basic CRUD operations (Create, Read, Update, Delete)');
    console.log('   • Standard REST API endpoints');
    console.log('   • Role-based access control');
    console.log('   • TypeBox schema validation');
    console.log('   • Pagination and filtering');
    console.log('');

    console.log('🟡 ENTERPRISE');
    console.log('   • Everything in Standard, plus:');
    console.log('   • Dropdown/Options API for UI components');
    console.log('   • Bulk operations (create, update, delete)');
    console.log('   • Status management (activate, deactivate, toggle)');
    console.log('   • Statistics and analytics endpoints');
    console.log('   • Enhanced error handling');
    console.log('');

    console.log('🔴 FULL');
    console.log('   • Everything in Enterprise, plus:');
    console.log('   • Data validation before save');
    console.log('   • Field uniqueness checking');
    console.log('   • Advanced search and filtering');
    console.log('   • Export capabilities');
    console.log('   • Business rule validation');
    console.log('');

    console.log('Usage Examples:');
    console.log('  crud-generator generate users --package standard');
    console.log('  crud-generator generate products --package enterprise');
    console.log('  crud-generator generate orders --package full');
    console.log('');

    console.log('💡 Recommendation:');
    console.log('   • Use STANDARD for simple data models');
    console.log('   • Use ENTERPRISE for admin interfaces and dashboards');
    console.log('   • Use FULL for complex business domains with validation');
  });

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE MANAGEMENT COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

const templates = program
  .command('templates')
  .alias('t')
  .description('Manage CRUD generator templates');

/**
 * List available templates
 */
templates
  .command('list [type]')
  .alias('ls')
  .description('List available templates (backend, frontend, or all)')
  .action(async (type) => {
    try {
      const templateManager = new TemplateManager({
        templatesBasePath: path.join(__dirname, '../templates'),
      });
      await templateManager.initialize();

      // Determine which templates to list
      let typesToList = ['backend', 'frontend'];
      if (type) {
        if (!['backend', 'frontend', 'all'].includes(type)) {
          console.error(
            chalk.red(
              `❌ Invalid type: ${type}. Must be 'backend', 'frontend', or 'all'`,
            ),
          );
          process.exit(1);
        }
        if (type !== 'all') {
          typesToList = [type];
        }
      }

      console.log(chalk.bold.cyan('\n📦 Available Templates\n'));

      for (const templateType of typesToList) {
        const templateList = await templateManager.listTemplates(templateType);
        const defaults = templateManager.getDefaults();
        const isDefault = defaults[templateType];

        console.log(
          chalk.bold.yellow(
            `${templateType.toUpperCase()} Templates (${templateList.length}):`,
          ),
        );

        if (templateList.length === 0) {
          console.log(chalk.gray('  No templates found'));
        } else {
          templateList.forEach((template) => {
            let name = `  • ${template.name}`;

            if (template.default || template.name === isDefault) {
              name = chalk.green(`${name} [DEFAULT]`);
            }

            if (template.deprecated) {
              name = chalk.gray(`${name} [DEPRECATED]`);
            }

            console.log(name);
            console.log(chalk.gray(`    ${template.description}`));
            console.log(
              chalk.gray(
                `    Version: ${template.version || 'N/A'} | Framework: ${template.framework || 'N/A'}`,
              ),
            );
            console.log('');
          });
        }
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error listing templates:'));
      console.error(error.message);
      process.exit(1);
    }
  });

/**
 * Set default template for a type
 */
templates
  .command('set-default')
  .alias('default')
  .description('Set default template for backend or frontend')
  .action(async () => {
    try {
      const templateManager = new TemplateManager({
        templatesBasePath: path.join(__dirname, '../templates'),
      });
      await templateManager.initialize();

      // Interactive mode
      const type = await promptTemplateType();

      const templateList = await templateManager.listTemplates(type);
      if (templateList.length === 0) {
        console.log(chalk.yellow(`\n⚠️  No ${type} templates available\n`));
        return;
      }

      const templateName = await promptSelectTemplate(
        templateList,
        `Select ${type} template to set as default:`,
      );

      const confirmed = await promptSetDefault(type, templateName);

      if (!confirmed) {
        console.log(chalk.yellow('\n⚠️  Cancelled by user\n'));
        return;
      }

      await templateManager.setDefaultTemplate(type, templateName);

      console.log(
        chalk.green(`\n✅ Set '${templateName}' as default ${type} template\n`),
      );
    } catch (error) {
      console.error(chalk.red('\n❌ Error setting default template:'));
      console.error(error.message);
      process.exit(1);
    }
  });

/**
 * Add custom template
 */
templates
  .command('add')
  .description('Add a custom template')
  .action(async () => {
    try {
      const templateManager = new TemplateManager({
        templatesBasePath: path.join(__dirname, '../templates'),
      });
      await templateManager.initialize();

      console.log(chalk.bold.cyan('\n📦 Add Custom Template\n'));

      const type = await promptTemplateType();
      const templateInfo = await promptNewTemplate();

      await templateManager.addCustomTemplate(
        type,
        templateInfo.name,
        templateInfo.path,
        templateInfo.description,
      );

      console.log(
        chalk.green(
          `\n✅ Added custom ${type} template '${templateInfo.name}'\n`,
        ),
      );
      console.log(chalk.gray(`Path: ${templateInfo.path}`));
      console.log(chalk.gray(`Description: ${templateInfo.description}\n`));
    } catch (error) {
      console.error(chalk.red('\n❌ Error adding custom template:'));
      console.error(error.message);
      process.exit(1);
    }
  });

/**
 * Remove custom template
 */
templates
  .command('remove')
  .alias('rm')
  .description('Remove a custom template')
  .action(async () => {
    try {
      const templateManager = new TemplateManager({
        templatesBasePath: path.join(__dirname, '../templates'),
      });
      await templateManager.initialize();

      const type = await promptTemplateType();

      const customTemplates =
        templateManager.config.customTemplates?.[type] || {};
      const customTemplateNames = Object.keys(customTemplates);

      if (customTemplateNames.length === 0) {
        console.log(
          chalk.yellow(`\n⚠️  No custom ${type} templates to remove\n`),
        );
        return;
      }

      const templateList = customTemplateNames.map((name) => ({
        name,
        description: customTemplates[name].description || 'Custom template',
      }));

      const templateName = await promptSelectTemplate(
        templateList,
        `Select ${type} template to remove:`,
      );

      const confirmed = await promptRemoveTemplate(type, templateName);

      if (!confirmed) {
        console.log(chalk.yellow('\n⚠️  Cancelled by user\n'));
        return;
      }

      await templateManager.removeCustomTemplate(type, templateName);

      console.log(
        chalk.green(`\n✅ Removed custom ${type} template '${templateName}'\n`),
      );
    } catch (error) {
      console.error(chalk.red('\n❌ Error removing custom template:'));
      console.error(error.message);
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

const config = program
  .command('config')
  .alias('cfg')
  .description('Manage CRUD generator configuration');

/**
 * Initialize configuration file
 */
config
  .command('init')
  .description('Initialize .crudgen.json configuration file')
  .option('-f, --force', 'Overwrite existing configuration file')
  .action(async (options) => {
    try {
      const fs = require('fs').promises;
      const configPath = path.join(PROJECT_ROOT, '.crudgen.json');

      // Check if config already exists
      try {
        await fs.access(configPath);
        if (!options.force) {
          console.log(
            chalk.yellow(
              '\n⚠️  Configuration file already exists at .crudgen.json',
            ),
          );
          console.log(
            chalk.gray('    Use --force to overwrite the existing file\n'),
          );
          return;
        }
      } catch {
        // File doesn't exist, proceed
      }

      const defaultConfig = {
        defaultTemplates: {
          backend: 'domain',
          frontend: 'v2',
        },
        customTemplates: {
          backend: {},
          frontend: {},
        },
        defaultFeatures: {
          events: true,
          bulkOperations: true,
          export: false,
          import: false,
        },
      };

      await fs.writeFile(
        configPath,
        JSON.stringify(defaultConfig, null, 2),
        'utf8',
      );

      console.log(
        chalk.green('\n✅ Created .crudgen.json configuration file\n'),
      );
      console.log(chalk.gray('Default templates:'));
      console.log(
        chalk.gray(`  • Backend: ${defaultConfig.defaultTemplates.backend}`),
      );
      console.log(
        chalk.gray(
          `  • Frontend: ${defaultConfig.defaultTemplates.frontend}\n`,
        ),
      );
    } catch (error) {
      console.error(chalk.red('\n❌ Error initializing configuration:'));
      console.error(error.message);
      process.exit(1);
    }
  });

/**
 * Show current configuration
 */
config
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    try {
      const templateManager = new TemplateManager({
        templatesBasePath: path.join(__dirname, '../templates'),
      });
      await templateManager.initialize();

      console.log(chalk.bold.cyan('\n⚙️  CRUD Generator Configuration\n'));

      const defaults = templateManager.getDefaults();

      console.log(chalk.bold.yellow('Default Templates:'));
      console.log(chalk.gray(`  • Backend:  ${defaults.backend}`));
      console.log(chalk.gray(`  • Frontend: ${defaults.frontend}\n`));

      const backendCustom =
        templateManager.config.customTemplates?.backend || {};
      const frontendCustom =
        templateManager.config.customTemplates?.frontend || {};

      if (Object.keys(backendCustom).length > 0) {
        console.log(chalk.bold.yellow('Custom Backend Templates:'));
        Object.entries(backendCustom).forEach(([name, config]) => {
          console.log(chalk.gray(`  • ${name}`));
          console.log(chalk.gray(`    Path: ${config.path}`));
          console.log(
            chalk.gray(`    Description: ${config.description || 'N/A'}`),
          );
        });
        console.log('');
      }

      if (Object.keys(frontendCustom).length > 0) {
        console.log(chalk.bold.yellow('Custom Frontend Templates:'));
        Object.entries(frontendCustom).forEach(([name, config]) => {
          console.log(chalk.gray(`  • ${name}`));
          console.log(chalk.gray(`    Path: ${config.path}`));
          console.log(
            chalk.gray(`    Description: ${config.description || 'N/A'}`),
          );
        });
        console.log('');
      }

      if (templateManager.config.defaultFeatures) {
        console.log(chalk.bold.yellow('Default Features:'));
        Object.entries(templateManager.config.defaultFeatures).forEach(
          ([feature, enabled]) => {
            const status = enabled ? chalk.green('✓') : chalk.gray('✗');
            console.log(chalk.gray(`  ${status} ${feature}`));
          },
        );
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error showing configuration:'));
      console.error(error.message);
      process.exit(1);
    }
  });

program.parse();
