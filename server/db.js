require("dotenv").config();
const pg = require("pg");
const bcrypt = require("bcrypt");
const uuid = require("uuid");
const jwt = require("jsonwebtoken");
const client = new pg.Client();

const createTables = async () => {
  const SQL = `
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS reviews;
    DROP TABLE IF EXISTS books;
    DROP TABLE IF EXISTS users;
    CREATE TABLE users(
    id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE books(
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE reviews(
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <=5),
    review_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 );
    CREATE TABLE comments(
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`;

  await client.query(SQL);
};

const createUser = async ({ username, password }) => {
  const SQL = `
    INSERT INTO users(id, username, password) VALUES($1, $2, $3) RETURNING *;`;

  //   const hashedPassword = await bcrypt.hash(password, 5);
  const response = await client.query(SQL, [
    uuid.v4(),
    username,
    await bcrypt.hash(password, 5),
  ]);
  return response.rows[0];
};

const createBook = async ({ title, author, description }) => {
  const SQL = `
    INSERT INTO books(id, title, author, description) VALUES($1, $2, $3, $4) RETURNING *`;
  const response = await client.query(SQL, [
    uuid.v4(),
    title,
    author,
    description,
  ]);
  return response.rows[0];
};

const createReview = async ({ user_id, book_id, rating, review_text }) => {
  const SQL = `
    INSERT INTO reviews(id, user_id, book_id, rating, review_text) VALUES($1, $2, $3, $4, $5) RETURNING *;`;
  const response = await client.query(SQL, [
    uuid.v4(),
    user_id,
    book_id,
    rating,
    review_text,
  ]);
  console.log(response.rows);
  return response.rows[0];
};

const createComment = async ({ user_id, review_id, comment_text }) => {
  const SQL = `
    INSERT INTO comments(id, user_id, review_id, comment_text) VALUES($1, $2, $3, $4) RETURNING *;`;
  const response = await client.query(SQL, [
    uuid.v4(),
    user_id,
    review_id,
    comment_text,
  ]);
  return response.rows[0];
};

const authenticate = async ({ username, password }) => {
  const SQL = `
    SELECT id, password FROM users WHERE username = $1;`;

  const response = await client.query(SQL, [username]);
  if (
    !response.rows.length ||
    !(await bcrypt.compare(password, response.rows[0].password))
  ) {
    const error = new Error("not authorized");
    error.status = 401;
    throw error;
  }
  const myToken = jwt.sign({ id: response.rows[0].id }, process.env.JWT_SECRET);
  return { token: myToken };
};

module.exports = {
  client,
  createTables,
  createUser,
  createBook,
  createReview,
  createComment,
  authenticate,
};
