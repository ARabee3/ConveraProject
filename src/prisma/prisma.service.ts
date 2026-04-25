import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private _extendedClient;

  constructor() {
    super();

    this._extendedClient = this.$extends({
      query: {
        $allModels: {
          async update({ args, query }) {
            const data = args.data as Record<string, unknown>;
            if (data.version !== undefined) {
              data.version = { increment: 1 };
            }
            return query(args);
          },
          async updateMany({ args, query }) {
            const data = args.data as Record<string, unknown>;
            if (data.version !== undefined) {
              data.version = { increment: 1 };
            }
            return query(args);
          },
        },
      },
    });
  }

  get client() {
    return this._extendedClient;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
