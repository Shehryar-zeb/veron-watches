
const PRODUCTS = {
  "Classic Silver": 6999,
  "Midnight Black": 7499,
  "Royal Chronograph": 8999
};

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

        if (
          !customerName || customerName.length > 100 ||
          !phone || phone.length > 25 ||
          !city || city.length > 60 ||
          !address || address.length > 500 ||
          !Array.isArray(items) || items.length < 1 || items.length > 20
        ) {
          return Response.json(
            { success: false, message: "Please enter valid order details." },
            { status: 400 }
          );
        }

        const verifiedItems = [];

        for (const item of items) {
          const name = String(item.name || "");
          if (!Object.prototype.hasOwnProperty.call(PRODUCTS, name)) {
            return Response.json(
              { success: false, message: "Invalid product in your order." },
              { status: 400 }
            );
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

        return Response.json({
          success: true,
          message: "Your order has been placed successfully!",
          order_id: id,
          total
        });

      } catch (error) {
        return Response.json(
          { success: false, message: "Unable to place your order. Please try again." },
          { status: 500 }
        );
      }
    }
if (url.pathname === "/admin/login" && request.method === "POST") {
  const formData = await request.formData();
  const password = formData.get("password");

  if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
    return new Response("Invalid password", {
      status: 401,
      headers: { "Content-Type": "text/plain" }
    });
  }

  return new Response("Login successful! Admin panel coming next.", {
    headers: { "Content-Type": "text/plain" }
  });
}
       if (url.pathname === "/admin") {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>VÉRON Admin Login</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: Arial;
          background: #f5f5f5;
          display: grid;
          place-items: center;
          min-height: 100vh;
          margin: 0;
        }
        .login {
          background: white;
          padding: 35px;
          width: 300px;
          text-align: center;
          box-shadow: 0 5px 25px #ddd;
        }
        input, button {
          box-sizing: border-box;
          width: 100%;
          padding: 13px;
          margin-top: 15px;
        }
        button {
          background: #171717;
          color: white;
          border: 0;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="login">
        <h2>VÉRON WATCHES</h2>
        <p>Admin Login</p>
        <form method="POST" action="/admin/login">
          <input type="password" name="password"
            placeholder="Enter Admin Password" required>
          <button type="submit">LOGIN</button>
        </form>
      </div>
    </body>
    </html>
  `, {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}
        return env.ASSETS.fetch(request);
  }
};
