import { terrainResponse } from '../worker/terrain.js';
import { sendWebResponse, toWebRequest } from './_lib/nodeRequest.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  try {
    const response = await terrainResponse(await toWebRequest(req));
    await sendWebResponse(response, res);
  } catch {
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Elevation request timed out or failed' }));
    }
  }
}
