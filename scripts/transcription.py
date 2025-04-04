import sys
import logging
import os
from install_packages import check_and_install_packages

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

# Suppress ctranslate2 warnings
os.environ['CT2_VERBOSE'] = '0'  # Suppress ctranslate2 logger
logging.getLogger('ctranslate2').setLevel(logging.ERROR)

# Check and install required packages
check_and_install_packages([
    {'import_name': 'websockets'},
    {'import_name': 'RealtimeSTT'},
    {'import_name': 'asyncio'},
])

from RealtimeSTT import AudioToTextRecorder
import asyncio
import websockets
import json
import signal
import sys
import time
import queue
import numpy as np

# Global flag to control the recording state
recording = False
# Global recorder instance
recorder = None
# Global flag to track if recorder is initialized
recorder_initialized = False
# Queue for transcription updates
transcription_queue = queue.SimpleQueue()

async def send_transcription(websocket, text):
    """Send the transcription to the connected client"""
    try:
        await websocket.send(json.dumps({"type": "transcription", "text": text}))
    except websockets.exceptions.ConnectionClosed:
        logging.warning("Connection closed while sending transcription")
    except Exception as e:
        logging.error(f"Error sending transcription: {e}")

def process_text(text, websocket):
    """Callback function for processing transcribed text"""
    if recording:
        # Instead of creating a new event loop and sending immediately,
        # put the update in a queue to be processed by the main event loop
        transcription_queue.put((websocket, text))

async def process_transcription_queue():
    """Process transcription updates from the queue"""
    while True:
        try:
            # Process transcriptions in batches if available to reduce event loop overhead
            batch_size = 0
            latest_text = None
            latest_websocket = None
            
            # Get all available updates and only keep the latest one per websocket
            while not transcription_queue.empty() and batch_size < 5:
                websocket, text = transcription_queue.get_nowait()
                latest_websocket = websocket
                latest_text = text
                batch_size += 1
            
            # If we got any updates, send the latest one
            if latest_text is not None and latest_websocket is not None:
                await send_transcription(latest_websocket, latest_text)
        except Exception as e:
            logging.error(f"Error processing transcription queue: {e}")
        
        # Small delay to avoid tight loop
        await asyncio.sleep(0.01)  # 10ms delay - fast enough for responsiveness

def initialize_recorder():
    """Initialize the recorder if not already initialized"""
    global recorder, recorder_initialized
    
    if not recorder_initialized:
        try:
            recorder = AudioToTextRecorder(
                spinner=False,
                model='base.en',
                realtime_model_type='base.en',
                language='en',
                silero_sensitivity=0.4,
                webrtc_sensitivity=3,
                post_speech_silence_duration=1.8,
                min_length_of_recording=1.1,
                min_gap_between_recordings=0,
                enable_realtime_transcription=True,
                # Reduce processing pause for more frequent updates
                realtime_processing_pause=0.02,
                silero_deactivity_detection=False,
                early_transcription_on_silence=0,
                beam_size=5,
                beam_size_realtime=1,
                no_log_file=True,
                initial_prompt=(
                    "End incomplete sentences with ellipses.\n"
                    "Examples:\n"
                    "Complete: The sky is blue.\n"
                    "Incomplete: When the sky...\n"
                    "Complete: She walked home.\n"
                    "Incomplete: Because he...\n"
                )
            )
            recorder_initialized = True
            logging.info("Recorder initialized successfully")
        except Exception as e:
            logging.error(f"Error initializing recorder: {e}")
            return False
    return True

async def handle_client(websocket):
    """Handle WebSocket connection with the Electron app"""
    global recording, recorder, recorder_initialized
    
    # Initialize recorder - this might take some time on first run
    initialized = initialize_recorder()
    if not initialized:
        await websocket.close(1011, "Failed to initialize recorder")
        return
    
    # Send initial connection message
    try:
        await websocket.send(json.dumps({"type": "status", "status": "connected"}))
        logging.info("Client connected to transcription server")
    except Exception as e:
        logging.error(f"Error sending initial connection message: {e}")
        return
    
    try:
        async for message in websocket:
            # Check if the message is binary (audio data) or text (command)
            if isinstance(message, bytes):
                if recording:
                    try:
                        # Log the size of the received audio data
                        logging.info(f"Received audio data: {len(message)} bytes")
                        
                        # Convert bytes to float32 array expected by RealtimeSTT
                        
                        # First interpret as int16 (most common audio format)
                        audio_data = np.frombuffer(message, dtype=np.int16)
                        
                        # Print basic audio stats for debugging
                        if len(audio_data) > 0:
                            logging.info(f"Audio data stats: min={audio_data.min()}, max={audio_data.max()}, mean={audio_data.mean()}, samples={len(audio_data)}")
                        
                        # Convert to float32 normalized to [-1, 1] range as required by RealtimeSTT
                        audio_float = audio_data.astype(np.float32) / 32767.0
                        
                        # Feed the audio data to the recorder
                        if recorder:
                            recorder.feed_audio(audio_float.tobytes())
                            logging.info("Audio data sent to transcription engine")
                    except Exception as e:
                        logging.error(f"Error processing audio data: {e}")
            else:
                # Handle text messages (commands)
                try:
                    data = json.loads(message)
                    command = data.get("command")
                    
                    if command == "start":
                        if not recording:
                            logging.info("Starting transcription...")
                            recording = True
                            
                            # Set callback to send updates to the client
                            recorder.on_realtime_transcription_update = lambda text: process_text(text, websocket)
                            
                            # Start the recording in a separate thread
                            asyncio.get_event_loop().run_in_executor(None, start_recording_loop)
                            
                            await websocket.send(json.dumps({"type": "status", "status": "started"}))
                    
                    elif command == "stop":
                        if recording:
                            logging.info("Stopping transcription...")
                            recording = False
                            await websocket.send(json.dumps({"type": "status", "status": "stopped"}))
                except json.JSONDecodeError:
                    logging.warning(f"Received invalid JSON: {message}")
                except Exception as e:
                    logging.error(f"Error processing message: {e}")
    except websockets.exceptions.ConnectionClosed as e:
        logging.info(f"Client disconnected with code {e.code}: {e.reason}")
    except Exception as e:
        logging.error(f"Error handling client: {e}")
    finally:
        recording = False
        logging.info("Client connection handling completed")

def start_recording_loop():
    """Function to run in a separate thread for continuous recording"""
    global recording, recorder
    
    try:
        # Use a dedicated thread for recording to avoid blocking
        while recording:
            try:
                # Call text() without the unsupported timeout parameter
                recorder.text(lambda text: None)  # We handle real-time updates via on_realtime_transcription_update
            except Exception as e:
                logging.error(f"Error in recording iteration: {e}")
                time.sleep(0.1)
    except Exception as e:
        logging.error(f"Error in recording loop: {e}")
    finally:
        logging.debug("Recording loop ended")

async def main():
    """Main function to start the WebSocket server"""
    # Pre-initialize the recorder at server startup to reduce connection delay
    initialize_recorder()
    
    # Start the transcription queue processor task
    asyncio.create_task(process_transcription_queue())
    
    try:
        # Use larger buffer sizes for better performance
        server = await websockets.serve(
            handle_client, 
            "127.0.0.1", 
            9876,
            ping_interval=None,  # Disable ping/pong for lower overhead
            max_size=10 * 1024 * 1024,  # 10MB message size
            max_queue=64  # Larger queue for messages
        )
        
        logging.info("Transcription server started on ws://127.0.0.1:9876")
        
        # On Windows, signal handlers with asyncio can cause issues
        # Just run the server indefinitely
        try:
            await asyncio.Future()  # Run forever
        except asyncio.CancelledError:
            pass
        finally:
            server.close()
            await server.wait_closed()
            logging.info("Server shut down gracefully")
            if recorder:
                try:
                    recorder.shutdown()
                except Exception as e:
                    logging.error(f"Error shutting down recorder: {e}")
    except OSError as e:
        # Handle the case where the port is already in use
        if e.errno == 10048:  # Windows-specific error for "Address already in use"
            logging.info("Transcription server is already running on port 9876")
            # Exit gracefully - this is not an error
            return
        else:
            # For other OSErrors, log and re-raise
            logging.error(f"Failed to start server: {e}")
            raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Interrupted by user")
        sys.exit(0) 