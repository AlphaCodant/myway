import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, Point, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import {
  DeliveryMode, DispatchStatus, ItemStatus, OfferStatus, OrderStatus, PaymentMethod, PaymentStatus,
} from '../../common/enums';
import { Shop } from './shop.entities';
import { User } from './user.entities';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;
  /** Référence courte lisible au téléphone, ex. GAG-4K7P2 */
  @Index({ unique: true }) @Column() reference: string;
  @Index() @Column('uuid') clientId: string;
  @ManyToOne(() => User) client: User;
  @Index() @Column('uuid') shopId: string;
  @ManyToOne(() => Shop) shop: Shop;
  @Index() @Column('uuid', { nullable: true }) courierId: string | null;
  @Column({ type: 'enum', enum: OrderStatus }) status: OrderStatus;
  @Column({ type: 'enum', enum: DeliveryMode, default: DeliveryMode.PLATFORM }) deliveryMode: DeliveryMode;
  @Column({ type: 'enum', enum: DispatchStatus, default: DispatchStatus.NONE }) dispatchStatus: DispatchStatus;
  @Column({ type: 'enum', enum: PaymentMethod }) paymentMethod: PaymentMethod;
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING }) paymentStatus: PaymentStatus;

  // Montants en FCFA
  @Column('int') subtotal: number;
  @Column('int') deliveryFee: number;
  @Column('int') total: number;
  @Column('int', { default: 0 }) commission: number;
  @Column('int', { default: 0 }) courierEarning: number;
  @Column('int', { default: 0 }) cancellationFee: number;

  // Copie de l'adresse au moment de la commande
  @Column('uuid', { nullable: true }) addressId: string | null;
  @Column('uuid', { nullable: true }) neighborhoodId: string | null;
  @Column('geography', { spatialFeatureType: 'Point', srid: 4326, nullable: true }) deliveryLocation: Point | null;
  @Column({ type: 'text', nullable: true }) deliveryLandmark: string | null;
  @Column({ type: 'varchar', nullable: true }) deliveryVoiceNoteUrl: string | null;
  @Column({ type: 'varchar', nullable: true }) deliveryPhotoUrl: string | null;
  @Column('int', { nullable: true }) distanceMeters: number | null;

  @Column({ type: 'text', nullable: true }) note: string | null;
  /** Code à 4 chiffres que le client donne au livreur à la remise. */
  @Column({ select: false }) deliveryCode: string;
  @Column('int', { default: 0 }) clientCallAttempts: number;
  @Column('timestamptz', { nullable: true }) firstCallAttemptAt: Date | null;
  @Column('timestamptz', { nullable: true }) merchantReminderSentAt: Date | null;
  @Column({ type: 'text', nullable: true }) cancelReason: string | null;
  @Column({ type: 'varchar', nullable: true }) cancelledBy: string | null;

  @Column('timestamptz', { nullable: true }) confirmedAt: Date | null;
  @Column('timestamptz', { nullable: true }) readyAt: Date | null;
  @Column('timestamptz', { nullable: true }) pickedUpAt: Date | null;
  @Column('timestamptz', { nullable: true }) deliveredAt: Date | null;
  @Column('timestamptz', { nullable: true }) cancelledAt: Date | null;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: true }) items: OrderItem[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') orderId: string;
  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' }) order: Order;
  @Column('uuid') productId: string;
  @Column() name: string;
  @Column('int') unitPrice: number;
  @Column('int') quantity: number;
  @Column({ type: 'enum', enum: ItemStatus, default: ItemStatus.OK }) status: ItemStatus;
  @Column('uuid', { nullable: true }) substituteProductId: string | null;
  @Column({ type: 'varchar', nullable: true }) substituteName: string | null;
  @Column('int', { nullable: true }) substituteUnitPrice: number | null;
}

/** Historique des statuts (pour le suivi client et les litiges). */
@Entity('order_events')
export class OrderEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') orderId: string;
  @Column() type: string;
  @Column('uuid', { nullable: true }) actorId: string | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @CreateDateColumn() createdAt: Date;
}

/** Proposition de course à un livreur (30 secondes pour accepter). */
@Entity('delivery_offers')
export class DeliveryOffer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') orderId: string;
  @Index() @Column('uuid') courierId: string;
  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.OFFERED }) status: OfferStatus;
  @Column('int') distanceMeters: number;
  @Column('int') estimatedEarning: number;
  @Column('timestamptz') expiresAt: Date;
  @CreateDateColumn() createdAt: Date;
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') orderId: string;
  @Column({ type: 'enum', enum: PaymentMethod }) method: PaymentMethod;
  @Column() provider: string;
  @Column('int') amount: number;
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING }) status: PaymentStatus;
  @Index() @Column({ type: 'varchar', nullable: true }) providerRef: string | null;
  @Column({ type: 'text', nullable: true }) checkoutUrl: string | null;
  @Column('jsonb', { nullable: true }) raw: unknown;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
