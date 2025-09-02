const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
//verify token from frontend / request
const verifyToken = require("../middleware/verify-token");
const Board = require("../models/board");
const User = require("../models/user");
const Card = require("../models/card");

//**Cards Routes*/

//Get all cards
router.get("/", verifyToken, async (req, res) => {
  try {
    const cards = await Card.find({}).populate().sort({ position: 1 });
    res.status(200).json({ cards });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//get card by id - show card
router.get("/:cardId", verifyToken, async (req, res) => {
  try {
    const cardId = req.params.cardId;
    const card = await Card.findById(cardId).populate();
    if (!card) return res.status(404).json("Card cannot be found");
    res.status(200).json(card);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//Reorder Card within the column
router.put("/reorder", verifyToken, async (req, res) => {
  try {
    const { columnId, orderedCardIds } = req.body; //array of card ids in new order

    if (!Array.isArray(orderedCardIds) || orderedCardIds.length === 0) {
      return res.status(400).json("orderedCardIds must be a non-empty array");
    }

    // Check if column exists
    const currentBoard = await Board.findOne({ "columns._id": columnId });
    if (!currentBoard) return res.status(404).json("Board cannot be found");
    const column = currentBoard.columns.id(columnId);
    if (!column) return res.status(404).json("Column cannot be found");

    // Ensure user is authorized
    const userId = req.user._id;
    const isOwner = currentBoard.ownerId.equals(userId);
    const isMember = currentBoard.memberIds?.some((id) => id.equals(userId));
    if (!isOwner && !isMember) {
      return res
        .status(403)
        .json("You are not authorized to reorder cards in this column");
    }

    // update positions only for cards in this column
    await Promise.all(
      orderedCardIds.map((cardId, index) =>
        Card.updateOne(
          { _id: cardId, columnId }, //filter by card and column id
          { $set: { position: index } }
        )
      )
    );

    //fetch new order of cards in this column to return to frontend
    const newCardOrder = await Card.find({ columnId }).sort({ position: 1 }); //ascending order based off position (-1 would be descending order )
    res
      .status(200)
      .json({ message: "Cards reordered successfully", newCardOrder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//Move card within the same column or different one
router.put("/move", verifyToken, async (req, res) => {
  try {
    const { cardId, fromColumnId, toColumnId, toIndex } = req.body;

    // Check if card exists
    const card = await Card.findById(cardId);
    if (!card) return res.status(404).json("Card cannot be found");

    // Check if new column exists
    const currentBoard = await Board.findOne({ "columns._id": toColumnId });
    if (!currentBoard) return res.status(404).json("Board cannot be found");
    const newColumn = currentBoard.columns.id(toColumnId);
    if (!newColumn) return res.status(404).json("Column cannot be found");

    // Ensure user is authorized
    const userId = req.user._id;
    const isOwner = currentBoard.ownerId.equals(userId);
    const isMember = currentBoard.memberIds?.some((id) => id.equals(userId));
    if (!isOwner && !isMember) {
      return res
        .status(403)
        .json("You are not authorized to move cards to this column");
    }

    // If moving within the same column, handle differently
    if (fromColumnId === toColumnId) {
      // Validate toIndex is within bounds for the column
      const cardsInColumn = await Card.find({ columnId: fromColumnId });
      if (toIndex < 0 || toIndex >= cardsInColumn.length) {
        return res.status(400).json("toIndex is out of bounds");
      }
      // Moving within the same column
      if (card.position < toIndex) {
        // Moving down
        await Card.updateMany(
          {
            columnId: fromColumnId,
            position: { $gt: card.position, $lte: toIndex }, // Only affect cards between the original and new position
            _id: { $ne: cardId }, // Exclude the card being moved
          },
          { $inc: { position: -1 } } // Decrement position by 1
        );
      } else if (card.position > toIndex) {
        // Moving up
        await Card.updateMany(
          {
            columnId: fromColumnId,
            position: { $gte: toIndex, $lt: card.position }, // Only affect cards between the original and new position
            _id: { $ne: cardId }, // Exclude the card being moved
          },
          { $inc: { position: 1 } } // Increment position by 1
        );
      }
      card.position = toIndex;
      await card.save();

      res.status(200).json({ message: "Card moved successfully", card });
    } else {
      // Validate toIndex is within bounds for the target column
      const cardsInTargetColumn = await Card.find({ columnId: toColumnId });
      if (toIndex < 0 || toIndex > cardsInTargetColumn.length) {
        return res
          .status(400)
          .json("toIndex is out of bounds for target column");
      }
      // Adjust positions in the original column
      await Card.updateMany(
        { columnId: fromColumnId, position: { $gt: card.position } }, //filter to only cards in the original column with position greater than the moved card
        { $inc: { position: -1 } } //decrement position by 1 to fill the gap
      );

      // Adjust positions in the new column
      await Card.updateMany(
        { columnId: toColumnId, position: { $gte: toIndex } }, //filter to only cards in the new column with position greater than or equal to the new index
        { $inc: { position: 1 } } //increment position by 1 to make space for the moved card
      );
      // Set new position for moved card
      card.position = toIndex;

      // Move card to new column
      card.columnId = toColumnId;
      await card.save();

      // Update cardIds arrays in board columns
      const oldColumn = currentBoard.columns.id(fromColumnId);
      if (oldColumn) {
        oldColumn.cardIds = oldColumn.cardIds.filter(
          (id) => !id.equals(cardId)
        );
      }
      if (newColumn) {
        newColumn.cardIds.splice(toIndex, 0, card._id);
      }
      await currentBoard.save();

      res.status(200).json({ message: "Card moved successfully", card });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//Edit Card
router.put("/:cardId", verifyToken, async (req, res) => {
  try {
    const cardId = req.params.cardId;
    const card = await Card.findById(cardId);
    if (!card) return res.status(404).json("Card cannot be found");

    const currentBoard = await Board.findById(card.boardId);
    if (!currentBoard) return res.status(404).json("Board cannot be found");

    //ensure only owners and members can edit card on this board
    const userId = req.user._id;
    const isOwnerReqUser = currentBoard.ownerId.equals(userId);
    const isMemberReqUser = currentBoard.memberIds?.some((id) =>
      id.equals(userId)
    );
    if (!isOwnerReqUser && !isMemberReqUser) {
      return res
        .status(403)
        .json("You are not authorized to edit cards on this board");
    }

    let update = {};

    //Assigned to person
    let findUserInDB;

    if ("assignedTo" in req.body) {
      const userIdAssigned = req.body.assignedTo ? req.body.assignedTo : null;
      //find searched user in db
      if (userIdAssigned) {
        findUserInDB = await User.findById(userIdAssigned);

        if (!findUserInDB) {
          return res.status(404).json("No User exists by that ID");
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

      update.assignedTo = findUserInDB ? findUserInDB._id : null;
    }

    //title check
    if ("title" in req.body) {
      if (typeof req.body.title !== "string") {
        return res.status(400).json("title required");
      }
      update.title = req.body.title;
    }

    if ("description" in req.body) {
      if (typeof req.body.description !== "string") {
        return res.status(400).json("description needs to be a string");
      }
      update.description = req.body.description;
    }

    if ("completedAt" in req.body) {
      if (req.body.completedAt === null) {
        update.completedAt = null;
      } else {
        const d = new Date(req.body.completedAt);
        if (isNaN(d.getTime())) {
          return res
            .status(400)
            .json("completedAt must be a valid date or null");
        }
        update.completedAt = d;
      }
    }

    const newCard = await Card.findByIdAndUpdate(
      cardId,
      { $set: update },
      { new: true }
    );

    res.status(200).json({ newCard });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//Remove Card
router.delete("/:cardId", verifyToken, async (req, res) => {
  try {
    const cardId = req.params.cardId;
    const card = await Card.findById(cardId);
    if (!card) return res.status(404).json("Card cannot be found");

    const currentBoard = await Board.findById(card.boardId);
    if (!currentBoard) return res.status(404).json("Board cannot be found");

    //ensure only owners and members can delete card on this board
    const userId = req.user._id;
    const isOwnerReqUser = currentBoard.ownerId.equals(userId);
    const isMemberReqUser = currentBoard.memberIds?.some((id) =>
      id.equals(userId)
    );
    if (!isOwnerReqUser && !isMemberReqUser) {
      return res
        .status(403)
        .json("You are not authorized to delete cards on this board");
    }
    // Adjust positions of remaining cards in the column
    const columnId = card.columnId;
    await Card.updateMany(
      { columnId, position: { $gt: card.position } }, //filter to only cards in the column with position greater than the deleted card
      { $inc: { position: -1 } } //decrement position by 1 to fill the gap
    );

    await Board.updateOne(
      { "columns._id": columnId }, //filter by columnId
      { $pull: { "columns.$.cardIds": cardId } } //remove card from column
    );

    await Card.findByIdAndDelete(cardId);
    res.status(200).json({ message: "Card deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//**Comments Routes */
//Add Comment
router.post("/:cardId/comments", verifyToken, async (req, res) => {
  try {
    //find parent - card
    const cardId = req.params.cardId;
    const card = await Card.findById(cardId);
    if (!card) return res.status(404).json("Card cannot be found");

    // Only push the required fields for a comment
    const commentData = {
      text: req.body.text,
      author: req.user._id,
      createdAt: new Date(),
    };

    card.comments.push(commentData);
    await card.save();

    // Populate the author field for the newly added comment
    const populatedCard = await Card.findById(cardId).populate(
      "comments.author"
    );
    const newComment =
      populatedCard.comments[populatedCard.comments.length - 1];
    res.status(201).json({ comment: newComment }); //respond with new comment
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//get comment by id
router.get("/:cardId/comments/:commentId", verifyToken, async (req, res) => {
  try {
    const cardId = req.params.cardId;
    const commentId = req.params.commentId;

    const card = await Card.findById(cardId);
    if (!card) return res.status(404).json("Card cannot be found");

    const comment = card.comments.id(commentId);
    if (!comment) return res.status(404).json("Comment cannot be found");

    res.status(200).json({ comment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//Edit Comment
router.put("/:cardId/comments/:commentId", verifyToken, async (req, res) => {
  try {
    const cardId = req.params.cardId;
    const commentId = req.params.commentId;

    const card = await Card.findById(cardId);
    if (!card) return res.status(404).json("Card cannot be found");

    const comment = card.comments.id(commentId);
    if (!comment) return res.status(404).json("Comment cannot be found");

    // Ensure the user is the author of the comment
    if (!comment.author.equals(req.user._id)) {
      return res
        .status(403)
        .json("You are not authorized to edit this comment");
    }

    // Update the comment text
    comment.text = req.body.text;
    await card.save();

    const populatedCard = await Card.findById(cardId).populate(
      "comments.author"
    );
    const updatedComment = populatedCard.comments.id(commentId);
    res.status(200).json({ comment: updatedComment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//Delete Comment
router.delete("/:cardId/comments/:commentId", verifyToken, async (req, res) => {
  try {
    const cardId = req.params.cardId;
    const commentId = req.params.commentId;

    const card = await Card.findById(cardId);
    if (!card) return res.status(404).json("Card cannot be found");

    const comment = card.comments.id(commentId);
    if (!comment) return res.status(404).json("Comment cannot be found");

    // Ensure the user is the author of the comment
    if (
      !comment.author ||
      !comment.author.equals ||
      !comment.author.equals(req.user._id)
    ) {
      return res
        .status(403)
        .json("You are not authorized to delete this comment");
    }

    card.comments.pull(commentId);
    await card.save();

    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
