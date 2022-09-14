import { Express } from 'express';

/** Start HTTP Webserver */
export function startHttpServer(app: Express) {
  const httpServer = app.listen(3000, () => {
    console.log(`Server is running at http://0.0.0.0:3000`);
  });
  httpServer.on('close', () => { console.info('HTTP WebServer closed.'); });
}
