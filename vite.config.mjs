import {defineConfig} from 'vite';
import {terrainResponse} from './worker/terrain.js';
export default defineConfig({plugins:[{name:'terrain-api',configureServer(server){server.middlewares.use('/api/terrain',async(req,res)=>{const response=await terrainResponse(new Request('http://localhost/api/terrain'+(req.url?.includes('?')?req.url.slice(req.url.indexOf('?')):''),{method:req.method}));res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(await response.text())})}}]});
