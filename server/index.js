require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const PORT = process.env.PORT || 3000;

const {
  client,
  createTables,
  createUser,
  createBook,
  createReview,
  createComment,
  authenticate,
} = require("./db");

const app = express();
app.use(express.json());

//middleware to verify JWT tokenb

const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).send("Access denied");

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send("invalid token");
    req.user = user;
    next();
  });
};

//register

app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const SQL = `SELECT * FROM users WHERE username = $1;`;
    const existingUser = await client.query(SQL, [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "user already exists" });
    }
    const newUser = await createUser({ username, password });
    const { token } = await authenticate({ username, password });
    res.status(201).json({ user: newUser, token });
  } catch (err) {
    res.status(400).send("user creation failed");
  }
});

//login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const { token } = await authenticate({ username, password });
    res.json({ token });
  } catch (err) {
    res.status(401).send("invalid details");
  }
});

//get current user
app.get("/api/auth/me", authenticateToken, async (req, res, next) => {
  try {
    const SQL = `SELECT id, username FROM users WHERE id = $1;`;
    const user = await client.query(SQL, [req.user.id]);
    res.json(user.rows[0]);
  } catch (err) {
    res.status(500).send("unable to get info");
  }
});

//get books
app.get("/api/books", async (req, res) => {
  const SQL = `SELECT * FROM books;`;
  const books = await client.query(SQL);
  res.json(books.rows);
});

//get single book
app.get("/api/books/:bookId", async (req, res) => {
  const { bookId } = req.params;
  const SQL = `SELECT * FROM books WHERE id = $1;`;
  const book = await client.query(SQL, [bookId]);
  if (book.rows.length === 0) return res.status(404).send("book not found");
  res.json(book.rows[0]);
});

//get reviews for a book
app.get("/api/books/:bookId/reviews", async (req, res) => {
  const { bookId } = req.params;
  const SQL = `SELECT * FROM reviews WHERE book_id = $1;`;
  const reviews = await client.query(SQL, [bookId]);
  res.json(reviews.rows);
});

//get a specific review
app.get("/api/books/:bookId/reviews/:reviewId", async (req, res) => {
  const { bookId, reviewId } = req.params;
  const SQL = `SELECT * FROM reviews WHERE id = $1 AND book_id = $2;`;
  if (reviewId.rows.length === 0)
    return res.status(404).send("review not found");
  res.json(reviewId.rows[0]);
});

//create a review
app.post(
  "/api/books/:bookId/reviews",
  authenticateToken,
  async (req, res, next) => {
    const { bookId } = req.params;
    const { rating, review_text } = req.body;
    try {
      const review = await createReview({
        user_id: req.user.id,
        book_id: bookId,
        rating,
        review_text,
      });
      console.log(review);
      res.status(201).json(review);
    } catch (err) {
      res.status(400).json({ message: "unable to create review", err });
    }
  }
);

//get reviews from a user
app.get("/api/reviews/me", authenticateToken, async (req, res, next) => {
  const SQL = `SELECT * FROM reviews WHERE user_id = $1;`;
  const reviews = await client.query(SQL, [req.user.id]);
  res.json(reviews.rows);
});

//edit a review
app.put(
  "/api/users/:userId/reviews/:reviewId",
  authenticateToken,
  async (req, res, next) => {
    const { userId, reviewId } = req.params;
    const { rating, review_text } = req.body;
    if (userId !== req.user.id)
      return res.status(403).send("not authorized to edit");
    const SQL = `UPDATE reviews SET rating = $1, review_text = $2 WHERE id = $3 RETURNING *;`;
    const updatedReview = await client.query(SQL, [
      rating,
      review_text,
      reviewId,
    ]);
    if (updatedReview.rows.length === 0)
      return res.status(404).send("review not found");
    res.json(updatedReview.rows[0]);
  }
);

//delete review
app.delete(
  "/api/users/:userId/reviews/:reviewId",
  authenticateToken,
  async (req, res, next) => {
    const { userId, reviewId } = req.params;
    if (userId !== req.user.id)
      return res.status(403).send("not authorized to delete");
    const SQL = `DELETE FROM reviews WHERE id = $1 RETURNING *;`;
    const deletedReview = await client.query(SQL, [reviewId]);
    if (deletedReview.rows.length === 0)
      return res.status(404).send("review not foubd");
  }
);

//create a comment on a review

const init = async () => {
  console.log("connecting to database");
  await client.connect();
  console.log("connected to database");
  await createTables();
  console.log("tables created");

  const [ben, taylor, gleyber] = await Promise.all([
    createUser({ username: "ben", password: "ilovelamp" }),
    createUser({ username: "taylor", password: "ilovelamp" }),
    createUser({ username: "gleyber", password: "ilovelamp" }),
  ]);
  console.log("users seeded:");

  const [book1, book2, book3] = await Promise.all([
    createBook({
      title: "The Philosophers Stone",
      author: "J.K. Rowling",
      description: "Harry goes to Hogwarts",
    }),
    createBook({
      title: "Fellowship of the Ring",
      author: "J.R.R. Tolkien",
      description: "The fellowship sets out to destroy the One Ring",
    }),
    createBook({
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      description: "Rich alcoholic love triangle",
    }),
  ]);
  console.log("books seeded");

  const [review1, review2, review3] = await Promise.all([
    createReview({
      user_id: ben.id,
      book_id: book1.id,
      rating: 5,
      review_text: "Great first edition to the series!",
    }),
    createReview({
      user_id: taylor.id,
      book_id: book2.id,
      rating: 4,
      review_text: "Loved it! RIP Gandalf :(",
    }),
    createReview({
      user_id: gleyber.id,
      book_id: book3.id,
      rating: 3,
      review_text: "classic, but feels like a book about nothing",
    }),
  ]);
  console.log("reviews seeded");

  const [comment1, comment2, comment3] = await Promise.all([
    createComment({
      user_id: taylor.id,
      review_id: review1.id,
      comment_text: "i agree, but still too childish for me!",
    }),
    createComment({
      user_id: ben.id,
      review_id: review3.id,
      comment_text: "Gatsby aint deserve that!",
    }),
    createComment({
      user_id: gleyber.id,
      review_id: review2.id,
      comment_text: "RIP BOROMIR",
    }),
  ]);
  console.log("comments seeded");

  app.listen(PORT, () => {
    console.log(`port alive on ${PORT}`);
  });
};

init();
