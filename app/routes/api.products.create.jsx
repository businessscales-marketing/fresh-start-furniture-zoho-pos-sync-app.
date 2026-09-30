import unauthenticated from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // 1. Verify shared secret key for security (optional depending on env setting)
  const authHeader = request.headers.get("X-Zoho-Secret-Key");
  const expectedSecret = process.env.ZOHO_SECRET_KEY;

  if (expectedSecret && authHeader !== expectedSecret) {
    console.warn("Unauthorized request attempt to product creation API.");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse payload
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    title,
    sku,
    price,
    description,
    vendor,
    product_type,
    status = "ACTIVE",
    barcode,
  } = body;

  if (!title) {
    return Response.json({ error: "Missing required field: title" }, { status: 400 });
  }

  console.log(`Received product creation request from Zoho for title: '${title}', SKU: '${sku || "N/A"}'`);

  try {
    // 3. Find active shop session in db
    const activeSession = await db.session.findFirst();
    const shop = activeSession ? activeSession.shop : "nxfguf-u6.myshopify.com";

    console.log(`Retrieving admin API client for shop: ${shop}`);
    const { admin } = await unauthenticated.admin(shop);

    // 4. Build product creation input
    const variantInput = {};
    if (price !== undefined && price !== null && price !== "") {
      variantInput.price = price.toString();
    }
    if (sku) {
      variantInput.sku = sku.toString();
    }
    if (barcode) {
      variantInput.barcode = barcode.toString();
    }

    const input = {
      title: title.toString(),
      status: status.toUpperCase() === "DRAFT" ? "DRAFT" : "ACTIVE",
    };

    if (description) {
      input.descriptionHtml = description.toString();
    }
    if (vendor) {
      input.vendor = vendor.toString();
    }
    if (product_type) {
      input.productType = product_type.toString();
    }

    // Include variant options if provided
    if (Object.keys(variantInput).length > 0) {
      input.variants = [variantInput];
    }

    // 5. Execute productCreate mutation
    const createResponse = await admin.graphql(
      `#graphql
      mutation createProductFromZoho($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            status
            variants(first: 5) {
              nodes {
                id
                sku
                price
                barcode
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          input: input,
        },
      }
    );

    const createData = await createResponse.json();
    const userErrors = createData?.data?.productCreate?.userErrors || [];

    if (userErrors.length > 0) {
      console.error("Shopify product creation user errors:", userErrors);
      return Response.json({ error: "Shopify creation error", details: userErrors }, { status: 500 });
    }

    const createdProduct = createData?.data?.productCreate?.product;
    console.log(`Successfully created product '${createdProduct?.title}' (ID: ${createdProduct?.id}) on Shopify.`);

    return Response.json({
      success: true,
      message: `Product successfully created on Shopify`,
      product: {
        id: createdProduct?.id,
        title: createdProduct?.title,
        handle: createdProduct?.handle,
        status: createdProduct?.status,
        variants: createdProduct?.variants?.nodes || [],
      },
    });
  } catch (error) {
    console.error(`Product creation API failed for title '${title}':`, error);
    return Response.json({ error: "Server error", message: error.message }, { status: 500 });
  }
};
