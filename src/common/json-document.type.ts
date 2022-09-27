import { JsonDocumentDbEntity } from './orm-json-document';

export interface JsonDocument extends JsonDocumentDbEntity {}

/**
 * Document propertied, but without write token.
 */
export interface JsonPublicDocument extends Omit<JsonDocument, 'write_access_token' | 'contents'> {}

export interface JsonDocumentToSave extends Omit<JsonDocument, 'created_at' | 'updated_at' | 'id' | 'contents'> {
  id: string | null;
}

export type JsonDocumentListItem = Pick<JsonDocument, 'id'|'title'|'created_at'|'updated_at'>;
