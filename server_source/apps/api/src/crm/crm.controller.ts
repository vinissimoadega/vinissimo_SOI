import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CrmService } from './crm.service';
import { parseCrmQueueFilters } from './crm.utils';

@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('overview')
  async getOverview() {
    return this.crmService.getOverview();
  }

  @Get('queue')
  async listQueue(@Query() query: Record<string, string | undefined>) {
    return this.crmService.listQueue(parseCrmQueueFilters(query));
  }

  @Get('customers/:customerId/memory')
  async getCustomerMemory(
    @Param('customerId', new ParseUUIDPipe({ version: '4' })) customerId: string,
  ) {
    return this.crmService.getCustomerMemory(customerId);
  }

  @Post('tasks')
  async createTask(
    @Body() body: Record<string, unknown>,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.crmService.createTask(body, currentUser);
  }

  @Patch('tasks/:taskId')
  async updateTask(
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.crmService.updateTask(taskId, body, currentUser);
  }
}
