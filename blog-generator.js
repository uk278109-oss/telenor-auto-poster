const fs = require("fs");

function load(file) {
  return JSON.parse(
    fs.readFileSync(file, "utf8")
  );
}

function main() {
  const blogs = load("blogs.json");
  const quiz = load("quiz.json");

  const output = {
    generatedAt: new Date().toISOString(),
    latestQuizDate: quiz.date,
    blogs: blogs.blogs.map(blog => ({
      ...blog,
      updatedForQuizDate: quiz.date
    }))
  };

  fs.writeFileSync(
    "blog-pages.json",
    JSON.stringify(output, null, 2)
  );

  console.log("✓ Blog pages data generated.");
}

main();
