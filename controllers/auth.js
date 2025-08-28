const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

const saltRounds = 12;

//sign-up and sign-in routes

router.post("/sign-up", async (req, res) => {
  try {
    const userInDB = await User.findOne({ username: req.body.username });

    if (userInDB) {
      return res.status(409).json("Username already taken");
    }

    const user = await User.create({
      name: req.body.name,
      username: req.body.username,
      password: bcrypt.hashSync(req.body.password, saltRounds),
    });

    //create the payload - name , username and id
    const payload = { name: user.name, username: user.username, _id: user._id };
    //create the token (payload + secret)
    const token = jwt.sign({ payload }, process.env.JWT_SECRET);

    //send back the token
    res.status(201).json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sign-in", async (req, res) => {
  try {
    //see if user in db
    const userInDB = await User.findOne({ username: req.body.username });

    //if not return with error 401
    if (!userInDB) {
      return res.status(401).json("Invalid Credentials");
    }

    //check password matches the user found 
    const isPasswordCorrect = bcrypt.compareSync(
      req.body.password,
      userInDB.password
    );

    //if not return with error 401
    if (!isPasswordCorrect) {
      return res.status(401).json("Invalid Credentials");
    }

    //create the payload
    const payload = {
      name: userInDB.name,
      username: userInDB.username,
      _id: userInDB._id,
    };
    //create the token - payload+secret
    const token = jwt.sign({ payload }, process.env.JWT_SECRET);

    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
