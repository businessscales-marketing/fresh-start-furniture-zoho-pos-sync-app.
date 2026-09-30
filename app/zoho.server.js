

/**
 * Refreshes the Zoho Creator OAuth Access Token using the Client Credentials
 * and the Refresh Token configured in env/config.
 */
export async function refreshAccessToken() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error("Missing Zoho credentials in environment variables!");
    throw new Error("Zoho credentials missing");
  }

  const url = "https://accounts.zoho.com/oauth/v2/token";
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      body: params,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error refreshing Zoho access token:", error);
    throw error;
  }
}

/**
 * Sends a Shopify order to Zoho Creator's Shopify_Orders form.
 * Handles token refresh automatically.
 */
export async function sendOrderToZoho(orderData) {
  const owner = process.env.ZOHO_ACCOUNT_OWNER;
  const appName = process.env.ZOHO_APP_LINK_NAME;
  const formName = process.env.ZOHO_FORM_LINK_NAME || "Shopify_Orders";

  if (!owner || !appName) {
    throw new Error("ZOHO_ACCOUNT_OWNER and ZOHO_APP_LINK_NAME must be configured");
  }

  const accessToken = await refreshAccessToken();
  const url = `https://creator.zoho.com/api/v2/${owner}/${appName}/form/${formName}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: orderData,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Zoho Creator API response error: ${response.status} - ${errorText}`);
    throw new Error(`Zoho API Error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result;
}
