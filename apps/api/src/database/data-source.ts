import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';

export function buildDataSourceOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  return {
    type: 'postgres',
    url: env.DATABASE_URL ?? 'postgres://livraison:livraison@localhost:5432/livraison',
    entities: ENTITIES,
    migrations: [__dirname + '/migrations/*.{ts,js}'],
    synchronize: env.DB_SYNC === 'true',
    logging: env.DB_LOGGING === 'true',
  };
}

// Utilisé par la CLI TypeORM (migrations)
export default new DataSource(buildDataSourceOptions());
