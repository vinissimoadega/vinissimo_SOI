import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SettingsService {
  constructor(private readonly db: DatabaseService) {}

  async getCurrentSettings() {
    const result = await this.db.query(
      'SELECT * FROM soi.v_current_system_settings LIMIT 1;',
    );

    return result.rows[0] ?? null;
  }
}
