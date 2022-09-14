import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { JsonDocumentDbEntity, JsonDocumentToSave, JsonPublicDocument } from '../db/document';
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
      contents: req.body.contents,
      schema: req.body.schema,
      write_access_token: req.body.write_access_token,
    }
    const updatedDocument = await upsertDocument(document);
    res.json(updatedDocument);
    res.end();

  } catch (e: any) {
    res.status(500);
    res.json({
      error: e.message,
    });
  }
}


export async function upsertDocument(document: JsonDocumentToSave): Promise<JsonPublicDocument> {
  let existingDocument: JsonDocumentDbEntity | null = null;
  if (document.id) {
    existingDocument = await db.getRepository(JsonDocumentDbEntity).findOneBy({
      id: document.id
    });
  }
  if (existingDocument) {
    if (existingDocument.write_access_token !== document.write_access_token) {
      throw new Error('Update document rejected, because write token is not correct.')
    }
  } else {
    // New document.

    // Check the write token for complexity
    // if (document.write_access_token?.length < 8) {
    //   throw new Error('Store document rejected, because the write token length must be at least 8 chars.');
    // }
  }

  if (!document.id) {
    document.id = uuidv4();
  }

  await db.getRepository(JsonDocumentDbEntity).upsert({
    id: document.id,
    title: document.title,
    contents: document.contents,
    schema: document.schema,
    write_access_token: document.write_access_token,
    updated_at: new Date(),
  }, ['id']);

  return getDocument(document.id);
}
