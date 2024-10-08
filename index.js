import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";


const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/delete", async (req, res) => {
  if (req.isAuthenticated()) {
    const idToDelete = req.query.id;
    try {
      const result = await db.query(
        `DELETE FROM expenses WHERE referencingid = $1 AND id = $2`,
        [req.user.id, idToDelete]
      );
      res.redirect("/expense");
    } catch (err) {
      console.log(err);
      res.status(500).send("Error deleting expense");
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/edit-expense/:id", async (req, res) => {
  const expenseId = req.params.id;
  if (req.isAuthenticated()) {
    try {
      const result = await db.query(
        "SELECT * FROM expenses WHERE id = $1 AND referencingid = $2",
        [expenseId, req.user.id]
      );
      if (result.rows.length > 0) {
        const expense = result.rows[0];
        // Format the date for HTML date input
        expense.date = new Date(expense.date).toISOString().split('T')[0];
        
        // Convert time to 12-hour format with AM/PM
        const timeParts = expense.time.split(':');
        let hours = parseInt(timeParts[0], 10);
        const minutes = timeParts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12; // Convert hour to 12-hour format
        const formattedTime = `${hours}:${minutes}`;

        expense.time = formattedTime;

        res.render("edit-expense.ejs", { expense });
      } else {
        res.status(404).send("Expense not found");
      }
    } catch (err) {
      console.log(err);
      res.status(500).send("Error retrieving expense");
    }
  } else {
    res.redirect("/login");
  }
});


app.post("/edit-expense/:id", async (req, res) => {
  const expenseId = req.params.id;
  const { expenseName, category, amount, date, time, additionalInfo } = req.body;

  if (req.isAuthenticated()) {
    try {
      await db.query(
        "UPDATE expenses SET expensename = $1, category = $2, amount = $3, date = $4, time = $5, additionalinfo = $6 WHERE id = $7 AND referencingid = $8",
        [expenseName, category, amount, date, time, additionalInfo, expenseId, req.user.id]
      );
      res.redirect("/expense");
    } catch (err) {
      console.log(err);
      res.status(500).send("Error updating expense");
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/expense", async (req, res) => {
  const currentDate = new Date().toLocaleDateString('en-GB');
  
  // Time formatting in 12-hour format with AM/PM
  const currentTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  console.log(req.user);

  if (req.isAuthenticated()) {
    try {
      const result = await db.query(
        `SELECT * FROM expenses WHERE referencingid = $1`,
        [req.user.id]
      );
      const income=await db.query(`SELECT sum(amount) FROM expenses WHERE referencingid=$1 AND category=$2`,
      [req.user.id,"Income"]);
      const food=await db.query(`SELECT sum(amount) FROM expenses WHERE referencingid=$1 AND category=$2`,
      [req.user.id,"Food & Drinks"]);
      const shopping=await db.query(`SELECT sum(amount) FROM expenses WHERE referencingid=$1 AND category=$2`,
      [req.user.id,"Shopping"]);
      const housing=await db.query(`SELECT sum(amount) FROM expenses WHERE referencingid=$1 AND category=$2`,
      [req.user.id,"Housing"]);
      const transportation=await db.query(`SELECT sum(amount) FROM expenses WHERE referencingid=$1 AND category=$2`,
      [req.user.id,"Transportation"]);
      const vehicle=await db.query(`SELECT sum(amount) FROM expenses WHERE referencingid=$1 AND category=$2`,
      [req.user.id,"Vehicle"]);
      const entertainment=await db.query(`SELECT sum(amount) FROM expenses WHERE referencingid=$1 AND category=$2`,
      [req.user.id,"Entertainment"]);
      const investments=await db.query(`SELECT sum(amount) FROM expenses WHERE referencingid=$1 AND category=$2`,
      [req.user.id,"Investments"]);
      const other=await db.query(`SELECT sum(amount) FROM expenses WHERE referencingid=$1 AND category=$2`,
      [req.user.id,"Other"]);

      const expenditureSum=await db.query(`SELECT sum(amount) FROM expenses WHERE referencingid=$1 AND category!=$2`,
      [req.user.id,"Income"]);

      const categories = ["Food", "Shopping", "Housing", "Transportation", "Vehicle", "Entertainment", "Investments", "Other"];
      const categoryValues = [food.rows[0].sum, shopping.rows[0].sum, housing.rows[0].sum, transportation.rows[0].sum, vehicle.rows[0].sum, entertainment.rows[0].sum, investments.rows[0].sum, other.rows[0].sum]
      const pieColors = [
        "#b91d47",
        "#00aba9",
        "#2b5797",
        "#e8c3b9",
        "#1e7145",
        "#FF8911",
        "#E8C872",
        "#D63484",
      ];

      const barValues = [income.rows[0].sum, expenditureSum.rows[0].sum];
      console.log(categories);
      console.log(categoryValues);
      res.render("expense.ejs", {expenseList: result.rows,currentDate: currentDate,currentTime: currentTime, categories: categories, categoryValues: categoryValues, pieColors: pieColors, barValues: barValues})
    } catch (err) {
      console.log(err);
    }
  } else {
    res.redirect("/login");
  }
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/expense",
  passport.authenticate("google", {
    successRedirect: "/expense",
    failureRedirect: "/login",
  })
);

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/expense",
    failureRedirect: "/login",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/expense");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

app.post("/expense", async function (req, res) {
  const expensename=req.body.expenseName;
  const category=req.body.category;
  const amount=req.body.amount;
  const date=req.body.date;
  const time=req.body.time;
  const additionalInfo=req.body.additionalInfo;
  const referencingid=req.user.id;
  console.log(req.user);
  try {
    await db.query(`INSERT INTO expenses (referencingid, expensename, category, amount,date,time,additionalInfo) values($1,$2,$3,$4,$5,$6,$7)`, [
      referencingid, expensename, category, amount, date, time, additionalInfo
    ]);
    res.redirect("/expense");
  } catch (err) {
    console.log(err);
  }
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/expense",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        console.log(profile);
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2)",
            [profile.email, "google"]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
