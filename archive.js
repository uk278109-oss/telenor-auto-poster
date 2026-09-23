const fs = require("fs");

const QUIZ_FILE = "quiz.json";
const ARCHIVE_FILE = "quiz-archive.json";

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function saveJson(file, data) {
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2)
  );
}

function main() {
  const current = loadJson(QUIZ_FILE, null);

  if (!current || !current.date || !Array.isArray(current.quiz)) {
    throw new Error("quiz.json is missing or invalid.");
  }

  const archive = loadJson(ARCHIVE_FILE, {
    quizzes: []
  });

  if (!Array.isArray(archive.quizzes)) {
    archive.quizzes = [];
  }

  const exists = archive.quizzes.some(
    item => item.date === current.date
  );

  if (!exists) {
    archive.quizzes.push({
      date: current.date,
      quiz: current.quiz
    });

    archive.quizzes.sort(
      (a, b) =>
        new Date(b.date) - new Date(a.date)
    );

    saveJson(ARCHIVE_FILE, archive);

    console.log(
      `✓ Archived quiz: ${current.date}`
    );
  } else {
    console.log(
      `✓ Quiz already archived: ${current.date}`
    );
  }
}

main();
