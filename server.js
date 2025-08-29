//env
const dotenv = require('dotenv');
dotenv.config();
//app 
const express = require('express');
const app = express();

const cors = require('cors');
const logger = require("morgan");
const mongoose = require('mongoose');
//routers imported
const authRouter = require('./controllers/auth');
const boardRouter=require("./controllers/boards");
const cardsRouter=require("./controllers/cards");

//db connection 
mongoose.connect(process.env.MONGODB_URI);
mongoose.connection.on('connected', () => {
  console.log(`Connected to MongoDB ${mongoose.connection.name}.`);
});

//controllers

//middleware
app.use(cors());
app.use(express.json());
app.use(logger('dev'));
//routers middleware
app.use('/auth',authRouter);
app.use('/boards', boardRouter);
app.use('/cards',cardsRouter);

//listening 
const port = process.env.PORT ? process.env.PORT : 3000;
app.listen(port, ()=>{
    console.log(`Listening on port: ${port}`);
});