import { Handler } from "@netlify/functions";

const handler: Handler = async (event) => {

  const authHeader = event.headers["authorization"];

  //    username:password -> base64 encode
  const expectedUser = process.env.WEBHOOK_USER  || "";
  const expectedPass = process.env.WEBHOOK_PASS  || "";
  const expectedAuth =
    "Basic " + Buffer.from(`${expectedUser}:${expectedPass}`).toString("base64");

  if (authHeader !== expectedAuth) {
    return {
      statusCode: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Protected"' },
      body: "Unauthorized",
    };
  }

  const payload = event.body ? JSON.parse(event.body) : {};
  console.log("Verified webhook:", payload);

  return { statusCode: 200, body: "ok" };
};

export { handler };