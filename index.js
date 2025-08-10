const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

app.use(cors());
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

    // Define the database collections
    const quizzesCollection = client.db("quizDB").collection("quizzes");
    const usersCollection = client.db("quizDB").collection("users");

    app.get("/users/data", async (req, res) => {
      try {
        const userEmail = req.query.email;

        if (!userEmail) {
          return res
            .status(400)
            .json({ error: "Email is required as a query parameter." });
        }

        const user = await usersCollection.findOne({ email: userEmail });

        // If findOne() returns a user document, send it.
        // Otherwise, it returns null, and the condition is false.
        if (user) {
          console.log(`User found: ${user.name}`);
          // Use res.json() to send a JSON response
          res.json(user);
        } else {
          // If the user object is null, send a 404 Not Found response
          console.log(`User not found for email: ${userEmail}`);
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
        res
          .status(500)
          .json({
            message:
              "An error occurred during sign-up. Please try again later.",
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
        res
          .status(500)
          .json({
            message: "An error occurred while updating the certificate.",
          });
      }
    });

    // Send a ping to confirm a successful connection
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}

// Run the main function and start the server
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
