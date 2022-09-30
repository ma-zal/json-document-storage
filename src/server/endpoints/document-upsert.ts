import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parseDocument } from '@common/document-parse';
import { db } from '../db';
import { JsonDocumentDbEntity } from '@common/orm-json-document';
import { JsonDocumentToSave, JsonPublicDocument } from '@common/json-document.type';
import { validateUuid } from '../utils';
import { getDocument } from './document-get';

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
      write_access_token: req.body.write_access_token,
    }
    const accessToken = req.headers.authorization?.split(' ')[1];
    const updatedDocument = await upsertDocument(document, accessToken);
    res.json(updatedDocument);
    res.end();

  } catch (e: any) {
    res.status(e.statusCode || 500);
    res.json({
      error: e.message,
    });
  }
}


export async function upsertDocument(document: JsonDocumentToSave, writeAccessToken: string | undefined): Promise<JsonPublicDocument> {
  let existingDocument: JsonDocumentDbEntity | null = null;
  if (document.id) {
    existingDocument = await db.getRepository(JsonDocumentDbEntity).findOneBy({
      id: document.id
    });
  }

  const contents = parseDocument(document.contents_raw, document.schema);

  if (existingDocument) {
    if (existingDocument.write_access_token && !writeAccessToken) {
      const error = new Error('Update document rejected, because write is password protected.');
      (error as any).statusCode = 401;
      throw error;
    }

    if ((existingDocument.write_access_token || writeAccessToken) && existingDocument.write_access_token !== writeAccessToken) {
      const error = new Error('Update document rejected, because write token is not correct.');
      (error as any).statusCode = 403;
      throw error;
    }

    existingDocument.title = document.title;
    existingDocument.notes = document.notes;
    existingDocument.contents_raw = document.contents_raw;
    existingDocument.contents = contents;
    existingDocument.schema = document.schema;
    existingDocument.updated_at = new Date();
    if (typeof document.write_access_token === 'string') {
      existingDocument.write_access_token = document.write_access_token;
    }
    await db.getRepository(JsonDocumentDbEntity).save(existingDocument);

    return getDocument(existingDocument.id);

  } else {
    // New document.

    // Check the write token for complexity
    // if (document.write_access_token?.length < 8) {
    //   throw new Error('Store document rejected, because the write token length must be at least 8 chars.');
    // }

    const id = uuidv4();

    await db.getRepository(JsonDocumentDbEntity).insert({
      id: id,
      title: document.title,
      notes: document.notes,
      contents_raw: document.contents_raw,
      contents: contents,
      schema: document.schema,
      updated_at: new Date(),
      ...document.write_access_token !== undefined ? { write_access_token: document.write_access_token } : {}
    });

    return getDocument(id);
  }

}
