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
import { CustomersService } from './customers.service';
import { parseCustomerListFilters } from './customers.utils';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    return this.customersService.listCustomers(parseCustomerListFilters(query));
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.customersService.createCustomer(body);
  }

  @Get(':customerId/preferences')
  async listPreferences(
    @Param('customerId', new ParseUUIDPipe({ version: '4' })) customerId: string,
  ) {
    return this.customersService.listCustomerPreferences(customerId);
  }

  @Post(':customerId/preferences')
  async createPreference(
    @Param('customerId', new ParseUUIDPipe({ version: '4' })) customerId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.customersService.createCustomerPreference(customerId, body);
  }

  @Get(':customerId/interactions')
  async listInteractions(
    @Param('customerId', new ParseUUIDPipe({ version: '4' })) customerId: string,
  ) {
    return this.customersService.listCustomerInteractions(customerId);
  }

  @Post(':customerId/interactions')
  async createInteraction(
    @Param('customerId', new ParseUUIDPipe({ version: '4' })) customerId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.customersService.createCustomerInteraction(
      customerId,
      body,
      currentUser,
    );
  }

  @Get(':customerId')
  async getById(
    @Param('customerId', new ParseUUIDPipe({ version: '4' })) customerId: string,
  ) {
    return this.customersService.getCustomerById(customerId);
  }

  @Patch(':customerId')
  async update(
    @Param('customerId', new ParseUUIDPipe({ version: '4' })) customerId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.customersService.updateCustomer(customerId, body);
  }
}
