import time
from RealtimeSTT import AudioToTextRecorder

print("Testing RealtimeSTT installation...")

try:
    # Create a simple recorder object
    recorder = AudioToTextRecorder(
        use_microphone=False,
        spinner=False,
        model="tiny.en",
        no_log_file=True
    )
    
    print("✅ RealtimeSTT was imported and initialized successfully!")
    
    # Clean up
    recorder.shutdown()
    
except Exception as e:
    print(f"❌ Error initializing RealtimeSTT: {e}")
    
print("Test completed.") 