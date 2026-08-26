const SOURCE_URL = "https://todaymytelenoranswer.pk/";
const TODAY_PAGE_ID = 26;

function getPakistanDate() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date());
}

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchQuiz() {
  console.log("Fetching Telenor quiz...");

  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Quiz source failed: ${response.status}`);
  }

  const html = await response.text();

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const quiz = [];

  for (let i = 0; i < text.length; i++) {
    if (/^Question\s*(No:|Number:)?\s*0?[1-5]/i.test(text[i])) {
      let question = "";
      let answer = "";

      for (let j = i + 1; j < Math.min(i + 15, text.length); j++) {
        if (!question && text[j].length > 8) {
          question = text[j];
        }

        if (/^Answer$/i.test(text[j]) && text[j + 1]) {
          answer = text[j + 1];
          break;
        }
      }

      if (question && answer) {
        quiz.push({ question, answer });
      }
    }
  }

  if (quiz.length < 5) {
    throw new Error(
      `Could not find all 5 quiz answers. Found: ${quiz.length}`
    );
  }

  return quiz.slice(0, 5);
}

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

  return fetch(
    `${WP_URL.replace(/\/$/, "")}/wp-json/wp/v2${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
        ...(options.headers || {})
      }
    }
  );
}

function createContent(quiz, date) {
  const answers = quiz.map((item, index) => `
    <div class="telenor-quiz-item">
      <h3>Question ${index + 1}</h3>
      <p><strong>${escapeHtml(item.question)}</strong></p>
      <p>✅ <strong>Answer:</strong> ${escapeHtml(item.answer)}</p>
    </div>
    <hr>
  `).join("");

  return `
    <h1>Telenor Quiz Answers Today</h1>

    <p><strong>Today's Date:</strong> ${escapeHtml(date)}</p>

    <p>Below are today's 5 Telenor Quiz questions and correct answers.</p>

    ${answers}

    <p><em>Last updated automatically.</em></p>
  `;
}

async function updateTodayPage(content, title) {
  console.log("Updating Today Telenor Answer page...");

  const response = await wpRequest(`/pages/${TODAY_PAGE_ID}`, {
    method: "POST",
    body: JSON.stringify({
      title,
      content,
      status: "publish"
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    throw new Error("Today page update failed.");
  }

  console.log("Today page updated:", data.link);
}

async function createArchivePost(content, title) {
  console.log("Checking archive post...");

  const check = await wpRequest(
    `/posts?search=${encodeURIComponent(title)}&per_page=20`
  );

  if (!check.ok) {
    throw new Error("Archive duplicate check failed.");
  }

  const posts = await check.json();

  const duplicate = posts.find(
    post =>
      post.title.rendered
        .toLowerCase()
        .trim() === title.toLowerCase().trim()
  );

  if (duplicate) {
    console.log("Archive post already exists:", duplicate.link);
    return;
  }

  console.log("Creating archive post...");

  const response = await wpRequest("/posts", {
    method: "POST",
    body: JSON.stringify({
      title,
      content,
      status: "publish"
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    throw new Error("Archive post creation failed.");
  }

  console.log("Archive post created:", data.link);
}

async function main() {
  const date = getPakistanDate();
  const title = `Telenor Quiz Answers Today - ${date}`;

  console.log(`Starting auto poster for ${date}`);

  const quiz = await fetchQuiz();

  console.log("5 quiz answers found.");

  const content = createContent(quiz, date);

  // Update Page ID 26
  await updateTodayPage(content, "Today Telenor Answer");

  // Create daily archive post
  await createArchivePost(content, title);

  console.log("SUCCESS! Auto posting completed.");
}

main().catch(error => {
  console.error("\nAUTO POSTER FAILED:");
  console.error(error);
  process.exit(1);
});
