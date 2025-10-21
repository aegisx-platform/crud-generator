/**
 * Template Manager
 *
 * High-level template management interface
 * Handles template selection, validation, and path resolution
 */

const fs = require('fs').promises;
const path = require('path');
const TemplateRegistry = require('./template-registry');

class TemplateManager {
  constructor(options = {}) {
    this.configPath = options.configPath || '.crudgen.json';
    this.templatesBasePath =
      options.templatesBasePath || path.join(__dirname, '../../templates');
    this.registry = new TemplateRegistry(this.templatesBasePath);
    this.config = null;
  }

  /**
   * Initialize template manager (load config)
   */
  async initialize() {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configContent);
    } catch (error) {
      // Config file doesn't exist, use defaults
      this.config = await this._getDefaultConfig();
    }
  }

  /**
   * Get default configuration
   */
  async _getDefaultConfig() {
    return {
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
  }

  /**
   * Get default templates
   */
  getDefaults() {
    return {
      backend: this.config?.defaultTemplates?.backend || 'domain',
      frontend: this.config?.defaultTemplates?.frontend || 'v2',
    };
  }

  /**
   * List available templates
   */
  async listTemplates(type) {
    if (type === 'backend') {
      return await this.registry.getBackendTemplates();
    } else if (type === 'frontend') {
      return await this.registry.getFrontendTemplates();
    } else {
      return {
        backend: await this.registry.getBackendTemplates(),
        frontend: await this.registry.getFrontendTemplates(),
      };
    }
  }

  /**
   * Get template path
   */
  async getTemplatePath(type, name) {
    const defaults = this.getDefaults();
    const templateName = name || defaults[type];

    return await this.registry.getTemplatePath(type, templateName);
  }

  /**
   * Get template configuration
   */
  async getTemplateConfig(type, name) {
    const defaults = this.getDefaults();
    const templateName = name || defaults[type];

    return await this.registry.getTemplate(type, templateName);
  }

  /**
   * Validate template exists and is properly configured
   */
  async validateTemplate(type, name) {
    const defaults = this.getDefaults();
    const templateName = name || defaults[type];

    return await this.registry.validateTemplate(type, templateName);
  }

  /**
   * Get template for generation (with validation)
   */
  async getTemplateForGeneration(type, name) {
    const defaults = this.getDefaults();
    const templateName = name || defaults[type];

    // Validate template
    const validation = await this.validateTemplate(type, templateName);
    if (!validation.valid) {
      throw new Error(
        `Invalid template ${templateName}: ${validation.errors.join(', ')}`,
      );
    }

    // Get template config
    const templateConfig = await this.getTemplateConfig(type, templateName);
    if (!templateConfig) {
      throw new Error(`Template ${templateName} not found`);
    }

    return {
      name: templateConfig.name,
      path: templateConfig.path,
      config: templateConfig,
      files: templateConfig.files || [],
    };
  }

  /**
   * Get choices for interactive prompts (inquirer format)
   */
  async getTemplateChoices(type) {
    const templates = await this.listTemplates(type);
    const defaults = this.getDefaults();

    return templates.map((template) => ({
      name: `${template.name} - ${template.description}${template.default ? ' [RECOMMENDED]' : ''}${template.deprecated ? ' [DEPRECATED]' : ''}`,
      value: template.name,
      short: template.name,
    }));
  }

  /**
   * Set default template
   */
  async setDefaultTemplate(type, name) {
    // Validate template exists
    const template = await this.registry.getTemplate(type, name);
    if (!template) {
      throw new Error(`Template ${name} not found`);
    }

    // Update config
    this.config.defaultTemplates[type] = name;
    await this.saveConfig();
  }

  /**
   * Save configuration to file
   */
  async saveConfig() {
    const content = JSON.stringify(this.config, null, 2);
    await fs.writeFile(this.configPath, content, 'utf8');
  }

  /**
   * Create configuration file with defaults
   */
  async createConfigFile() {
    const defaultConfig = await this._getDefaultConfig();
    const content = JSON.stringify(defaultConfig, null, 2);
    await fs.writeFile(this.configPath, content, 'utf8');
    this.config = defaultConfig;
  }

  /**
   * Get summary for display
   */
  async getSummary() {
    const backend = await this.registry.getBackendTemplates();
    const frontend = await this.registry.getFrontendTemplates();
    const defaults = this.getDefaults();

    return {
      defaults: defaults,
      available: {
        backend: backend.map((t) => ({
          name: t.name,
          version: t.version,
          default: t.default,
          deprecated: t.deprecated,
        })),
        frontend: frontend.map((t) => ({
          name: t.name,
          version: t.version,
          default: t.default,
          deprecated: t.deprecated,
        })),
      },
      stats: {
        totalBackendTemplates: backend.length,
        totalFrontendTemplates: frontend.length,
      },
    };
  }

  /**
   * Format template list for CLI display
   */
  async formatTemplateList(type) {
    const templates = await this.listTemplates(type);
    const defaults = this.getDefaults();

    const lines = [];
    templates.forEach((template) => {
      const marker = template.name === defaults[type] ? '✓' : '○';
      const tags = [];
      if (template.default) tags.push('DEFAULT');
      if (template.deprecated) tags.push('DEPRECATED');
      const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';

      lines.push(
        `${marker} ${template.name} - ${template.description}${tagStr}`,
      );
      lines.push(`  Version: ${template.version}`);
      if (template.framework) {
        lines.push(`  Framework: ${template.framework}`);
      }
      lines.push('');
    });

    return lines.join('\n');
  }
}

module.exports = TemplateManager;
