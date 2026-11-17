
const PRODUCTS = {
  "Classic Silver": 6999,
  "Midnight Black": 7499,
  "Royal Chronograph": 8999
};

const SESSION_COOKIE = "veron_admin_session";
const SESSION_SECONDS = 28800;

const ALLOWED_STATUSES = [
  "Pending",
  "Confirmed",
  "Shipped",
  "Delivered",
  "Cancelled"
];

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function signSession(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  return base64url(new TextEncoder().encode(payload)) +
    "." + base64url(new Uint8Array(signature));
}

async function verifySession(request, secret) {
  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookie = cookieHeader.split(";")
      .map(v => v.trim())
      .find(v => v.startsWith(SESSION_COOKIE + "="));

    if (!cookie) return false;

    const token = cookie.substring(SESSION_COOKIE.length + 1);
    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const payload = new TextDecoder().decode(
      decodeBase64url(parts[0])
    );

    const session = JSON.parse(payload);

    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }

    const expected = await signSession(payload, secret);
    const expectedSignature = expected.split(".")[1];

    const a = decodeBase64url(parts[1]);
    const b = decodeBase64url(expectedSignature);

    if (a.length !== b.length) return false;

    let difference = 0;
    for (let i = 0; i < a.length; i++) {
      difference |= a[i] ^ b[i];
    }

    return difference === 0;
  } catch {
    return false;
  }
}

function cookieHeader(token) {
  return SESSION_COOKIE + "=" + token +
    "; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=" +
    SESSION_SECONDS;
}

function clearCookieHeader() {
  return SESSION_COOKIE +
    "=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0";
}

function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function loginPage() {
  return new Response(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VÉRON Admin Login</title>
<style>
*{box-sizing:border-box}
body{font-family:Arial;background:#f5f5f5;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}
.login{background:white;padding:35px;width:100%;max-width:360px;text-align:center;box-shadow:0 5px 25px #ddd}
h2{letter-spacing:3px}
input,button{width:100%;padding:14px;margin-top:16px}
input{border:1px solid #ccc}
button{background:#171717;color:white;border:0;cursor:pointer}
</style>
</head>
<body>
<div class="login">
<h2>VÉRON WATCHES</h2>
<p>Admin Login</p>
<form method="POST" action="/admin/login">
<input type="password" name="password" placeholder="Enter Admin Password" required>
<button type="submit">LOGIN</button>
</form>
</div>
</body>
</html>`, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}

function dashboardPage() {
  return new Response(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VÉRON Admin Dashboard</title>
<style>
*{box-sizing:border-box}
body{font-family:Arial;background:#f5f5f5;margin:0;color:#222}
header{background:#171717;color:white;padding:20px;display:flex;justify-content:space-between;align-items:center;gap:12px}
header h2{font-size:19px;letter-spacing:2px;margin:0}
button{cursor:pointer;border:0;padding:11px 16px}
.logout{background:white;color:#171717}
main{max-width:1000px;margin:25px auto;padding:0 15px}
.summary{background:white;padding:20px;margin-bottom:20px}
#orders{display:grid;gap:15px}
.order{background:white;padding:20px;border:1px solid #ddd}
.order h3{margin-top:0}
.order p{line-height:1.5;overflow-wrap:anywhere}
.status{padding:10px;margin-right:8px;max-width:180px}
.update{background:#171717;color:white}
.message{padding:15px;background:white;margin-bottom:15px}
@media(max-width:500px){header{padding:15px}header h2{font-size:15px}.order{padding:15px}}
</style>
</head>
<body>
<header>
<h2>VÉRON WATCHES — ADMIN</h2>
<button class="logout" id="logout">LOGOUT</button>
</header>
<main>
<div class="summary">
<h2>Order Management</h2>
<p id="count">Loading orders...</p>
</div>
<div id="message" class="message">Loading...</div>
<div id="orders"></div>
</main>
<script>
const ordersBox = document.getElementById("orders");
const message = document.getElementById("message");
const count = document.getElementById("count");

async function loadOrders() {
  message.textContent = "Loading orders...";
  ordersBox.replaceChildren();

  try {
    const response = await fetch("/admin/api/orders", {
      credentials: "same-origin"
    });

    if (response.status === 401) {
      location.href = "/admin";
      return;
    }

    if (!response.ok) throw new Error("Could not load orders.");

    const data = await response.json();
    count.textContent = "Total orders: " + data.orders.length;

    if (!data.orders.length) {
      message.textContent = "No orders received yet.";
      return;
    }

    message.textContent = "";

    data.orders.forEach(order => {
      const card = document.createElement("div");
      card.className = "order";

      const heading = document.createElement("h3");
      heading.textContent = "Order #" + order.id;
      card.appendChild(heading);

      function addLine(label, value) {
        const p = document.createElement("p");
        p.textContent = label + ": " + value;
        card.appendChild(p);
      }

      addLine("Customer", order.customer_name);
      addLine("Phone", order.phone);
      addLine("City", order.city);
      addLine("Address", order.address);

      const products = (order.items || []).map(item =>
        item.name + " — Rs. " + Number(item.price).toLocaleString()
      ).join(", ");

      addLine("Products", products || "Not available");
      addLine("Total", "Rs. " + Number(order.total).toLocaleString());
      addLine("Date", order.created_at);

      const controls = document.createElement("div");
      const select = document.createElement("select");
      select.className = "status";

      ["Pending","Confirmed","Shipped","Delivered","Cancelled"].forEach(status => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        select.appendChild(option);
      });

      select.value = order.status;

      const button = document.createElement("button");
      button.className = "update";
      button.textContent = "UPDATE STATUS";

      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "UPDATING...";

        try {
          const result = await fetch("/admin/api/status", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: order.id,
              status: select.value
            })
          });

          if (result.status === 401) {
            location.href = "/admin";
            return;
          }

          if (!result.ok) throw new Error("Status update failed.");

          message.textContent = "Order status updated successfully.";
          order.status = select.value;
        } catch (error) {
          message.textContent = error.message;
        } finally {
          button.disabled = false;
          button.textContent = "UPDATE STATUS";
        }
      });

      controls.appendChild(select);
      controls.appendChild(button);
      card.appendChild(controls);
      ordersBox.appendChild(card);
    });
  } catch (error) {
    message.textContent = error.message;
  }
}

document.getElementById("logout").addEventListener("click", async () => {
  await fetch("/admin/logout", {
    method: "POST",
    credentials: "same-origin"
  });
  location.href = "/admin";
});

loadOrders();
</script>
</body>
</html>`, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CUSTOMER CHECKOUT
    if (url.pathname === "/api/order" && request.method === "POST") {
      try {
        const data = await request.json();

        const customerName = String(data.customer_name || "").trim();
        const phone = String(data.phone || "").trim();
        const city = String(data.city || "").trim();
        const address = String(data.address || "").trim();
        const items = data.items;

        if (
          !customerName || customerName.length > 100 ||
          !phone || phone.length > 25 ||
          !city || city.length > 60 ||
          !address || address.length > 500 ||
          !Array.isArray(items) || items.length < 1 || items.length > 20
        ) {
          return jsonResponse({
            success: false,
            message: "Please enter valid order details."
          }, 400);
        }

        const verifiedItems = [];

        for (const item of items) {
          const name = String(item.name || "");

          if (!Object.prototype.hasOwnProperty.call(PRODUCTS, name)) {
            return jsonResponse({
              success: false,
              message: "Invalid product in your order."
            }, 400);
          }

          verifiedItems.push({
            name,
            price: PRODUCTS[name]
          });
        }

        const total = verifiedItems.reduce((sum, item) => sum + item.price, 0);
        const id = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO orders
          (id, customer_name, phone, city, address, items_json, total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          customerName,
          phone,
          city,
          address,
          JSON.stringify(verifiedItems),
          total
        ).run();

        return jsonResponse({
          success: true,
          message: "Your order has been placed successfully!",
          order_id: id,
          total
        });

      } catch (error) {
        return jsonResponse({
          success: false,
          message: "Unable to place your order. Please try again."
        }, 500);
      }
    }

    // ADMIN LOGIN
    if (url.pathname === "/admin/login" && request.method === "POST") {
      if (!env.ADMIN_PASSWORD) {
        return new Response("Admin password is not configured.", { status: 500 });
      }

      try {
        const formData = await request.formData();
        const password = formData.get("password");

        if (typeof password !== "string" || password !== env.ADMIN_PASSWORD) {
          return new Response("Invalid password. Please go back and try again.", {
            status: 401,
            headers: { "Content-Type": "text/plain" }
          });
        }

        const payload = JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
          nonce: crypto.randomUUID()
        });

        const token = await signSession(payload, env.ADMIN_PASSWORD);

        return new Response(null, {
          status: 303,
          headers: {
            "Location": "/admin/dashboard",
            "Set-Cookie": cookieHeader(token),
            "Cache-Control": "no-store"
          }
        });
      } catch (error) {
        return new Response("Login failed. Please try again.", { status: 500 });
      }
    }

    // ADMIN LOGIN PAGE
    if (url.pathname === "/admin" && request.method === "GET") {
      return loginPage();
    }

    // ADMIN LOGOUT
    if (url.pathname === "/admin/logout" && request.method === "POST") {
      return new Response(null, {
        status: 303,
        headers: {
          "Location": "/admin",
          "Set-Cookie": clearCookieHeader(),
          "Cache-Control": "no-store"
        }
      });
    }

    // PROTECT ALL REMAINING ADMIN ROUTES
    if (url.pathname.startsWith("/admin/")) {
      if (!env.ADMIN_PASSWORD ||
          !(await verifySession(request, env.ADMIN_PASSWORD))) {
        return jsonResponse({
          success: false,
          message: "Please log in."
        }, 401);
      }

      // ADMIN DASHBOARD
      if (url.pathname === "/admin/dashboard" && request.method === "GET") {
        return dashboardPage();
      }

      // GET CUSTOMER ORDERS
      if (url.pathname === "/admin/api/orders" && request.method === "GET") {
        try {
          const result = await env.DB.prepare(`
            SELECT id, customer_name, phone, city, address,
                   items_json, total, status, created_at
            FROM orders
            ORDER BY created_at DESC
            LIMIT 200
          `).all();

          const orders = (result.results || []).map(order => {
            let items = [];
            try {
              items = JSON.parse(order.items_json || "[]");
            } catch {
              items = [];
            }

            return {
              id: order.id,
              customer_name: order.customer_name,
              phone: order.phone,
              city: order.city,
              address: order.address,
              items,
              total: order.total,
              status: order.status,
              created_at: order.created_at
            };
          });

          return jsonResponse({ success: true, orders });
        } catch (error) {
          return jsonResponse({
            success: false,
            message: "Unable to load orders."
          }, 500);
        }
      }

      // UPDATE ORDER STATUS
      if (url.pathname === "/admin/api/status" && request.method === "POST") {
        try {
          const data = await request.json();
          const id = String(data.id || "");
          const status = String(data.status || "");

          if (!id || id.length > 100 ||
              !ALLOWED_STATUSES.includes(status)) {
            return jsonResponse({
              success: false,
              message: "Invalid order or status."
            }, 400);
          }

          const existing = await env.DB.prepare(
            "SELECT id FROM orders WHERE id = ?"
          ).bind(id).first();

          if (!existing) {
            return jsonResponse({
              success: false,
              message: "Order not found."
            }, 404);
          }

          await env.DB.prepare(
            "UPDATE orders SET status = ? WHERE id = ?"
          ).bind(status, id).run();

          return jsonResponse({
            success: true,
            message: "Order status updated."
          });
        } catch (error) {
          return jsonResponse({
            success: false,
            message: "Unable to update order status."
          }, 500);
        }
      }

      return new Response("Admin page not found.", { status: 404 });
    }

    // WEBSITE FILES
    return env.ASSETS.fetch(request);
  }
};

