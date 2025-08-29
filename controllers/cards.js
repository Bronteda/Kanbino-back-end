const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
//verify token from frontend / request
const verifyToken = require("../middleware/verify-token");
const Board = require("../models/board");
const User = require("../models/user");

//**Cards Routes*/

//add Card
router.post('/',verifyToken, async (req,res)=>{
    

});
//Edit Card
//Reorder Card
//Move card to different column
//Remove Card

//**Comments Routes */
//Add Comment
//Edit Comment
//Delete Comment

module.exports = router;