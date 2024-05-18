const fs = require('fs');
const https = require('https');
const express = require('express');
const app = express();
const socketio = require('socket.io');
app.use(express.static(__dirname));

// Load SSL certificates
const key = fs.readFileSync('cert.key');
const cert = fs.readFileSync('cert.crt');

// Create an HTTPS server
const expressServer = https.createServer({ key, cert }, app);

// Create a Socket.io server with CORS settings
const io = socketio(expressServer, {
    cors: {
        origin: [
            "https://localhost",
            "https://3.6.214.118:8181"
        ],
        methods: ["GET", "POST"]
    }
});
expressServer.listen(8181);

// Initialize data structures for offers and connected sockets
const offers = [];
const connectedSockets = [];

// Handle new socket connections
io.on('connection', (socket) => {
    const { userName, password } = socket.handshake.auth;

    // Disconnect if password is incorrect
    if (password !== "x") {
        socket.disconnect(true);
        return;
    }

    // Add new connection to the connectedSockets array
    connectedSockets.push({ socketId: socket.id, userName });
    console.log(connectedSockets);

    // Handle new offers
    socket.on('newOffer', (data) => {
        const { offer, toUser } = data;
        const socketToAnswer = connectedSockets.find(s => s.userName === toUser);
        if (!socketToAnswer) {
            console.log("No matching socket");
            return;
        }
        const socketIdToAnswer = socketToAnswer.socketId;
        offers.push({
            offererUserName: userName,
            offer,
            offerIceCandidates: [],
            answererUserName: null,
            answer: null,
            answererIceCandidates: []
        });
        socket.to(socketIdToAnswer).emit('newOfferAwaiting', offers.slice(-1));
    });

    // Handle new answers
    socket.on('newAnswer', (offerObj, ackFunction) => {
        const socketToAnswer = connectedSockets.find(s => s.userName === offerObj.offererUserName);
        if (!socketToAnswer) {
            console.log("No matching socket");
            return;
        }
        const socketIdToAnswer = socketToAnswer.socketId;
        const offerToUpdate = offers.find(o => o.offererUserName === offerObj.offererUserName);
        if (!offerToUpdate) {
            console.log("No OfferToUpdate");
            return;
        }
        ackFunction(offerToUpdate.offerIceCandidates);
        offerToUpdate.answer = offerObj.answer;
        offerToUpdate.answererUserName = userName;
        socket.to(socketIdToAnswer).emit('answerResponse', offerToUpdate);
    });

    // Handle ICE candidates
    socket.on('sendIceCandidateToSignalingServer', (iceCandidateObj) => {
        const { didIOffer, iceUserName, iceCandidate } = iceCandidateObj;
        if (didIOffer) {
            const offerInOffers = offers.find(o => o.offererUserName === iceUserName);
            if (offerInOffers) {
                offerInOffers.offerIceCandidates.push(iceCandidate);
                if (offerInOffers.answererUserName) {
                    const socketToSendTo = connectedSockets.find(s => s.userName === offerInOffers.answererUserName);
                    if (socketToSendTo) {
                        socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
                    } else {
                        console.log("Ice candidate received but could not find answerer");
                    }
                }
            }
        } else {
            const offerInOffers = offers.find(o => o.answererUserName === iceUserName);
            const socketToSendTo = connectedSockets.find(s => s.userName === offerInOffers.offererUserName);
            if (socketToSendTo) {
                socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
            } else {
                console.log("Ice candidate received but could not find offerer");
            }
        }
    });

    // Handle disconnections
    socket.on('disconnect', () => {
        const index = connectedSockets.findIndex(s => s.socketId === socket.id);
        if (index !== -1) {
            connectedSockets.splice(index, 1);
        }
        console.log(connectedSockets);
    });

    // Handle hang up
    socket.on('hangUp', (data) => {
        const { toUser } = data;
        const remoteUserToHangUp = connectedSockets.find(s => s.userName === toUser);
        if (!remoteUserToHangUp) {
            console.log("No matching socket");
            return;
        }
        const socketIdToAnswer = remoteUserToHangUp.socketId;
        socket.to(socketIdToAnswer).emit('hangUp');
    });

    // Handle messages
    socket.on('send-message', ({ message, toUser }) => {
        const socketToMessage = connectedSockets.find(s => s.userName === toUser);
        if (socketToMessage) {
            io.to(socketToMessage.socketId).emit('receive-message', { fromUser: userName, message });
        }
    });
});
