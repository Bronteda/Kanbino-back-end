const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  try {
    //get token and remove bearer
    const token = req.headers.authorization.split(" ")[1];
    //decode token into readable format
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    //let user have paymoad information
    req.user = decoded.payload;
    //next function
    next();
  } catch (error) {
    res.status(401).json({ error: "invalid token" });
  }
};


module.exports = verifyToken;