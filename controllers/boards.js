const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
//verify token from frontend / request
const verifyToken = require("../middleware/verify-token");
const Board = require("../models/board");
const User = require("../models/user");
const Card = require("../models/card");

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
    // Remove time value from date strings (keep only YYYY-MM-DD)
    const startDate = req.body.startDate ? req.body.startDate.split("T")[0] : undefined;
    const dueDate = req.body.dueDate ? req.body.dueDate.split("T")[0] : undefined;
    console.log(dueDate);

    const newBoard = await Board.create({
      title: req.body.title,
      ownerId: req.user._id,
      startDate,
      dueDate,
    });
    res.status(200).json({ newBoard });
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

//edit title,dueDate and startDate on the board
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

    // guard: members cannot change membership/owner
    delete req.body.memberIds;
    delete req.body.ownerId;

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

//delete board ? 
router.delete("/:boardId", verifyToken, async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const currentBoard = await Board.findById(boardId);

    if (!currentBoard) {
      return res.status(404).json("Board not found");
    }

    // Ensure user is authorized
    const userId = req.user._id;
    const isOwner = currentBoard.ownerId.equals(userId);
    const isMember = currentBoard.memberIds.some((id) => id.equals(userId));

    if (!isOwner && !isMember) {
      return res.status(403).json("You are not authorized to delete this board");
    }

    await Card.deleteMany({ boardId });
    await Board.findByIdAndDelete(boardId);
    res.status(200).json({ message: "Board deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//*Member routes */

//get board members
router.get("/:boardId/members", verifyToken, async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const currentBoard = await Board.findById(boardId);

    if (!currentBoard) {
      return res.status(404).json("Board not found");
    }

    // Ensure user is authorized
    const userId = req.user._id;
    const isOwner = currentBoard.ownerId.equals(userId);
    const isMember = currentBoard.memberIds.some((id) => id.equals(userId));

    if (!isOwner && !isMember) {
      return res.status(403).json("You are not authorized to view members of this board");
    }

    const members = await User.find({ _id: { $in: currentBoard.memberIds } });
    res.status(200).json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//add a member
router.put("/:boardId/member", verifyToken, async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const newUsername = req.body.username;
    //current board details
    const currentBoard = await Board.findById(boardId);
    //find searched user in db
    const findUserInDB = await User.findOne({ username: newUsername });

    if (!findUserInDB) {
      return res.status(403).json("No User exists by that username");
    }

    //Only owner of the board can add members and make sure Owner is not adding Owner as a member
    const isOwner = currentBoard.ownerId.equals(req.user._id);

    if (!isOwner) {
      return res.status(403).json("Only Owner can edit members");
    }

    if (isOwner && !currentBoard.ownerId.equals(findUserInDB._id)) {
      await Board.findByIdAndUpdate(
        boardId,
        { $addToSet: { memberIds: findUserInDB._id } } //stops duplicates
      );
    }
    res.status(201).json({
      message: `User ${newUsername} has been added as a member successfully`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
//remove a member
router.put("/:boardId/member/:memberId", verifyToken, async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const memberId = req.params.memberId;

    //current board details
    const currentBoard = await Board.findById(boardId);

    if (!currentBoard) {
      return res.status(404).json("Board not found");
    }

    //Only owner of the board can edit member
    const isOwner = currentBoard.ownerId.equals(req.user._id);

    if (!isOwner) {
      return res.status(403).json("Only Owner can edit members");
    }

    // Prevent removing the owner via this endpoint
    if (currentBoard.ownerId.equals(memberId)) {
      return res
        .status(400)
        .json("Owner cannot be removed from their own board");
    }

    //ensure actual member
    const isMember = currentBoard.memberIds.some((id) => id.equals(memberId));
    if (!isMember) {
      return res.status(404).json("User is not a member of this board");
    }

    if (isOwner) {
      await Board.findByIdAndUpdate(
        boardId,
        { $pull: { memberIds: new mongoose.Types.ObjectId(memberId) } } // $pull removes and type casted to an object
      );
    }

    res.status(200).json({
      message: `Member has been removed`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//*Column routes */
//add a column
router.post("/:boardId/column", verifyToken, async (req, res) => {
  try {
    const boardId = req.params.boardId;
    //get parent
    const currentBoard = await Board.findById(boardId);

    if (!currentBoard) {
      return res.status(404).json("Board not found");
    }

    let maxPosition = -1;

    // console.log(currentBoard.columns.length)
    if (currentBoard.columns.length > 0) {
      for (const column of currentBoard.columns) {
        if (column.position > maxPosition) {
          //console.log(maxPosition);
          maxPosition = column.position;
        }
      }
    }

    //position
    const lastPosition = maxPosition;

    //pushing new data to embedded column
    currentBoard.columns.push({
      title: req.body.title,
      position: lastPosition + 1,
    });

    await currentBoard.save();

    const newColumn = currentBoard.columns[currentBoard.columns.length - 1];
    res.status(201).json(newColumn);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//edit column
router.put("/:boardId/column/:columnId", verifyToken, async (req, res) => {
  try {
    const { boardId, columnId } = req.params;
    //get parent
    const currentBoard = await Board.findById(boardId);

    if (!currentBoard) {
      return res.status(404).json("Board not found");
    }

    //get column
    const column = currentBoard.columns.id(columnId);

    if (!column) {
      return res.status(404).json("Column doesn't exist");
    }

    column.title = req.body.title;

    await currentBoard.save();

    res.status(200).json("column changed");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//reorder columns
router.put("/:boardId/columns/reorder", verifyToken, async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const currentBoard = await Board.findById(boardId);
    const { orderedColumnIds } = req.body; //array of column ids in new order

    if (!currentBoard) {
      return res.status(404).json("Board not found");
    }

    //reordering the db array of column ids by the sorted list sent from frontend
    orderedColumnIds.forEach((columnId, index) => {
      const column = currentBoard.columns.id(columnId);
      column.position = index;
    });

    currentBoard.columns.sort((a, b) => a.position - b.position); //ensure the array in the db matches position values

    await currentBoard.save();
    res.status(200).json(currentBoard.columns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//delete a column
router.delete("/:boardId/column/:columnId", verifyToken, async (req, res) => {
  try {
    const { boardId, columnId } = req.params;
    const currentBoard = await Board.findById(boardId);

    if (!currentBoard) {
      return res.status(404).json("Board not found");
    }

    const column = currentBoard.columns.id(columnId);

    if (!column) {
      return res.status(404).json("Column doesn't exist");
    }

    //can only delete column if it has no cards in it
    if (column.cardIds.length > 0) {
      return res
        .status(409)
        .json("You cannot delete column that contain cards");
    }

    //delete column
    column.deleteOne();

    //fix position of remaining columns
    currentBoard.columns
      .sort((a, b) => a.position - b.position)
      .forEach((column, index) => {
        column.position = index;
      });

    await currentBoard.save();

    res.status(200).json("Column deleted");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//**Add a card */

router.post(
  "/:boardId/column/:columnId/card",
  verifyToken,
  async (req, res) => {
    try {
      const { boardId, columnId } = req.params;
      const currentBoard = await Board.findById(boardId);

      if (!currentBoard) {
        return res.status(404).json("Board not found");
      }

      const column = currentBoard.columns.id(columnId);

      if (!column) {
        return res.status(404).json("Column doesn't exist");
      }

      //ensure only owners and members can create card on this board
      const userId = req.user._id;
      const isOwnerReqUser = currentBoard.ownerId.equals(userId);
      const isMemberReqUser = currentBoard.memberIds?.some((id) =>
        id.equals(userId)
      );
      if (!isOwnerReqUser && !isMemberReqUser) {
        return res
          .status(403)
          .json("You are not authorized to create cards on this board");
      }

      //Assigned to person
      let findUserInDB;
      const usernameAssigned = req.body.assignedTo ? req.body.assignedTo : null;
      //find searched user in db
      if (usernameAssigned) {
        findUserInDB = await User.findOne({ username: usernameAssigned });

        if (!findUserInDB) {
          return res.status(404).json("No User exists by that username");
        }

        //trying to ensure the assigned to person is either the owner or a member of the board
        const isOwner = currentBoard.ownerId.equals(findUserInDB._id);
        const isMember = currentBoard.memberIds.some((id) =>
          id.equals(findUserInDB._id)
        );

        if (!isMember && !isOwner) {
          return res
            .status(403)
            .json("Assigned to person is not a member or owner of the board");
        }
      }

      const assigned = findUserInDB ? findUserInDB._id : null;

      //checking title
      if (!req.body.title) {
        return res.status(400).json("title required");
      }

      //create new card
      const newCard = await Card.create({
        boardId: boardId,
        columnId: columnId,
        title: req.body.title,
        description: req.body.description ? req.body.description : "",
        assignedTo: assigned,
        position: column.cardIds.length,
      });

      column.cardIds.push(newCard._id);

      await currentBoard.save();

      res.status(201).json({newCard});
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
