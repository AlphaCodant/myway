import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToOne, Point, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { AccountStatus, Role, VehicleType } from '../../common/enums';
import { Neighborhood } from './geo.entities';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  /** Numéro au format international, ex. +2250701020304 */
  @Column({ unique: true }) phone: string;
  @Column({ type: 'varchar', nullable: true }) name: string | null;
  @Column({ type: 'enum', enum: Role, default: Role.CLIENT }) role: Role;
  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE }) status: AccountStatus;
  @Column('uuid', { nullable: true }) neighborhoodId: string | null;
  @Column({ default: 'fr' }) language: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('otp_codes')
export class OtpCode {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() phone: string;
  @Column() codeHash: string;
  @Column('timestamptz') expiresAt: Date;
  @Column('int', { default: 0 }) attempts: number;
  @Column({ default: false }) used: boolean;
  @CreateDateColumn() createdAt: Date;
}

/** Adresse informelle : point GPS + quartier + repère texte + note vocale + photo du portail. */
@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') userId: string;
  @Column({ default: 'Maison' }) label: string;
  @Column('uuid') neighborhoodId: string;
  @ManyToOne(() => Neighborhood) neighborhood: Neighborhood;
  @Column('geography', { spatialFeatureType: 'Point', srid: 4326 }) location: Point;
  /** ex. « après la mosquée, portail bleu » */
  @Column({ type: 'text', nullable: true }) landmarkText: string | null;
  @Column('uuid', { nullable: true }) landmarkId: string | null;
  @Column({ type: 'varchar', nullable: true }) voiceNoteUrl: string | null; // 30 s max
  @Column({ type: 'varchar', nullable: true }) photoUrl: string | null;
  @Column({ type: 'varchar', nullable: true }) plusCode: string | null;
  @Column({ default: false }) gpsCorrected: boolean;
  @CreateDateColumn() createdAt: Date;
}

@Entity('courier_profiles')
export class CourierProfile {
  @PrimaryColumn('uuid') userId: string;
  @OneToOne(() => User) @JoinColumn({ name: 'userId' }) user: User;
  @Column({ type: 'enum', enum: VehicleType, default: VehicleType.MOTO }) vehicle: VehicleType;
  @Column({ type: 'varchar', nullable: true }) idDocumentUrl: string | null;
  @Column({ type: 'varchar', nullable: true }) licenseUrl: string | null; // permis (moto)
  @Column({ type: 'varchar', nullable: true }) registrationUrl: string | null; // carte grise (moto)
  @Column({ type: 'varchar', nullable: true }) photoUrl: string | null;
  @Column({ type: 'varchar', nullable: true }) emergencyContact: string | null;
  @Column({ type: 'varchar', nullable: true }) mobileMoneyNumber: string | null;
  @Column({ default: false }) online: boolean;
  /** Position partagée uniquement quand le livreur est en service. */
  @Index({ spatial: true })
  @Column('geography', { spatialFeatureType: 'Point', srid: 4326, nullable: true }) location: Point | null;
  @Column('timestamptz', { nullable: true }) lastSeenAt: Date | null;
  /** Espèces encaissées non encore reversées à la plateforme (FCFA). */
  @Column('int', { default: 0 }) cashHeld: number;
  @Column('numeric', { precision: 3, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string | null) => (v == null ? null : Number(v)) } })
  ratingAvg: number;
  @Column('int', { default: 0 }) ratingCount: number;
  @UpdateDateColumn() updatedAt: Date;
}
