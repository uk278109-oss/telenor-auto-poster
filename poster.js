const SOURCE_URL = "https://todaymytelenoranswer.pk/";
const TODAY_PAGE_ID = 26;

/* =========================
   PAKISTAN DATE
========================= */

function getPakistanDate() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date());
}

/* =========================
   HTML SAFETY
========================= */

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   FETCH QUIZ
========================= */

async function fetchQuiz() {
  console.log("Fetching Telenor quiz source...");
  console.log("Source:", SOURCE_URL);

  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 TelenorQuizAutoPoster/1.0",
      "Accept": "text/html"
    }
  });

  console.log("Quiz source status:", response.status);

  if (!response.ok) {
    throw new Error(
      `Quiz source failed with status ${response.status}`
    );
  }

  const html = await response.text();

  if (!html || html.length < 100) {
    throw new Error("Quiz source returned empty content.");
  }

  console.log("Quiz source downloaded.");

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  console.log("Extracted text lines:", text.length);

  const quiz = [];

  for (let i = 0; i < text.length; i++) {
    const line = text[i];

    const questionMatch =
      /^Question\s*(?:No\.?|Number)?\s*[:\-]?\s*([1-5])\b/i.exec(line);

    if (!questionMatch) continue;

    const number = Number(questionMatch[1]);

    let question = "";
    let answer = "";

    for (
      let j = i + 1;
      j < Math.min(i + 20, text.length);
      j++
    ) {
      const current = text[j];

      if (
        /^Question\s*(?:No\.?|Number)?\s*[:\-]?\s*[1-5]\b/i.test(current)
      ) {
        break;
      }

      if (
        !question &&
        current.length > 10 &&
        !/^Answer\s*[:\-]?$/i.test(current) &&
        !/^[A-D][\.\)]/i.test(current)
      ) {
        question = current;
      }

      const inlineAnswer =
        /^Answer\s*[:\-]\s*(.+)$/i.exec(current);

      if (inlineAnswer && inlineAnswer[1]) {
        answer = inlineAnswer[1].trim();
        break;
      }

      if (/^Answer\s*[:\-]?$/i.test(current)) {
        if (text[j + 1]) {
          answer = text[j + 1].trim();
          break;
        }
      }
    }

    if (question && answer) {
      quiz.push({
        number,
        question,
        answer
      });

      console.log(
        `Found Q${number}: ${question.substring(0, 80)}`
      );
      console.log(`Answer ${number}: ${answer}`);
    }
  }

  const uniqueQuiz = [];

  for (const item of quiz) {
    if (
      !uniqueQuiz.some(
        existing => existing.number === item.number
      )
    ) {
      uniqueQuiz.push(item);
    }
  }

  uniqueQuiz.sort((a, b) => a.number - b.number);

  console.log(
    `Total unique quiz answers found: ${uniqueQuiz.length}`
  );

  if (uniqueQuiz.length < 5) {
    throw new Error(
      `Could not extract all 5 quiz answers. Found only ${uniqueQuiz.length}.`
    );
  }

  return uniqueQuiz.slice(0, 5);
}

/* =========================
   WORDPRESS API REQUEST
========================= */

async function wpRequest(path, options = {}) {
  const WP_URL = process.env.WP_URL;
  const WP_USERNAME = process.env.WP_USERNAME;
  const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

  if (!WP_URL) {
    throw new Error("Missing WP_URL secret.");
  }

  if (!WP_USERNAME) {
    throw new Error("Missing WP_USERNAME secret.");
  }

  if (!WP_APP_PASSWORD) {
    throw new Error("Missing WP_APP_PASSWORD secret.");
  }

  const auth = Buffer.from(
    `${WP_USERNAME}:${WP_APP_PASSWORD}`
  ).toString("base64");

  const baseUrl = WP_URL.replace(/\/$/, "");

  const url = `${baseUrl}/wp-json/wp/v2${path}`;

  console.log("WordPress API request:");
  console.log(url);

  const response = await fetch(url, {
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

  console.log("WordPress response status:", response.status);
  console.log(
    "WordPress content type:",
    response.headers.get("content-type")
  );

  const rawText = await response.text();

  console.log(
    "WordPress response preview:",
    rawText.substring(0, 300)
  );

  let data = null;

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    throw new Error(
      `WordPress returned non-JSON response. Status: ${response.status}. Preview: ${rawText.substring(0, 150)}`
    );
  }

  if (!response.ok) {
    const message =
      data.message ||
      data.code ||
      "Unknown WordPress API error";

    throw new Error(
      `WordPress API failed (${response.status}): ${message}`
    );
  }

  return data;
}

/* =========================
   CREATE HTML CONTENT
========================= */

function createContent(quiz, date) {
  const answersHtml = quiz
    .map(item => {
      return `
<div class="telenor-quiz-item">
  <h3>Question ${item.number}</h3>

  <p>
    <strong>
      ${escapeHtml(item.question)}
    </strong>
  </p>

  <p>
    ✅ <strong>Answer:</strong>
    ${escapeHtml(item.answer)}
  </p>
</div>

<hr>
`;
    })
    .join("\n");

  return `
<h1>Telenor Quiz Answers Today</h1>

<p>
  <strong>Date:</strong> ${escapeHtml(date)}
</p>

<p>
  Here are today's 5 Telenor Quiz questions and answers.
</p>

${answersHtml}

<p>
  <em>
    Last updated automatically by Telenor Quiz PK.
  </em>
</p>
`;
}

/* =========================
   UPDATE TODAY PAGE
========================= */

async function updateTodayPage(content) {
  console.log("");
  console.log("========== UPDATING TODAY PAGE ==========");

  const data = await wpRequest(
    `/pages/${TODAY_PAGE_ID}`,
    {
      method: "POST",
      body: JSON.stringify({
        title: "Today Telenor Answer",
        content,
        status: "publish"
      })
    }
  );

  console.log("TODAY PAGE UPDATED SUCCESSFULLY");
  console.log("Page ID:", data.id);
  console.log("Page Link:", data.link);

  return data;
}

/* =========================
   CHECK EXISTING POST
========================= */

async function findExistingPost(title) {
  console.log("");
  console.log("Checking if today's archive post already exists...");

  const posts = await wpRequest(
    `/posts?search=${encodeURIComponent(title)}&per_page=100`
  );

  const existing = posts.find(post => {
    const postTitle = String(post.title?.rendered || "")
      .trim()
      .toLowerCase();

    return postTitle === title.trim().toLowerCase();
  });

  if (existing) {
    console.log("Existing archive post found.");
    console.log("Post ID:", existing.id);
    console.log("Post Link:", existing.link);
    return existing;
  }

  console.log("No existing archive post found.");

  return null;
}

/* =========================
   CREATE DAILY POST
========================= */

async function createArchivePost(content, title) {
  console.log("");
  console.log("========== DAILY ARCHIVE POST ==========");

  const existing = await findExistingPost(title);

  if (existing) {
    console.log("Skipping duplicate post.");
    return existing;
  }

  console.log("Creating new WordPress post...");
  console.log("Title:", title);

  const data = await wpRequest(
    "/posts",
    {
      method: "POST",
      body: JSON.stringify({
        title,
        content,
        status: "publish"
      })
    }
  );

  console.log("");
  console.log("ARCHIVE POST CREATED SUCCESSFULLY");
  console.log("Post ID:", data.id);
  console.log("Post Link:", data.link);

  return data;
}

/* =========================
   MAIN
========================= */

async function main() {
  console.log("");
  console.log("======================================");
  console.log("TELENOR QUIZ AUTO POSTER STARTED");
  console.log("======================================");

  const date = getPakistanDate();

  console.log("Pakistan Date:", date);

  const title =
    `Telenor Quiz Answers Today - ${date}`;

  console.log("Post Title:", title);

  console.log("");
  console.log("STEP 1: FETCH QUIZ");

  const quiz = await fetchQuiz();

  console.log("");
  console.log("SUCCESS: 5 QUIZ ANSWERS READY");

  quiz.forEach(item => {
    console.log(`Q${item.number}: ${item.question}`);
    console.log(`A${item.number}: ${item.answer}`);
  });

  console.log("");
  console.log("STEP 2: CREATE CONTENT");

  const content = createContent(quiz, date);

  console.log("Content created successfully.");

  console.log("");
  console.log("STEP 3: UPDATE TODAY PAGE");

  const page = await updateTodayPage(content);

  console.log("");
  console.log("STEP 4: CREATE DAILY ARCHIVE POST");

  const post = await createArchivePost(
    content,
    title
  );

  console.log("");
  console.log("======================================");
  console.log("AUTO POSTER COMPLETED SUCCESSFULLY");
  console.log("======================================");
  console.log("Today Page:", page.link);
  console.log("Archive Post:", post.link);
}

main().catch(error => {
  console.error("");
  console.error("======================================");
  console.error("AUTO POSTER FAILED");
  console.error("======================================");
  console.error(error);

  process.exit(1);
});
