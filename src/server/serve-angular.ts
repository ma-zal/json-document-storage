import express, { Application } from 'express';
import path from 'path';

export function serveAngular(app: Application, htmlDir: string, basePath: string) {
  app.use(basePath, express.static(htmlDir));
  // Serve Angular HTML5 routes
  app.get(angularAllRoutes(basePath), (req, res) => {
    res.sendFile(path.join(htmlDir, 'index.html'));
  });
  // Redirect root to app
  app.get(/^\/$/, (req, res) => { res.redirect(basePath + '/'); });
}

/**
 * Generates regExp that matches all Angular HTML5 paths.
 */
 export function angularAllRoutes(appBasehref: string) {
  return new RegExp(`^\/${appBasehref}(\/[a-zA-Z0-9/_-]*)?$`);
}
