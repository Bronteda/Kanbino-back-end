const mongoose = require("mongoose");
const User = require("../models/user");

const columnSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    position: {
      type: Number,
      default: 0,
      min: 0,
    },
    cardIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Card" }],
  },
  { timestamps: true }
);

const boardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    startDate: {
      type: Date,
      default: Date.now, // set default
    },
    dueDate: {
      type: Date,
    },
    columns: [columnSchema],
  },
  { timestamps: true } //this will give our document createdAt and updatedAt properties
);

const Board = mongoose.model("Board", boardSchema);

module.exports = Board;
