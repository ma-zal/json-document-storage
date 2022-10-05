import { JsonDocumentDbEntity } from './orm-json-document';

export interface JsonDocument extends JsonDocumentDbEntity {}

/**
 * Document properties, but without write password.
 */
export interface JsonPublicDocument extends Omit<JsonDocument, 'write_password_bcrypted' | 'contents'> {}

export interface JsonDocumentToSave extends Omit<JsonDocument, 'created_at' | 'updated_at' | 'id' | 'contents'> {
  id: string | null;
}

export type JsonDocumentListItem = Pick<JsonDocument, 'id'|'title'|'created_at'|'updated_at'>;
