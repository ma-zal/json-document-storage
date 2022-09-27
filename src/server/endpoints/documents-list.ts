import { Request, Response } from 'express';
import { db } from '../db';
import { JsonDocumentDbEntity } from '@common/orm-json-document';
import { JsonDocumentListItem } from '@common/json-document.type';

export async function getDocumentsListHttp(req: Request, res: Response) {
  try {
    const documents = await getDocumentsList();
    res.json(documents);
  } catch (e: any) {
    res.status(500);
    res.json({
      error: e.message,
    });
    console.error(`ERROR: ` + String(e));
    console.error(e.stack);
  }
}

export async function getDocumentsList(): Promise<JsonDocumentListItem[]> {
  return db.getRepository(JsonDocumentDbEntity).find({
    select: ['id', 'title', 'created_at', 'updated_at'],
    order: { 'updated_at': 'desc' },
  });
}
