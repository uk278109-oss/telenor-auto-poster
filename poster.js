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
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
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
      /^Question\s*(?:No\.?)?\s*[:\-]?\s*0?([1-5])$/i
    );

    if (!match) continue;

    const number = Number(match[1]);
    let question = "";
    let answer = "";

    /* Find question */

    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const line = lines[j];

      if (
        line.length > 5 &&
        !/^Question/i.test(line) &&
        !/^Answer/i.test(line) &&
        !/^Correct/i.test(line)
      ) {
        question = line;
        break;
      }
    }

    /* Find answer */

    for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
      const line = lines[j];

      if (
        j > i + 1 &&
        /^Question\s*(?:No\.?)?\s*[:\-]?\s*0?[1-5]$/i.test(line)
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

      if (/^(?:Correct\s*)?Answer\s*:?\s*$/i.test(line)) {
        for (let k = j + 1; k < Math.min(j + 8, lines.length); k++) {
          const candidate = lines[k];

          if (
            candidate &&
            candidate.length > 1 &&
            !/^Question/i.test(candidate) &&
            !/^Answer/i.test(candidate) &&
            !/^Correct/i.test(candidate)
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
      "Accept": "application/json",
      "Content-Type": "application/json; charset=UTF-8",
      "User-Agent": "Mozilla/5.0",
      ...(options.headers || {})
    },

    body: options.body
  });

  const raw = await response.text();

  console.log("WordPress status:", response.status);
  console.log(
    "Response preview:",
    raw.substring(0, 150).replace(/\n/g, " ")
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
   CREATE QUIZ CARD
========================= */

function createQuizCard(item) {
  return `
<div style="max-width:850px;margin:28px auto;background:#111111;border-radius:20px;padding:3px;box-shadow:0 10px 30px rgba(0,0,0,.18);">

  <div style="background:#ffffff;border-radius:18px;overflow:hidden;">

    <div style="background:linear-gradient(135deg,#075fa8,#1396df);color:#ffffff;padding:20px 24px;font-family:Arial,sans-serif;">
      <div style="font-size:12px;letter-spacing:2px;opacity:.85;font-weight:bold;">
        TELENOR QUIZ PK
      </div>

      <div style="font-size:25px;font-weight:bold;margin-top:6px;">
        Question ${item.number}
      </div>
    </div>

    <div style="padding:28px 24px;font-family:Arial,sans-serif;">

      <div style="font-size:21px;font-weight:700;color:#172033;line-height:1.6;">
        ${escapeHtml(item.question)}
      </div>

      <div style="margin-top:25px;text-align:center;font-size:12px;font-weight:bold;letter-spacing:1px;color:#64748b;">
        ✓ CORRECT ANSWER
      </div>

      <div style="margin-top:10px;padding:18px;background:linear-gradient(135deg,#0074c2,#00a0e3);border-radius:13px;color:#ffffff;text-align:center;font-size:21px;font-weight:bold;">
        ${escapeHtml(item.answer)}
      </div>

      <div dir="rtl" style="margin-top:18px;padding:14px;background:#f1f5f9;border-radius:10px;text-align:right;font-size:16px;color:#334155;">
        درست جواب: <strong>${escapeHtml(item.answer)}</strong>
      </div>

    </div>

  </div>

</div>`;
}

/* =========================
   PROFESSIONAL CONTENT
========================= */

function createContent(quiz, date) {
  const cards = quiz.map(createQuizCard).join("");

  return `
<div style="max-width:950px;margin:auto;font-family:Arial,sans-serif;">

  <div style="background:linear-gradient(135deg,#050505,#172033);border-radius:22px;padding:38px 20px;text-align:center;color:#ffffff;margin-bottom:25px;">

    <div style="font-size:13px;letter-spacing:3px;color:#72c8ff;font-weight:bold;">
      ${SITE_NAME.toUpperCase()}
    </div>

    <h1 style="margin:15px 0 10px;font-size:32px;color:#ffffff;">
      Telenor Quiz Answers Today
    </h1>

    <div style="font-size:16px;color:#dbeafe;">
      ${escapeHtml(date)} • Updated & Verified
    </div>

  </div>

  <div style="max-width:850px;margin:20px auto 30px;padding:20px;background:#f8fafc;border-radius:14px;text-align:center;color:#475569;font-size:16px;line-height:1.8;">
    <strong>Today's 5 Telenor Quiz Questions & Correct Answers</strong>
    <br><br>
    <span dir="rtl">
      آج کے مائی ٹیلینور کوئز کے پانچ سوالات اور ان کے درست جوابات نیچے دیے گئے ہیں۔
    </span>
  </div>

  ${cards}

  <div style="max-width:850px;margin:35px auto;padding:28px;background:#111827;border-radius:18px;color:#ffffff;">

    <h2 style="margin-top:0;color:#ffffff;">
      How to Play Today's Telenor Quiz
    </h2>

    <ol style="line-height:2;color:#dbeafe;">
      <li>Open the MyTelenor App.</li>
      <li>Open the Daily Quiz section.</li>
      <li>Answer all 5 questions.</li>
      <li>Use the verified answers above.</li>
    </ol>

    <div dir="rtl" style="border-top:1px solid #334155;margin-top:20px;padding-top:20px;text-align:right;line-height:2;color:#dbeafe;">
      <strong>ٹیلینور کوئز کیسے کھیلیں؟</strong>
      <br>
      مائی ٹیلینور ایپ کھولیں، ڈیلی کوئز سیکشن میں جائیں اور پانچوں سوالات کے درست جواب منتخب کریں۔
    </div>

    <p style="margin-bottom:0;color:#93c5fd;">
      Last Updated: ${escapeHtml(date)}
    </p>

  </div>

  <div style="max-width:850px;margin:25px auto;padding:18px;background:#f1f5f9;border-left:4px solid #008bd2;border-radius:10px;color:#64748b;font-size:13px;line-height:1.8;">
    <strong>Disclaimer:</strong>
    This website is an independent informational website and is not officially affiliated with Telenor Pakistan.
  </div>

</div>`;
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

/* =========================
   ERROR HANDLER
========================= */

main().catch(error => {
  console.error("\n======================================");
  console.error("AUTO POSTER FAILED");
  console.error("======================================");
  console.error(error.message);
  process.exit(1);
});
