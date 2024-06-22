const fs = require('fs');
const https = require('https');
const express = require('express');
const socketio = require('socket.io');
const moment = require('moment-timezone');
let nowIST;

const app = express();
app.use(express.static(__dirname + '/')); 


// Load SSL certificates
// Load SSL certificates



const key = fs.readFileSync('/etc/letsencrypt/live/test.findnewcars.com/privkey.pem');
const cert = fs.readFileSync('/etc/letsencrypt/live/test.findnewcars.com/fullchain.pem');




// const key = fs.readFileSync('cert.key');
// const cert = fs.readFileSync('cert.crt');


// Create an HTTPS server
const expressServer = https.createServer({ key, cert }, app);

// Create a Socket.io server with CORS settings
const io = socketio(expressServer, {
    cors: {
        origin: [
            "https://test.findnewcars.com",
            "https://localhost",
            "https://168.235.89.123:443"
        ],
        methods: ["GET", "POST"]
    }
});

expressServer.listen(443, () => {
    console.log('Server is running on https://test.findnewcars.com:8181');
});

// Modification 2: Serve ui.html when a user visits /room
app.get('/room', (req, res) => {
    res.sendFile(__dirname + '/ui.html');
});



// Initialize data structures for offers and connected sockets
const offers = [];
const connectedSockets = [];

// Handle new socket connections
io.on('connection', (socket) => {
    const { userName, password, token ,CallType} = socket.handshake.auth;

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
        socket.emit('redirect', '/notAllowed.html');
        socket.disconnect(true);
        return;
    }
 // find the user with the same token to establish a connection
    const remoteUserToConnect = connectedSockets.find(s => s.token == token);

    if (remoteUserToConnect) {  

    const SitedUSer = remoteUserToConnect.socketId;
    const JoinedUser = socket.id;
    socket.to(SitedUSer).emit('WaitedRemoteUser',JoinedUser);
    console.log("User Found to connect", remoteUserToConnect.userName);
    console.log("testSocket", JoinedUser);

    nowIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'); // Start Time

         
    }
else {
 socket.to(socket.id).emit('NoUserFound');

    console.log("No User Found to connect");
    }

         



    // Add new connection to the connectedSockets array
    connectedSockets.push({ socketId: socket.id, userName, token, CallType, nowIST });
    socket.emit('updateUserList', connectedSockets);
    
    console.log("New All user", connectedSockets);
    
    // Handle new offers
    socket.on('newOffer', (data) => {
        const { offer, token,toUser } = data;
        const senderSocketId = socket.id;
        const socketToAnswer = connectedSockets.find(s => s.socketId === toUser);


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
        const remoteUserToHangUp2 = connectedSockets.find(s => s.token === token);

        if (!remoteUserToHangUp2) {
            console.log("No matching socket");
            return;
        }

        const socketIdToAnswer = remoteUserToHangUp2.socketId;
        socket.to(socketIdToAnswer).emit('hangUp');

        if (index !== -1) {
            connectedSockets.splice(index, 1);
        }
        console.log("available user", connectedSockets);
        io.emit('updateUserList', connectedSockets);
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
        const senderSocketId = socket.id;
        const socketToMessage = connectedSockets.find(s => s.token === msgTo && s.socketId !== senderSocketId);

        if (socketToMessage) {
            io.to(socketToMessage.socketId).emit('receive-message', { fromUser: userName, message });
        } else {
            io.to(senderSocketId).emit('receive-message', { fromUser: 'System', message: 'Please wait, there is no remote user connected.' });
        }
    });
});
