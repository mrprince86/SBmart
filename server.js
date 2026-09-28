const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=__dirname,DB=path.join(ROOT,'db.json'),PORT=process.env.PORT||3000,STORE_NAME='SBmart';
const DEFAULT={products:[
{id:1,name:"Premium Men's T-Shirt",cat:'Male',price:599,img:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=700'},
{id:2,name:"Elegant Women's Dress",cat:'Female',price:999,img:'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=700'},
{id:3,name:'Kids Casual Wear',cat:'Children',price:499,img:'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=700'},
{id:4,name:'Remote Control Toy Car',cat:'Toys',price:799,img:'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=700'},
{id:5,name:'Wireless Earbuds',cat:'Electronics',price:1299,img:'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=700'},
{id:6,name:'Smart Watch',cat:'Electronics',price:1799,img:'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700'}],orders:[],users:[]};
if(!fs.existsSync(DB))fs.writeFileSync(DB,JSON.stringify(DEFAULT,null,2));
const read=()=>JSON.parse(fs.readFileSync(DB));const write=x=>fs.writeFileSync(DB,JSON.stringify(x,null,2));
const sessions=new Map();
const ADMIN_USER=process.env.SBMART_ADMIN_USER||'admin@sbmart.com',ADMIN_PASS=process.env.SBMART_ADMIN_PASS||'SBmart@123';
const hash=p=>crypto.createHash('sha256').update(String(p)).digest('hex');
const cookie=req=>(req.headers.cookie||'').match(/sb_session=([^;]+)/)?.[1];
function session(req){const s=sessions.get(cookie(req));if(!s||s.expires<Date.now()){if(s)sessions.delete(cookie(req));return null}return s}
function adminAuth(req){return session(req)?.type==='admin'}
function customerAuth(req){return session(req)?.type==='customer'}
function send(res,status,data,type='application/json'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'});res.end(type==='application/json'?JSON.stringify(data):data)}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',d=>s+=d);req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}})})}
const id=()=>crypto.randomBytes(16).toString('hex');
const setSession=(res,type,userId,email)=>{const t=id();sessions.set(t,{type,userId,email,expires:Date.now()+8*3600e3});res.setHeader('Set-Cookie',`sb_session=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`)};
const clearSession=res=>res.setHeader('Set-Cookie','sb_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
const server=http.createServer(async(req,res)=>{try{
if(req.method==='OPTIONS')return send(res,204,'');
if(req.url==='/api/register'&&req.method==='POST'){
 let b=await body(req),email=String(b.email??'').trim().toLowerCase(),password=String(b.password??''),name=String(b.name??'').trim(),mobile=String(b.mobile??'').trim();
 if(!name||!email||!password)return send(res,400,{error:'Name, email and password are required'});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return send(res,400,{error:'Enter a valid email'});
 if(password.length<6)return send(res,400,{error:'Password must be at least 6 characters'});
 if(mobile&&!/^\d{10}$/.test(mobile))return send(res,400,{error:'Enter a valid 10-digit mobile number'});
 let d=read();if(!d.users)d.users=[];if(d.users.some(u=>u.email===email))return send(res,409,{error:'An account with this email already exists'});
 const user={id:id(),name,email,passwordHash:hash(password),mobile,createdAt:new Date().toISOString()};d.users.push(user);write(d);return send(res,201,{ok:true});
}
if(req.url==='/api/customer/login'&&req.method==='POST'){
 let b=await body(req),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');let d=read(),u=(d.users||[]).find(x=>x.email===email);
 if(!u||u.passwordHash!==hash(password))return send(res,401,{error:'Invalid email or password'});setSession(res,'customer',u.id,u.email);return send(res,200,{ok:true});
}
if(req.url==='/api/customer/logout'&&req.method==='POST'){const s=session(req);if(s&&s.type==='customer')sessions.delete(cookie(req));clearSession(res);return send(res,200,{ok:true})}
if(req.url==='/api/customer/me'&&req.method==='GET'){const s=session(req);if(!s||s.type!=='customer')return send(res,200,{authenticated:false});let u=(read().users||[]).find(x=>x.id===s.userId);if(!u)return send(res,200,{authenticated:false});return send(res,200,{authenticated:true,user:{id:u.id,name:u.name,email:u.email,mobile:u.mobile||'',address:u.address||''}})}
if(req.url==='/api/customer/orders'&&req.method==='GET'){const s=session(req);if(!s||s.type!=='customer')return send(res,401,{error:'Login required'});return send(res,200,read().orders.filter(o=>o.userId===s.userId))}
if(req.url.startsWith('/api/login')&&req.method==='POST'){let b=await body(req);if(b.username===ADMIN_USER&&b.password===ADMIN_PASS){setSession(res,'admin','admin',ADMIN_USER);return send(res,200,{ok:true})}return send(res,401,{error:'Invalid credentials'})}
if(req.url==='/api/logout'&&req.method==='POST'){sessions.delete(cookie(req));clearSession(res);return send(res,200,{ok:true})}
if(req.url==='/api/products'&&req.method==='GET')return send(res,200,read().products);
if(req.url==='/api/orders'&&req.method==='POST'){
 const s=session(req);if(!s||s.type!=='customer')return send(res,401,{error:'Please create an account and login before checkout'});
 let b=await body(req);if(!b.items?.length||!b.utr)return send(res,400,{error:'Missing order fields'});
 let d=read(),u=(d.users||[]).find(x=>x.id===s.userId);if(!u)return send(res,401,{error:'Account not found'});
 let c=b.customer||{};if(!c.name||!c.mobile||!c.address)return send(res,400,{error:'Name, mobile and delivery address are required'});if(!/^\d{10}$/.test(String(c.mobile)))return send(res,400,{error:'Enter a valid 10-digit mobile number'});
 let order={id:'SB'+Date.now(),date:new Date().toISOString(),userId:u.id,customer:{name:String(c.name),mobile:String(c.mobile),address:String(c.address)},items:b.items,total:Number(b.total)||0,utr:String(b.utr),status:'Pending Verification'};d.orders.unshift(order);
 u.name=String(c.name);u.mobile=String(c.mobile);u.address=String(c.address);write(d);return send(res,201,{ok:true,orderId:order.id});
}
if(req.url==='/api/admin/products'&&req.method==='GET'){if(!adminAuth(req))return send(res,401,{error:'Unauthorized'});return send(res,200,read().products)}
if(req.url==='/api/admin/orders'&&req.method==='GET'){if(!adminAuth(req))return send(res,401,{error:'Unauthorized'});return send(res,200,read().orders)}
if(req.url==='/api/admin/products'&&req.method==='POST'){if(!adminAuth(req))return send(res,401,{error:'Unauthorized'});let b=await body(req),d=read();let p={id:Date.now(),name:String(b.name),cat:String(b.cat),price:Number(b.price),img:String(b.img)};if(!p.name||p.price<=0)return send(res,400,{error:'Invalid product'});d.products.push(p);write(d);return send(res,201,p)}
let m=req.url.match(/^\/api\/admin\/products\/(\d+)$/);if(m&&req.method==='DELETE'){if(!adminAuth(req))return send(res,401,{error:'Unauthorized'});let d=read();d.products=d.products.filter(p=>p.id!==Number(m[1]));write(d);return send(res,200,{ok:true})}
m=req.url.match(/^\/api\/admin\/orders\/([^/]+)$/);if(m&&req.method==='PUT'){if(!adminAuth(req))return send(res,401,{error:'Unauthorized'});let b=await body(req),d=read(),o=d.orders.find(x=>x.id===m[1]);if(!o)return send(res,404,{error:'Order not found'});o.status=String(b.status);if(o.status==='Payment Verified')o.verifiedAt=new Date().toISOString();write(d);return send(res,200,o)}
if(req.url==='/api/admin/me'&&req.method==='GET')return send(res,200,{authenticated:adminAuth(req)});
let file=req.url==='/'?'/index.html':req.url;file=path.normalize(file).replace(/^\.\.(\/|\\)/,'');let fp=path.join(ROOT,file);if(fs.existsSync(fp)&&fs.statSync(fp).isFile()){let ext=path.extname(fp),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};return send(res,200,fs.readFileSync(fp),types[ext]||'application/octet-stream')}
send(res,404,{error:'Not found'})
}catch(e){console.error(e);send(res,500,{error:'Server error'})}});
server.listen(PORT,()=>console.log(`${STORE_NAME} running on ${PORT}`));
