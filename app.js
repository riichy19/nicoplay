const { main } = require("./Backend/src/server");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
