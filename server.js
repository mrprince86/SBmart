const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=__dirname, DB=path.join(ROOT,'db.json'), PORT=process.env.PORT||3000;
const DEFAULT={products:[{id:1,name:"Premium Men's T-Shirt",cat:'Male',price:599,img:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=700'},{id:2,name:"Elegant Women's Dress",cat:'Female',price:999,img:'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=700'},{id:3,name:'Kids Casual Wear',cat:'Children',price:499,img:'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=700'},{id:4,name:'Remote Control Toy Car',cat:'Toys',price:799,img:'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=700'},{id:5,name:'Wireless Earbuds',cat:'Electronics',price:1299,img:'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=700'},{id:6,name:'Smart Watch',cat:'Electronics',price:1799,img:'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700'}],orders:[]};
if(!fs.existsSync(DB))fs.writeFileSync(DB,JSON.stringify(DEFAULT,null,2));
const read=()=>JSON.parse(fs.readFileSync(DB)); const write=x=>fs.writeFileSync(DB,JSON.stringify(x,null,2));
const sessions=new Map(); const ADMIN_USER=process.env.SBMART_ADMIN_USER||'admin', ADMIN_PASS=process.env.SBMART_ADMIN_PASS||'SBmart@123';
function cookie(req){return (req.headers.cookie||'').match(/sb_session=([^;]+)/)?.[1]}
function auth(req){return sessions.has(cookie(req))}
function send(res,status,data,type='application/json'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'});res.end(type==='application/json'?JSON.stringify(data):data)}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',d=>s+=d);req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}})})}
function id(){return crypto.randomBytes(12).toString('hex')}
const server=http.createServer(async(req,res)=>{try{
 if(req.method==='OPTIONS')return send(res,204,'');
 if(req.url.startsWith('/api/login')&&req.method==='POST'){let b=await body(req);if(b.username===ADMIN_USER&&b.password===ADMIN_PASS){let t=id();sessions.set(t,Date.now()+8*3600e3);res.setHeader('Set-Cookie',`sb_session=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);return send(res,200,{ok:true})}return send(res,401,{error:'Invalid credentials'})}
 if(req.url==='/api/logout'&&req.method==='POST'){sessions.delete(cookie(req));res.setHeader('Set-Cookie','sb_session=; HttpOnly; Path=/; Max-Age=0');return send(res,200,{ok:true})}
 if(req.url==='/api/products'&&req.method==='GET')return send(res,200,read().products);
if(req.url==='/api/orders'&&req.method==='POST'){let b=await body(req);if(!b.customer||!b.items?.length||!b.total||!b.utr)return send(res,400,{error:'Missing order fields'});let d=read();let order={id:'SB'+Date.now(),date:new Date().toISOString(),customer:b.customer,items:b.items,total:Number(b.total),utr:String(b.utr),status:'Pending Verification'};d.orders.unshift(order);write(d);return send(res,201,{ok:true,orderId:order.id})}
 if(req.url==='/api/admin/products'&&req.method==='GET'){if(!auth(req))return send(res,401,{error:'Unauthorized'});return send(res,200,read().products)}
 if(req.url==='/api/admin/orders'&&req.method==='GET'){if(!auth(req))return send(res,401,{error:'Unauthorized'});return send(res,200,read().orders)}
 if(req.url==='/api/admin/products'&&req.method==='POST'){if(!auth(req))return send(res,401,{error:'Unauthorized'});let b=await body(req),d=read();let p={id:Date.now(),name:String(b.name),cat:String(b.cat),price:Number(b.price),img:String(b.img)};if(!p.name||p.price<=0)return send(res,400,{error:'Invalid product'});d.products.push(p);write(d);return send(res,201,p)}
 let m=req.url.match(/^\/api\/admin\/products\/(\d+)$/);if(m&&req.method==='DELETE'){if(!auth(req))return send(res,401,{error:'Unauthorized'});let d=read();d.products=d.products.filter(p=>p.id!==Number(m[1]));write(d);return send(res,200,{ok:true})}
 m=req.url.match(/^\/api\/admin\/orders\/([^/]+)$/);if(m&&req.method==='PUT'){if(!auth(req))return send(res,401,{error:'Unauthorized'});let b=await body(req),d=read(),o=d.orders.find(x=>x.id===m[1]);if(!o)return send(res,404,{error:'Order not found'});o.status=String(b.status);if(o.status==='Payment Verified')o.verifiedAt=new Date().toISOString();write(d);return send(res,200,o)}
 if(req.url==='/api/admin/me'&&req.method==='GET')return send(res,200,{authenticated:auth(req)});
 let file=req.url==='/'?'/index.html':req.url;file=path.normalize(file).replace(/^\.\.(\/|\\)/,'');let fp=path.join(ROOT,file);if(fs.existsSync(fp)&&fs.statSync(fp).isFile()){let ext=path.extname(fp),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};return send(res,200,fs.readFileSync(fp),types[ext]||'application/octet-stream')}send(res,404,{error:'Not found'});
}catch(e){console.error(e);send(res,500,{error:'Server error'})}});
server.listen(PORT,()=>console.log(`SBmart running on http://localhost:${PORT}`));
