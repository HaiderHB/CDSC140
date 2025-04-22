import sys
import logging
import os
from install_packages import check_and_install_packages
from RealtimeSTT import AudioToTextRecorder
import asyncio
import websockets
import json
import signal
import sys
import time
import queue
import numpy as np
from sentence_transformers import SentenceTransformer, util
import re

# Configure logging
logging.basicConfig(
    level=print,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)  # Explicitly set to stdout
    ]
)

# --- Sentence Similarity Setup ---
MODEL_NAME = 'sentence-transformers/multi-qa-MiniLM-L6-cos-v1'
SIMILARITY_THRESHOLD = 0.5  # Threshold for matching

# Global variables for sentence similarity
model = None
bullet_points = []
bullet_embeddings = None
# Track recent words and last matched text
recent_words = []
MIN_NEW_WORDS = 10  # Minimum number of new words required before matching again
ROLLING_WINDOW_SIZE = 10  # Number of words to keep in recent words
# --- End Sentence Similarity Setup ---

# Global flag to control the recording state
recording = False
# Global recorder instance
recorder = None
# Global flag to track if recorder is initialized
recorder_initialized = False
# Queue for transcription updates
transcription_queue = queue.SimpleQueue()
# Queue for similarity results
similarity_queue = queue.SimpleQueue()
# Flag to track if shutdown is in progress
shutdown_in_progress = False
# Flag to track if we're handling a signal
handling_signal = False
# Global variable to track total word count
total_word_count = 0
last_deleted_word_count = 0
# Track the last transcript seen
last_transcribed_text = ""

# Signal handler for graceful shutdown
def signal_handler(sig, frame):
    """Handle signals for graceful shutdown"""
    global shutdown_in_progress, handling_signal
    
    if handling_signal:
        return
    
    handling_signal = True
    print(f"Received signal {sig}, shutting down gracefully...")
    
    try:
        # Set the shutdown flag
        shutdown_in_progress = True
        
        # Stop recording if it's active
        global recording
        if recording:
            recording = False
            print("Stopped recording before shutdown")
        
        # Properly shut down the recorder
        shutdown_recorder()
        
        # Exit gracefully
        print("Shutdown complete, exiting")
    except Exception as e:
        logging.error(f"Error during signal handling: {e}")
    finally:
        sys.exit(0)

# --- Sentence Similarity Functions ---
def load_similarity_model(model_name=MODEL_NAME):
    """Loads the sentence transformer model."""
    global model
    try:
        model = SentenceTransformer(model_name)
        print(f"Loaded SentenceTransformer model: {model_name}")
        return True
    except Exception as e:
        logging.error(f"Failed to load sentence similarity model: {e}")
        model = None
        return False

def precompute_bullet_embeddings(points):
    """Precomputes embeddings for the list of bullet points."""
    global bullet_points, bullet_embeddings, recent_words
    bullet_points = points
    recent_words = []  # Reset recent words when bullet points change
    if not points:
        bullet_embeddings = None
        print("Bullet points list is empty. Cleared embeddings.")
        return
    
    print(f"Precomputing embeddings for {len(points)} bullet points...")
    start_time = time.time()
    
    try:
        bullet_embeddings = model.encode(points, convert_to_tensor=True)
        end_time = time.time()
        print(f"Precomputation finished in {end_time - start_time:.2f} seconds.")
    except Exception as e:
        bullet_embeddings = None
        logging.error(f"Failed to precompute bullet embeddings: {e}")

def find_best_match(transcript_text):
    """Finds the best matching bullet point for the given transcript."""
    global recent_words, last_deleted_word_count, total_word_count
    
    if bullet_embeddings is None or len(bullet_points) == 0 or not transcript_text:
        if bullet_embeddings is None:
            logging.debug("No bullet embeddings available for matching.")
        elif len(bullet_points) == 0:
            logging.debug("No bullet points available for matching.")
        elif not transcript_text:
            logging.debug("Empty transcript text, skipping matching.")
        return None, 0.0  # No match if no bullets or empty transcript

    try:
        # Update recent words
        words = transcript_text.split()
        recent_words.extend(words)
        if len(recent_words) > ROLLING_WINDOW_SIZE:  # Keep only last ROLLING_WINDOW_SIZE words
            recent_words = recent_words[-ROLLING_WINDOW_SIZE:]
        
        if total_word_count - last_deleted_word_count < MIN_NEW_WORDS:
            last_deleted_word_count = total_word_count
            return None, 0.0

        # Encode the transcript text
        transcript_embedding = model.encode(transcript_text, convert_to_tensor=True)
        
        # Only compute score for the first bullet point
        first_bullet_embedding = bullet_embeddings[0].unsqueeze(0)  # Add batch dimension
        score = util.dot_score(transcript_embedding, first_bullet_embedding)[0].cpu().item()
        
        logging.debug(f"Match score with first bullet: {score:.4f} (threshold: {SIMILARITY_THRESHOLD})")
        
        if score >= SIMILARITY_THRESHOLD:
            return bullet_points[0], score
        else:
            # Try matching with recent words as fallback
            if recent_words:
                recent_text = " ".join(recent_words)
                recent_embedding = model.encode(recent_text, convert_to_tensor=True)
                recent_score = util.dot_score(recent_embedding, first_bullet_embedding)[0].cpu().item()
                logging.debug(f"Fallback match score with recent words: {recent_score:.4f}")
                
                if recent_score >= SIMILARITY_THRESHOLD:
                    return bullet_points[0], recent_score
            
            return None, score  # No match above threshold
    except Exception as e:
        logging.error(f"Error finding best match: {e}")
        return None, 0.0

# --- End Sentence Similarity Functions ---

async def send_message(websocket, message_type, data):
    """Helper function to send JSON messages"""
    try:
        payload = {"type": message_type, **data}
        await websocket.send(json.dumps(payload))
    except websockets.exceptions.ConnectionClosed:
        logging.warning(f"Connection closed while sending {message_type}")
    except Exception as e:
        logging.error(f"Error sending {message_type}: {e}")

def strip_dots_and_spaces(text: str) -> str:
    """Removes dots and extra spaces from the text."""
    return re.sub(r'[.\s]+', ' ', text).strip()

def get_difference(prev: str, new: str) -> str:
    """Removes the common starting portion from new relative to prev."""
    prev_words = prev.split()
    new_words = new.split()
    i = 0
    while i < min(len(prev_words), len(new_words)) and prev_words[i] == new_words[i]:
        i += 1
    return ' '.join(new_words[i:])

def process_text(text, websocket):
    global total_word_count, last_transcribed_text

    if recording and text:
        # Step 1: Normalize by removing dots
        cleaned = strip_dots_and_spaces(text)
        last_cleaned = strip_dots_and_spaces(last_transcribed_text)

        # Step 4: If it's exactly the same, skip
        if cleaned == last_cleaned:
            print(f"Ignored duplicate transcript: '{cleaned}'")
            return

        # Step 2: Extract the difference
        difference = get_difference(last_cleaned, cleaned)

        # Step 3: Count and update
        added_words = len(difference.split())
        total_word_count += added_words

        # Replace Unicode characters with plain text
        # print(f"New words added: '{difference}'")
        # print(f"Total word count: {total_word_count}")

        transcription_queue.put((websocket, text))
        last_transcribed_text = text  # Store original, not cleaned

async def process_transcription_queue():
    """Process transcription updates from the queue and perform matching"""
    while True:
        try:
            # Process transcriptions in batches if available
            latest_texts = {} # Store latest text per websocket
            while not transcription_queue.empty():
                websocket, text = transcription_queue.get_nowait()
                latest_texts[websocket] = text # Keep only the latest

            # Process the latest transcription for each active websocket
            for websocket, text in latest_texts.items():
                # Send the latest transcription immediately
                await send_message(websocket, "transcription", {"text": text})

                # Perform similarity matching
                match, score = find_best_match(text)
                print(f"User just said: '{text[:50]}...'")
                if match:
                    print(f"Match found: '{match}' (Score: {score:.2f}) for transcript: '{text[:50]}...'")
                    # Put result in another queue to be sent by the main loop
                    similarity_queue.put((websocket, match, score))
                # else:
                #     # Add debug logging for when no match is found but we have bullets
                #     if bullet_points and len(bullet_points) > 0:
                #         print(f"No match found (Score: {score:.2f}) for transcript: '{text[:50]}...'")
                #         print(f"Current bullet points ({len(bullet_points)}): {', '.join(bullet_points[:3])}{'...' if len(bullet_points) > 3 else ''}")
                #     # logging.debug(f"No match found (Score: {score:.2f}) for transcript: '{text[:50]}...'")

        except Exception as e:
            logging.error(f"Error processing transcription queue: {e}")

        # Small delay to avoid tight loop
        await asyncio.sleep(0.05) # Slightly longer delay, matching is heavier

async def process_similarity_queue():
    """ Sends similarity results from the queue """
    while True:
        try:
            # Send all available similarity results
            while not similarity_queue.empty():
                websocket, match, score = similarity_queue.get_nowait()
                await send_message(websocket, "match_result", {"match": match, "score": float(score)})

        except Exception as e:
            logging.error(f"Error processing similarity queue: {e}")

        await asyncio.sleep(0.01) # Check frequently

# Custom AudioToTextRecorder class that properly handles shutdown
class CustomAudioToTextRecorder(AudioToTextRecorder):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._stop_poll = False
    
    def poll_connection(self):
        """Override the poll_connection method to respect the stop flag"""
        try:
            while not self._stop_poll:
                try:
                    if self.conn.poll(0.01):
                        data = self.conn.recv()
                        if isinstance(data, tuple):
                            status, content = data
                            if status == 'success':
                                transcription, info = content
                                if self.on_realtime_transcription_update:
                                    self.on_realtime_transcription_update(transcription)
                            elif status == 'error':
                                logging.error(f"Error in transcription: {content}")
                except (EOFError, BrokenPipeError) as e:
                    if not self._stop_poll:  # Only log if not intentionally stopping
                        logging.error(f"Connection error in poll_connection: {e}")
                    break
                except Exception as e:
                    if not self._stop_poll:  # Only log if not intentionally stopping
                        logging.error(f"Error in poll_connection: {e}")
                    time.sleep(0.1)
        except Exception as e:
            if not self._stop_poll:  # Only log if not intentionally stopping
                logging.error(f"Fatal error in poll_connection: {e}")
        finally:
            logging.debug("Poll connection thread ended")
    
    def shutdown(self):
        """Properly shut down the recorder"""
        try:
            # Stop the poll_connection thread
            self._stop_poll = True
            if hasattr(self, '_poll_thread') and self._poll_thread:
                self._poll_thread.join(timeout=1.0)
            
            # Call the parent's shutdown method if it exists
            if hasattr(super(), 'shutdown'):
                super().shutdown()
        except Exception as e:
            logging.error(f"Error in custom shutdown: {e}")

def initialize_recorder():
    """Initialize the recorder if not already initialized"""
    global recorder, recorder_initialized
    
    if not recorder_initialized:
        try:
            recorder = CustomAudioToTextRecorder(
                spinner=False,
                model='tiny.en',
                use_main_model_for_realtime=True,
                compute_type='int8_float32',
                language='en',
                silero_sensitivity=0.6,
                webrtc_sensitivity=2,
                post_speech_silence_duration=0.15,
                min_gap_between_recordings=0.3,
                early_transcription_on_silence=50,
                min_length_of_recording=1.5,
                enable_realtime_transcription=True,
                # Reduce processing pause for more frequent updates
                realtime_processing_pause=0.02,
                silero_deactivity_detection=False,
                beam_size=5,
                beam_size_realtime=1,
                debug_mode=True,
                no_log_file=True,
            )
            recorder_initialized = True
            print("Recorder initialized successfully")
        except Exception as e:
            logging.error(f"Error initializing recorder: {e}")
            return False
    return True

def handle_client_disconnect(websocket):
    """Handle client disconnection without shutting down the recorder"""
    global recording
    recording = False  # Ensure recording stops on disconnect
    print(f"Client connection handling completed for {websocket.remote_address}")

async def handle_client(websocket):
    """Handle WebSocket connection with the Electron app"""
    global recording, recorder, recorder_initialized, bullet_points, bullet_embeddings

    # Ensure recorder is initialized
    if not recorder_initialized:
        logging.warning("Recorder not initialized before client connection.")
        initialized = initialize_recorder()
        if not initialized:
            await websocket.close(1011, "Failed to initialize recorder")
            return

    # Send initial connection status
    await send_message(websocket, "status", {"status": "connected"})
    print("Client connected to transcription server")

    try:
        async for message in websocket:
            # Handle binary audio data
            if isinstance(message, bytes):
                if recording and recorder and not shutdown_in_progress:
                    try:
                        # Convert bytes to float32 array expected by RealtimeSTT
                        audio_data = np.frombuffer(message, dtype=np.int16)
                        if len(audio_data) > 0:
                            # Normalize to [-1, 1] float range
                            audio_float = audio_data.astype(np.float32) / 32767.0
                            recorder.feed_audio(audio_float.tobytes())

                    except Exception as e:
                        logging.error(f"Error processing audio data: {e}")

            else:
                try:
                    data = json.loads(message)
                    message_type = data.get("type")
                    payload = data.get("payload", {})

                    if message_type == "control":
                        command = payload.get("command")
                        if command == "start":
                            if not recording and not shutdown_in_progress:
                                print("Start recording command received")
                                recording = True
                                # Clear old transcription data if needed
                                while not transcription_queue.empty(): transcription_queue.get()
                                while not similarity_queue.empty(): similarity_queue.get()

                                recorder.on_realtime_transcription_update = lambda text: process_text(text, websocket)
                                # Start recorder loop in executor
                                asyncio.get_event_loop().run_in_executor(None, start_recording_loop)
                                await send_message(websocket, "status", {"status": "started"})

                        elif command == "stop":
                            if recording:
                                print("Stop recording command received")
                                recording = False
                                # Optionally send final transcription fragments if any
                                recorder.on_realtime_transcription_update = None  # Detach callback
                                await send_message(websocket, "status", {"status": "stopped"})

                        elif command == "shutdown":
                            print("Shutdown command received")
                            # Properly shut down the recorder
                            await asyncio.get_event_loop().run_in_executor(None, shutdown_recorder)
                            await send_message(websocket, "status", {"status": "shutdown_complete"})
                            # Close the websocket connection
                            await websocket.close(1000, "Shutdown requested by client")

                        elif command == "ping":
                            # Respond to pings to keep connection alive if needed
                            await send_message(websocket, "control", {"command": "pong"})

                    elif message_type == "set_bullet_points":
                        points = payload.get("points", [])
                        print(f"Received {len(points)} bullet points from client.")
                        # Run blocking precomputation in executor
                        await asyncio.get_event_loop().run_in_executor(None, precompute_bullet_embeddings, points)
                        await send_message(websocket, "status", {"status": "bullets_updated", "count": len(bullet_points)})

                    else:
                        logging.warning(f"Received unknown message type: {message_type}")

                except json.JSONDecodeError:
                    logging.warning(f"Received invalid JSON: {message}")
                except Exception as e:
                    logging.error(f"Error processing message: {e} | Raw: {message}")

    except websockets.exceptions.ConnectionClosed as e:
        print(f"Client disconnected with code {e.code}: {e.reason}")
    except Exception as e:
        logging.error(f"Error handling client: {e}", exc_info=True)  # Log traceback
    finally:
        handle_client_disconnect(websocket)

def start_recording_loop():
    """Function to run in a separate thread for continuous recording"""
    global recording, recorder
    
    try:
        # Use a dedicated thread for recording to avoid blocking
        while recording and not shutdown_in_progress:
            try:
                # Call text() without the unsupported timeout parameter
                recorder.text(lambda text: None)  # We handle real-time updates via on_realtime_transcription_update
            except Exception as e:
                if not shutdown_in_progress:  # Only log if not shutting down
                    logging.error(f"Error in recording iteration: {e}")
                time.sleep(0.1)
    except Exception as e:
        if not shutdown_in_progress:  # Only log if not shutting down
            logging.error(f"Error in recording loop: {e}")
    finally:
        logging.debug("Recording loop ended")

def shutdown_recorder():
    """Properly shut down the recorder to prevent memory leaks"""
    global recording, recorder, recorder_initialized, shutdown_in_progress
    
    if shutdown_in_progress:
        return
    
    shutdown_in_progress = True
    print("Shutting down recorder...")
    
    try:
        # First stop recording if it's active
        if recording:
            recording = False
            print("Stopped recording before shutdown")
        
        # Then properly shut down the recorder
        if recorder and recorder_initialized:
            try:
                # Detach callback to prevent further callbacks during shutdown
                recorder.on_realtime_transcription_update = None
                
                # Call the custom shutdown method
                recorder.shutdown()
                print("Recorder shutdown method called")
                
                # Clear the recorder instance
                recorder = None
                recorder_initialized = False
                print("Recorder instance cleared")
            except Exception as e:
                logging.error(f"Error during recorder shutdown: {e}")
    except Exception as e:
        logging.error(f"Error in shutdown_recorder: {e}")
    finally:
        shutdown_in_progress = False
        print("Recorder shutdown completed")

# You can also add a function to retrieve the total word count if needed
def get_total_word_count():
    """Returns the total word count for the session"""
    return total_word_count

has_started = False

async def main():
    """Main function to start the WebSocket server"""
    global has_started
    if has_started:
        print("Server already started")
        return
    has_started = True

    # Print a startup banner
    print("\n" + "="*50)
    print("Starting Transcription Server")
    print("="*50 + "\n")

    start_time = time.time()
    last_step_time = start_time

    # Suppress ctranslate2 warnings
    os.environ['CT2_VERBOSE'] = '0'  # Suppress ctranslate2 logger
    logging.getLogger('ctranslate2').setLevel(logging.ERROR)
    # Suppress sentence_transformers INFO messages
    logging.getLogger('sentence_transformers').setLevel(logging.WARNING)

    current_time = time.time()
    print(f"Initial setup completed in {current_time - last_step_time:.2f} seconds")
    last_step_time = current_time

    print("Checking and installing required packages...")
    # Check and install required packages
    check_and_install_packages([
        {'import_name': 'websockets'},
        {'import_name': 'RealtimeSTT'},
        {'import_name': 'asyncio'},
        {'import_name': 'sentence_transformers'},
        {'import_name': 'numpy'},
    ])
    
    current_time = time.time()
    print(f"Package installation completed in {current_time - last_step_time:.2f} seconds")
    last_step_time = current_time
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # --- Initialize Model and Recorder ---
    # Load sentence transformer model at startup
    print("Loading sentence transformer model...")
    model_loaded = load_similarity_model()
    if not model_loaded:
        logging.error("---CRITICAL---: Failed to load sentence similarity model. Matching will be disabled.")
        # Decide if server should exit or run without matching
        # sys.exit(1) # Or just continue without matching features

    current_time = time.time()
    print(f"Model loading completed in {current_time - last_step_time:.2f} seconds")
    last_step_time = current_time

    # Pre-initialize the recorder
    print("Initializing recorder...")
    initialize_recorder()
    if not recorder_initialized:
         logging.error("---CRITICAL---: Failed to initialize recorder. Server cannot start.")
         sys.exit(1)
    # --- End Initialization ---

    current_time = time.time()
    print(f"Recorder initialization completed in {current_time - last_step_time:.2f} seconds")
    last_step_time = current_time

    # Start the transcription and similarity queue processors
    print("Starting transcription and similarity queue processors...")
    asyncio.create_task(process_transcription_queue())
    asyncio.create_task(process_similarity_queue()) # Start the new queue processor

    current_time = time.time()
    print(f"Queue processors started in {current_time - last_step_time:.2f} seconds")
    last_step_time = current_time

    try:
        print("Starting WebSocket server...")
        # Use larger buffer sizes for better performance
        server = await websockets.serve(
            handle_client, 
            "127.0.0.1", 
            9876,
            ping_interval=None,  # Disable ping/pong for lower overhead
            max_size=10 * 1024 * 1024,  # 10MB message size
            max_queue=64  # Larger queue for messages
        )
        
        current_time = time.time()
        print(f"WebSocket server started in {current_time - last_step_time:.2f} seconds")
        print(f"Total startup time: {current_time - start_time:.2f} seconds")
        print("\nServer listening on ws://127.0.0.1:9876")
        print("Ready to accept WebSocket connections")
        
        # On Windows, signal handlers with asyncio can cause issues
        # Just run the server indefinitely
        try:
            await asyncio.Future()  # Run forever
        except asyncio.CancelledError:
            pass
        finally:
            server.close()
            await server.wait_closed()
            print("Server shut down gracefully")
            # Properly shut down the recorder
            await asyncio.get_event_loop().run_in_executor(None, shutdown_recorder)
    except OSError as e:
        # Handle the case where the port is already in use
        if e.errno == 10048:  # Windows-specific error for "Address already in use"
            print("Transcription server is already running on port 9876")
            # Exit gracefully - this is not an error
            return
        else:
            # For other OSErrors, log and re-raise
            logging.error(f"Failed to start server: {e}")
            raise
    finally:
        # Ensure recorder is shut down even if there's an exception
        if not shutdown_in_progress:
            await asyncio.get_event_loop().run_in_executor(None, shutdown_recorder)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Interrupted by user")
        # Ensure recorder is shut down on keyboard interrupt
        if not shutdown_in_progress:
            asyncio.run(asyncio.get_event_loop().run_in_executor(None, shutdown_recorder))
        sys.exit(0)
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        # Ensure recorder is shut down on unexpected errors
        if not shutdown_in_progress:
            asyncio.run(asyncio.get_event_loop().run_in_executor(None, shutdown_recorder))
        sys.exit(1) 