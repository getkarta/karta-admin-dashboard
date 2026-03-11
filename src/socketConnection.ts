import { io, Socket } from 'socket.io-client';
import { environment } from './config/environment';

let socket: Socket | null = null;
export function createVoiceSocket(token: string): Socket {
    const sessionid = new Date().getTime().toString();
    const voiceSocket = io(environment.apiUrl, {
        path: '/agent/ws/generate-content/',
        transports: ['polling', 'websocket'],
    });
    voiceSocket.on('connect', () => {
        console.log('[Voice Socket] Connected to /agent/ws/generate-content. ID:', voiceSocket.id);
    });
    voiceSocket.on('connect_error', (error) => {
        console.error('[Voice Socket] Connection error:', error?.message || error);
    });
    voiceSocket.on('disconnect', (reason) => {
        console.log('[Voice Socket] Disconnected:', reason);
    });
    return voiceSocket;
}

export function connectSocket(token: string): Socket {
    const sessionid = new Date().getTime().toString();
    if (socket) {
        socket.disconnect();
    }
    socket = io(environment.apiUrl, {
        path: '/ws',
        auth: {
            token: token,
            sessionID: sessionid,
        }
    });

    socket.on('connect', () => {
        if (socket) {
            console.log('Connected to server');
            console.log('Socket ID:', socket.id);
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    return socket;
}

// export function connectElevelLabsSocket(): WebSocket {
//     const sessionid = new Date().getTime().toString();
   
//     // const socket = new WebSocket('wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_01jy42s2g4fqqvehc13nvfn5ft&conversation_signature=cvtkn_01jy458q9pebht2sqx4dc7w5r2');

//     // socket.onopen = () => {
//     //     console.log('Connected');
//     // };

//     // socket.onopen = () => {
//     //     console.log("Connected");
      
//     //     // Send audio chunk as JSON
//     //     const payload = {
//     //       type: "user_audio_chunk",
//     //       user_audio_chunk: base64Data, // your base64-encoded audio data
//     //       conversation_id: this.dataService.sessionId,
//     //       audio_format: "pcm_16000"
//     //     };
      
//     //     console.log("Sending audio chunk:", payload);
//     //     socket.send(JSON.stringify(payload));
//     // };

   
//     // // Use the correct ElevenLabs WebSocket URL
//     // socket = io('wss://api.elevenlabs.io', {
//     //     path: '/v1/convai/conversation',
//     //     query: {
//     //         agent_id: 'agent_01jy42s2g4fqqvehc13nvfn5ft&conversation_signature=cvtkn_01jy458q9pebht2sqx4dc7w5r2'
//     //     }
//     // });

//     // socket.on('connect', () => {
//     //     if (socket) {
//     //         console.log('Connected to ElevenLabs server');
//     //         console.log('Socket ID:', socket.id);
//     //     }
//     // });

//     // socket.on('disconnect', () => {
//     //     console.log('Disconnected from server');
//     // });

//     // return socket;
// }



export function getSocket(): Socket | null {
    return socket;
}
