import {ApplicationConfig} from '@loopback/core';
import {MicroCatalogApplication} from './application';
import {RestServer} from "@loopback/rest";

/**
 * Export the OpenAPI spec from the application
 */
async function exportOpenApiSpec(): Promise<void> {
  const config: ApplicationConfig = {
    rest: {
      port: +(process.env.PORT ?? 3000),
      host: process.env.HOST ?? 'localhost',
    },
  };
  const outFile = process.argv[2] ?? '';
  const app = new MicroCatalogApplication(config);
  await app.boot();
  const restServer = app.getSync<RestServer>('servers.RestServer');
  await restServer.exportOpenApiSpec(outFile);
}

exportOpenApiSpec().catch(err => {
  console.error('Fail to export OpenAPI spec from the application.', err);
  process.exit(1);
});
