const PRODUCTS = {
  "Classic Silver": { price: 6999, colors: ["Silver", "Black", "Gold"] },
  "Midnight Black": { price: 7499, colors: ["Black", "Silver", "Rose Gold"] },
  "Royal Chronograph": { price: 8999, colors: ["Silver", "Black", "Gold"] },
  "Heritage Gold": { price: 8299, colors: ["Gold", "Two-Tone", "Black"] },
  "Urban Steel": { price: 6499, colors: ["Silver", "Black", "Blue"] },
  "Royal Rose": { price: 8499, colors: ["Rose Gold", "Gold", "Silver"] },
  "Sport Velocity": { price: 7999, colors: ["Black", "Blue", "Silver"] },
  "Heritage Brown": { price: 6999, colors: ["Brown", "Black", "Gold"] },
  "Slate Chronograph": { price: 9499, colors: ["Slate", "Black", "Silver"] },
  "Ivory Minimal": { price: 5999, colors: ["Ivory", "Black", "Rose Gold"] },
  "Noir Dress": { price: 8999, colors: ["Black", "Gold", "Silver"] },
  "Ocean Steel": { price: 7799, colors: ["Blue", "Silver", "Black"] }
};

const SESSION_COOKIE = "veron_admin_session";
const SESSION_SECONDS = 28800;
const ALLOWED_STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"];

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodeBase64url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function signSession(payload, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64url(new TextEncoder().encode(payload)) + "." + base64url(new Uint8Array(signature));
}
async function verifySession(request, secret) {
  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookie = cookieHeader.split(";").map(v => v.trim()).find(v => v.startsWith(SESSION_COOKIE + "="));
    if (!cookie) return false;
    const parts = cookie.substring(SESSION_COOKIE.length + 1).split(".");
    if (parts.length !== 2) return false;
    const payload = new TextDecoder().decode(decodeBase64url(parts[0]));
    const session = JSON.parse(payload);
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return false;
    const expected = await signSession(payload, secret);
    const a = decodeBase64url(parts[1]), b = decodeBase64url(expected.split(".")[1]);
    if (a.length !== b.length) return false;
    let difference = 0;
    for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
    return difference === 0;
  } catch { return false; }
}
function cookieHeader(token) {
  return SESSION_COOKIE + "=" + token + "; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=" + SESSION_SECONDS;
}
function clearCookieHeader() {
  return SESSION_COOKIE + "=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0";
}
function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
function loginPage() {
  return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VÉRON Admin</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#11110f;color:#eee;font-family:Arial;padding:20px}.panel{width:100%;max-width:380px;background:#f8f5ee;color:#171713;padding:38px;box-shadow:0 20px 70px #0008}.brand{text-align:center;font:30px Georgia;letter-spacing:6px;color:#a78a5b}.sub{text-align:center;font-size:10px;letter-spacing:3px;margin:8px 0 30px;color:#777}h2{font:24px Georgia;font-weight:400;text-align:center}input,button{width:100%;padding:14px;margin-top:14px}input{border:1px solid #ddd;background:white}button{border:0;background:#171713;color:white;letter-spacing:2px;cursor:pointer}</style></head><body><form class="panel" method="POST" action="/admin/login"><div class="brand">VÉRON</div><div class="sub">TIMELESS BY DESIGN</div><h2>Admin access</h2><input type="password" name="password" placeholder="Admin password" required><button>LOG IN</button></form></body></html>`, { headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" } });
}
function dashboardPage() {
  return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VÉRON — Orders</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f1e9;color:#222;font-family:Arial}header{background:#141410;color:#eee;padding:20px 5%;display:flex;justify-content:space-between;align-items:center}header strong{font:23px Georgia;letter-spacing:4px;color:#c4a575}.logout{border:1px solid #9e895f;background:transparent;color:#eee;padding:10px 15px;cursor:pointer}main{max-width:1100px;margin:32px auto;padding:0 18px}.intro{display:flex;justify-content:space-between;align-items:end;gap:15px;margin-bottom:22px}.intro h1{font:34px Georgia;font-weight:400;margin:0 0 8px}.muted{font-size:12px;color:#777}.stats{display:flex;gap:12px}.stat,.order{background:white;border:1px solid #e4dfd5;padding:18px}.stat strong{display:block;font:25px Georgia;margin-top:7px}.orders{display:grid;gap:13px}.order-head{display:flex;justify-content:space-between;gap:15px;align-items:center;border-bottom:1px solid #eee;padding-bottom:12px}.order-head h3{font:20px Georgia;margin:0}.ref{font-size:11px;color:#92774c}.order p{font-size:12px;line-height:1.65;margin:8px 0;overflow-wrap:anywhere}.order-bottom{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}.status{padding:10px;border:1px solid #ddd;background:white}.update{padding:11px 16px;background:#171713;color:white;border:0;cursor:pointer}.message{font-size:12px;color:#6e5a39;margin:12px 0}@media(max-width:600px){.intro{display:block}.stats{margin-top:15px}.order{padding:14px}header{padding:17px 5%}}</style></head><body><header><strong>VÉRON <span style="font:10px Arial;letter-spacing:2px;color:#aaa">ADMIN</span></strong><button class="logout" id="logout">LOG OUT</button></header><main><div class="intro"><div><h1>Order management</h1><div class="muted">Review customer orders and update fulfilment status.</div></div><div class="stats"><div class="stat"><span class="muted">TOTAL ORDERS</span><strong id="count">—</strong></div></div></div><div id="message" class="message">Loading orders…</div><div class="orders" id="orders"></div></main><script>
const box=document.getElementById("orders"),message=document.getElementById("message"),count=document.getElementById("count");
const money=n=>"Rs. "+Number(n).toLocaleString("en-PK");
function line(parent,label,value){const p=document.createElement("p");p.textContent=label+": "+value;parent.appendChild(p)}
async function load(){message.textContent="Loading orders…";box.replaceChildren();try{const r=await fetch("/admin/api/orders",{credentials:"same-origin"});if(r.status===401){location.href="/admin";return}if(!r.ok)throw new Error("Could not load orders.");const data=await r.json();count.textContent=data.orders.length;if(!data.orders.length){message.textContent="No orders received yet.";return}message.textContent="";data.orders.forEach(o=>{const card=document.createElement("article");card.className="order";const head=document.createElement("div");head.className="order-head";const h=document.createElement("h3");h.textContent="Order "+o.order_ref;const ref=document.createElement("span");ref.className="ref";ref.textContent=o.status;head.append(h,ref);card.appendChild(head);line(card,"Customer",o.customer_name);line(card,"Phone",o.phone);line(card,"City",o.city);line(card,"Address",o.address);line(card,"Items",(o.items||[]).map(x=>{const qty=Number(x.quantity)||1;return x.name+" · "+(x.color||"Finish not recorded")+" × "+qty+" — "+money(Number(x.price||0)*qty)}).join(" | "));line(card,"Total",money(o.total));line(card,"Placed",o.created_at);const controls=document.createElement("div");controls.className="order-bottom";const select=document.createElement("select");select.className="status";["Pending","Confirmed","Shipped","Delivered","Cancelled"].forEach(s=>{const op=document.createElement("option");op.value=s;op.textContent=s;select.appendChild(op)});select.value=o.status;const btn=document.createElement("button");btn.className="update";btn.textContent="UPDATE STATUS";btn.onclick=async()=>{btn.disabled=true;try{const x=await fetch("/admin/api/status",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:o.id,status:select.value})});if(x.status===401){location.href="/admin";return}if(!x.ok)throw new Error("Update failed.");ref.textContent=select.value;message.textContent="Order status updated."}catch(e){message.textContent=e.message}finally{btn.disabled=false}};controls.append(select,btn);card.appendChild(controls);box.appendChild(card)})}catch(e){message.textContent=e.message}}
document.getElementById("logout").onclick=async()=>{await fetch("/admin/logout",{method:"POST",credentials:"same-origin"});location.href="/admin"};load();
</script></body></html>`, { headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/order" && request.method === "POST") {
      try {
        const data = await request.json();
        const customerName = String(data.customer_name || "").trim();
        const phone = String(data.phone || "").trim();
        const city = String(data.city || "").trim();
        const address = String(data.address || "").trim();
        const items = data.items;
        if (!customerName || customerName.length > 100 || !phone || phone.length > 25 ||
            !city || city.length > 60 || !address || address.length > 500 ||
            !Array.isArray(items) || items.length < 1 || items.length > 30) {
          return jsonResponse({ success: false, message: "Please enter valid order details." }, 400);
        }
        const verifiedItems = [];
        for (const item of items) {
          const name = String(item.name || "");
          const color = String(item.color || "");
          const product = PRODUCTS[name];
          const quantity = Number(item.quantity);
          if (!product || !product.colors.includes(color) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
            return jsonResponse({ success: false, message: "Invalid product, finish or quantity in your order." }, 400);
          }
          verifiedItems.push({ name, color, price: product.price, quantity });
        }
        const total = verifiedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const id = crypto.randomUUID();
        await env.DB.prepare(`INSERT INTO orders (id, customer_name, phone, city, address, items_json, total) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, customerName, phone, city, address, JSON.stringify(verifiedItems), total).run();
        return jsonResponse({ success: true, message: "Your order has been placed successfully.", order_id: id, order_ref: "VR-" + id.slice(0, 6).toUpperCase(), total });
      } catch (error) {
        return jsonResponse({ success: false, message: "Unable to place your order. Please try again." }, 500);
      }
    }

    if (url.pathname === "/admin/login" && request.method === "POST") {
      if (!env.ADMIN_PASSWORD) return new Response("Admin password is not configured.", { status: 500 });
      try {
        const formData = await request.formData();
        const password = formData.get("password");
        if (typeof password !== "string" || password !== env.ADMIN_PASSWORD) {
          return new Response("Invalid password. Please go back and try again.", { status: 401, headers: { "Content-Type": "text/plain" } });
        }
        const payload = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS, nonce: crypto.randomUUID() });
        const token = await signSession(payload, env.ADMIN_PASSWORD);
        return new Response(null, { status: 303, headers: { "Location": "/admin/dashboard", "Set-Cookie": cookieHeader(token), "Cache-Control": "no-store" } });
      } catch (error) { return new Response("Login failed. Please try again.", { status: 500 }); }
    }
    if (url.pathname === "/admin" && request.method === "GET") return loginPage();
    if (url.pathname === "/admin/logout" && request.method === "POST") {
      return new Response(null, { status: 303, headers: { "Location": "/admin", "Set-Cookie": clearCookieHeader(), "Cache-Control": "no-store" } });
    }

    if (url.pathname.startsWith("/admin/")) {
      if (!env.ADMIN_PASSWORD || !(await verifySession(request, env.ADMIN_PASSWORD))) {
        return jsonResponse({ success: false, message: "Please log in." }, 401);
      }
      if (url.pathname === "/admin/dashboard" && request.method === "GET") return dashboardPage();
      if (url.pathname === "/admin/api/orders" && request.method === "GET") {
        try {
          const result = await env.DB.prepare(`SELECT id, customer_name, phone, city, address, items_json, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 200`).all();
          const orders = (result.results || []).map(order => {
            let items = [];
            try { items = JSON.parse(order.items_json || "[]"); } catch { items = []; }
            return { id: order.id, order_ref: "VR-" + order.id.slice(0, 6).toUpperCase(), customer_name: order.customer_name, phone: order.phone, city: order.city, address: order.address, items, total: order.total, status: order.status, created_at: order.created_at };
          });
          return jsonResponse({ success: true, orders });
        } catch (error) { return jsonResponse({ success: false, message: "Unable to load orders." }, 500); }
      }
      if (url.pathname === "/admin/api/status" && request.method === "POST") {
        try {
          const data = await request.json();
          const id = String(data.id || ""), status = String(data.status || "");
          if (!id || id.length > 100 || !ALLOWED_STATUSES.includes(status)) return jsonResponse({ success: false, message: "Invalid order or status." }, 400);
          const existing = await env.DB.prepare("SELECT id FROM orders WHERE id = ?").bind(id).first();
          if (!existing) return jsonResponse({ success: false, message: "Order not found." }, 404);
          await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(status, id).run();
          return jsonResponse({ success: true, message: "Order status updated." });
        } catch (error) { return jsonResponse({ success: false, message: "Unable to update order status." }, 500); }
      }
      return new Response("Admin page not found.", { status: 404 });
    }
    return env.ASSETS.fetch(request);
  }
};
