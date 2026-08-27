const fs = require("fs");

const SOURCE_URL = "https://todaymytelenoranswer.pk/";

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
  console.log("Source:", SOURCE_URL);

  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept": "text/html,*/*"
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

    /* FIND QUESTION */

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

    /* FIND ANSWER */

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

      quiz.push({
        number,
        question,
        answer
      });

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

  console.log(
    "Total unique quiz answers found:",
    unique.length
  );

  if (unique.length < 5) {
    throw new Error(
      `Could not extract all 5 quiz answers. Found only ${unique.length}.`
    );
  }

  return unique.slice(0, 5);
}

/* =========================
   SAVE QUIZ.JSON
========================= */

function saveQuiz(quiz) {

  const data = {
    date: getPakistanDate(),
    quiz: quiz
  };

  fs.writeFileSync(
    "quiz.json",
    JSON.stringify(data, null, 2)
  );

  console.log("quiz.json updated successfully!");
}

/* =========================
   MAIN
========================= */

async function main() {

  console.log("======================================");
  console.log("TELENOR QUIZ AUTO POSTER STARTED");
  console.log("======================================");

  console.log("Pakistan Date:", getPakistanDate());

  console.log("\nSTEP 1: FETCH QUIZ");

  const quiz = await fetchQuiz();

  console.log("\nSTEP 2: UPDATE QUIZ.JSON");

  saveQuiz(quiz);

  console.log("\n======================================");
  console.log("QUIZ UPDATE SUCCESSFUL!");
  console.log("======================================");
}

main().catch(error => {

  console.error("\n======================================");
  console.error("AUTO POSTER FAILED");
  console.error("======================================");

  console.error(error.message);

  process.exit(1);
});
