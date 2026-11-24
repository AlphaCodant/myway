import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, Point, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AccountStatus, ShopCategory } from '../../common/enums';
import { Neighborhood } from './geo.entities';
import { User } from './user.entities';

const num = { to: (v: number) => v, from: (v: string | null) => (v == null ? null : Number(v)) };

export interface OpeningHours {
  /** 0 = dimanche … 6 = samedi ; heures « HH:MM ». Jour absent = fermé. */
  [day: string]: { open: string; close: string } | undefined;
}

@Entity('shops')
export class Shop {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') ownerId: string;
  @ManyToOne(() => User) owner: User;
  @Column() name: string;
  @Column({ type: 'enum', enum: ShopCategory }) category: ShopCategory;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column('uuid') neighborhoodId: string;
  @ManyToOne(() => Neighborhood) neighborhood: Neighborhood;
  @Index({ spatial: true })
  @Column('geography', { spatialFeatureType: 'Point', srid: 4326 }) location: Point;
  @Column({ type: 'text', nullable: true }) landmarkText: string | null;
  @Column({ type: 'varchar', nullable: true }) photoUrl: string | null;
  @Column({ type: 'varchar', nullable: true }) idDocumentUrl: string | null;
  @Column({ type: 'varchar', nullable: true }) mobileMoneyNumber: string | null;
  @Column({ default: 'DAILY' }) payoutFrequency: 'DAILY' | 'WEEKLY';
  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.PENDING }) status: AccountStatus;
  /** Bouton « ouvert / fermé » du commerçant. */
  @Column({ default: false }) isOpen: boolean;
  @Column('jsonb', { default: {} }) openingHours: OpeningHours;
  /** Le commerçant accepte de livrer lui-même. */
  @Column({ default: false }) selfDelivery: boolean;
  /** Commission offerte jusqu'à cette date (0 % les 2 premiers mois). */
  @Column('timestamptz', { nullable: true }) commissionFreeUntil: Date | null;
  /** Taux spécifique à ce commerce (sinon taux de la catégorie). */
  @Column('numeric', { precision: 5, scale: 2, nullable: true, transformer: num }) commissionRateOverride: number | null;
  @Column('numeric', { precision: 3, scale: 2, default: 0, transformer: num }) ratingAvg: number;
  @Column('int', { default: 0 }) ratingCount: number;
  /** Agent terrain qui a créé le compte. */
  @Column('uuid', { nullable: true }) createdByAgentId: string | null;
  @OneToMany(() => Product, (p) => p.shop) products: Product[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') shopId: string;
  @ManyToOne(() => Shop, (s) => s.products, { onDelete: 'CASCADE' }) shop: Shop;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  /** Prix en FCFA (entier). */
  @Column('int') price: number;
  @Column({ type: 'varchar', nullable: true }) photoUrl: string | null; // WebP < 80 Ko
  @Column({ type: 'varchar', nullable: true }) section: string | null; // rayon libre : « Boissons », « Plats du jour »…
  /** Rupture de stock en un clic. */
  @Column({ default: true }) available: boolean;
  @Column({ default: false }) archived: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
