
let userName;
let url = new URL(window.location.href);
userName = url.searchParams.get('userName');
let userB = url.searchParams.get('userb');

const password = "x";
document.querySelector('#user-name').innerHTML = userName;

const socket = io.connect('https://localhost:8181/', {
    auth: {
        userName,
        password
    }
});

const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');

let localStream;
let remoteStream;
let peerConnection;
let didIOffer = false;

let peerConfiguration = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ]
        }
    ]
};

const call = async e => {
    await fetchUserMedia();

    await createPeerConnection();

    try {
        console.log("Creating offer...");
        const offer = await peerConnection.createOffer();
        console.log(offer);
        peerConnection.setLocalDescription(offer);
        didIOffer = true;
        socket.emit('newOffer', { offer, toUser: userB });
    } catch (err) {
        console.log(err);
    }
};

const answerOffer = async (offerObj) => {
    await fetchUserMedia();
    await createPeerConnection(offerObj);
    const answer = await peerConnection.createAnswer({});
    await peerConnection.setLocalDescription(answer);
    console.log(offerObj);
    console.log(answer);
    offerObj.answer = answer;
    const offerIceCandidates = await socket.emitWithAck('newAnswer', offerObj);
    offerIceCandidates.forEach(c => {
        peerConnection.addIceCandidate(c);
        console.log("======Added Ice Candidate======");
    });
    console.log(offerIceCandidates);
};

const addAnswer = async (offerObj) => {
    await peerConnection.setRemoteDescription(offerObj.answer);
};

const fetchUserMedia = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
            });
            localVideoEl.srcObject = stream;
            localStream = stream;
            resolve();
        } catch (err) {
            console.log(err);
            reject();
        }
    });
};

const createPeerConnection = (offerObj) => {
    return new Promise(async (resolve, reject) => {
        peerConnection = await new RTCPeerConnection(peerConfiguration);
        remoteStream = new MediaStream();
        remoteVideoEl.srcObject = remoteStream;

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.addEventListener("signalingstatechange", (event) => {
            console.log(event);
            console.log(peerConnection.signalingState);
        });

        peerConnection.addEventListener('icecandidate', e => {
            console.log('........Ice candidate found!......');
            console.log(e);
            if (e.candidate) {
                socket.emit('sendIceCandidateToSignalingServer', {
                    iceCandidate: e.candidate,
                    iceUserName: userName,
                    didIOffer,
                });
            }
        });

        peerConnection.addEventListener('track', e => {
            console.log("Got a track from the other peer!! How exciting");
            console.log(e);
            e.streams[0].getTracks().forEach(track => {
                remoteStream.addTrack(track, remoteStream);
                console.log("Here's an exciting moment... fingers crossed");
            });
        });

        if (offerObj) {
            await peerConnection.setRemoteDescription(offerObj.offer);
        }
        resolve();
    });
};

const addNewIceCandidate = iceCandidate => {
    peerConnection.addIceCandidate(iceCandidate);
    console.log("======Added Ice Candidate======");
};

document.querySelector('#call').addEventListener('click', call);

socket.on('newOfferAwaiting', offerObj => {
    answerOffer(offerObj);
});

socket.on('answerResponse', offerObj => {
    console.log(offerObj);
    addAnswer(offerObj);
});

socket.on('receivedIceCandidateFromServer', iceCandidate => {
    addNewIceCandidate(iceCandidate);
    console.log(iceCandidate);
});

document.querySelector('#hang-up').addEventListener('click', () => {
    if (peerConnection) {
        peerConnection.close();

        // Reset the peer connection
        peerConnection = null;
        didIOffer = false;

        socket.emit('hangUp', { toUser: userB });


    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
    }
    //remoteVideoEl.style.display = 'none'; // Hide the remote video element
    console.log("peerConnection closed and streams stopped! Hang up complete! Bye! Bye!"); 
    
   // hangUpClient();
});

// Hang up the call on the client side


socket.on('hangUp', () => {
   
    if (peerConnection) {
        peerConnection.close();

        // Reset the peer connection
        peerConnection = null;
        didIOffer = false;
        
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
    }
    //remoteVideoEl.style.display = 'none'; // Hide the remote video element
    alert("The other user has hung up!");
});





//modal
/*const callModal = document.getElementById('callModal');
const openModalButton = document.getElementById('openModalButton');
const acceptButton = document.getElementById('acceptButton');
const declineButton = document.getElementById('declineButton');

openModalButton.addEventListener('click', function() {
    callModal.classList.remove('hidden');
});

acceptButton.addEventListener('click', function() {
    // Handle the call acceptance logic
    // For example, you can start the call here
    callModal.classList.add('hidden');
});

declineButton.addEventListener('click', function() {
    // Handle the call rejection logic
    // For example, you can decline the call here
    callModal.classList.add('hidden');
}); */