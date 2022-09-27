import express, { NextFunction, Request, Response } from 'express';
import { resolve } from 'path';
import { dbConnectionInit } from './db';
import { getDocumentContentsHttp, getDocumentHttp } from './endpoints/document-get';
import { upsertDocumentHttp } from './endpoints/document-upsert';
import { getDocumentsListHttp } from './endpoints/documents-list';
import { startHttpServer } from './http-server';
import { serveAngular } from './serve-angular';

const app = express();


// Serve Angular Client App
const htmlDir = resolve(__dirname, '../client');
serveAngular(app, htmlDir, '/manage');

app.use('/api/*', express.json()); // Used to parse JSON bodies

/** Registered API endpoints. */
app.get('/api/manage/document/:documentId', getDocumentHttp);
app.post('/api/manage/document', upsertDocumentHttp);
app.get('/api/manage/documents', getDocumentsListHttp);
app.get('/api/document/:documentId', getDocumentContentsHttp);

/**
 * Errors renderrer
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // HTTP Response code
  const errCode = (err as any).statusCode || 500;
  res.status(errCode);
  switch (req.accepts(['text', 'json'])) {
    // HTTP Response body
    case 'text':
      res.send('Error: ' + err.message);
      break;
    case 'json':
      res.json({
        error: err.message,
      });
      break;
    default:
      console.error(`Unsupported "${req.accepts(['text', 'json'])}" in error response accepted content type.`);
      // Response in JSON as default
      res.json({
        error: err.message,
      });
  }
  // Display error in console
  console.error(`Error: ${req.method} ${req.baseUrl}${req.path} failed with HTTP ${errCode}. Message: ${err.message}`);
});


(async function main() {
  await dbConnectionInit();
  startHttpServer(app);

})().catch((err: any) => {
  console.error('Main() error: ', err.message);
  console.error('Main() stack: ', err.stack);
});
