import express, { Application } from 'express';
import path from 'path';

/**
 * 
 * @param app 
 * @param htmlDir 
 * @param baseHref - must be with '/' on begin and wihout on the end. @example `/client`
 */
export function serveAngular(app: Application, htmlDir: string, baseHref: string) {
  if (!baseHref.length || baseHref[0] !== '/') {
    throw new Error(`Invalid baseHred "${baseHref}". It must to start with "/" characted.`);
  }
  app.use(baseHref, express.static(htmlDir));
  // Serve Angular HTML5 routes
  app.get(angularAllRoutes(baseHref), (req, res) => {
    res.sendFile(path.join(htmlDir, 'index.html'));
  });
  // Redirect root to app
  app.get(/^\/$/, (req, res) => { res.redirect(baseHref + '/'); });
}

/**
 * Generates regExp that matches all Angular HTML5 paths.
 */
export function angularAllRoutes(appBasehref: string) {
  return new RegExp(`^${appBasehref}(\/[a-zA-Z0-9/_-]*)?$`);
}
