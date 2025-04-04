import asyncio
import websockets

async def echo(websocket, path):
    print("Client connected!")
    try:
        async for message in websocket:
            print(f"Received message: {message[:30]}...")
            await websocket.send("Echo: Test successful!")
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")

async def main():
    print("Starting test WebSocket server on ws://localhost:8765")
    async with websockets.serve(echo, "localhost", 8765):
        print("Server is running. Waiting for connections...")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped by user")
    except Exception as e:
        print(f"Error: {e}") 