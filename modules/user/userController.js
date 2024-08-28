const mongoose = require("mongoose");
const User = require("../../models/User");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../../middleware/mailer");

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// Validation schema
const registrationSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters long",
    "any.required": "Password is required",
  }),
  dob: Joi.date().required().messages({
    "date.base": "Date of birth must be a valid date",
    "any.required": "Date of birth is required",
  }),
  gender: Joi.string().valid("male", "female").required().messages({
    "any.only": "Gender must be either male or female",
    "any.required": "Gender is required",
  }),
  city: Joi.string().required().messages({
    "any.required": "City is required",
  }),
  country: Joi.string().required().messages({
    "any.required": "Country is required",
  }),
  searching_for: Joi.string()
    .valid("sugar_baby", "sugar_mommy", "sugar_daddy", "sugar_boy")
    .required()
    .messages({
      "any.only":
        "Searching for must be one of sugar_baby, sugar_mommy, sugar_daddy, or sugar_boy",
      "any.required": "Searching for is required",
    }),
  username: Joi.string().optional(),
  found_at: Joi.string().optional(),
  prelaunch: Joi.boolean().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters long",
    "any.required": "Password is required",
  }),
});

const verificationSchema = Joi.object({
  verificationCode: Joi.string().length(6).required().messages({
    "string.length": "Verification code must be 6 characters long",
    "any.required": "Verification code is required",
  }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
  resetPasswordCode: Joi.string().length(6).required().messages({
    "string.length": "Reset password code must be 6 characters long",
    "any.required": "Reset password code is required",
  }),
  newPassword: Joi.string().min(6).required().messages({
    "string.min": "New password must be at least 6 characters long",
    "any.required": "New password is required",
  }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(6).required().messages({
    "string.min": "Current password must be at least 6 characters long",
    "any.required": "Current password is required",
  }),
  newPassword: Joi.string().min(6).required().messages({
    "string.min": "New password must be at least 6 characters long",
    "any.required": "New password is required",
  }),
});

// Function to get administrative_area_level_2, country, and coordinates from Google Places API
const getLocationFromCityCountry = async (city, country) => {
  const address = `${city}, ${country}`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await axios.get(url);
  console.log(response.data); // Log the full response

  const { results } = response.data;

  if (results.length === 0) {
    throw new Error("Invalid city or country");
  }

  // Extracting location details
  const locationData = results[0];
  const cityName =
    locationData.address_components.find((component) =>
      component.types.includes("locality")
    )?.long_name ||
    locationData.address_components.find((component) =>
      component.types.includes("administrative_area_level_4")
    )?.long_name ||
    locationData.address_components.find((component) =>
      component.types.includes("administrative_area_level_2")
    )?.long_name ||
    city;

  const countryName =
    locationData.address_components.find((component) =>
      component.types.includes("country")
    )?.long_name || country;

  const { lat, lng } = locationData.geometry.location;

  return {
    city: cityName,
    country: countryName,
    coordinates: [lng, lat],
  };
};

// Generate unique username
const generateUsername = async (email) => {
  const baseUsername = email.split("@")[0];
  let username = baseUsername;
  let count = 1;

  while (await User.exists({ username })) {
    username = `${baseUsername}${count}`;
    count++;
  }

  return username;
};

// Generate a 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Register user
exports.registerUser = async (req, res) => {
  try {
    const { error } = registrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      email,
      password,
      dob,
      gender,
      city,
      country,
      searching_for,
      found_at,
      prelaunch,
    } = req.body;
    let { username } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ error: "A user with this email already exists." });
    }

    if (!username) {
      username = await generateUsername(email);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();

    const location = await getLocationFromCityCountry(city, country);

    const newUser = new User({
      email,
      password: hashedPassword,
      username,
      dob,
      gender,
      location: {
        type: "Point",
        coordinates: location.coordinates,
        city: location.city,
        country: location.country,
      },
      searching_for,
      emailVerificationCode: verificationCode,
      emailVerified: false,
      found_at: found_at,
      prelaunch: prelaunch,
    });

    await newUser.save();

    // Send verification email with the HTML template
    const emailResult = await sendVerificationEmail(
      email,
      verificationCode,
      username
    );

    if (!emailResult.success) {
      console.error("Error sending verification email:", emailResult.error);
      return res.status(201).json({
        message:
          "Registration successful, but failed to send verification email. Please try again later.",
      });
    }

    // Generate JWT token
    const payload = { id: newUser.id, email: newUser.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    res.cookie("token", token, { httpOnly: true });
    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
      token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Verify email
exports.verifyEmail = async (req, res) => {
  const { error } = verificationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { verificationCode } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.emailVerificationCode !== verificationCode) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    user.email_verified = true;
    user.emailVerificationCode = undefined; // Clear the verification code
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Login user
exports.loginUser = async (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Incorrect email or password" });
    }

    // if (!user.email_verified) {
    //   return res
    //     .status(400)
    //     .json({ message: "Please verify your email before logging in." });
    // }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect email or password" });
    }

    const payload = { id: user.id, email: user.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    res.cookie("token", token, { httpOnly: true });
    res.json({ message: "Logged in successfully", token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Middleware to protect routes
exports.protect = async (req, res, next) => {
  const token =
    req.cookies.token ||
    (req.headers.authorization && req.headers.authorization.split(" ")[1]);

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  const { error } = forgotPasswordSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Email not found" });
    }

    const resetPasswordCode = generateVerificationCode();
    user.resetPasswordCode = resetPasswordCode;
    await user.save();

    // Send reset password email
    const emailResult = await sendPasswordResetEmail(email, resetPasswordCode);
    if (!emailResult.success) {
      console.error("Error sending reset password email:", emailResult.error);
      return res.status(500).json({
        message: "Failed to send reset password email. Please try again later.",
      });
    }

    res.status(200).json({ message: "Reset password code sent to email" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  const { error } = resetPasswordSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { email, resetPasswordCode, newPassword } = req.body;

  try {
    const user = await User.findOne({ email, resetPasswordCode });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid reset password code or email" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordCode = undefined; // Clear the reset password code
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Change password with existing password
exports.changePassword = async (req, res) => {
  const { error } = changePasswordSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
