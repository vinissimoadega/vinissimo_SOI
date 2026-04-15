import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  async check() {
    const result = await this.db.query<{
      current_database: string;
      current_user: string;
    }>('SELECT current_database(), current_user;');

    return {
      status: 'ok',
      service: 'vinissimo-soi-api',
      timestamp: new Date().toISOString(),
      database: result.rows[0],
    };
  }
}
