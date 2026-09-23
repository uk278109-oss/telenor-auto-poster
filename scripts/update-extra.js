const { execFileSync } = require("child_process");

function run(file) {
  console.log(`\nRunning ${file}...`);

  execFileSync(
    "node",
    [file],
    {
      stdio: "inherit"
    }
  );
}

try {
  run("archive.js");
  run("blog-generator.js");
  run("seo.js");

  console.log("\n✓ Extra system completed.");
} catch (error) {
  console.error(
    "\nExtra system failed:",
    error.message
  );

  process.exit(1);
}
