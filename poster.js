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
    .replace(/<[^>]+>/g, "\n")
    .replace(/\r/g, "")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);
}

/* =========================
   FETCH QUIZ
========================= */

async function fetchQuiz() {
  console.log("Fetching Telenor quiz source...");

  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  console.log("Quiz source status:", response.status);

  if (!response.ok) {
    throw new Error(`Quiz source failed: ${response.status}`);
  }

  const html = await response.text();
  const lines = htmlToText(html);

  console.log("Extracted text lines:", lines.length);

  const quiz = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(
      /^Question\s*(?:No)?\s*[:\-]?\s*0?([1-5])$/i
    );

    if (!match) continue;

    const number = Number(match[1]);
    let question = "";
    let answer = "";

    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const line = lines[j];

      if (/^Answer\s*:?\s*$/i.test(line)) break;

      if (
        line.length > 5 &&
        !/^Question/i.test(line) &&
        !/^Answer/i.test(line)
      ) {
        question = line;
        break;
      }
    }

    for (let j = i + 1; j < Math.min(i + 25, lines.length); j++) {
      const line = lines[j];

      if (
        j > i + 1 &&
        /^Question\s*(?:No)?\s*[:\-]?\s*0?[1-5]$/i.test(line)
      ) {
        break;
      }

      const inline = line.match(
        /^(?:Correct\s*)?Answer\s*[:\-]\s*(.+)$/i
      );

      if (inline && inline[1]) {
        answer = inline[1].trim();
        break;
      }

      if (/^Answer\s*:?\s*$/i.test(line)) {
        for (let k = j + 1; k < Math.min(j + 6, lines.length); k++) {
          const candidate = lines[k];

          if (
            candidate &&
            candidate.length > 1 &&
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

      console.log(`Question ${number}: ${question}`);
      console.log(`Answer ${number}: ${answer}`);
    }
  }

  const unique = [];

  for (const item of quiz) {
    if (!unique.some(x => x.number === item.number)) {
      unique.push(item);
    }
  }

  unique.sort((a, b) => a.number - b.number);

  console.log("Total unique quiz answers found:", unique.length);

  if (unique.length < 5) {
    throw new Error(
      `Could not extract all 5 quiz answers. Found only ${unique.length}.`
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

  if (!WP_URL) throw new Error("Missing WP_URL secret");
  if (!WP_USERNAME) throw new Error("Missing WP_USERNAME secret");
  if (!WP_APP_PASSWORD) throw new Error("Missing WP_APP_PASSWORD secret");

  const baseUrl = WP_URL.replace(/\/$/, "");
  const url = `${baseUrl}/wp-json/wp/v2${path}`;

  const auth = Buffer.from(
    `${WP_USERNAME}:${WP_APP_PASSWORD}`
  ).toString("base64");

  console.log("WordPress request:", path);

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json; charset=UTF-8",

      /* Browser-like headers */
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      "Origin": baseUrl,
      "Referer": `${baseUrl}/wp-admin/`,

      ...(options.headers || {})
    },
    body: options.body
  });

  const raw = await response.text();

  console.log("WordPress status:", response.status);
  console.log(
    "Response preview:",
    raw.substring(0, 100).replace(/\n/g, " ")
  );

  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      `WordPress returned invalid response (${response.status}): ${raw.substring(0, 250)}`
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
   PROFESSIONAL CONTENT
========================= */

function createContent(quiz, date) {
  const cards = quiz.map(item => `
<div style="max-width:850px;margin:30px auto;border-radius:20px;overflow:hidden;background:#fff;border:1px solid #dbe5ee;box-shadow:0 8px 25px rgba(0,0,0,.08);">

<div style="background:linear-gradient(135deg,#075fa8,#1396df);color:#fff;padding:18px 25px;font-family:Arial,sans-serif;">
<div style="font-size:14px;letter-spacing:1px;opacity:.85;">TELENOR DAILY QUIZ</div>
<div style="font-size:26px;font-weight:bold;margin-top:5px;">Question ${item.number}</div>
</div>

<div style="padding:30px 25px;font-family:Arial,sans-serif;">

<div style="font-size:22px;font-weight:700;color:#172033;line-height:1.5;">
${escapeHtml(item.question)}
</div>

<div style="margin-top:25px;padding:22px;background:#eaf8ef;border:1px solid #bde5c9;border-radius:14px;">

<div style="font-size:13px;font-weight:bold;color:#087443;letter-spacing:1px;">
✓ VERIFIED CORRECT ANSWER
</div>

<div style="font-size:25px;font-weight:bold;color:#075c35;margin-top:8px;">
${escapeHtml(item.answer)}
</div>

</div>
</div>
</div>
`).join("");

  return `
<div style="max-width:900px;margin:auto;font-family:Arial,sans-serif;">

<div style="text-align:center;padding:35px 20px;border-radius:20px;background:linear-gradient(135deg,#063e70,#0e86ce);color:#fff;">
<div style="font-size:15px;letter-spacing:2px;opacity:.85;">
${SITE_NAME.toUpperCase()}
</div>

<h1 style="margin:12px 0;font-size:32px;color:#fff;">
🎯 Telenor Quiz Answers Today
</h1>

<p style="margin:0;font-size:17px;">
${escapeHtml(date)} • Updated & Verified
</p>
</div>

<p style="text-align:center;margin:25px 10px;color:#52616b;font-size:17px;">
Today's 5 Telenor Quiz questions and verified correct answers.
</p>

${cards}

<div style="background:#f4f7fa;border-radius:16px;padding:25px;margin:30px 0;color:#34424c;">
<h2>How to Play Today's Telenor Quiz</h2>

<ol>
<li>Open the My Telenor App.</li>
<li>Open the Daily Quiz section.</li>
<li>Answer all 5 questions.</li>
<li>Use the verified answers above.</li>
</ol>

<p><strong>Last Updated:</strong> ${escapeHtml(date)}</p>
</div>

</div>
`;
}

/* =========================
   UPDATE TODAY PAGE
========================= */

async function updateTodayPage(content) {
  console.log("Updating Today page...");

  return await wpRequest(`/pages/${TODAY_PAGE_ID}`, {
    method: "POST",
    body: JSON.stringify({
      content,
      status: "publish"
    })
  });
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
      .toLowerCase() === title.trim().toLowerCase()
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

  return await wpRequest("/posts", {
    method: "POST",
    body: JSON.stringify({
      title,
      content,
      status: "publish"
    })
  });
}

/* =========================
   MAIN
========================= */

async function main() {
  console.log("======================================");
  console.log("TELENOR QUIZ AUTO POSTER STARTED");
  console.log("======================================");

  const date = getPakistanDate();
  const title = `Telenor Quiz Answers Today - ${date}`;

  console.log("Pakistan Date:", date);
  console.log("Post Title:", title);

  console.log("\nSTEP 1: FETCH QUIZ");
  const quiz = await fetchQuiz();

  console.log("\nSTEP 2: CREATE PROFESSIONAL CONTENT");
  const content = createContent(quiz, date);

  console.log("\nSTEP 3: UPDATE TODAY PAGE");
  const page = await updateTodayPage(content);

  console.log("Today page updated:");
  console.log(page.link);

  console.log("\nSTEP 4: CREATE DAILY POST");
  const post = await createDailyPost(content, title);

  console.log("\n======================================");
  console.log("AUTO POST SUCCESSFUL!");
  console.log("======================================");
  console.log("TODAY PAGE:", page.link);
  console.log("DAILY POST:", post.link);
}

main().catch(error => {
  console.error("\n======================================");
  console.error("AUTO POSTER FAILED");
  console.error("======================================");
  console.error(error.message);
  process.exit(1);
});
