import asyncio
import websockets
from RealtimeSTT import AudioToTextRecorder
import numpy as np

async def transcribe(websocket, path):
    print("Client connected")
    recorder = AudioToTextRecorder()

    try:
        async for message in websocket:
            print("Received audio data")
            # Convert bytes to Int16 numpy array
            audio_data = np.frombuffer(message, dtype=np.int16)
            # Convert to float32 for the transcriber
            audio_float = audio_data.astype(np.float32) / 32767.0
            # Feed the audio data to the transcriber
            recorder.feed_audio(audio_float.tobytes())
            transcription = recorder.text()
            if transcription:  # Only send if we have a transcription
                print("Transcription:", transcription)
                await websocket.send(transcription)
    except websockets.exceptions.ConnectionClosed as e:
        print("Connection closed", e)
    finally:
        recorder.shutdown()

async def main():
    async with websockets.serve(transcribe, "localhost", 8765):
        print("WebSocket server started on ws://localhost:8765")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main()) 