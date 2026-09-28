const UPI_ID="mrsunnykumar@ptaxis";
const STORE_NAME="SBmart";
let products=[],cart=JSON.parse(localStorage.getItem("sbmart_cart")||"[]"),current="All",customer=null;
const productsEl=document.getElementById("products");
const saveCart=()=>localStorage.setItem("sbmart_cart",JSON.stringify(cart));
async function api(url,opt={}){const r=await fetch(url,opt);let x={};try{x=await r.json()}catch(e){}if(!r.ok)throw Error(x.error||"Request failed");return x}
async function loadProducts(){try{products=await api('/api/products');render()}catch(e){toast('Could not load products')}}
async function loadCustomer(){try{customer=await api('/api/customer/me');updateAuthArea();if(customer.authenticated)prefillCustomer()}catch(e){}}
function updateAuthArea(){const el=document.getElementById('authArea');if(!el)return;if(customer?.authenticated){el.innerHTML=`<a class="authLink" href="orders.html">My Orders</a><a class="authLink" href="contact.html">Customer Service</a><button class="authLink dark" onclick="logoutCustomer()">Logout</button>`}else{el.innerHTML=`<a class="authLink" href="register.html">Create Account</a><a class="authLink dark" href="login.html">Login</a>`}}
async function logoutCustomer(){try{await api('/api/customer/logout',{method:'POST'});location.reload()}catch(e){toast('Logout failed')}}
function cat(c,el){current=c;document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));el.classList.add("active");render()}
function render(){const q=(document.getElementById("search")?.value||"").toLowerCase();const a=products.filter(p=>(current==="All"||p.cat===current)&&p.name.toLowerCase().includes(q));if(!productsEl)return;document.getElementById("result").textContent=a.length+" products";productsEl.innerHTML=a.map((p,i)=>`<article class="card" style="animation-delay:${i*45}ms"><div class="pic"><img src="${p.img}" loading="lazy" onerror="this.src='https://placehold.co/600x600?text=SBmart'"></div><p class="cat">${p.cat}</p><h3>${p.name}</h3><div class="price">₹${Number(p.price).toLocaleString('en-IN')}</div><button class="add" onclick="add(${p.id})">Add to Cart</button></article>`).join('')||'<p>No products found.</p>'}
function add(id){const p=products.find(x=>x.id===id);if(!p)return;if(!customer?.authenticated){toast('Please create an account first');setTimeout(()=>location.href='register.html?next=cart',500);return}const item=cart.find(x=>x.id===id);item?item.qty++:cart.push({...p,qty:1});saveCart();updateCount();toast('✓ Product added to cart')}
function updateCount(){const n=cart.reduce((s,x)=>s+x.qty,0),el=document.getElementById('cartCount');if(el)el.textContent=n}
function cartTotal(){return cart.reduce((s,x)=>s+x.price*x.qty,0)}
function openCart(){document.getElementById('cartModal').style.display='block';let sum=0;document.getElementById('cartItems').innerHTML=cart.map((p,i)=>{sum+=p.price*p.qty;return `<div class="row"><img src="${p.img}"><div class="grow"><b>${p.name}</b><br><small>₹${p.price.toLocaleString('en-IN')} × ${p.qty}</small></div><div class="qty"><button onclick="changeQty(${i},-1)">−</button><b>${p.qty}</b><button onclick="changeQty(${i},1)">+</button></div><button class="remove" onclick="removeItem(${i})">×</button></div>`}).join('')||'<p>Your cart is empty.</p>';document.getElementById('total').textContent=sum.toLocaleString('en-IN')}
function changeQty(i,d){cart[i].qty+=d;if(cart[i].qty<=0)cart.splice(i,1);saveCart();updateCount();openCart()}
function removeItem(i){cart.splice(i,1);saveCart();openCart();updateCount()}
function closeCart(){document.getElementById('cartModal').style.display='none'}
async function openPayment(){
  if(!cart.length)return toast('Cart is empty');
  if(!customer?.authenticated){closeCart();toast('Please create an account first');setTimeout(()=>location.href='register.html?next=checkout',700);return}
  closeCart();document.getElementById('payModal').style.display='block';
  const amount=cartTotal();document.getElementById('payAmount').textContent=amount.toLocaleString('en-IN');
  const uri=`upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(STORE_NAME)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('SBmart Order')}`;
  const qr=document.getElementById('qrcode');qr.innerHTML='';new QRCode(qr,{text:uri,width:210,height:210,correctLevel:QRCode.CorrectLevel.M});
  document.getElementById('upiId').textContent=UPI_ID;prefillCustomer();
}
function prefillCustomer(){if(!customer?.authenticated)return;const u=customer.user;document.getElementById('customerName').value=u.name||'';document.getElementById('customerMobile').value=u.mobile||'';document.getElementById('customerAddress').value=u.address||''}
function closePay(){document.getElementById('payModal').style.display='none'}
async function confirmOrder(){
  const utr=document.getElementById('utr').value.trim(),name=document.getElementById('customerName').value.trim(),mobile=document.getElementById('customerMobile').value.trim(),address=document.getElementById('customerAddress').value.trim();
  if(!customer?.authenticated){closePay();return location.href='login.html?next=checkout'}
  if(!name||!mobile||!address)return toast('Name, mobile and delivery address are required');
  if(!/^\d{10}$/.test(mobile))return toast('Enter a valid 10-digit mobile number');
  if(!utr)return toast('Please enter UTR / Transaction ID');
  try{const x=await api('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer:{name,mobile,address},items:cart,total:cartTotal(),utr})});cart=[];saveCart();updateCount();closePay();document.getElementById('utr').value='';toast('✓ Order '+x.orderId+' submitted for verification');setTimeout(openOrders,700)}catch(e){toast(e.message||'Order submission failed')}
}
async function openOrders(){if(!customer?.authenticated){location.href='login.html';return}document.getElementById('ordersModal').style.display='block';const box=document.getElementById('ordersList');box.innerHTML='<p class="muted">Loading orders...</p>';try{const orders=await api('/api/customer/orders');box.innerHTML=orders.length?orders.map(o=>`<div class="orderCard"><b>${o.id}</b><span>${new Date(o.date).toLocaleString()}</span><p>₹${Number(o.total).toLocaleString('en-IN')} • ${o.status}</p><small>${o.items.map(i=>`${i.name} × ${i.qty}`).join('<br>')}</small></div>`).join(''):'<p class="muted">No orders yet.</p>'}catch(e){box.innerHTML='<p>Could not load order history.</p>'}}
function closeOrders(){document.getElementById('ordersModal').style.display='none'}
function toast(msg){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
window.addEventListener('load',()=>{setTimeout(()=>document.getElementById('loader')?.classList.add('hide'),650);loadProducts();updateCount();loadCustomer()});
