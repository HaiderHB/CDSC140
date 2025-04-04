import asyncio
import websockets
from RealtimeSTT import AudioToTextRecorder
import numpy as np
import logging
import time

# Set up logging
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('transcription_server')

# Buffer to collect some audio before processing
audio_buffer = []
BUFFER_SIZE_THRESHOLD = 3  # Process after collecting a few chunks

# Global recorder to maintain state between messages
global_recorder = None

async def transcribe(websocket, path):
    global global_recorder, audio_buffer
    
    logger.info("Client connected - initializing recorder")
    
    # Initialize the recorder without microphone input
    # Use a smaller model for faster processing
    if global_recorder is None:
        global_recorder = AudioToTextRecorder(
            use_microphone=False,
            spinner=False,
            model="tiny.en",
            silero_sensitivity=0.2,
            webrtc_sensitivity=2,
            enable_realtime_transcription=True,
            on_realtime_transcription_update=lambda text: logger.info(f"Realtime update: {text}"),
            initial_prompt="End incomplete sentences with ellipses.",
            no_log_file=True
        )
        logger.info("Recorder initialized")
    
    try:
        last_processed = time.time()
        previous_text = ""
        
        async for message in websocket:
            logger.info(f"Received audio data of size {len(message)} bytes")
            
            # Convert bytes to Int16 numpy array (expected format)
            audio_data = np.frombuffer(message, dtype=np.int16)
            
            # Convert to float32 normalized to [-1, 1] range as required by RealtimeSTT
            audio_float = audio_data.astype(np.float32) / 32767.0
            
            # Feed the audio data to the transcriber
            logger.info(f"Feeding {len(audio_float)} samples to the recorder")
            global_recorder.feed_audio(audio_float.tobytes())
            
            # Check for transcription more frequently
            current_time = time.time()
            if current_time - last_processed > 0.2:  # Check every 200ms
                text = global_recorder.text()
                last_processed = current_time
                
                # Always send something even if it's the same text
                if text:
                    logger.info(f"Sending transcription: {text}")
                    await websocket.send(text)
                    previous_text = text
                elif previous_text:
                    # Send previous text to maintain connection
                    logger.info(f"No new text, sending previous: {previous_text}")
                    await websocket.send(previous_text)
                else:
                    logger.info("No transcription available yet")
                    
    except websockets.exceptions.ConnectionClosed as e:
        logger.warning(f"Connection closed: {e}")
    except Exception as e:
        logger.error(f"Error in transcribe function: {e}", exc_info=True)
    # Don't shutdown the recorder as we want to maintain state

async def main():
    server = await websockets.serve(transcribe, "localhost", 8765)
    logger.info("WebSocket server started on ws://localhost:8765")
    await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
        if global_recorder:
            logger.info("Shutting down recorder")
            global_recorder.shutdown()
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        if global_recorder:
            global_recorder.shutdown() 