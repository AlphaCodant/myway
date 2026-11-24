import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, Point, PrimaryGeneratedColumn } from 'typeorm';
import { LandmarkType, ShopCategory } from '../../common/enums';

/** Ville : le modèle est multi-villes dès le départ, même si seule Gagnoa est ouverte. */
@Entity('cities')
export class City {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) slug: string;
  @Column() name: string;
  @Column({ default: false }) active: boolean;
  @Column('geography', { spatialFeatureType: 'Point', srid: 4326, nullable: true }) center: Point | null;
  @OneToMany(() => Neighborhood, (n) => n.city) neighborhoods: Neighborhood[];
}

@Entity('neighborhoods')
export class Neighborhood {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') cityId: string;
  @ManyToOne(() => City, (c) => c.neighborhoods) city: City;
  @Column() name: string;
  @Column({ default: true }) active: boolean;
  @Column('geography', { spatialFeatureType: 'Point', srid: 4326, nullable: true }) center: Point | null;
}

/**
 * Grille tarifaire des frais de livraison par ville : une ligne par palier de distance.
 * Exemple Gagnoa : 0-2 km = 500, 2-3,5 km = 750, 3,5-5 km = 1000 FCFA.
 */
@Entity('delivery_tariffs')
export class DeliveryTariff {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') cityId: string;
  @Column('int') maxDistanceMeters: number;
  @Column('int') fee: number;
}

/** Commission de la plateforme par catégorie de commerce (en pourcentage). */
@Entity('category_commissions')
export class CategoryCommission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'enum', enum: ShopCategory, unique: true }) category: ShopCategory;
  @Column('numeric', { precision: 5, scale: 2, transformer: { to: (v: number) => v, from: (v: string | null) => (v == null ? null : Number(v)) } })
  ratePercent: number;
}

/** Repères partagés (mosquées, églises, écoles…) créés par les agents terrain. */
@Entity('landmarks')
export class Landmark {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') neighborhoodId: string;
  @ManyToOne(() => Neighborhood) neighborhood: Neighborhood;
  @Column() name: string;
  @Column({ type: 'enum', enum: LandmarkType, default: LandmarkType.AUTRE }) type: LandmarkType;
  @Index({ spatial: true })
  @Column('geography', { spatialFeatureType: 'Point', srid: 4326 }) location: Point;
  @CreateDateColumn() createdAt: Date;
}

/** Paramètres globaux modifiables par l'admin (clé / valeur). */
@Entity('settings')
export class Setting {
  @Column({ primary: true }) key: string;
  @Column('jsonb') value: unknown;
}
