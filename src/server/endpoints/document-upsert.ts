import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parseDocument } from '@common/document-parse';
import { db } from '../db';
import { JsonDocumentDbEntity } from '@common/orm-json-document';
import { JsonDocumentToSave, JsonPublicDocument } from '@common/json-document.type';
import { validateUuid } from '../utils';
import { getDocument } from './document-get';
import * as bcrypt from 'bcryptjs';

/**
 * Wrapper for Node Express. Wrapping function `upsertDocument()` implemented below.
 */
export async function upsertDocumentHttp(req: Request, res: Response) {
  try {
    if (req.body?.id !== null) {
      validateUuid(req.body?.id);
    }
    const document: JsonDocumentToSave = {
      id: req.body.id,
      title: req.body.title,
      notes: req.body.notes,
      contents_raw: req.body.contents_raw,
      schema: req.body.schema,
      write_password_bcrypted: req.body.write_password_bcrypted,
    }
    // Write password is provided as 'Authorization: Bearer BASE64(password_string)'.
    const currentWritePasswordBase64 = req.headers.authorization?.split(' ')[1];
    // Decode password from Base64 into plain text.
    const currentWritePassword = currentWritePasswordBase64 ? Buffer.from(currentWritePasswordBase64, 'base64').toString('utf-8') : undefined;

    const updatedDocument = await upsertDocument(document, currentWritePassword);
    res.json(updatedDocument);
    res.end();

  } catch (e: any) {
    res.status(e.statusCode || 500);
    res.json({
      error: e.message,
    });
  }
}

/**
 * @param document
 *   New document properties, which to save. Contains optionally also `id` to identity,
 *   which document to update. If no `id` then new document will be created.
 * @param currentWritePassword 
 *   If document is write protected, the current password must be received from user.
 * @returns 
 *   Final properties of document. In case of new document, there is also `id` of newly created document.
 */
export async function upsertDocument(document: JsonDocumentToSave, currentWritePassword: string | undefined): Promise<JsonPublicDocument> {
  // If update of existing document is required, then find the original document in DB.
  let existingDocument: JsonDocumentDbEntity | null = null;
  if (document.id) {
    existingDocument = await db.getRepository(JsonDocumentDbEntity).findOneBy({
      id: document.id
    });
  }

  const contents = parseDocument(document.contents_raw, document.schema);

  if (existingDocument) {
    // Return HTTP 401 as information to client app to ask user for current write password.
    if (existingDocument.write_password_bcrypted && !currentWritePassword) {
      const error = new Error('Update document rejected, because write is password protected.');
      (error as any).statusCode = 401;
      throw error;
    }

    // Return HTTP 403 if case of incorrect authorization
    if (
      existingDocument.write_password_bcrypted &&
      !(await bcrypt.compare(currentWritePassword || '', existingDocument.write_password_bcrypted))
    ) {
      const error = new Error('Update document rejected, because write password is not correct.');
      (error as any).statusCode = 403;
      throw error;
    }

    // Update existing document properties
    existingDocument.title = document.title;
    existingDocument.notes = document.notes;
    existingDocument.contents_raw = document.contents_raw;
    existingDocument.contents = contents;
    existingDocument.schema = document.schema;
    existingDocument.updated_at = new Date();

    // Change write password (if entered new one)
    if (typeof document.write_password_bcrypted === 'string' && document.write_password_bcrypted !== '') {
      // Check if string has bcrypt format
      checkBcryptFormat(document.write_password_bcrypted);
      // OK, change the password
      existingDocument.write_password_bcrypted = document.write_password_bcrypted;
    }
    await db.getRepository(JsonDocumentDbEntity).save(existingDocument);

    return getDocument(existingDocument.id);

  } else {
    // New document.

    // Create random UUID for new document.
    const id = uuidv4();

    let newPasswordHashed: string | null = null;
    if (typeof document.write_password_bcrypted === 'string' && document.write_password_bcrypted !== '') {
      // Check if string has bcrypt format
      checkBcryptFormat(document.write_password_bcrypted);
      // OK, change the password
      newPasswordHashed = document.write_password_bcrypted;
    }

    await db.getRepository(JsonDocumentDbEntity).insert({
      id: id,
      title: document.title,
      notes: document.notes,
      contents_raw: document.contents_raw,
      contents: contents,
      schema: document.schema,
      updated_at: new Date(),
      write_password_bcrypted: newPasswordHashed,
    });

    return getDocument(id);
  }
}

/**
 * Checks, if string is Bcrypted password.
 */
function checkBcryptFormat(bcryptedPassword: string): void {
  if (
    typeof bcryptedPassword !== 'string'
    || !bcryptedPassword.startsWith('$2a$')
    || bcryptedPassword.length !== 60
  ) {
    throw new Error('Password is in unexpected format. Expected bcrypted password.');
  }
}
