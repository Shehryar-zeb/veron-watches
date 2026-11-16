
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

    return env.ASSETS.fetch(request);
  }
};
