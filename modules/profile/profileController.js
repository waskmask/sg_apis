const mongoose = require("mongoose");
const User = require("../../models/User");
const Joi = require("joi");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const profileSchema = joi.object({
  username: Joi.string().min(4).max(20).required().messages({
    "string.min": "username must be between 4 and 20 characters long",
    "any.required": "Username is required",
  }),

  gender: Joi.string().valid("male", "female").required().messages({
    "any.only": "Gender must be either male or female",
    "any.required": "Gender is required",
  }),
  looking_for: Joi.string
    .valid(
      "sugar_relationship",
      "casual_dating",
      "dating",
      "one_night_stand",
      "online_chat",
      "friendship",
      "serious_relationship",
      "travel_partner",
      "friends_with_benefits",
      "sugar_friendship"
    )
    .message({
      "any.only":
        "Invalid input, please pass the data from the available list below",
    }),
  smoking: Joi.string.valid("yes", "no", "sometimes").message({
    "any.only": "Invalid input, please send data as yes, no or sometimes",
  }),
  children: Joi.string.valid("yes", "no", "maybe").message({
    "any.only": "Invalid input, please send data as yes, no or maybe",
  }),
  body_shape: Joi.string
    .valid("slim", "average", "athletic", "curvy", "overweight")
    .message({
      "any.only":
        "Invalid input, please send data as slim, average, athletic, curvy, overweight",
    }),
  ethnicity: Joi.string
    .valid(
      "white",
      "black",
      "asian",
      "latino",
      "caucasian",
      "middle_eastern",
      "mixed",
      "other"
    )
    .message({
      "any.only":
        "Invalid input, please send data as white, black, caucasian, asian, latino, middle_eastern, mixed, other",
    }),
});

// Function to get administrative_area_level_2, country, and coordinates from Google Places API
const getLocationFromCityCountry = async (city, country) => {
  const address = `${city}, ${country}`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await axios.get(url);
  const { results } = response.data;

  if (results.length === 0) {
    throw new Error("Invalid city or country");
  }

  const locationData = results[0];

  const administrativeArea =
    locationData.address_components.find((component) =>
      component.types.includes("administrative_area_level_2")
    )?.long_name || city;

  const countryName =
    locationData.address_components.find((component) =>
      component.types.includes("country")
    )?.long_name || country;

  const { lat, lng } = locationData.geometry.location;

  return {
    administrativeArea,
    country: countryName,
    coordinates: [lng, lat],
  };
};
