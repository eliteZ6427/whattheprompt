const express = require('express');
const app = express();
require('dotenv').config();

app.use(express.static('frontend'));

const cors = require('cors');
app.use(cors());

const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
	cors: {
		origin: process.env.SERVER_URL,
		methods: ['GET', 'POST'],
	}
});

const { initialize } = require('./scripts/socket');
initialize(io);

server.listen(process.env.PORT);