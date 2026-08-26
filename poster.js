const SOURCE_URL = "https://todaymytelenoranswer.pk/";
const TODAY_PAGE_ID = 26;
const SITE_NAME = "Telenor Quiz PK";

/* =========================================
   DATE
========================================= */

function getPakistanDate() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date());
}

function getFileDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

/* =========================================
   HTML / SVG SAFETY
========================================= */

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeXml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* =========================================
   HTML TO TEXT
========================================= */

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
    .filter(Boolean);
}

/* =========================================
   FETCH QUIZ
========================================= */

async function fetchQuiz() {
  console.log("Fetching quiz source...");
  console.log("Source:", SOURCE_URL);

  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "text/html"
    }
  });

  if (!response.ok) {
    throw new Error(`Quiz source failed: ${response.status}`);
  }

  const html = await response.text();
  const lines = htmlToText(html);

  console.log("Extracted text lines:", lines.length);

  const quiz = [];

  for (let i = 0; i < lines.length; i++) {
    const questionMatch = lines[i].match(
      /^Question\s*(?:No\.?|Number)?\s*:\s*0?([1-5])$/i
    );

    if (!questionMatch) continue;

    const number = Number(questionMatch[1]);

    let question = "";
    let answer = "";

    /* Find question after Question No */
    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      if (/^Answer\s*(?:No\.?)?\s*:?\s*0?[1-5]?$/i.test(lines[j])) {
        break;
      }

      if (
        lines[j].length > 5 &&
        !/^Question/i.test(lines[j])
      ) {
        question = lines[j];
        break;
      }
    }

    /* Find Answer label and actual answer */
    for (let j = i + 1; j < Math.min(i + 25, lines.length); j++) {
      if (
        j > i + 1 &&
        /^Question\s*(?:No\.?|Number)?\s*:\s*0?[1-5]$/i.test(lines[j])
      ) {
        break;
      }

      const inlineAnswer = lines[j].match(
        /^(?:Correct\s*)?Answer\s*:\s*(.+)$/i
      );

      if (inlineAnswer && inlineAnswer[1]) {
        answer = inlineAnswer[1].trim();
        break;
      }

      if (/^(?:Correct\s*)?Answer\s*$/i.test(lines[j])) {
        for (let k = j + 1; k < Math.min(j + 5, lines.length); k++) {
          const candidate = lines[k].trim();

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
    }

    if (question && answer) {
      quiz.push({ number, question, answer });

      console.log(`FOUND Q${number}: ${question}`);
      console.log(`ANSWER ${number}: ${answer}`);
    }
  }

  const uniqueQuiz = [];

  for (const item of quiz) {
    if (!uniqueQuiz.some(x => x.number === item.number)) {
      uniqueQuiz.push(item);
    }
  }

  uniqueQuiz.sort((a, b) => a.number - b.number);

  console.log("Total quiz answers found:", uniqueQuiz.length);

  if (uniqueQuiz.length < 5) {
    console.log("----- QUIZ DEBUG -----");

    lines.forEach((line, index) => {
      if (/Question No|Answer/i.test(line)) {
        console.log(`${index}: ${line}`);
      }
    });

    console.log("----- END DEBUG -----");

    throw new Error(
      `Could not extract all 5 questions and answers. Found ${uniqueQuiz.length}.`
    );
  }

  return uniqueQuiz.slice(0, 5);
}

/* =========================================
   WORDPRESS API
========================================= */

async function wpRequest(path, options = {}) {
  const WP_URL = process.env.WP_URL;
  const WP_USERNAME = process.env.WP_USERNAME;
  const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

  if (!WP_URL) throw new Error("Missing WP_URL secret.");
  if (!WP_USERNAME) throw new Error("Missing WP_USERNAME secret.");
  if (!WP_APP_PASSWORD) throw new Error("Missing WP_APP_PASSWORD secret.");

  const auth = Buffer.from(
    `${WP_USERNAME}:${WP_APP_PASSWORD}`
  ).toString("base64");

  const url =
    `${WP_URL.replace(/\/$/, "")}/wp-json/wp/v2${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Basic ${auth}`,
      "Accept": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `WordPress invalid response (${response.status}): ${text.substring(0, 200)}`
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

/* =========================================
   TEXT WRAPPING FOR IMAGE
========================================= */

function wrapText(text, maxChars = 38) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;

    if (test.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);

  return lines;
}

/* =========================================
   CREATE PROFESSIONAL QUIZ SVG IMAGE
========================================= */

function createQuizImage(item, date) {
  const questionLines = wrapText(item.question, 42);
  const answerLines = wrapText(item.answer, 38);

  const questionSvg = questionLines
    .map((line, index) => `
      <text
        x="70"
        y="${390 + index * 48}"
        font-family="Arial, sans-serif"
        font-size="32"
        font-weight="600"
        fill="#172033"
      >
        ${escapeXml(line)}
      </text>
    `)
    .join("");

  const answerStart = 650;

  const answerSvg = answerLines
    .map((line, index) => `
      <text
        x="85"
        y="${answerStart + index * 52}"
        font-family="Arial, sans-serif"
        font-size="36"
        font-weight="700"
        fill="#087443"
      >
        ${escapeXml(line)}
      </text>
    `)
    .join("");

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1200"
  height="900"
  viewBox="0 0 1200 900"
>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7fbff"/>
      <stop offset="100%" stop-color="#e8f5ff"/>
    </linearGradient>

    <linearGradient id="header" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0a5fa8"/>
      <stop offset="100%" stop-color="#1288d4"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="900" fill="url(#bg)"/>

  <rect
    x="0"
    y="0"
    width="1200"
    height="190"
    fill="url(#header)"
  />

  <text
    x="70"
    y="75"
    font-family="Arial, sans-serif"
    font-size="30"
    font-weight="700"
    fill="#d9efff"
  >
    ${SITE_NAME.toUpperCase()}
  </text>

  <text
    x="70"
    y="135"
    font-family="Arial, sans-serif"
    font-size="52"
    font-weight="800"
    fill="#ffffff"
  >
    TODAY'S QUIZ ANSWER
  </text>

  <rect
    x="930"
    y="45"
    width="190"
    height="90"
    rx="45"
    fill="#ffffff"
  />

  <text
    x="1025"
    y="102"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="32"
    font-weight="800"
    fill="#0a5fa8"
  >
    Q${item.number}
  </text>

  <rect
    x="55"
    y="240"
    width="1090"
    height="290"
    rx="28"
    fill="#ffffff"
    stroke="#d9e8f3"
    stroke-width="3"
  />

  <text
    x="70"
    y="310"
    font-family="Arial, sans-serif"
    font-size="24"
    font-weight="700"
    fill="#1682c5"
  >
    QUESTION ${item.number}
  </text>

  ${questionSvg}

  <rect
    x="55"
    y="590"
    width="1090"
    height="190"
    rx="28"
    fill="#e9f9ef"
    stroke="#b9e7c9"
    stroke-width="3"
  />

  <text
    x="85"
    y="635"
    font-family="Arial, sans-serif"
    font-size="23"
    font-weight="700"
    fill="#087443"
  >
    ✓ VERIFIED CORRECT ANSWER
  </text>

  ${answerSvg}

  <text
    x="600"
    y="850"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="24"
    fill="#6b7b88"
  >
    ${escapeXml(date)} • Updated Daily
  </text>
</svg>
`;
}

/* =========================================
   UPLOAD IMAGE TO WORDPRESS
========================================= */

async function uploadImage(svg, filename, altText) {
  const WP_URL = process.env.WP_URL;
  const WP_USERNAME = process.env.WP_USERNAME;
  const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

  const auth = Buffer.from(
    `${WP_USERNAME}:${WP_APP_PASSWORD}`
  ).toString("base64");

  const url =
    `${WP_URL.replace(/\/$/, "")}/wp-json/wp/v2/media`;

  console.log("Uploading image:", filename);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Disposition":
        `attachment; filename="${filename}"`,
      "Content-Type": "image/svg+xml"
    },
    body: Buffer.from(svg)
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Image upload invalid response: ${text.substring(0, 300)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Image upload failed ${response.status}: ${
        data.message || "Unknown error"
      }`
    );
  }

  console.log("IMAGE UPLOADED");
  console.log("Image ID:", data.id);
  console.log("Image URL:", data.source_url);

  return {
    id: data.id,
    url: data.source_url,
    alt: altText
  };
}

/* =========================================
   CREATE POST CONTENT
========================================= */

function createContent(quiz, date, images) {
  const imageHtml = images.map((image, index) => `
    <section style="margin:35px 0;">
      <h2>
        Question ${quiz[index].number}
      </h2>

      <img
        src="${escapeHtml(image.url)}"
        alt="${escapeHtml(image.alt)}"
        style="
          width:100%;
          max-width:1200px;
          height:auto;
          border-radius:16px;
          display:block;
          margin:15px auto;
        "
      >

      <p>
        <strong>Question:</strong>
        ${escapeHtml(quiz[index].question)}
      </p>

      <p>
        <strong>Correct Answer:</strong>
        ${escapeHtml(quiz[index].answer)}
      </p>
    </section>
  `).join("");

  return `
<h1>Telenor Quiz Answers Today - ${escapeHtml(date)}</h1>

<p>
  Get today's latest Telenor Quiz answers.
  Below are all 5 questions with verified answers.
</p>

${imageHtml}

<hr>

<h2>How to Play Telenor Quiz</h2>

<ol>
  <li>Open the My Telenor App.</li>
  <li>Go to the daily quiz section.</li>
  <li>Answer all 5 questions.</li>
  <li>Use today's verified answers above.</li>
</ol>

<p>
  <strong>Last Updated:</strong> ${escapeHtml(date)}
</p>
`;
}

/* =========================================
   UPDATE TODAY PAGE
========================================= */

async function updateTodayPage(content) {
  console.log("Updating Today page...");

  const body = new URLSearchParams({
    title: "Today Telenor Answer",
    content,
    status: "publish"
  });

  const data = await wpRequest(
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

  console.log("TODAY PAGE UPDATED:", data.link);

  return data;
}

/* =========================================
   CHECK DUPLICATE
========================================= */

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

/* =========================================
   CREATE ARCHIVE POST
========================================= */

async function createArchivePost(
  content,
  title,
  featuredImageId
) {
  console.log("Checking for existing post...");

  const existing = await findExistingPost(title);

  if (existing) {
    console.log("POST ALREADY EXISTS:", existing.link);
    return existing;
  }

  console.log("Creating professional archive post...");

  const body = new URLSearchParams({
    title,
    content,
    status: "publish"
  });

  if (featuredImageId) {
    body.append("featured_media", featuredImageId);
  }

  const data = await wpRequest(
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

  console.log("POST CREATED SUCCESSFULLY");
  console.log("Post ID:", data.id);
  console.log("Post URL:", data.link);

  return data;
}

/* =========================================
   MAIN
========================================= */

async function main() {
  console.log("======================================");
  console.log("TELENOR QUIZ IMAGE AUTO POSTER");
  console.log("======================================");

  const date = getPakistanDate();
  const fileDate = getFileDate();

  const title =
    `Telenor Quiz Answers Today - ${date}`;

  console.log("Date:", date);
  console.log("Title:", title);

  console.log("");
  console.log("STEP 1: FETCH QUIZ");

  const quiz = await fetchQuiz();

  console.log("");
  console.log("SUCCESS: 5 QUIZZES FOUND");

  console.log("");
  console.log("STEP 2: GENERATE AND UPLOAD 5 IMAGES");

  const images = [];

  for (const item of quiz) {
    const svg = createQuizImage(item, date);

    const filename =
      `telenor-quiz-${fileDate}-question-${item.number}.svg`;

    const altText =
      `Telenor Quiz Question ${item.number} Answer ${date}`;

    const image = await uploadImage(
      svg,
      filename,
      altText
    );

    images.push(image);
  }

  console.log("");
  console.log(`SUCCESS: ${images.length} IMAGES UPLOADED`);

  console.log("");
  console.log("STEP 3: CREATE PROFESSIONAL CONTENT");

  const content =
    createContent(quiz, date, images);

  console.log("");
  console.log("STEP 4: UPDATE TODAY PAGE");

  const page =
    await updateTodayPage(content);

  console.log("");
  console.log("STEP 5: CREATE DAILY POST");

  const post =
    await createArchivePost(
      content,
      title,
      images[0]?.id
    );

  console.log("");
  console.log("======================================");
  console.log("AUTO POST COMPLETED SUCCESSFULLY");
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
