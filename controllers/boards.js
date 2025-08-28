const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
//verify token from frontend / request
const verifyToken = require("../middleware/verify-token");
const Board = require("../models/board");
const User = require("../models/user");

//just for me to user id's
router.get("/user", verifyToken, async (req, res) => {
  try {
    const users = await User.find({}, "username");

    res.json(users);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

//*Workspace Page*/
//gets all boards/workspaces associated to that user
router.get("/", verifyToken, async (req, res) => {
  try {
    console.log(req.user);
    const boards = await Board.find({
      $or: [{ ownerId: req.user._id }, { memberIds: req.user._id }],
    }).populate();
    if (!boards) {
      return res.json("No Boards found");
    }

    res.status(200).json({ boards });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//create a new baord
router.post("/", verifyToken, async (req, res) => {
  try {
    //console.log("req.body", req.body);
    const newBoard = await Board.create({
      title: req.body.title,
      ownerId: req.user._id,
      startDate: req.body.startDate,
      dueDate: req.body.dueDate,
    });
    res.status(200).json("New Board created");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//*Individual Board page*/

router.get("/:boardId", verifyToken, async (req, res) => {
  try {
    const boardId = req.params.boardId;
    console.log("Board Id ", boardId);

    const currentBoard = await Board.findById(boardId).populate();

    res.status(200).json({ currentBoard });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:boardId", verifyToken, async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const currentBoard = await Board.findById(boardId);

    //board not found
    if (!currentBoard) {
      return res.status(404).json("Board not found");
    }

    //owner and member can edit board
    const userId = req.user._id;
    const isOwner = currentBoard.ownerId.equals(userId);
    const isMember = currentBoard.memberIds.some((id) => id.equals(userId));

    if (!isOwner && !isMember) {
      return res.status(403).json("You are not authorized to edit this board");
    }

    //add a new member to the board
    if (isOwner && req.body?.username) {
      //if they adding in a member ID , ensure the individual is a user
      const findMemberInDb = await User.findOne({
        username: req.body.username,
      });

      if (!findMemberInDb) {
        res.status(403).json("No user exists");
      }

      if (!findMemberInDb._id.equals(currentBoard.ownerId)) {
        await Board.findByIdAndUpdate(
          boardId,
          { $addToSet: { memberIds: findMemberInDb._id } } //stops duplicates
        );
      }
    }

    //remove a member from the board
    if (isOwner && req.body?.removeUsername) {
      const findMemberInDb = await User.findOne({
        username: req.body.removeUsername,
      });
      if (!findMemberInDb) {
        return res.status(404).json("No user exists");
      }

      await Board.findByIdAndUpdate(
        boardId,
        { $pull: { memberIds: findMemberInDb._id } }, // $pull removes
      );
    }

    //update board
    const updatedBoard = await Board.findByIdAndUpdate(boardId, req.body, {
      new: true,
    });

    console.log("updated board", updatedBoard);
    res.status(200).json(updatedBoard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
