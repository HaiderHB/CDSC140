# transcription_mac.spec
# For macOS build

block_cipher = None

a = Analysis(
    ['transcription.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('venv/lib/python3.12/site-packages/pvporcupine/resources/keyword_files/mac', 'pvporcupine/resources/keyword_files/mac'),
        ('venv/lib/python3.12/site-packages/RealtimeSTT/warmup_audio.wav', 'RealtimeSTT'),
        ('venv/lib/python3.12/site-packages/faster_whisper/assets/silero_encoder_v5.onnx', 'faster_whisper/assets'),
        ('venv/lib/python3.12/site-packages/faster_whisper/assets/silero_decoder_v5.onnx', 'faster_whisper/assets')
    ],
    hiddenimports=['pkg_resources.py2_warn'],
    hookspath=['./hooks'],
    hooksconfig={},
    runtime_hooks=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='transcription',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
)
