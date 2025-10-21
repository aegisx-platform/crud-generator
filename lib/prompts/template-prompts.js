/**
 * Interactive Prompts for Template Management
 *
 * Provides prompts for template-related operations
 */

const inquirer = require('inquirer');
const chalk = require('chalk');

/**
 * Prompt for template type selection
 */
async function promptTemplateType() {
  const { type } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Select template type:',
      choices: [
        { name: 'Backend Templates', value: 'backend' },
        { name: 'Frontend Templates', value: 'frontend' },
        { name: 'Both', value: 'all' },
      ],
    },
  ]);

  return type;
}

/**
 * Prompt for template selection from list
 */
async function promptSelectTemplate(templates, message = 'Select template:') {
  if (templates.length === 0) {
    throw new Error('No templates available');
  }

  const choices = templates.map((template) => {
    let name = `${template.name} - ${template.description}`;

    const tags = [];
    if (template.default) tags.push(chalk.green('DEFAULT'));
    if (template.deprecated) tags.push(chalk.gray('DEPRECATED'));

    if (tags.length > 0) {
      name += ` [${tags.join(', ')}]`;
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
      message,
      choices,
    },
  ]);

  return templateName;
}

/**
 * Prompt for new template details
 */
async function promptNewTemplate() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Template name:',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Template name is required';
        }
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Template name must contain only lowercase letters, numbers, and hyphens';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'path',
      message: 'Template directory path:',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Template path is required';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Template description:',
      default: 'Custom template',
    },
  ]);

  return answers;
}

/**
 * Prompt for default template change confirmation
 */
async function promptSetDefault(type, templateName) {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Set '${chalk.cyan(templateName)}' as default ${type} template?`,
      default: true,
    },
  ]);

  return confirm;
}

/**
 * Prompt for template removal confirmation
 */
async function promptRemoveTemplate(type, templateName) {
  console.log(
    chalk.yellow(
      '\n⚠️  Warning: This will remove the template from your configuration.',
    ),
  );
  console.log(chalk.gray('Template files will NOT be deleted from disk.\n'));

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Remove '${chalk.red(templateName)}' from ${type} templates?`,
      default: false,
    },
  ]);

  return confirm;
}

module.exports = {
  promptTemplateType,
  promptSelectTemplate,
  promptNewTemplate,
  promptSetDefault,
  promptRemoveTemplate,
};
