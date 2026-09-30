import { authenticate } from "../shopify.server";
import { sendOrderToZoho } from "../zoho.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (topic !== "ORDERS_PAID") {
    return new Response("Invalid topic", { status: 400 });
  }

  if (!payload || !payload.line_items) {
    console.error("Webhook payload missing line items!");
    return new Response("Missing payload data", { status: 200 }); // return 200 so Shopify doesn't retry
  }

  const orderId = payload.id ? payload.id.toString() : (payload.name || "Unknown");
  const orderDateRaw = payload.created_at || new Date().toISOString();

  // Format order date to Zoho friendly format: MM-dd-yyyy
  const dateObj = new Date(orderDateRaw);
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const yyyy = dateObj.getFullYear();
  const orderDate = `${mm}-${dd}-${yyyy}`;

  console.log(`Processing Shopify Paid Order #${orderId} with ${payload.line_items.length} line items.`);

  // 1. Deduplication check in SQLite database
  try {
    const existing = await db.processedOrder.findUnique({
      where: { orderId: orderId },
    });

    if (existing) {
      console.log(`Order #${orderId} has already been processed previously. Skipping to prevent duplicate records in Zoho.`);
      return new Response(); // Return 200 OK to Shopify
    }
  } catch (dbError) {
    console.error(`Database query failed during duplicate check for Order #${orderId}:`, dbError);
    // Continue processing as fallback
  }

  // 2. Loop and push line items to Zoho Creator
  let successCount = 0;
  for (const item of payload.line_items) {
    try {
      const orderRecord = {
        Order_ID: orderId,
        sku: item.sku || "",
        shopify_variant_id: item.variant_id ? item.variant_id.toString() : "",
        variant_title: item.variant_title || "",
        Product_ID: item.product_id ? item.product_id.toString() : "",
        quantity: item.quantity || 1,
        product_name: item.title || "",
        order_date: orderDate,
      };

      console.log(`Sending item SKU ${item.sku} to Zoho Creator...`);
      const result = await sendOrderToZoho(orderRecord);
      console.log(`Zoho Creator Sync Success for SKU ${item.sku}:`, result);
      successCount++;
    } catch (error) {
      console.error(`Failed to send line item (SKU: ${item.sku}) to Zoho Creator:`, error);
    }
  }

  // 3. Mark order as processed if at least one item was sent or processed
  if (successCount > 0) {
    try {
      await db.processedOrder.create({
        data: { orderId: orderId },
      });
      console.log(`Order #${orderId} marked as processed in local database.`);
    } catch (dbError) {
      console.error(`Failed to record processed status for Order #${orderId}:`, dbError);
    }
  }

  return new Response();
};
