import { chatResponse } from '../worker/chat.js';
import { sendWebResponse, toWebRequest } from './_lib/nodeRequest.js';

export const config = { api: { bodyParser: false }, maxDuration: 60 };

export default async function handler(req, res) {
  try {
    const response = await chatResponse(await toWebRequest(req), process.env);
    await sendWebResponse(response, res);
  } catch {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { code: 'unavailable' } }));
    }
  }
}
