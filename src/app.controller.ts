import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { I18nContext, I18n } from 'nestjs-i18n';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('hello')
  async getHelloI18n(@I18n() i18n: I18nContext): Promise<string> {
    return i18n.t('common.HELLO');
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
