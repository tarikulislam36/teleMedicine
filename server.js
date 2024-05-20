const fs = require('fs');
const https = require('https');
const express = require('express');
const socketio = require('socket.io');

const app = express();
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
    const { userName, password, token } = socket.handshake.auth;

    // Disconnect if password is incorrect
    if (password !== "x") {
        socket.disconnect(true);
        return;
    }

    // Check if there are already two users connected with the same token
    const usersWithSameUserNAMEID = connectedSockets.filter(s => s.userName === userName);
    if (usersWithSameUserNAMEID.length >= 1) {
       
        socket.emit('redirect', '/notAllowedUser.html');
        socket.disconnect(true);
        return;
    }

    const usersWithSameToken = connectedSockets.filter(s => s.token === token);

    if (usersWithSameToken.length >= 2) {
        // Redirect the third user to notAllowed.html
        socket.emit('redirect', '/notAllowed.html');
        socket.disconnect(true);
        return;
    }

    // Add new connection to the connectedSockets array
    connectedSockets.push({ socketId: socket.id, userName, token });
    console.log(connectedSockets);

    // Handle new offers
    socket.on('newOffer', (data) => {
        const { offer, toUser, token } = data;
        senderSocketId = socket.id;
        const socketToAnswer = connectedSockets.find(s => s.token === token && s.id !== senderSocketId);

        if (!socketToAnswer) {
            console.log("No matching socket");
            return;
        }
        const socketIdToAnswer = socketToAnswer.socketId;
        offers.push({
            offererUserName: userName,
            tokenID: token,
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
        const remoteUserToHangUp2 = connectedSockets.find(s => s.token === token );

        if (!remoteUserToHangUp2) {
            console.log("No matching socket");
            return;
        }
        const socketIdToAnswer = remoteUserToHangUp2.socketId;
        socket.to(socketIdToAnswer).emit('hangUp');
        
        if (index !== -1) {
            connectedSockets.splice(index, 1);
        }
        console.log(connectedSockets);
    });

    // Handle hang up
    socket.on('hangUp', (data) => {
        const { token } = data;

        senderSocketId = socket.id;

        const remoteUserToHangUp = connectedSockets.find(s => s.token === token);

        if (!remoteUserToHangUp) {
            console.log("No matching socket");
            return;
        }
        const socketIdToAnswer = remoteUserToHangUp.socketId;
        socket.to(socketIdToAnswer).emit('hangUp');
    });

    // Handle messages
    socket.on('send-message', ({ message, msgTo }) => {
        senderSocketId = socket.id;
        const socketToMessage = connectedSockets.find(s => s.token === msgTo && s.socketId !== senderSocketId);
        
        if (socketToMessage) {
            io.to(socketToMessage.socketId).emit('receive-message', { fromUser: userName, message });
        } else {
            io.to(senderSocketId).emit('receive-message', { fromUser: 'System', message: 'Please wait, there is no remote user connected.' });
        }
    });
});
