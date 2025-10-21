/**
 * Template Registry
 *
 * Manages template registration and discovery
 * Provides centralized template metadata access
 */

const fs = require('fs').promises;
const path = require('path');

class TemplateRegistry {
  constructor(templatesBasePath) {
    this.templatesBasePath =
      templatesBasePath || path.join(__dirname, '../../templates');
    this.cache = {
      backend: null,
      frontend: null,
    };
  }

  /**
   * Get all backend templates
   */
  async getBackendTemplates() {
    if (this.cache.backend) {
      return this.cache.backend;
    }

    const backendPath = path.join(this.templatesBasePath, 'backend');
    const templates = await this._discoverTemplates(backendPath, 'backend');
    this.cache.backend = templates;
    return templates;
  }

  /**
   * Get all frontend templates
   */
  async getFrontendTemplates() {
    if (this.cache.frontend) {
      return this.cache.frontend;
    }

    const frontendPath = path.join(this.templatesBasePath, 'frontend');
    const templates = await this._discoverTemplates(frontendPath, 'frontend');
    this.cache.frontend = templates;
    return templates;
  }

  /**
   * Get template by name
   */
  async getTemplate(type, name) {
    const templates =
      type === 'backend'
        ? await this.getBackendTemplates()
        : await this.getFrontendTemplates();

    return templates.find((t) => t.name === name);
  }

  /**
   * Get default template for type
   */
  async getDefaultTemplate(type) {
    const templates =
      type === 'backend'
        ? await this.getBackendTemplates()
        : await this.getFrontendTemplates();

    const defaultTemplate = templates.find((t) => t.default === true);
    return defaultTemplate || templates[0];
  }

  /**
   * Get template path
   */
  async getTemplatePath(type, name) {
    const template = await this.getTemplate(type, name);
    return template ? template.path : null;
  }

  /**
   * Clear cache (useful after adding new templates)
   */
  clearCache() {
    this.cache = {
      backend: null,
      frontend: null,
    };
  }

  /**
   * Private: Discover templates in a directory
   */
  async _discoverTemplates(basePath, type) {
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      const templates = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const templatePath = path.join(basePath, entry.name);
          const configPath = path.join(templatePath, 'template.config.json');

          try {
            const configContent = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configContent);

            templates.push({
              ...config,
              path: templatePath,
              configPath: configPath,
            });
          } catch (error) {
            console.warn(
              `Warning: Template ${entry.name} missing or invalid template.config.json`,
            );
          }
        }
      }

      // Sort by default first, then by name
      templates.sort((a, b) => {
        if (a.default && !b.default) return -1;
        if (!a.default && b.default) return 1;
        return a.name.localeCompare(b.name);
      });

      return templates;
    } catch (error) {
      console.error(`Error discovering ${type} templates:`, error.message);
      return [];
    }
  }

  /**
   * Validate template structure
   */
  async validateTemplate(type, name) {
    const template = await this.getTemplate(type, name);
    if (!template) {
      return { valid: false, errors: [`Template ${name} not found`] };
    }

    const errors = [];

    // Check if template directory exists
    try {
      await fs.access(template.path);
    } catch (error) {
      errors.push(`Template directory not found: ${template.path}`);
    }

    // Check if all template files exist
    if (template.files && Array.isArray(template.files)) {
      for (const file of template.files) {
        const filePath = path.join(template.path, file.template);
        try {
          await fs.access(filePath);
        } catch (error) {
          errors.push(`Template file not found: ${file.template}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * List all templates with their status
   */
  async listAllTemplates() {
    const backend = await this.getBackendTemplates();
    const frontend = await this.getFrontendTemplates();

    return {
      backend: backend.map((t) => ({
        name: t.name,
        description: t.description,
        version: t.version,
        default: t.default || false,
        deprecated: t.deprecated || false,
      })),
      frontend: frontend.map((t) => ({
        name: t.name,
        description: t.description,
        version: t.version,
        default: t.default || false,
        deprecated: t.deprecated || false,
      })),
    };
  }
}

module.exports = TemplateRegistry;
