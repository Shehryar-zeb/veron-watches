export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Website files serve karna
    if (url.pathname === "/api/order" && request.method === "POST") {
      try {
        const data = await request.json();

        const { customer_name, phone, city, address, items, total } = data;

        if (
          !customer_name || !phone || !city || !address ||
          !Array.isArray(items) || items.length === 0 ||
          !Number.isInteger(total) || total <= 0
        ) {
          return Response.json(
            { success: false, message: "Please provide valid order details." },
            { status: 400 }
          );
        }

        const id = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO orders
          (id, customer_name, phone, city, address, items_json, total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          String(customer_name).trim(),
          String(phone).trim(),
          String(city).trim(),
          String(address).trim(),
          JSON.stringify(items),
          total
        ).run();

        return Response.json({
          success: true,
          message: "Order received successfully.",
          order_id: id
        });
      } catch (error) {
        return Response.json(
          { success: false, message: "Unable to place order." },
          { status: 500 }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
