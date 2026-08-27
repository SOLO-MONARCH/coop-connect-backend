const API_BASE_URL = (process.env.API_BASE_URL || "https://coop-connect-backend-2.onrender.com").replace(/\/$/, "");

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      },
      body: "",
    };
  }
  const path = event.path.replace(/^\/\.netlify\/functions\/api/, "") || "/";
  const url = new URL(`${path}${event.rawQueryString ? `?${event.rawQueryString}` : ""}`, API_BASE_URL);

  const headers = { ...event.headers };
  delete headers.host;
  delete headers["content-length"];

  const init = {
    method: event.httpMethod,
    headers,
  };

  if (event.body && event.httpMethod !== "GET" && event.httpMethod !== "HEAD") {
    init.body = event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body;
  }

  try {
    const response = await fetch(url, init);
    const contentType = response.headers.get("content-type") || "application/json";
    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Content-Type": contentType,
      },
      body,
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: error.message || "Backend unavailable" }),
    };
  }
}
