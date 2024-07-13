const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

const anthropic = new Anthropic({
  apiKey: "",
});

const mongoUri = "";
const client = new MongoClient(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function connectToMongo() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Could not connect to MongoDB", error);
  }
}

connectToMongo();

app.post("/generate-svg", async (req, res) => {
  try {
    const { theme } = req.body;
    console.log("Received theme:", theme);

    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `create a 32 by 32 pixel art svg of a cat with the following theme : "${theme}" no curved edges, squares/rectangles and no blank space. Only provide the SVG code, nothing else.`,
        },
      ],
    });

    const svg = msg.content[0].text;
    console.log("Generated SVG:", svg);

    res.json({ svg });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to generate SVG" });
  }
});

app.post("/publish-svg", async (req, res) => {
  try {
    const { svg } = req.body;
    const db = client.db("zircats");
    const collection = db.collection("svgs");
    const result = await collection.insertOne({ svg, createdAt: new Date() });
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error("Error publishing SVG:", error);
    res.status(500).json({ error: "Failed to publish SVG" });
  }
});

app.get("/get-svgs", async (req, res) => {
  try {
    const db = client.db("zircats");
    const collection = db.collection("svgs");
    const svgs = await collection.find({}).toArray();
    res.json(svgs);
  } catch (error) {
    console.error("Error fetching SVGs:", error);
    res.status(500).json({ error: "Failed to fetch SVGs" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
