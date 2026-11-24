import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LedgerEntry } from '../../database/entities';
import { LedgerAccount, LedgerKind } from '../../common/enums';

@Injectable()
export class LedgerService {
  constructor(@InjectRepository(LedgerEntry) private readonly entries: Repository<LedgerEntry>) {}

  async record(
    accountType: LedgerAccount, accountId: string, kind: LedgerKind, amount: number,
    orderId: string | null = null, note: string | null = null, manager?: EntityManager,
  ) {
    if (amount === 0) return;
    const repo = manager ? manager.getRepository(LedgerEntry) : this.entries;
    await repo.save(repo.create({ accountType, accountId, kind, amount, orderId, note }));
  }

  async balance(accountType: LedgerAccount, accountId: string): Promise<number> {
    const row = await this.entries
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'sum')
      .where('e.accountType = :t AND e.accountId = :id', { t: accountType, id: accountId })
      .getRawOne();
    return Number(row.sum);
  }

  async sumSince(accountType: LedgerAccount, accountId: string, kinds: LedgerKind[], since: Date): Promise<number> {
    const row = await this.entries
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'sum')
      .where('e.accountType = :t AND e.accountId = :id AND e.kind IN (:...kinds) AND e.createdAt >= :since', {
        t: accountType, id: accountId, kinds, since,
      })
      .getRawOne();
    return Number(row.sum);
  }

  history(accountType: LedgerAccount, accountId: string, limit = 50) {
    return this.entries.find({ where: { accountType, accountId }, order: { createdAt: 'DESC' }, take: limit });
  }
}
