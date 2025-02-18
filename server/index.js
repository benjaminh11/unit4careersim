require("dotenv").config();

const { client, createTables } = require("./db");

const init = async () => {
  console.log("connecting to database");
  await client.connect();
  console.log("connected to database");
  await createTables();
  console.log("tables created");
};

init();
