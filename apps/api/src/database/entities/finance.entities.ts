import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { LedgerAccount, LedgerKind, PayoutStatus, RatingTarget, TicketStatus } from '../../common/enums';

/**
 * Grand livre : chaque mouvement d'argent dû à un commerçant ou un livreur.
 * Le solde d'un compte = somme des montants. Les reversements (PAYOUT) sont négatifs.
 */
@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'enum', enum: LedgerAccount }) accountType: LedgerAccount;
  @Index() @Column('uuid') accountId: string; // shopId ou userId du livreur
  @Index() @Column('uuid', { nullable: true }) orderId: string | null;
  @Column({ type: 'enum', enum: LedgerKind }) kind: LedgerKind;
  @Column('int') amount: number;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @CreateDateColumn() createdAt: Date;
}

/** Remise d'espèces d'un livreur à la plateforme (enregistrée par l'admin). */
@Entity('cash_remittances')
export class CashRemittance {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') courierId: string;
  @Column('int') amount: number;
  @Column() recordedBy: string;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity('ratings')
@Index(['orderId', 'targetType'], { unique: true })
export class Rating {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') orderId: string;
  @Column('uuid') raterId: string;
  @Column({ type: 'enum', enum: RatingTarget }) targetType: RatingTarget;
  @Index() @Column('uuid') targetId: string;
  @Column('int') score: number;
  @Column({ type: 'text', nullable: true }) comment: string | null;
  @CreateDateColumn() createdAt: Date;
}

export interface TicketMessage {
  authorId: string;
  authorRole: string;
  text: string;
  at: string;
}

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') userId: string;
  @Column('uuid', { nullable: true }) orderId: string | null;
  @Column() subject: string;
  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.OPEN }) status: TicketStatus;
  @Column('jsonb', { default: [] }) messages: TicketMessage[];
  @Column('int', { nullable: true }) refundAmount: number | null;
  @CreateDateColumn() createdAt: Date;
  @Column('timestamptz', { nullable: true }) resolvedAt: Date | null;
}

/** File de SMS envoyés (journal + repli pour les notifications critiques). */
@Entity('sms_outbox')
export class SmsMessage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() phone: string;
  @Column('text') body: string;
  @Column({ default: 'SENT' }) status: string;
  @Column() provider: string;
  @CreateDateColumn() createdAt: Date;
}

/** Demande de reversement Mobile Money (commerçant ou livreur), traitée par l'admin. */
@Entity('payout_requests')
export class PayoutRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'enum', enum: LedgerAccount }) accountType: LedgerAccount;
  @Index() @Column('uuid') accountId: string;
  @Column('int') amount: number;
  @Column() mobileMoneyNumber: string;
  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.REQUESTED }) status: PayoutStatus;
  @Column({ type: 'varchar', nullable: true }) providerRef: string | null;
  @Column({ type: 'varchar', nullable: true }) processedBy: string | null;
  @CreateDateColumn() createdAt: Date;
  @Column('timestamptz', { nullable: true }) processedAt: Date | null;
}
