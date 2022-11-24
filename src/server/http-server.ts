import { Express } from 'express';
import { Server } from 'http';

let httpServer: Server | undefined;

/** Start HTTP webserver */
export function startHttpServer(app: Express) {
  if (httpServer) {
    throw new Error('Webserver is already running.');
  }

  httpServer = app.listen(3000, () => {
    console.log(`Server is running at http://0.0.0.0:3000`);
  });
  httpServer.on('close', () => { console.info('HTTP webserver closed.'); });
}

function stopHttpServer() {
  console.log('Stopping HTTP webserver ...');
  if (httpServer) {
    httpServer.close();
    httpServer = undefined;
  }

  if (!httpServer) {
    console.log('HTTP webserver is already stopped.');
    // process.exit(1);
  }
}

/** Stop webserver on terminal signals (by docker container stop) */
process.on('SIGINT', stopHttpServer );
process.on('SIGTERM', stopHttpServer );