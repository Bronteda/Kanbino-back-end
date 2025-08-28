const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  username: {
    type: String,
    required: true,
    unique:true,
  },
  password: {
    type: String,
    required: true,
  },
});

//when converting this document to JSON use the following rule : Never pass the password to the frontend. Only send Name and username.
userSchema.set("toJSON", {
  transform: (document, returnedObject) => {
    delete returnedObject.password;
  },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
