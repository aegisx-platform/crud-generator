const knexLib = require('knex');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

if (process.env.NODE_ENV !== 'production') {
  // Find project root by traversing up from current directory
  function findProjectRoot() {
    let currentDir = __dirname;

    // Traverse up until we find .env.local or reach root
    while (currentDir !== path.dirname(currentDir)) {
      const envLocalPath = path.join(currentDir, '.env.local');
      if (fs.existsSync(envLocalPath)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }

    // Fallback to process.cwd() if not found
    return process.cwd();
  }

  const projectRoot = findProjectRoot();
  const envLocalPath = path.join(projectRoot, '.env.local');

  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
    console.log(`✓ Loaded environment from: ${envLocalPath}`);
  }
}

const config = {
  client: 'postgresql',
  connection: {
    host: process.env.POSTGRES_HOST || process.env.DATABASE_HOST || 'localhost',
    port: parseInt(
      process.env.POSTGRES_PORT || process.env.DATABASE_PORT || '5432',
    ),
    database:
      process.env.POSTGRES_DATABASE || process.env.DATABASE_NAME || 'aegisx_db',
    user: process.env.POSTGRES_USER || process.env.DATABASE_USER || 'postgres',
    password:
      process.env.POSTGRES_PASSWORD ||
      process.env.DATABASE_PASSWORD ||
      'postgres',
  },
  pool: {
    min: 2,
    max: 10,
  },
};

let knexInstance = null;

function getKnexConnection() {
  if (!knexInstance) {
    knexInstance = knexLib(config);
  }
  return knexInstance;
}

const knex = getKnexConnection();

module.exports = { knex, getKnexConnection };
