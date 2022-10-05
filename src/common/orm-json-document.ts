import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity(/*table name:*/ 'documents')
export class JsonDocumentDbEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  title!: string;

  @Column({ type: 'text', nullable: false, default: '' })
  notes!: string;

  @Column({ type: 'jsonb', nullable: false })
  contents!: any;

  @Column({ type: 'text', nullable: false })
  contents_raw!: string;

  @Column({ type: 'jsonb', nullable: true })
  schema!: any | null;

  @CreateDateColumn({ type: 'timestamptz', nullable: false, name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: false, name: 'updated_at' })
  updated_at!: Date;

  /**
   * BCrypt hashed password.
   */
  @Column({ type: 'varchar', length: 60, nullable: true })
  write_password_bcrypted!: string | null;

}
