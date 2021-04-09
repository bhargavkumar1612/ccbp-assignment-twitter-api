const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");

const app = express();
app.use(express.json());
let db = null;

const init = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
  app.listen(3000, () => {
    console.log("server is running at http://localhost:3000");
  });
};
init();

app.post("/register/", async (request, response) => {
  const { username, password, gender, name } = request.body;
  const dbUser = await db.get(
    `Select * From user where username = "${username}";`
  );
  if (dbUser === undefined) {
    if (password.length >= 6) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.run(`
        INSERT INTO user 
        (username,password, gender, name )
        values 
        ("${username}","${hashedPassword}","${gender}","${name}");
        `);
      response.status(200);
      response.send("Successful registration of the registrant");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// get all users

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const dbUser = await db.get(
    `Select * From user where username = "${username}";`
  );
  if (dbUser !== undefined) {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch) {
      let jwtToken = jwt.sign(username, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

function authenticateToken(request, response, next) {
  let jwtToken;
  const authorization = request.headers["authorization"];
  if (authorization !== undefined) {
    jwtToken = authorization.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.send(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload;
        next();
      }
    });
  }
}

const tweetResponse = (dbObject) => ({
  username: dbObject.username,
  tweet: dbObject.tweet,
  dateTime: dbObject.date_time,
});

// user tweets api
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let userId = await db.get(
    `select user_id from user where username = "${request.username}"`
  );
  userId = userId.user_id;
  const latestTweets = await db.all(`
    select 
    tweet.tweet_id,
    tweet.user_id,
    user.username,
    tweet.tweet,
    tweet.date_time
    from 
    follower
    left join tweet on tweet.user_id = follower.following_user_id
    left join user on follower.following_user_id = user.user_id
    where follower.follower_user_id = ${userId}
    order by tweet.date_time desc
    limit 4;
    `);
  response.send(latestTweets.map((item) => tweetResponse(item)));
});
