const fs = require("fs");

async function main() {
  const WP_URL = process.env.WP_URL;
  const WP_USERNAME = process.env.WP_USERNAME;
  const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

  if (!WP_URL || !WP_USERNAME || !WP_APP_PASSWORD) {
    throw new Error("WordPress secrets missing.");
  }

  // Temporary test post content
  const date = new Date().toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Karachi"
  });

  const title = `Telenor Quiz Answers Today - ${date}`;

  const content = `
    <h2>Telenor Quiz Answers Today</h2>
    <p><strong>Date:</strong> ${date}</p>

    <p>This post was published automatically by the Telenor Auto Poster.</p>

    <h3>Today's Answers</h3>
    <ol>
      <li>Answer will appear here.</li>
      <li>Answer will appear here.</li>
      <li>Answer will appear here.</li>
      <li>Answer will appear here.</li>
      <li>Answer will appear here.</li>
    </ol>

    <p><em>Last updated automatically.</em></p>
  `;

  const auth = Buffer.from(
    `${WP_USERNAME}:${WP_APP_PASSWORD}`
  ).toString("base64");

  const response = await fetch(
    `${WP_URL.replace(/\/$/, "")}/wp-json/wp/v2/posts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`
      },
      body: JSON.stringify({
        title,
        content,
        status: "publish"
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    throw new Error("WordPress post failed.");
  }

  console.log("SUCCESS!");
  console.log("Post URL:", data.link);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
