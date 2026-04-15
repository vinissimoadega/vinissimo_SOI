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
import { FinancialService } from './financial.service';

@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Get('overview')
  async overview() {
    return this.financialService.getOverview();
  }

  @Get('receivables')
  async receivables(@Query() query: Record<string, string | undefined>) {
    return this.financialService.listReceivables(
      this.financialService.parseReceivableFilters(query),
    );
  }

  @Patch('receivables/:receivableId')
  async updateReceivable(
    @Param('receivableId', new ParseUUIDPipe({ version: '4' }))
    receivableId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.financialService.updateReceivable(
      receivableId,
      body,
      currentUser,
    );
  }

  @Get('payables')
  async payables(@Query() query: Record<string, string | undefined>) {
    return this.financialService.listPayables(
      this.financialService.parsePayableFilters(query),
    );
  }

  @Patch('payables/:payableId')
  async updatePayable(
    @Param('payableId', new ParseUUIDPipe({ version: '4' })) payableId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.financialService.updatePayable(payableId, body);
  }

  @Get('cashflow')
  async cashflow(@Query() query: Record<string, string | undefined>) {
    return this.financialService.getCashflow(
      this.financialService.parseCashflowFilters(query),
    );
  }

  @Get('pnl')
  async pnl(@Query() query: Record<string, string | undefined>) {
    return this.financialService.getPnl(
      this.financialService.parsePnlFilters(query),
    );
  }

  @Get('settlements')
  async settlements(@Query() query: Record<string, string | undefined>) {
    return this.financialService.listSettlements(
      this.financialService.parseSettlementFilters(query),
    );
  }

  @Post('settlements/ifood/generate')
  async generateIfoodSettlements(
    @Body() body: Record<string, unknown>,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.financialService.generateIfoodSettlementBatches(
      body,
      currentUser,
    );
  }

  @Patch('settlements/:batchId')
  async updateSettlement(
    @Param('batchId', new ParseUUIDPipe({ version: '4' })) batchId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.financialService.updateSettlementBatch(batchId, body);
  }

  @Get('channel-rules')
  async channelRules() {
    return this.financialService.listChannelRules();
  }

  @Patch('channel-rules/:ruleId')
  async updateChannelRule(
    @Param('ruleId', new ParseUUIDPipe({ version: '4' })) ruleId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.financialService.updateChannelRule(ruleId, body);
  }
}
