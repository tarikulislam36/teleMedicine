

let userName;
let url = new URL(window.location.href);
userName = url.searchParams.get('userName');
 let token = url.searchParams.get('token');
 let CallType = url.searchParams.get('CallType');
//let userB = url.searchParams.get('userb');

let userB = url.searchParams.get('userb');

const password = "x";
document.querySelector('#user-name').innerHTML = userName;  

const socket = io.connect('https://test.findnewcars.com:443', {
    auth: {
        userName,
        password,
        token,
        CallType
    }
});
socket.on('redirect', (url) => {
    window.location.href = url;
});




// oncall
document.addEventListener('DOMContentLoaded', (event) => {
    // Your function to call when the website is loading or reloading
   // call();
});


  
const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');

let localStream;
let remoteStream;
let peerConnection;
let didIOffer = false;




let peerConfiguration = {
    iceServers:[
        {
            urls:[
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302'
            ]
        },
      {
            urls: 'turn:192.158.29.39:3478?transport=tcp',
            username: '28224511:1379330808',
            credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA='
        }
    ]
}

// codeSafe

// new Algo

// if User is available to connect
socket.on('WaitedRemoteUser', (JoinedUser) => {
    console.log("Remote User is available to connect");
   // console.log(remoteUserToConnect);
    console.log(JoinedUser);
    //alert("Remote User is available to connect");
   // alert("Remote User is available to connect", remoteUserToConnect);
   




// last modified

    const call = async e => {
        await fetchUserMedia();
    
        await createPeerConnection();
    
        try {
            console.log("Creating offer...");
            const offer = await peerConnection.createOffer();
            console.log(offer);
            peerConnection.setLocalDescription(offer);
            didIOffer = true;
            socket.emit('newOffer', { offer, toUser: JoinedUser, token });

            console.log("TEsting, Accessable or not", JoinedUser);
        } catch (err) {
            //console.log(err);
        }
    };
    
    call(); 

    // upto this is
});


// if User is not available to connect
socket.on('NoUserFound', () => {
    console.log("No User Found to connect");
    alert("No User Found to connect");
});



//End codeSafe







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
    if (CallType == 'audio') {
    return new Promise(async (resolve, reject) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: false, // Add video constraint
                audio: true, // Add audio constraint
            });
            localVideoEl.srcObject = stream;
            localStream = stream;
            resolve();
        } catch (err) {
            //console.log(err);
            reject();
        }
    });

} else if (CallType == 'video') {


 return new Promise(async (resolve, reject) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true, // Add video constraint
                audio: true, // Add audio constraint
            });
            localVideoEl.srcObject = stream;
            localStream = stream;
            resolve();
        } catch (err) {
            //console.log(err);
            reject();
        }

    });



}else{

    console.log("No Call Type Found");
}


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
           // console.log(e);
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
            //console.log(e);
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

        socket.emit('hangUp', { token: token });


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
   // alert("The other user has hung up!");
   console.log("The other user has leaved!");
//    history.back()
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

// const messagesContainer = document.getElementById('msgbox');
// const chatInput = document.querySelector('#chat-input');
// const sendMessageButton = document.querySelector('#send-message');
// const chatMessages = document.querySelector('#chat-messages');

// sendMessageButton.addEventListener('click', () => {
//     const message = chatInput.value;
//     if (message.trim() !== '') {
//         // Send the message to the connected user
//         socket.emit('send-message', { message, msgTo: token });
//         // Display the message locally
//         displayMessage(userName, message);
//         // Clear the chat input
//         chatInput.value = '';
//     }
// });

// socket.on('receive-message', ({ fromUser, message }) => {
//     // Display the received message
//     displayMessage(fromUser, message);
// });

// function displayMessage(user, message) {
//     const messageElement = document.createElement('div');
//    messageElement.innerHTML = `<b>${user}</b>:  ${message}  `;
//     chatMessages.appendChild(messageElement);
//     scrollToBottom();
    
// }

// function scrollToBottom() {
//     messagesContainer.scrollTop = messagesContainer.scrollHeight;
// }// popup message 

const popupMessagesContainer = document.getElementById('popup-msgbox');
const popupChatInput = document.querySelector('#popup-chat-input');
const popupSendMessageButton = document.querySelector('#popup-send-message');
const popupChatMessages = document.querySelector('#popup-chat-messages');
const notificationDot = document.getElementById('notification-dot');
const chatPopup = document.getElementById('chatPopup');
const messageBoxButton = document.getElementById('message_box');
let popupVisible = false;

popupSendMessageButton.addEventListener('click', () => {
    const message = popupChatInput.value;
    if (message.trim() !== '') {
        // Send the message to the connected user
        socket.emit('send-message', { message, msgTo: token });
        // Display the message locally
        displayPopupMessage(userName, message);
        // Clear the chat input
        popupChatInput.value = '';
    }
});

socket.on('receive-message', ({ fromUser, message }) => {
    // Display the received message
    displayPopupMessage(fromUser, message);
    // Show notification dot if the popup is not visible
    if (!popupVisible) {
        notificationDot.classList.remove('hidden');
    }
});

function displayPopupMessage(user, message) {
    const messageElement = document.createElement('div');
    messageElement.innerHTML = `<b>${user}</b>: ${message}`;
    popupChatMessages.appendChild(messageElement);
    scrollToBottom(popupMessagesContainer);
}

function scrollToBottom(container) {
    container.scrollTop = container.scrollHeight;
}

// Show/hide popup





// mute 
const muteButton = document.querySelector('#mute');
const unmuteButton = document.querySelector('#unmute');
const muteVideoButton = document.querySelector('#muteVideo');
const unmuteVideoButton = document.querySelector('#unmuteVideo');

muteButton.addEventListener('click', () => {
    toggleAudio(true);
    muteButton.style.display = 'none';
    unmuteButton.style.display = 'block';
});

unmuteButton.addEventListener('click', () => {
    toggleAudio(false);
    muteButton.style.display = 'block';
    unmuteButton.style.display = 'none';
});

muteVideoButton.addEventListener('click', () => {
    toggleVideo(true);
    muteVideoButton.style.display = 'none';
    unmuteVideoButton.style.display = 'block';
});

unmuteVideoButton.addEventListener('click', () => {
    toggleVideo(false);
    muteVideoButton.style.display = 'block';
    unmuteVideoButton.style.display = 'none';
});

function toggleAudio(muted) {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !muted;
        });
    }
}

function toggleVideo(muted) {
    if (localStream) {
        localStream.getVideoTracks().forEach(track => {
            track.enabled = !muted;
        });
    }
}




//REcall after 5sec  

// setTimeout(function() {
//     if (!peerConnection) {
//         console.log("You are not connected");
//       //  call();
//     }else{
//         console.log("You are already connected");
//          }
        
//   }, 5000);


// window.addEventListener('beforeunload', (event) => {
//     // Your code here

//     if (peerConnection) {
//         peerConnection.close();

//         // Reset the peer connection
//         peerConnection = null;
//         didIOffer = false;

//         socket.emit('hangUp', { token: token });
// alert("You have been disconnected from the call");

//     }
//     if (localStream) {
//         localStream.getTracks().forEach(track => track.stop());
//     }
//     if (remoteStream) {
//         remoteStream.getTracks().forEach(track => track.stop());
//     }
//     //remoteVideoEl.style.display = 'none'; // Hide the remote video element
//     console.log("peerConnection closed and streams stopped! Hang up complete! Bye! Bye!"); 
    
//    // hangUpClient();
    
//   });


const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Create an AnalyserNode
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256; // Adjust this value if needed

// Create a MediaStreamSource from the remote audio stream
const source = audioContext.createMediaStreamSource(remoteStream);

// Connect the source to the analyser
source.connect(analyser);

// Create a Uint8Array to store the analyser data
const dataArray = new Uint8Array(analyser.frequencyBinCount);

// Function to update the audio level
function updateAudioLevel() {
  // Get the audio level data
  analyser.getByteFrequencyData(dataArray);

  // Calculate the average audio level
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  const average = sum / dataArray.length;

  // Display the audio level (e.g., updating a progress bar or a visual indicator)
  const audioLevelElement = document.getElementById('remote-audio-level');
  if (audioLevelElement) {
    audioLevelElement.style.width = `${average}%`;
  }

  // Repeat the function at the next animation frame
  requestAnimationFrame(updateAudioLevel);
}

// Start updating the audio level
updateAudioLevel();