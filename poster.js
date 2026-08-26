async function wpRequest(path, options = {}) {
  const WP_URL = process.env.WP_URL;
  const WP_USERNAME = process.env.WP_USERNAME;
  const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

  if (!WP_URL || !WP_USERNAME || !WP_APP_PASSWORD) {
    throw new Error("WordPress secrets missing.");
  }

  const auth = Buffer.from(
    `${WP_USERNAME}:${WP_APP_PASSWORD}`
  ).toString("base64");

  const url =
    `${WP_URL.replace(/\/$/, "")}/wp-json/wp/v2${path}`;

  console.log("WordPress API:", url);

  return fetch(url, {
    ...options,
    redirect: "follow",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Basic ${auth}`,
      "User-Agent": "TelenorQuizAutoPoster/1.0",
      ...(options.headers || {})
    }
  });
    }
