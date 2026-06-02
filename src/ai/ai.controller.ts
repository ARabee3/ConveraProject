import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { IsString, IsNotEmpty } from 'class-validator';

export class AiSearchDto {
  @IsString()
  @IsNotEmpty()
  query: string;
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: AiSearchDto) {
    return this.aiService.search(dto.query);
  }
}
