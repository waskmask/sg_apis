const express = require("express");
const router = express.Router();
const userController = require("./userController");
const passport = require("passport");

// Register route
router.post("/register", userController.registerUser);

// Login route
router.post("/login", userController.loginUser);

// Email verification route
router.post(
  "/verify-email",
  userController.protect,
  userController.verifyEmail
);

// Forgot password route
router.post("/forgot-password", userController.forgotPassword);

// Reset password route
router.post("/reset-password", userController.resetPassword);

// Change password route
router.post(
  "/change-password",
  userController.protect,
  userController.changePassword
);

// Protected route example
router.get("/protected", userController.protect, (req, res) => {
  res.json({ message: "This is a protected route", user: req.user });
});
module.exports = router;
