
import unauthenticated from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // 1. Verify shared secret key for security
  const authHeader = request.headers.get("X-Zoho-Secret-Key");
  const expectedSecret = process.env.ZOHO_SECRET_KEY;

  if (!authHeader || authHeader !== expectedSecret) {
    console.warn("Unauthorized request attempt to product deactivation API.");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse payload
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sku } = body;
  if (!sku) {
    return Response.json({ error: "Missing SKU parameter" }, { status: 400 });
  }

  console.log(`Received deactivation request from Zoho for SKU: ${sku}`);

  try {
    // 3. Find active shop session in db
    const activeSession = await db.session.findFirst();
    const shop = activeSession ? activeSession.shop : "nxfguf-u6.myshopify.com";

    console.log(`Retrieving admin API client for shop: ${shop}`);
    const { admin } = await unauthenticated.admin(shop);

    // 4. Search for product variant by SKU using GraphQL
    const searchResponse = await admin.graphql(
      `#graphql
      query findProductBySku($query: String!) {
        productVariants(first: 1, query: $query) {
          edges {
            node {
              id
              product {
                id
                title
                status
              }
            }
          }
        }
      }`,
      {
        variables: {
          query: `sku:${sku}`,
        },
      }
    );

    const searchData = await searchResponse.json();
    const variants = searchData?.data?.productVariants?.edges || [];

    if (variants.length === 0) {
      console.warn(`No product variant found in Shopify with SKU: ${sku}`);
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    const targetProduct = variants[0].node.product;
    const productId = targetProduct.id;
    console.log(`Found product '${targetProduct.title}' (ID: ${productId}) for SKU: ${sku}. Archiving...`);

    // 5. Update product status to ARCHIVED
    const updateResponse = await admin.graphql(
      `#graphql
      mutation archiveProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          input: {
            id: productId,
            status: "ARCHIVED",
          },
        },
      }
    );

    const updateData = await updateResponse.json();
    const userErrors = updateData?.data?.productUpdate?.userErrors || [];

    if (userErrors.length > 0) {
      console.error("Shopify product update user errors:", userErrors);
      return Response.json({ error: "Shopify update error", details: userErrors }, { status: 500 });
    }

    console.log(`Successfully archived product ID: ${productId} on Shopify.`);
    return Response.json({
      success: true,
      message: `Product successfully archived`,
      product_id: productId,
      sku: sku,
    });
  } catch (error) {
    console.error(`Deactivation API process failed for SKU ${sku}:`, error);
    return Response.json({ error: "Server error", message: error.message }, { status: 500 });
  }
};
