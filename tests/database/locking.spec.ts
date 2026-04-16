import { PrismaClient } from '@prisma/client';

describe('Optimistic Locking (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create an entity with version 1', async () => {
    const entity = await prisma.baseEntity.create({
      data: {},
    });
    expect(entity.version).toBe(1);
  });
});
