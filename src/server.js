require("dotenv").config();

const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const { ethers } = require("ethers");
const ZirCatsABI = require("./ZirCatsABI.json");

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
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const contractAddress = "0xD3b647A7b76c8251260662D956001943b0A669A8";
const rpcUrl = process.env.RPC_URL || "https://zircuit1.p2pify.com";

async function connectToMongo() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Could not connect to MongoDB", error);
  }
}

connectToMongo();

async function getProvider() {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  try {
    await provider.getNetwork();
    console.log("Connected to the network");
    return provider;
  } catch (error) {
    console.error("Failed to connect to the network:", error);
    return null;
  }
}

async function fetchAndStoreSVGs() {
  const provider = await getProvider();
  if (!provider) {
    console.error("Could not connect to the network. Skipping SVG fetch.");
    return;
  }

  const contract = new ethers.Contract(contractAddress, ZirCatsABI, provider);

  try {
    const totalSupply = await contract.totalSupply();
    const db = client.db("zircats");
    const collection = db.collection("svgs");

    for (let i = 0; i < totalSupply; i++) {
      const tokenId = await contract.tokenByIndex(i);
      const tokenURI = await contract.tokenURI(tokenId);
      
      // Check if the token ID already exists
      const existingToken = await collection.findOne({ tokenId: tokenId.toString() });
      if (existingToken) {
        console.log(`Token ID ${tokenId} already exists, skipping.`);
        continue;
      }

      // Decode the base64 SVG content
      const svgContent = Buffer.from(tokenURI.split(',')[1], 'base64').toString('utf-8');
      console.log(`SVG content for token ID ${tokenId}:`, svgContent);

      // Store the decoded SVG and token ID
      await collection.insertOne({
        tokenId: tokenId.toString(),
        svg: svgContent,
        createdAt: new Date()
      });

      console.log(`Stored SVG for token ID ${tokenId}`);
    }

    console.log("Finished fetching and storing SVGs");
  } catch (error) {
    console.error("Error fetching and storing SVGs:", error);
  }
}

// Function to periodically fetch SVGs
function startPeriodicFetch() {
  setInterval(async () => {
    console.log("Initiating periodic SVG fetch...");
    await fetchAndStoreSVGs();
  }, 10000); // 10000 milliseconds = 10 seconds
}

// Start periodic fetching when the server starts
startPeriodicFetch();

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

    res.json({ svg: svg });
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

app.get("/fetch-svgs", async (req, res) => {
  try {
    await fetchAndStoreSVGs();
    res.json({ message: "SVG fetch process initiated" });
  } catch (error) {
    console.error("Error initiating SVG fetch:", error);
    res.status(500).json({ error: "Failed to initiate SVG fetch" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));