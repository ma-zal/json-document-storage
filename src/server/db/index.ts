import { DataSource } from 'typeorm';
import { JsonDocumentDbEntity } from './document';

export let db: DataSource;

// Env variables validation
if (!process.env.POSTGRES_PASSWORD) {
  console.warn('Env POSTGRES_PASSWORD is missing. Trying to log-in without password.');
}

const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  username: process.env.POSTGRES_USER || 'jsondocumentstorage',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB || 'jsondocumentstorage',
};

export async function dbConnectionInit() {
  db = new DataSource({
    type: 'postgres',
    ...dbConfig,
    entities: [JsonDocumentDbEntity],
    // DB migrations disabled:
    // migrationsRun: true,
    // migrations: [__dirname + '/migration/*.ts', __dirname + '/migration/*.js'],
    synchronize: true, // Trivival variant of migrations
  });

  await db.initialize();
}
