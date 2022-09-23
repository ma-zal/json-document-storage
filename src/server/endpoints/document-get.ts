import { Request, Response } from 'express';
import { db } from '../db';
import { JsonDocumentDbEntity, JsonPublicDocument } from '../db/document';
import { validateUuid } from '../utils';

export async function getDocumentHttp(req: Request, res: Response) {
  try {
    const documentId: string = validateUuid(req.params.documentId);

    const document = await getDocument(documentId);
    res.json(document);
  } catch (e: any) {
    res.status(500);
    res.json({
      error: e.message,
    });
    console.error(`ERROR: ` + String(e));
    console.error(e.stack);
  }
}

export async function getDocumentContentsHttp(req: Request, res: Response) {
  try {
    const documentId: string = validateUuid(req.params.documentId);

    const documentContents = await getDocumentContents(documentId);
    res.json(documentContents);
  } catch (e: any) {
    res.status(500);
    res.json({
      error: e.message,
    });
    console.error(`ERROR: ` + String(e));
    console.error(e.stack);
  }
}

/**
 * Get document (with all public properties) from database.
 */
export async function getDocument(documentId: string): Promise<JsonPublicDocument> {
  const document = await db.getRepository(JsonDocumentDbEntity).findOneByOrFail({
    id: documentId,
  });
  return <JsonPublicDocument>{
    id: document.id,
    contents_raw: document.contents_raw,
    schema: document.schema,
    updated_at: document.updated_at,
    created_at: document.created_at,
    title: document.title,
    notes: document.notes,
  };
}

/**
 * Gets document contents from database.
 */
export async function getDocumentContents(documentId: string): Promise<any> {
  const document = await db.getRepository(JsonDocumentDbEntity).findOneOrFail({
    where: {
      id: documentId,
    },
    select: ['contents'],
  });
  return document.contents;
}
