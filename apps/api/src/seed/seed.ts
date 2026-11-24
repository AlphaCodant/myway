import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../database/data-source';
import { runSeed } from './run-seed';

async function main() {
  const ds = await new DataSource({ ...buildDataSourceOptions(), synchronize: process.env.DB_SYNC === 'true' }).initialize();
  await ds.query('CREATE EXTENSION IF NOT EXISTS postgis');
  const summary = await runSeed(ds, {
    adminPhone: process.env.SEED_ADMIN_PHONE ?? '0700000000',
    demo: process.env.SEED_DEMO !== 'false',
  });
  console.log('Données initiales chargées :', summary);
  await ds.destroy();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
