/**
 * Interactive Prompts for CRUD Generation
 *
 * Provides step-by-step prompts for generating CRUD modules
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const { getDatabaseSchema } = require('../utils/database');

/**
 * Get list of available tables from database
 */
async function getAvailableTables() {
  try {
    const schema = await getDatabaseSchema();
    return schema.tables || [];
  } catch (error) {
    console.error(
      chalk.red('❌ Failed to fetch database tables:'),
      error.message,
    );
    return [];
  }
}

/**
 * Prompt for table selection
 */
async function promptTableSelection() {
  const tables = await getAvailableTables();

  if (tables.length === 0) {
    throw new Error(
      'No tables found in database. Please check your database connection.',
    );
  }

  const { tableName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'tableName',
      message: 'Select a table to generate CRUD for:',
      choices: tables.map((table) => ({
        name: `${table} ${chalk.gray('(database table)')}`,
        value: table,
        short: table,
      })),
      pageSize: 15,
    },
  ]);

  return tableName;
}

/**
 * Prompt for generation type
 */
async function promptGenerationType() {
  const { generationType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'generationType',
      message: 'What would you like to generate?',
      choices: [
        {
          name:
            chalk.cyan('Full Stack') + ' - Backend + Frontend (Recommended)',
          value: 'fullstack',
          short: 'Full Stack',
        },
        {
          name: chalk.blue('Backend Only') + ' - API, Service, Repository',
          value: 'backend',
          short: 'Backend Only',
        },
        {
          name: chalk.magenta('Frontend Only') + ' - Angular Components',
          value: 'frontend',
          short: 'Frontend Only',
        },
        {
          name:
            chalk.yellow('Permissions Only') + ' - Role & Permission Migration',
          value: 'permissions',
          short: 'Permissions Only',
        },
      ],
      default: 'fullstack',
    },
  ]);

  return generationType;
}

/**
 * Prompt for template selection
 */
async function promptTemplateSelection(templateManager, type) {
  const templates = await templateManager.listTemplates(type);

  if (templates.length === 0) {
    const defaults = templateManager.getDefaults();
    return defaults[type];
  }

  const choices = templates.map((template) => {
    let name = `${template.name} - ${template.description}`;

    if (template.default) {
      name = chalk.green(`${name} [RECOMMENDED]`);
    }

    if (template.deprecated) {
      name = chalk.gray(`${name} [DEPRECATED]`);
    }

    return {
      name,
      value: template.name,
      short: template.name,
    };
  });

  const { templateName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'templateName',
      message: `Select ${type} template:`,
      choices,
      default: templates.find((t) => t.default)?.name || templates[0]?.name,
    },
  ]);

  return templateName;
}

/**
 * Prompt for features
 */
async function promptFeatures() {
  const { features } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'features',
      message: 'Select features to include:',
      choices: [
        {
          name: 'CRUD Operations (create, read, update, delete)',
          value: 'crud',
          checked: true,
          disabled: 'Required',
        },
        {
          name: 'Real-time Events (WebSocket notifications)',
          value: 'events',
          checked: true,
        },
        {
          name: 'Bulk Operations (create, update, delete multiple)',
          value: 'bulkOperations',
          checked: true,
        },
        {
          name: 'Export Functionality (CSV, Excel, JSON)',
          value: 'export',
          checked: false,
        },
        {
          name: 'Import Functionality (CSV upload)',
          value: 'import',
          checked: false,
        },
        {
          name: 'Advanced Filters (search, sort, pagination)',
          value: 'filters',
          checked: true,
          disabled: 'Required',
        },
        {
          name: 'Validation & Error Handling',
          value: 'validation',
          checked: true,
          disabled: 'Required',
        },
      ],
    },
  ]);

  return {
    withEvents: features.includes('events'),
    bulkOperations: features.includes('bulkOperations'),
    export: features.includes('export'),
    import: features.includes('import'),
  };
}

/**
 * Prompt for advanced options
 */
async function promptAdvancedOptions() {
  const { showAdvanced } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'showAdvanced',
      message: 'Configure advanced options?',
      default: false,
    },
  ]);

  if (!showAdvanced) {
    return {};
  }

  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Dry run (preview without creating files)?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'force',
      message: 'Force overwrite existing files?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'noRoles',
      message: 'Skip role/permission generation?',
      default: false,
    },
  ]);

  return answers;
}

/**
 * Prompt for confirmation
 */
async function promptConfirmation(summary) {
  console.log('\n' + chalk.bold.cyan('📋 Generation Summary:'));
  console.log(chalk.gray('─'.repeat(50)));

  Object.entries(summary).forEach(([key, value]) => {
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase());
    console.log(`${chalk.yellow(label + ':')} ${chalk.white(value)}`);
  });

  console.log(chalk.gray('─'.repeat(50)) + '\n');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Proceed with generation?',
      default: true,
    },
  ]);

  return confirm;
}

/**
 * Main interactive prompt flow for generation
 */
async function promptGenerate(templateManager) {
  console.log(chalk.bold.cyan('\n🚀 CRUD Generator - Interactive Mode\n'));

  // Step 1: Select table
  const tableName = await promptTableSelection();

  // Step 2: Select generation type
  const generationType = await promptGenerationType();

  // Step 3: Select templates (if applicable)
  let backendTemplate = null;
  let frontendTemplate = null;

  if (generationType === 'fullstack' || generationType === 'backend') {
    backendTemplate = await promptTemplateSelection(templateManager, 'backend');
  }

  if (generationType === 'fullstack' || generationType === 'frontend') {
    frontendTemplate = await promptTemplateSelection(
      templateManager,
      'frontend',
    );
  }

  // Step 4: Select features (if not permissions-only)
  let features = {};
  if (generationType !== 'permissions') {
    features = await promptFeatures();
  }

  // Step 5: Advanced options
  const advanced = await promptAdvancedOptions();

  // Step 6: Build summary
  const summary = {
    Table: tableName,
    Type: generationType,
  };

  if (backendTemplate) {
    summary['Backend Template'] = backendTemplate;
  }

  if (frontendTemplate) {
    summary['Frontend Template'] = frontendTemplate;
  }

  if (features.withEvents) summary['Real-time Events'] = '✓';
  if (features.bulkOperations) summary['Bulk Operations'] = '✓';
  if (features.export) summary['Export'] = '✓';
  if (features.import) summary['Import'] = '✓';
  if (advanced.dryRun) summary['Mode'] = 'Dry Run (Preview)';
  if (advanced.force) summary['Overwrite'] = 'Yes';
  if (advanced.noRoles) summary['Permissions'] = 'Skip';

  // Step 7: Confirmation
  const confirmed = await promptConfirmation(summary);

  if (!confirmed) {
    console.log(chalk.yellow('\n⚠️  Generation cancelled by user\n'));
    return null;
  }

  // Return generation options
  return {
    tableName,
    generationType,
    backendTemplate,
    frontendTemplate,
    ...features,
    ...advanced,
  };
}

module.exports = {
  promptGenerate,
  promptTableSelection,
  promptGenerationType,
  promptTemplateSelection,
  promptFeatures,
  promptAdvancedOptions,
  promptConfirmation,
};
