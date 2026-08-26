const SOURCE_URL = "https://todaymytelenoranswer.pk/";
const TODAY_PAGE_ID = 26;
const SITE_NAME = "Telenor Quiz PK";

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
   HTML TO TEXT
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
    .map(line => line.trim())
    .filter(Boolean);
}

/* =========================
   FETCH 5 QUIZ ANSWERS
========================= */

async function fetchQuiz() {
  console.log("Fetching Telenor quiz...");

  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
    }
  });

  console.log("Source status:", response.status);

  if (!response.ok) {
    throw new Error(`Source failed: ${response.status}`);
  }

  const html = await response.text();
  const lines = htmlToText(html);

  console.log("Text lines:", lines.length);

  const quiz = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(
      /^Question\s*No\s*:\s*0?([1-5])$/i
    );

    if (!match) continue;

    const number = Number(match[1]);

    let question = "";
    let answer = "";

    /* Find question */
    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const line = lines[j];

      if (/^Answer$/i.test(line)) break;

      if (
        line.length > 5 &&
        !/^Question/i.test(line) &&
        !/^[A-D][\.\)]/i.test(line)
      ) {
        question = line;
        break;
      }
    }

    /* Find Answer label */
    for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
      const line = lines[j];

      if (
        j > i + 1 &&
        /^Question\s*No\s*:\s*0?[1-5]$/i.test(line)
      ) {
        break;
      }

      if (/^Answer$/i.test(line)) {
        for (
          let k = j + 1;
          k < Math.min(j + 8, lines.length);
          k++
        ) {
          const candidate = lines[k];

          if (
            candidate &&
            !/^Question/i.test(candidate) &&
            !/^Answer/i.test(candidate)
          ) {
            answer = candidate;
            break;
          }
        }

        if (answer) break;
      }

      const inline = line.match(
        /^(?:Correct\s*)?Answer\s*:\s*(.+)$/i
      );

      if (inline) {
        answer = inline[1].trim();
        break;
      }
    }

    if (question && answer) {
      quiz.push({
        number,
        question,
        answer
      });

      console.log(`Q${number}: ${question}`);
      console.log(`A${number}: ${answer}`);
    }
  }

  const unique = [];

  for (const item of quiz) {
    if (!unique.some(x => x.number === item.number)) {
      unique.push(item);
    }
  }

  unique.sort((a, b) => a.number - b.number);

  console.log("Quiz found:", unique.length);

  if (unique.length < 5) {
    throw new Error(
      `Could not find all 5 quiz answers. Found: ${unique.length}`
    );
  }

  return unique.slice(0, 5);
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
  if (!WP_APP_PASSWORD) {
    throw new Error("Missing WP_APP_PASSWORD");
  }

  const auth = Buffer.from(
    `${WP_USERNAME}:${WP_APP_PASSWORD}`
  ).toString("base64");

  const url =
    `${WP_URL.replace(/\/$/, "")}/wp-json/wp/v2${path}`;

  console.log("WP:", path);

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  const raw = await response.text();

  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      `WordPress returned invalid response (${response.status}): ${raw.substring(0, 150)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `WordPress error ${response.status}: ${
        data.message || data.code || "Unknown error"
      }`
    );
  }

  return data;
}

/* =========================
   PROFESSIONAL QUIZ CARDS
========================= */

function createContent(quiz, date) {
  const cards = quiz.map(item => `
<div style="
  max-width:850px;
  margin:30px auto;
  border-radius:20px;
  overflow:hidden;
  background:#ffffff;
  border:1px solid #dbe5ee;
  box-shadow:0 8px 25px rgba(0,0,0,0.08);
">

  <div style="
    background:linear-gradient(135deg,#075fa8,#1396df);
    color:#ffffff;
    padding:18px 25px;
    font-family:Arial,sans-serif;
  ">
    <div style="
      font-size:14px;
      opacity:0.8;
      letter-spacing:1px;
    ">
      TELENOR DAILY QUIZ
    </div>

    <div style="
      font-size:26px;
      font-weight:bold;
      margin-top:5px;
    ">
      Question ${item.number}
    </div>
  </div>

  <div style="
    padding:30px 25px;
    font-family:Arial,sans-serif;
  ">

    <div style="
      font-size:22px;
      font-weight:700;
      color:#172033;
      line-height:1.5;
    ">
      ${escapeHtml(item.question)}
    </div>

    <div style="
      margin-top:25px;
      padding:22px;
      background:#eaf8ef;
      border:1px solid #bde5c9;
      border-radius:14px;
    ">

      <div style="
        font-size:13px;
        font-weight:bold;
        color:#087443;
        letter-spacing:1px;
      ">
        ✓ VERIFIED CORRECT ANSWER
      </div>

      <div style="
        font-size:25px;
        font-weight:bold;
        color:#075c35;
        margin-top:8px;
      ">
        ${escapeHtml(item.answer)}
      </div>

    </div>

  </div>

</div>
`).join("");

  return `
<div style="
  max-width:900px;
  margin:auto;
  font-family:Arial,sans-serif;
">

  <div style="
    text-align:center;
    padding:35px 20px;
    border-radius:20px;
    background:linear-gradient(135deg,#063e70,#0e86ce);
    color:#ffffff;
  ">
    <div style="
      font-size:15px;
      letter-spacing:2px;
      opacity:0.85;
    ">
      ${SITE_NAME.toUpperCase()}
    </div>

    <h1 style="
      margin:12px 0;
      font-size:32px;
      color:#ffffff;
    ">
      🎯 Telenor Quiz Answers Today
    </h1>

    <p style="
      margin:0;
      font-size:17px;
    ">
      ${escapeHtml(date)} • Updated & Verified
    </p>
  </div>

  <div style="
    text-align:center;
    margin:25px 10px 10px;
    color:#52616b;
    font-size:17px;
  ">
    Below are today's 5 Telenor Quiz questions and correct answers.
  </div>

  ${cards}

  <div style="
    background:#f4f7fa;
    border-radius:16px;
    padding:25px;
    margin:30px 0;
    color:#34424c;
  ">
    <h2 style="margin-top:0;">
      How to Play Today's Telenor Quiz
    </h2>

    <ol>
      <li>Open the My Telenor App.</li>
      <li>Go to the Daily Quiz section.</li>
      <li>Answer all 5 questions.</li>
      <li>Use the verified answers above.</li>
    </ol>

    <p>
      <strong>Last Updated:</strong>
      ${escapeHtml(date)}
    </p>
  </div>

</div>
`;
}

/* =========================
   UPDATE TODAY PAGE
========================= */

async function updateTodayPage(content) {
  console.log("Updating Today page...");

  const body = new URLSearchParams({
    title: "Today Telenor Answer",
    content,
    status: "publish"
  });

  const page = await wpRequest(
    `/pages/${TODAY_PAGE_ID}`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body
    }
  );

  console.log("Today page updated:", page.link);

  return page;
}

/* =========================
   FIND EXISTING POST
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
   CREATE DAILY POST
========================= */

async function createDailyPost(content, title) {
  console.log("Checking existing post...");

  const existing = await findExistingPost(title);

  if (existing) {
    console.log("Post already exists:", existing.link);
    return existing;
  }

  console.log("Creating daily post...");

  const body = new URLSearchParams({
    title,
    content,
    status: "publish"
  });

  const post = await wpRequest(
    "/posts",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body
    }
  );

  console.log("POST CREATED!");
  console.log("Post URL:", post.link);

  return post;
}

/* =========================
   MAIN
========================= */

async function main() {
  console.log("================================");
  console.log("TELENOR QUIZ AUTO POSTER");
  console.log("================================");

  const date = getPakistanDate();

  const title =
    `Telenor Quiz Answers Today - ${date}`;

  console.log("Date:", date);

  console.log("STEP 1: Fetching quiz...");
  const quiz = await fetchQuiz();

  console.log("STEP 2: Creating professional cards...");
  const content = createContent(quiz, date);

  console.log("STEP 3: Updating Today page...");
  const page = await updateTodayPage(content);

  console.log("STEP 4: Creating daily post...");
  const post = await createDailyPost(content, title);

  console.log("================================");
  console.log("AUTO POST SUCCESSFUL!");
  console.log("Today Page:", page.link);
  console.log("Daily Post:", post.link);
  console.log("================================");
}

main().catch(error => {
  console.error("AUTO POSTER FAILED");
  console.error(error.message);
  process.exit(1);
});
