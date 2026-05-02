import { INestApplication } from '@nestjs/common';

export function getHttpUrl(app: INestApplication): string {
  const server = app.getHttpServer() as import('http').Server;
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Server address not available');
  }
  return `http://localhost:${String(address.port)}`;
}
