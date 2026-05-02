import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap(): Promise<void> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication();
  const config = app.get(ConfigService);
  console.log('REDIS_URL =', config.get('REDIS_URL'));
  await app.close();
}
void bootstrap();
