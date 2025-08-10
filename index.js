const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

app.use(cors());
app.use(express.json());



const uri = process.env.DB_URI

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
        

        // Single API endpoint to fetch a combined set of data
        app.get("/", async (req, res) => {
             const cursor = await quizzesCollection.find().toArray();
             res.send(cursor) 
        });

        app.post('/signUp', async (req, res) => {
            try {
                // Extract user data from the request body
                const { name, email, password,role } = req.body;
        
                // Check if the user already exists by their email
                const existingUser = await usersCollection.findOne({ email: email });
        
                if (existingUser) {
                    // If the user exists, send a conflict status code (409)
                    return res.status(409).json({ message: "User with this email already exists." });
                }
        
                // If the user does not exist, insert the new user into the collection
                const newUser = {
                    name,
                    email,
                    role,
                    password, // In a real application, you should hash this password
                    createdAt: new Date()
                };
        
                const result = await usersCollection.insertOne(newUser);
        
                // Send a success response with the inserted user's ID
                res.status(201).json({ 
                    message: "User signed up successfully!", 
                    userId: result.insertedId,
                    user: { name, email }
                });
        
            } catch (error) {
                console.error("Error during user sign-up:", error);
                // Send a generic server error response
                res.status(500).json({ message: "An error occurred during sign-up. Please try again later." });
            }
        });
        
        // Send a ping to confirm a successful connection
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
       
    }
}

// Run the main function and start the server
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
