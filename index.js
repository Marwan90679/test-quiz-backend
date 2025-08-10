require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");

app.use(
  cors({
    origin: ["http://localhost:5173", "https://test-quizze.web.app"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

const uri = process.env.DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const verifyToken = async (req, res, next) => {
      const token = req?.cookies?.token;
      if (!token)
        return res.status(401).send({ message: "unauthorized access" });
      jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error)
          return res.status(401).send({ message: "unauthorized access" });
        req.decoded = decoded;
        next();
      });
    };

    const quizzesCollection = client.db("quizDB").collection("quizzes");
    const usersCollection = client.db("quizDB").collection("users");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        .send({ success: true });
    });
    app.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      });
      res.send({ success: true, message: "Logged out successfully" });
    });
    app.get("/", verifyToken, async (req, res) => {
      const result = await quizzesCollection.find().toArray();
      res.send(result);
    });
    app.get("/users/data", async (req, res) => {
      try {
        const userEmail = req.query.email;

        if (!userEmail) {
          return res
            .status(400)
            .json({ error: "Email is required as a query parameter." });
        }

        const user = await usersCollection.findOne({ email: userEmail });

        if (user) {
          res.json(user);
        } else {
          res.status(404).json({ error: "User not found." });
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        res.status(500).json({ error: "An internal server error occurred." });
      }
    });

    app.post("/signUp", async (req, res) => {
      try {
        // Extract user data from the request body
        const { name, email, password, role } = req.body;

        // Check if the user already exists by their email
        const existingUser = await usersCollection.findOne({ email: email });

        if (existingUser) {
          // If the user exists, send a conflict status code (409)
          return res
            .status(409)
            .json({ message: "User with this email already exists." });
        }

        // If the user does not exist, insert the new user into the collection
        const newUser = {
          name,
          email,
          role,
          password,
          certificates: [],
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);

        // Send a success response with the inserted user's ID
        res.status(201).json({
          message: "User signed up successfully!",
          userId: result.insertedId,
          user: { name, email },
        });
      } catch (error) {
        console.error("Error during user sign-up:", error);
        // Send a generic server error response
        res.status(500).json({
          message: "An error occurred during sign-up. Please try again later.",
        });
      }
    });
    app.patch("/users/certificates", async (req, res) => {
      try {
        const { email } = req.query; // Get email from query string
        const { certificate } = req.body;

        // Validate the input
        if (!email || !certificate) {
          return res
            .status(400)
            .json({ message: "Email and certificate are required." });
        }

        // The $addToSet operator ensures the certificate is added only if it's not already in the array.
        // This prevents duplicates and handles the "already have the certificate" case you mentioned.
        const result = await usersCollection.updateOne(
          { email: email }, // Find user by email
          { $addToSet: { certificates: certificate } }
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .json({ message: "User not found with the provided email." });
        }

        // If modifiedCount is 0, it means the certificate was already present.
        if (result.modifiedCount === 0) {
          return res.status(200).json({
            message:
              "Certificate already exists for this user. No changes made.",
            modifiedCount: result.modifiedCount,
          });
        }

        res.status(200).json({
          message: "Certificate added successfully!",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Error patching user certificate:", error);
        res.status(500).json({
          message: "An error occurred while updating the certificate.",
        });
      }
    });
    // Mark user as failed if they fail step 1
    app.patch("/users/mark-failed", async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res.status(400).json({ message: "Email is required." });
        }

        const result = await usersCollection.updateOne(
          { email: email },
          { $addToSet: { certificates: "Failed" } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "User not found." });
        }

        res.status(200).json({
          message: "User marked as Failed successfully.",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Error marking user as failed:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    });

    // Send a ping to confirm a successful connection
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    //
  }
}

// Run the main function and start the server
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
