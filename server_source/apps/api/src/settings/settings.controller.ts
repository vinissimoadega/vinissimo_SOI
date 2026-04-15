import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('current')
  async getCurrent() {
    return this.settingsService.getCurrentSettings();
  }
}
