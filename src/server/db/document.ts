import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { JSONData } from '@common/json-data.type';

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

  @Column({ type: 'varchar', length: 100, nullable: false })
  write_access_token!: string;

}

export interface JsonDocument extends JsonDocumentDbEntity {}

/**
 * Document propertied, but without write token.
 */
export interface JsonPublicDocument extends Omit<JsonDocument, 'write_access_token' | 'contents'> {}

export interface JsonDocumentToSave extends Omit<JsonDocument, 'created_at' | 'updated_at' | 'id' | 'contents'> {
  id: string | null;
}

export type JsonDocumentListItem = Pick<JsonDocument, 'id'|'title'|'created_at'|'updated_at'>;

