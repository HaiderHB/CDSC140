import asyncio
import websockets
from RealtimeSTT import AudioToTextRecorder

async def transcribe(websocket, path):
    print("Client connected")
    recorder = AudioToTextRecorder()

    try:
        async for message in websocket:
            print("Received audio data")
            # Assuming message is audio data in bytes
            recorder.feed_audio(message)
            transcription = recorder.text()
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