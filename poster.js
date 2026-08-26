const SOURCE_URL = "https://todaymytelenoranswer.pk/";
const TODAY_PAGE_ID = 26;

/* =========================
   DATE
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
   CLEAN HTML
========================= */

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#8217;/gi, "'")
    .replace(/&#8216;/gi, "'")
    .replace(/&#8220;/gi, '"')
    .replace(/&#8221;/gi, '"')
    .replace(/<[^>]+>/g, "\n")
    .replace(/\r/g, "")
    .split("\n")
    .map(x => x.trim())
    .filter(x => x.length > 0);
}

/* =========================
   FETCH QUIZ
========================= */

async function fetchQuiz() {
  console.log("Fetching quiz source...");
  console.log("Source:", SOURCE_URL);

  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml"
    }
  });

  console.log("Quiz source status:", response.status);

  if (!response.ok) {
    throw new Error(`Quiz source failed: ${response.status}`);
  }

  const html = await response.text();

  console.log("HTML downloaded. Length:", html.length);

  const lines = htmlToText(html);

  console.log("Extracted text lines:", lines.length);

  // Show useful source text in GitHub logs
  console.log("----- SOURCE DEBUG -----");

  lines
    .filter(line =>
      /question|answer|quiz|telenor|today/i.test(line)
    )
    .slice(0, 80)
    .forEach((line, index) => {
      console.log(`${index + 1}: ${line}`);
    });

  console.log("----- END DEBUG -----");

  const quiz = [];

  /*
    Try different common formats:

    1.
    Question 1
    What is...?
    Answer
    Pakistan

    2.
    Q1: What is...?
    Answer: Pakistan

    3.
    Question 1: What is...?
    Correct Answer: Pakistan
  */

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let number = null;
    let question = "";

    // Pattern: Question 1
    let match = line.match(
      /^(?:question|ques)\s*(?:no\.?|number)?\s*[:\-]?\s*([1-5])\s*$/i
    );

    if (match) {
      number = Number(match[1]);

      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        if (
          lines[j].length > 5 &&
          !/^(?:answer|correct answer)\s*[:\-]?$/i.test(lines[j])
        ) {
          question = lines[j];
          break;
        }
      }
    }

    // Pattern: Question 1: What is...?
    if (!number) {
      match = line.match(
        /^(?:question|ques)\s*(?:no\.?|number)?\s*([1-5])\s*[:\-]\s*(.+)$/i
      );

      if (match) {
        number = Number(match[1]);
        question = match[2].trim();
      }
    }

    // Pattern: Q1: What is...?
    if (!number) {
      match = line.match(
        /^q\s*([1-5])\s*[:\.\-]\s*(.+)$/i
      );

      if (match) {
        number = Number(match[1]);
        question = match[2].trim();
      }
    }

    if (!number || !question) continue;

    let answer = "";

    for (
      let j = i + 1;
      j < Math.min(i + 25, lines.length);
      j++
    ) {
      const current = lines[j];

      // Stop at next question
      if (
        /^(?:question|ques)\s*(?:no\.?|number)?\s*[:\-]?\s*[1-5]\b/i.test(current) ||
        /^q\s*[1-5]\s*[:\.\-]/i.test(current)
      ) {
        break;
      }

      // Answer: Pakistan
      const inlineAnswer = current.match(
        /^(?:correct\s*)?answer\s*[:\-]\s*(.+)$/i
      );

      if (inlineAnswer && inlineAnswer[1]) {
        answer = inlineAnswer[1].trim();
        break;
      }

      // Answer
      // Pakistan
      if (/^(?:correct\s*)?answer\s*[:\-]?$/i.test(current)) {
        if (lines[j + 1]) {
          answer = lines[j + 1].trim();
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

      console.log(`FOUND Q${number}: ${question}`);
      console.log(`ANSWER ${number}: ${answer}`);
    }
  }

  // Remove duplicates
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
    "Total unique quiz answers found:",
    uniqueQuiz.length
  );

  if (uniqueQuiz.length < 5) {
    throw new Error(
      `Could not extract all 5 answers. Found ${uniqueQuiz.length}. Check SOURCE DEBUG in GitHub logs.`
    );
  }

  return uniqueQuiz.slice(0, 5);
}

/* =========================
   WORDPRESS API
========================= */

async function wpRequest(path, options = {}) {
  const WP_URL = process.env.WP_URL;
  const WP_USERNAME = process.env.WP_USERNAME;
  const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

  if (!WP_URL) throw new Error("Missing WP_URL");
  if (!WP_USERNAME) throw new Error("Missing WP_USERNAME");
  if (!WP_APP_PASSWORD) throw new Error("Missing WP_APP_PASSWORD");

  const auth = Buffer.from(
    `${WP_USERNAME}:${WP_APP_PASSWORD}`
  ).toString("base64");

  const url =
    `${WP_URL.replace(/\/$/, "")}/wp-json/wp/v2${path}`;

  console.log("WordPress API:", url);

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

  const rawText = await response.text();

  console.log("WordPress status:", response.status);

  let data;

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(
      `WordPress returned invalid JSON. Status ${response.status}: ${rawText.substring(0, 200)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `WordPress API error ${response.status}: ${
        data.message || data.code || "Unknown error"
      }`
    );
  }

  return data;
}

/* =========================
   CREATE POST CONTENT
========================= */

function createContent(quiz, date) {
  const questions = quiz.map(item => `
    <div class="telenor-quiz-item">
      <h3>Question ${item.number}</h3>
      <p><strong>${escapeHtml(item.question)}</strong></p>
      <p>✅ <strong>Answer:</strong> ${escapeHtml(item.answer)}</p>
    </div>
    <hr>
  `).join("");

  return `
    <h1>Telenor Quiz Answers Today</h1>

    <p><strong>Date:</strong> ${escapeHtml(date)}</p>

    <p>Here are today's 5 Telenor Quiz answers.</p>

    ${questions}

    <p><em>Last updated automatically.</em></p>
  `;
}

/* =========================
   UPDATE TODAY PAGE
========================= */

async function updateTodayPage(content) {
  console.log("Updating Today page...");

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

  console.log("TODAY PAGE UPDATED");
  console.log("Page ID:", data.id);
  console.log("Page URL:", data.link);

  return data;
}

/* =========================
   CHECK DUPLICATE POST
========================= */

async function findExistingPost(title) {
  const posts = await wpRequest(
    `/posts?search=${encodeURIComponent(title)}&per_page=100`
  );

  return posts.find(post =>
    String(post.title?.rendered || "")
      .trim()
      .toLowerCase() ===
    title.trim().toLowerCase()
  );
}

/* =========================
   CREATE ARCHIVE POST
========================= */

async function createArchivePost(content, title) {
  console.log("Checking archive post...");

  const existing = await findExistingPost(title);

  if (existing) {
    console.log("POST ALREADY EXISTS");
    console.log("Post ID:", existing.id);
    console.log("Post URL:", existing.link);
    return existing;
  }

  console.log("Creating archive post...");

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

  console.log("ARCHIVE POST CREATED SUCCESSFULLY");
  console.log("Post ID:", data.id);
  console.log("Post URL:", data.link);

  return data;
}

/* =========================
   MAIN
========================= */

async function main() {
  console.log("======================================");
  console.log("TELENOR QUIZ AUTO POSTER STARTED");
  console.log("======================================");

  const date = getPakistanDate();

  const title =
    `Telenor Quiz Answers Today - ${date}`;

  console.log("Pakistan Date:", date);
  console.log("Post Title:", title);

  console.log("");
  console.log("STEP 1: FETCH QUIZ");

  const quiz = await fetchQuiz();

  console.log("");
  console.log("SUCCESS: 5 QUIZ ANSWERS FOUND");

  console.log("");
  console.log("STEP 2: CREATE CONTENT");

  const content = createContent(quiz, date);

  console.log("");
  console.log("STEP 3: UPDATE TODAY PAGE");

  const page = await updateTodayPage(content);

  console.log("");
  console.log("STEP 4: CREATE ARCHIVE POST");

  const post = await createArchivePost(content, title);

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
  console.error(error.message);

  process.exit(1);
});
