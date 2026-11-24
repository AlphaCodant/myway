import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from './common/auth/auth.decorators';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  @Public() @Get()
  async health() {
    await this.db.query('SELECT 1');
    return { status: 'ok', time: new Date().toISOString() };
  }
}
