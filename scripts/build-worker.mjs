import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const assets={};
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(path.resolve(f)===path.resolve('dist/server'))continue;if(e.isDirectory())walk(f);else {const ext=path.extname(f),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'}[ext]||'application/octet-stream';assets['/'+path.relative('dist',f).replaceAll('\\','/')]=[mime,readFileSync(f).toString('base64')]}}}
walk('dist');
const runtime=readFileSync('worker/terrain.js','utf8').replace('export async function','async function');
const chatRuntime=readFileSync('worker/chat.js','utf8').replace('export async function','async function');
mkdirSync('dist/server',{recursive:true});
writeFileSync('dist/server/index.js',runtime+'\n'+chatRuntime+'\nconst assets='+JSON.stringify(assets)+`;export default {async fetch(request,env){const u=new URL(request.url);if(u.pathname==='/api/terrain')return terrainResponse(request);if(u.pathname==='/api/chat')return chatResponse(request,env);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const a=assets[u.pathname==='/'?'/index.html':u.pathname];if(!a)return new Response('Not found',{status:404});return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(a[1]),c=>c.charCodeAt(0)),{headers:{'Content-Type':a[0],'Cache-Control':u.pathname.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache'}})}};`);
