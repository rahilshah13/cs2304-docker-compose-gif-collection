const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const MONGO_URL = "mongodb://mongo:27017";
const prometheusClient = require("prom-client");
const prometheusMiddleware = require("express-prometheus-middleware");

////////////////// prometheus metrics
const gifsAddedCounter = new prometheusClient.Counter({
    name: "app_gifs_added_total",
    help: "The total number of GIFs that have been added to the database",
});

const mongoQuerySummary = new prometheusClient.Summary({
    name: "app_mongo_query_time",
    help: "Query times to get the next Mongo image",
});
/////////////////////////////////

MongoClient.connect(MONGO_URL, (err, db) => {
  if (err) throw err;

  console.log("Database has connected!");
  const gifCollection = db.db("test").collection("gifs");

  // Change this to your own greeting
  const MY_MESSAGE = "frogs?";

  // Create our app and configure the view templating engine
  const app = express();
  app.set("view engine", "hbs");
  app.set("views", __dirname + "/views");

  app.use(express.urlencoded({
    extended: true
  }));

  app.use(prometheusMiddleware());


  // Add a handler for requests to "/". Simply picks a random image and renders the template.
  app.get("/", async (req, res) => {
    const endTimer = mongoQuerySummary.startTimer();
    const cursor = gifCollection.aggregate([{ $sample: { size : 1 }}]);
    const data = await cursor.next(); 
    endTimer();

    const imageUrl = (data) ? data.url : "https://media.giphy.com/media/14uQ3cOFteDaU/giphy.gif";
    res.render("index", { imageUrl, message: MY_MESSAGE });
  });

  app.post("/add-gif", async (req, res) => {
    const newDocument = { url : req.body.url, default: false };
    await gifCollection.insertOne(newDocument);
    gifsAddedCounter.inc();
    res.redirect("/");
  });

  // Start the webserver on port 3000
  app.listen(3000, () => console.log("Listening on port 3000"));
});
// Some nice cleanup handling to close things down when Docker stops the container
process.on("SIGINT", () => process.exit());
process.on("SIGTERM", () => process.exit());
