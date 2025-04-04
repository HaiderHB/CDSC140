import sys
import logging
import os
from install_packages import check_and_install_packages

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

# Suppress ctranslate2 warnings
os.environ['CT2_VERBOSE'] = '0'  # Suppress ctranslate2 logger
logging.getLogger('ctranslate2').setLevel(logging.ERROR)
# Suppress sentence_transformers INFO messages
logging.getLogger('sentence_transformers').setLevel(logging.WARNING)

# Check and install required packages
check_and_install_packages([
    {'import_name': 'websockets'},
    {'import_name': 'RealtimeSTT'},
    {'import_name': 'asyncio'},
    # Added for sentence similarity
    {'import_name': 'sentence_transformers'},
    {'import_name': 'onnxruntime'},
    {'import_name': 'onnx'},
    {'import_name': 'torch'}, # Needed for ONNX conversion
    {'import_name': 'numpy'},
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
# Added for sentence similarity
from sentence_transformers import SentenceTransformer
import onnxruntime as ort
from pathlib import Path
import torch # Required by sentence_transformers for conversion

# --- Sentence Similarity Setup ---
MODEL_NAME = 'multi-qa-MiniLM-L6-cos-v1'
ONNX_MODEL_DIR = Path("onnx_models")
ONNX_MODEL_PATH = ONNX_MODEL_DIR / f"{MODEL_NAME}.onnx"
SIMILARITY_THRESHOLD = 0.5  # Lowered from 0.7 to 0.5 for easier matching

# Global variables for sentence similarity
onnx_session = None
model = None # Keep the original model for encoding
bullet_points = []
bullet_embeddings = None
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

# --- Sentence Similarity Functions ---
def normalize_embeddings(embeddings):
    """Normalize embeddings to unit length."""
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    return embeddings / norms

class SentenceTransformerWrapper(torch.nn.Module):
    """Wrapper for SentenceTransformer to make it compatible with ONNX export"""
    def __init__(self, model):
        super().__init__()
        self.model = model
        self.tokenizer = model.tokenizer
    
    def forward(self, input_ids, attention_mask):
        # Forward compatible with ONNX export
        # This creates a dict expected by SentenceTransformer
        inputs = {"input_ids": input_ids, "attention_mask": attention_mask}
        return self.model.encode(inputs, convert_to_tensor=True)

def convert_to_onnx(model_name: str, output_path: Path):
    """Converts a SentenceTransformer model to ONNX format."""
    logging.info(f"Converting {model_name} to ONNX format...")
    try:
        # Load original model
        st_model = SentenceTransformer(model_name)
        # Create wrapper for ONNX export
        model = SentenceTransformerWrapper(st_model)
        
        # Create dummy input
        dummy_input_text = "This is a dummy input sentence."
        tokenized = st_model.tokenizer(dummy_input_text, return_tensors="pt", padding=True, truncation=True)
        input_ids = tokenized['input_ids']
        attention_mask = tokenized['attention_mask']

        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Export the model
        torch.onnx.export(
            model,                         # Wrapped model being run
            (input_ids, attention_mask),   # model inputs as separate tensors
            str(output_path),              # where to save the model
            export_params=True,            # store the trained parameter weights inside the model file
            opset_version=11,              # the ONNX version to export the model to
            do_constant_folding=True,      # whether to execute constant folding for optimization
            input_names=['input_ids', 'attention_mask'], # the model's input names
            output_names=['sentence_embedding'], # the model's output names
            dynamic_axes={'input_ids': {0: 'batch_size', 1: 'sequence_length'}, # variable length axes
                          'attention_mask': {0: 'batch_size', 1: 'sequence_length'},
                          'sentence_embedding': {0: 'batch_size'}}
        )
        logging.info(f"Model successfully converted to ONNX: {output_path}")
        return st_model # Return the original model for immediate use
    except Exception as e:
        logging.error(f"Error converting model to ONNX: {e}")
        return None

def load_onnx_model(model_name: str = MODEL_NAME, onnx_path: Path = ONNX_MODEL_PATH):
    """Loads the ONNX model, converting if necessary."""
    global onnx_session, model
    try:
        # First load the original model regardless of ONNX availability
        # This ensures we at least have a working model even if ONNX fails
        original_model = SentenceTransformer(model_name)
        model = original_model  # Set the global model
        logging.info(f"Loaded original SentenceTransformer model: {model_name}")
        
        # Try to load or convert to ONNX
        if not onnx_path.exists():
            logging.warning(f"ONNX model not found at {onnx_path}. Attempting conversion...")
            convert_to_onnx(model_name, onnx_path)
            
        # If we have a valid ONNX model, try to load it
        if onnx_path.exists():
            try:
                onnx_session = ort.InferenceSession(str(onnx_path))
                logging.info(f"ONNX Runtime session loaded successfully from {onnx_path}")
                return True
            except Exception as e:
                logging.error(f"Error loading ONNX session from {onnx_path}: {e}")
                logging.warning("Falling back to original SentenceTransformer model without ONNX")
                onnx_session = None
        else:
            logging.warning("ONNX model not available, using original SentenceTransformer directly")
            
        # Return True since we have a working model (even if not ONNX)
        return True
    except Exception as e:
        logging.error(f"Failed to load any sentence similarity model: {e}")
        model = None
        onnx_session = None
        return False

def compute_embeddings(texts):
    """Computes embeddings using either ONNX or the original model."""
    if not model:
        logging.warning("No model loaded. Cannot compute embeddings.")
        return None
        
    try:
        # If ONNX session is available, use it
        if onnx_session:
            inputs = model.tokenizer(texts, padding=True, truncation=True, return_tensors="np")
            onnx_inputs = {
                'input_ids': inputs['input_ids'].astype(np.int64),
                'attention_mask': inputs['attention_mask'].astype(np.int64)
            }
            # Run inference with ONNX Runtime
            outputs = onnx_session.run(None, onnx_inputs)
            embeddings = outputs[0] # Assuming the first output is the embedding
        else:
            # Fall back to the original model
            logging.debug("Using original SentenceTransformer model for embedding")
            embeddings = model.encode(texts, convert_to_numpy=True)
            
        normalized = normalize_embeddings(embeddings)
        return normalized
    except Exception as e:
        logging.error(f"Error computing embeddings: {e}")
        return None

def precompute_bullet_embeddings(points):
    """Precomputes embeddings for the list of bullet points."""
    global bullet_points, bullet_embeddings
    bullet_points = points
    if not points:
        bullet_embeddings = None
        logging.info("Bullet points list is empty. Cleared embeddings.")
        return
    logging.info(f"Precomputing embeddings for {len(points)} bullet points...")
    start_time = time.time()
    embeddings = compute_embeddings(points)
    if embeddings is not None:
        bullet_embeddings = embeddings
        end_time = time.time()
        logging.info(f"Precomputation finished in {end_time - start_time:.2f} seconds.")
    else:
        bullet_embeddings = None
        logging.error("Failed to precompute bullet embeddings.")

def find_best_match(transcript_text):
    """Finds the best matching bullet point for the given transcript."""
    if bullet_embeddings is None or len(bullet_points) == 0 or not transcript_text:
        if bullet_embeddings is None:
            logging.debug("No bullet embeddings available for matching.")
        elif len(bullet_points) == 0:
            logging.debug("No bullet points available for matching.")
        elif not transcript_text:
            logging.debug("Empty transcript text, skipping matching.")
        return None, 0.0 # No match if no bullets or empty transcript

    transcript_embedding = compute_embeddings([transcript_text])
    if transcript_embedding is None:
        logging.warning("Failed to compute embedding for transcript text.")
        return None, 0.0 # Failed to compute embedding

    # Calculate cosine similarities
    # Cosine similarity = dot product of normalized vectors
    similarities = np.dot(bullet_embeddings, transcript_embedding.T).flatten()

    best_match_index = np.argmax(similarities)
    best_score = similarities[best_match_index]

    logging.debug(f"Best match score: {best_score:.4f} (threshold: {SIMILARITY_THRESHOLD})")
    
    if best_score >= SIMILARITY_THRESHOLD:
        return bullet_points[best_match_index], best_score
    else:
        return None, best_score # No match above threshold

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

def process_text(text, websocket):
    """Callback function for processing transcribed text"""
    if recording and text:
        # Put the update in a queue to be processed by the main event loop
        transcription_queue.put((websocket, text))

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
                if match:
                    logging.info(f"Match found: '{match}' (Score: {score:.2f}) for transcript: '{text[:50]}...'")
                    # Put result in another queue to be sent by the main loop
                    similarity_queue.put((websocket, match, score))
                else:
                    # Add debug logging for when no match is found but we have bullets
                    if bullet_points and len(bullet_points) > 0:
                        logging.info(f"No match found (Score: {score:.2f}) for transcript: '{text[:50]}...'")
                        logging.info(f"Current bullet points ({len(bullet_points)}): {', '.join(bullet_points[:3])}{'...' if len(bullet_points) > 3 else ''}")
                    # logging.debug(f"No match found (Score: {score:.2f}) for transcript: '{text[:50]}...'")

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
    logging.info("Client connected to transcription server")

    try:
        async for message in websocket:
            # Handle binary audio data
            if isinstance(message, bytes):
                if recording and recorder:
                    try:
                        # Convert bytes to float32 array expected by RealtimeSTT
                        audio_data = np.frombuffer(message, dtype=np.int16)
                        if len(audio_data) > 0:
                            # Normalize to [-1, 1] float range
                            audio_float = audio_data.astype(np.float32) / 32767.0
                            recorder.feed_audio(audio_float.tobytes())
                            # logging.debug(f"Fed {len(message)} bytes of audio data") # Debug logging
                        # else:
                            # logging.warning("Received empty audio data chunk")

                    except Exception as e:
                        logging.error(f"Error processing audio data: {e}")

            # Handle text messages (commands or data)
            else:
                try:
                    data = json.loads(message)
                    message_type = data.get("type") # Use 'type' instead of 'command' for clarity
                    payload = data.get("payload", {})

                    if message_type == "control":
                        command = payload.get("command")
                        if command == "start":
                            if not recording:
                                logging.info("Start recording command received")
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
                                logging.info("Stop recording command received")
                                recording = False
                                # Optionally send final transcription fragments if any
                                recorder.on_realtime_transcription_update = None # Detach callback
                                await send_message(websocket, "status", {"status": "stopped"})

                        elif command == "ping":
                            # Respond to pings to keep connection alive if needed
                            await send_message(websocket, "control", {"command": "pong"})

                    elif message_type == "set_bullet_points":
                        points = payload.get("points", [])
                        logging.info(f"Received {len(points)} bullet points from client.")
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
        logging.info(f"Client disconnected with code {e.code}: {e.reason}")
    except Exception as e:
        logging.error(f"Error handling client: {e}", exc_info=True) # Log traceback
    finally:
        recording = False # Ensure recording stops on disconnect/error
        # Clear associated data for this client? Depends on desired behavior.
        logging.info(f"Client connection handling completed for {websocket.remote_address}")

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
    # --- Initialize Model and Recorder ---
    # Load ONNX model at startup
    model_loaded = load_onnx_model()
    if not model_loaded:
        logging.error("CRITICAL: Failed to load sentence similarity model. Matching will be disabled.")
        # Decide if server should exit or run without matching
        # sys.exit(1) # Or just continue without matching features

    # Pre-initialize the recorder
    initialize_recorder()
    if not recorder_initialized:
         logging.error("CRITICAL: Failed to initialize recorder. Server cannot start.")
         sys.exit(1)
    # --- End Initialization ---

    # Start the transcription and similarity queue processors
    asyncio.create_task(process_transcription_queue())
    asyncio.create_task(process_similarity_queue()) # Start the new queue processor

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