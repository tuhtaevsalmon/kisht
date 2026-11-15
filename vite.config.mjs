import {defineConfig,loadEnv} from 'vite';
import {terrainResponse} from './worker/terrain.js';
import {chatResponse} from './worker/chat.js';
import {surfaceResponse} from './worker/surface.js';

async function sendWorkerResponse(response,res){
 res.statusCode=response.status;
 response.headers.forEach((value,key)=>res.setHeader(key,value));
 res.end(await response.text());
}

export default defineConfig(({mode})=>{
 const env={...loadEnv(mode,process.cwd(),''),...process.env};
 return {plugins:[{name:'kisht-api',configureServer(server){
  server.middlewares.use('/api/terrain',async(req,res)=>{
   const response=await terrainResponse(new Request('http://localhost/api/terrain'+(req.url?.includes('?')?req.url.slice(req.url.indexOf('?')):''),{method:req.method}));
   await sendWorkerResponse(response,res);
  });
  server.middlewares.use('/api/surface',async(req,res)=>{
   const controller=new AbortController();
   const abort=()=>controller.abort();
   req.once('aborted',abort);res.once('close',abort);
   try{
    const method=req.method||'GET';
    const path=req.originalUrl||('/api/surface'+(req.url?.includes('?')?req.url.slice(req.url.indexOf('?')):''));
    const init={method,headers:req.headers,signal:controller.signal};
    if(!['GET','HEAD'].includes(method)){init.body=req;init.duplex='half';}
    const response=await surfaceResponse(new Request(`http://${req.headers.host||'localhost'}${path}`,init));
    if(!controller.signal.aborted)await sendWorkerResponse(response,res);
   }catch{
    if(!res.headersSent){res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Surface request failed'}));}
   }finally{req.off('aborted',abort);res.off('close',abort)}
  });
  server.middlewares.use('/api/chat',async(req,res)=>{
   const controller=new AbortController();
   const abort=()=>controller.abort();
   req.once('aborted',abort);res.once('close',abort);
   try{
    const method=req.method||'GET';
    const path=req.originalUrl||('/api/chat'+(req.url?.includes('?')?req.url.slice(req.url.indexOf('?')):''));
    const init={method,headers:req.headers,signal:controller.signal};
    if(!['GET','HEAD'].includes(method)){init.body=req;init.duplex='half';}
    const response=await chatResponse(new Request(`http://${req.headers.host||'localhost'}${path}`,init),env);
    if(!controller.signal.aborted)await sendWorkerResponse(response,res);
   }catch{
    if(!res.headersSent){res.statusCode=500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:{code:'unavailable'}}));}
   }finally{req.off('aborted',abort);res.off('close',abort)}
  });
 }}]};
});
