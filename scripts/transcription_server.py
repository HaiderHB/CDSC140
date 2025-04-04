import asyncio
import websockets
from RealtimeSTT import AudioToTextRecorder
import numpy as np
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('transcription_server')

async def transcribe(websocket, path):
    logger.info("Client connected")
    
    # Initialize the recorder without microphone input
    recorder = AudioToTextRecorder(
        use_microphone=False,
        spinner=False,
        model="tiny.en",  # Use a smaller model for faster processing
        silero_sensitivity=0.3,
        enable_realtime_transcription=True
    )
    
    try:
        async for message in websocket:
            logger.info(f"Received audio data of size {len(message)} bytes")
            
            # Convert bytes to Int16 numpy array (expected format)
            audio_data = np.frombuffer(message, dtype=np.int16)
            
            # Convert to float32 normalized to [-1, 1] range as required by RealtimeSTT
            audio_float = audio_data.astype(np.float32) / 32767.0
            
            # Feed the audio data to the transcriber
            logger.info("Processing audio data")
            recorder.feed_audio(audio_float.tobytes())
            
            # Get the transcription
            transcription = recorder.text()
            
            if transcription:
                logger.info(f"Transcription result: {transcription}")
                await websocket.send(transcription)
            else:
                logger.info("No transcription available yet")
    except websockets.exceptions.ConnectionClosed as e:
        logger.warning(f"Connection closed: {e}")
    except Exception as e:
        logger.error(f"Error in transcribe function: {e}")
    finally:
        logger.info("Shutting down recorder")
        recorder.shutdown()

async def main():
    server = await websockets.serve(transcribe, "localhost", 8765)
    logger.info("WebSocket server started on ws://localhost:8765")
    await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}") 