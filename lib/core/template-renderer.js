/**
 * Template Renderer
 *
 * Handles template rendering with TemplateManager integration
 * Provides backward compatibility with existing generator code
 */

const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

class TemplateRenderer {
  constructor(templateManager) {
    this.templateManager = templateManager;
  }

  /**
   * Render template by name from specific template type
   */
  async render(templateType, templateName, context) {
    // Get template info from manager
    const template = await this.templateManager.getTemplateForGeneration(
      templateType,
      context.templateVersion || null,
    );

    // Build template file path
    const templatePath = path.join(template.path, templateName);

    // Read and compile template
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const compiled = Handlebars.compile(templateContent);

    return compiled(context);
  }

  /**
   * Render backend template
   */
  async renderBackend(templateName, context) {
    return this.render('backend', templateName, context);
  }

  /**
   * Render frontend template
   */
  async renderFrontend(templateName, context) {
    return this.render('frontend', templateName, context);
  }

  /**
   * Render template from absolute path (for backward compatibility)
   */
  async renderFromPath(templatePath, context) {
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const compiled = Handlebars.compile(templateContent);
    return compiled(context);
  }

  /**
   * Get template path for manual operations
   */
  async getTemplatePath(templateType, templateName, context) {
    const template = await this.templateManager.getTemplateForGeneration(
      templateType,
      context.templateVersion || null,
    );
    return path.join(template.path, templateName);
  }
}

module.exports = TemplateRenderer;
