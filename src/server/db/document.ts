import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity(/*table name:*/ 'documents')
export class JsonDocumentDbEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', nullable: false })
  title!: string;

  @Column({ type: 'jsonb', nullable: false })
  contents!: any;

  @Column({ type: 'jsonb', nullable: true })
  schema!: any | null;

  @CreateDateColumn({ type: 'timestamptz', nullable: false, name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: false, name: 'updated_at' })
  updated_at!: Date;

  @Column({ type: 'varchar', nullable: false })
  write_access_token!: string;

}

export interface JsonDocument extends JsonDocumentDbEntity {}

/**
 * Document propertied, but without write token.
 */
export interface JsonPublicDocument extends Omit<JsonDocument, 'write_access_token'> {}

export interface JsonDocumentToSave extends Omit<JsonDocument, 'created_at' | 'updated_at' | 'id'> {
  id: string | null;
}

export type JsonDocumentListItem = Pick<JsonDocument, 'id'|'title'|'created_at'|'updated_at'>;

