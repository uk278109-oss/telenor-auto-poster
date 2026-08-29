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

function getDateVariants() {
  const now = new Date();

  const longDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(now);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).formatToParts(now);

  const day = parts.find(x => x.type === "day")?.value;
  const month = parts.find(x => x.type === "month")?.value;
  const year = parts.find(x => x.type === "year")?.value;

  return [
    longDate,
    `${day} ${month} ${year}`,
    `${month} ${day}, ${year}`,
    `${day}-${month}-${year}`,
    `${day}/${month}/${year}`
  ];
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
    .map(x => x.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}


/* =========================
   DATE VALIDATION
========================= */

function verifyTodayDate(html, lines) {

  const today = getPakistanDate();
  const variants = getDateVariants();

  const searchableText = [
    html,
    lines.join("\n")
  ].join("\n");

  console.log("Expected Pakistan date:", today);

  const found = variants.some(date => {

    const normalizedDate =
      date.replace(/\s+/g, " ").trim();

    return searchableText.includes(normalizedDate);

  });

  if (!found) {
    throw new Error(
      `SOURCE DATE MISMATCH: Today's date (${today}) was not found. Old quiz will NOT be published.`
    );
  }

  console.log("✓ Today's date verified");
}


/* =========================
   VALIDATE QUIZ
========================= */

function validateQuiz(quiz) {

  if (quiz.length !== 5) {
    throw new Error(
      `Invalid quiz count. Expected 5, found ${quiz.length}`
    );
  }

  const numbers = quiz.map(x => x.number);

  for (let i = 1; i <= 5; i++) {
    if (!numbers.includes(i)) {
      throw new Error(
        `Missing Question ${i}`
      );
    }
  }

  const uniqueQuestions =
    new Set(
      quiz.map(x =>
        x.question.toLowerCase().trim()
      )
    );

  if (uniqueQuestions.size !== 5) {
    throw new Error(
      "Duplicate questions detected."
    );
  }

  for (const item of quiz) {

    if (!item.question || item.question.length < 8) {
      throw new Error(
        `Invalid question ${item.number}`
      );
    }

    if (!item.answer || item.answer.length < 1) {
      throw new Error(
        `Invalid answer ${item.number}`
      );
    }

  }

  console.log("✓ All 5 questions validated");
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

  console.log(
    "Quiz source status:",
    response.status
  );

  if (!response.ok) {
    throw new Error(
      `Quiz source failed: ${response.status}`
    );
  }

  const html = await response.text();

  const lines = htmlToText(html);

  console.log(
    "Extracted text lines:",
    lines.length
  );


  /* =========================
     CRITICAL DATE CHECK
  ========================= */

  verifyTodayDate(html, lines);


  const quiz = [];


  /* =========================
     EXTRACT QUESTIONS
  ========================= */

  for (let i = 0; i < lines.length; i++) {

    const match = lines[i].match(
      /^Question\s*(?:No\.?)?\s*[:\-]?\s*0?([1-5])$/i
    );

    if (!match) continue;

    const number = Number(match[1]);

    let question = "";
    let answer = "";


    /* FIND QUESTION */

    for (
      let j = i + 1;
      j < Math.min(i + 15, lines.length);
      j++
    ) {

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

    for (
      let j = i + 1;
      j < Math.min(i + 30, lines.length);
      j++
    ) {

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


      if (
        /^(?:Correct\s*)?Answer\s*:?\s*$/i.test(line)
      ) {

        for (
          let k = j + 1;
          k < Math.min(j + 8, lines.length);
          k++
        ) {

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

      console.log(
        `Question ${number}: ${question}`
      );

      console.log(
        `Answer ${number}: ${answer}`
      );

    }

  }


  /* =========================
     REMOVE DUPLICATES
  ========================= */

  const unique = [];

  for (const item of quiz) {

    if (
      !unique.some(
        x => x.number === item.number
      )
    ) {
      unique.push(item);
    }

  }

  unique.sort(
    (a, b) => a.number - b.number
  );


  console.log(
    "Total unique quiz answers found:",
    unique.length
  );


  const finalQuiz =
    unique.slice(0, 5);


  /* =========================
     FINAL VALIDATION
  ========================= */

  validateQuiz(finalQuiz);

  return finalQuiz;

}


/* =========================
   SAVE QUIZ.JSON
========================= */

function saveQuiz(quiz) {

  const data = {
    date: getPakistanDate(),
    quiz
  };

  fs.writeFileSync(
    "quiz.json",
    JSON.stringify(data, null, 2)
  );

  console.log(
    "✓ quiz.json updated successfully!"
  );

}


/* =========================
   MAIN
========================= */

async function main() {

  console.log(
    "======================================"
  );

  console.log(
    "TELENOR QUIZ AUTO UPDATE STARTED"
  );

  console.log(
    "======================================"
  );

  console.log(
    "Pakistan Date:",
    getPakistanDate()
  );


  console.log(
    "\nSTEP 1: FETCH + VERIFY QUIZ"
  );

  const quiz = await fetchQuiz();


  console.log(
    "\nSTEP 2: UPDATE QUIZ.JSON"
  );

  saveQuiz(quiz);


  console.log(
    "\n======================================"
  );

  console.log(
    "QUIZ UPDATE SUCCESSFUL!"
  );

  console.log(
    "======================================"
  );

}


main().catch(error => {

  console.error(
    "\n======================================"
  );

  console.error(
    "AUTO QUIZ UPDATE FAILED"
  );

  console.error(
    "======================================"
  );

  console.error(error.message);

  console.log(
    "\nIMPORTANT: Existing quiz.json was NOT overwritten."
  );

  process.exit(1);

});
