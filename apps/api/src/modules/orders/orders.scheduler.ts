import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DispatchService } from './dispatch.service';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersScheduler {
  private readonly logger = new Logger('Scheduler');
  private running = false;
  constructor(private readonly dispatch: DispatchService, private readonly orders: OrdersService) {}

  @Interval(5000)
  async run() {
    if (process.env.DISABLE_SCHEDULER === 'true' || this.running) return;
    this.running = true;
    try {
      await this.dispatch.tick();
      await this.orders.remindMerchants();
    } catch (e) {
      this.logger.error(e);
    } finally {
      this.running = false;
    }
  }
}
