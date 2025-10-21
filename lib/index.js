/**
 * @aegisx/crud-generator
 *
 * Public API for programmatic usage
 */

module.exports = {
  // Core Classes
  TemplateManager: require('./core/template-manager'),
  TemplateRegistry: require('./core/template-registry'),
  TemplateRenderer: require('./core/template-renderer'),

  // Generators
  generateCrudModule: require('./generators/backend-generator')
    .generateCrudModule,
  generateDomainModule: require('./generators/backend-generator')
    .generateDomainModule,
  addRouteToDomain: require('./generators/backend-generator').addRouteToDomain,
  generateFrontendCrud: require('./generators/frontend-generator')
    .generateFrontendCrud,
  generateRoles: require('./generators/role-generator').generateRoles,

  // Utils
  database: require('./utils/database'),
  validator: require('./utils/validator'),

  // Config
  knexConnection: require('./config/knex-connection'),
};
