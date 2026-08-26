const SOURCE_URL = "https://todaymytelenoranswer.pk/";

function getPakistanDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).formatToParts(new Date());

  const obj = Object.fromEntries(
    parts.filter(p => p.type !== "literal")
         .map(p => [p.type, p.value])
  );

  return `${obj.month} ${obj.day}, ${obj.year}`;
}

function escapeHtml(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchQuiz() {
  console.log("Fetching quiz source...");

  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 TelenorQuizAutoPoster/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Source failed: ${response.status}`);
  }

  const html = await response.text();

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const quiz = [];

  for (let i = 0; i < text.length; i++) {
    const line = text[i];

    if (/^Question\s*(No:|Number:)?\s*0?[1-5]/i.test(line)) {
      let question = "";
      let answer = "";

      for (let j = i + 1; j < Math.min(i + 12, text.length); j++) {
        if (!question && text[j].length > 8) {
          question = text[j];
        }

        if (/^Answer$/i.test(text[j]) && text[j + 1]) {
          answer = text[j + 1];
          break;
        }
      }

      if (question && answer) {
        quiz.push({
          question,
          answer
        });
      }
    }
  }

  if (quiz.length < 5) {
    throw new Error(
      `Could not extract 5 quiz answers. Found: ${quiz.length}`
    );
  }

  return quiz.slice(0, 5);
}

async function wordpressRequest(path, options = {}) {
  const WP_URL = process.env.WP_URL;
  const WP_USERNAME = process.env.WP_USERNAME;
  const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

  if (!WP_URL || !WP_USERNAME || !WP_APP_PASSWORD) {
    throw new Error("WordPress secrets are missing.");
  }

  const auth = Buffer.from(
    `${WP_USERNAME}:${WP_APP_PASSWORD}`
  ).toString("base64");

  const url = `${WP_URL.replace(/\/$/, "")}/wp-json/wp/v2${path}`;

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${auth}`,
      ...(options.headers || {})
    }
  });
}

async function postToWordPress(quiz, date) {
  const title = `Telenor Quiz Answers Today - ${date}`;

  // Duplicate check
  const searchResponse = await wordpressRequest(
    `/posts?search=${encodeURIComponent(title)}&per_page=10`
  );

  if (!searchResponse.ok) {
    throw new Error("Could not check existing WordPress posts.");
  }

  const existingPosts = await searchResponse.json();

  const duplicate = existingPosts.find(
    post => post.title.rendered.toLowerCase() === title.toLowerCase()
  );

  if (duplicate) {
    console.log("Today's post already exists:");
    console.log(duplicate.link);
    return;
  }

  const questionsHtml = quiz.map((item, index) => `
    <div class="telenor-answer">
      <h3>Question ${index + 1}</h3>
      <p><strong>${escapeHtml(item.question)}</strong></p>
      <p>✅ <strong>Answer:</strong> ${escapeHtml(item.answer)}</p>
    </div>
    <hr>
  `).join("");

  const content = `
    <h1>Telenor Quiz Answers Today</h1>

    <p><strong>Date:</strong> ${escapeHtml(date)}</p>

    <p>Here are today's 5 Telenor Quiz questions and answers.</p>

    ${questionsHtml}

    <p><strong>Updated:</strong> Automatically by Telenor Quiz PK.</p>
  `;

  const postResponse = await wordpressRequest("/posts", {
    method: "POST",
    body: JSON.stringify({
      title,
      content,
      status: "publish"
    })
  });

  const data = await postResponse.json();

  if (!postResponse.ok) {
    console.error(data);
    throw new Error("WordPress publishing failed.");
  }

  console.log("SUCCESS!");
  console.log("Published:", data.link);
}

async function main() {
  const date = getPakistanDate();

  console.log(`Telenor Auto Poster started: ${date}`);

  const quiz = await fetchQuiz();

  console.log("Quiz found:");
  quiz.forEach((item, index) => {
    console.log(`${index + 1}. ${item.question}`);
    console.log(`Answer: ${item.answer}`);
  });

  await postToWordPress(quiz, date);
}

main().catch(error => {
  console.error("\nAUTO POSTER FAILED:");
  console.error(error.message);
  process.exit(1);
});
