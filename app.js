require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const userRoutes = require("./modules/user/userRoutes");
const cors = require("cors");
const app = express();
// app.use(cors({ origin: ["http://localhost:5000", "https://sugar-list.de"] }));
app.options('*', cors());

mongoose.connect(process.env.MONGO_DB_PROD, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000, // Increase to 30 seconds
  socketTimeoutMS: 45000,          // Increase to 45 seconds
});


mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to " + process.env.MONGO_DB_PROD);
});

mongoose.connection.on("error", (err) => {
  console.log("Mongoose connection error: " + err);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected");
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use("/users", userRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle process termination
process.on("SIGINT", () => {
  mongoose.connection.close(() => {
    console.log("Mongoose disconnected through app termination");
    process.exit(0);
  });
});
