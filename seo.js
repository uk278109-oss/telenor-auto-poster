const fs = require("fs");

const quiz = JSON.parse(
  fs.readFileSync("quiz.json", "utf8")
);

const blogs = JSON.parse(
  fs.readFileSync("blogs.json", "utf8")
);

const faq = JSON.parse(
  fs.readFileSync("faq.json", "utf8")
);

const sitemap = [
  "/",
  "/quiz",
  "/quiz/archive",
  "/blogs",
  "/faq",
  "/about",
  "/contact",
  ...blogs.blogs.map(
    blog => `/blogs/${blog.slug}`
  )
];

const data = {
  title: `Telenor Quiz Answers - ${quiz.date}`,
  description:
    "Latest verified Telenor quiz questions, answers, guides and information.",
  lastUpdated: quiz.date,
  pages: sitemap,
  faqCount: faq.faqs.length,
  blogCount: blogs.blogs.length
};

fs.writeFileSync(
  "seo.json",
  JSON.stringify(data, null, 2)
);

console.log("✓ SEO data generated.");
