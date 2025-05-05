# transcription_win.spec
# For Windows build

block_cipher = None

a = Analysis(
    ['transcription.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('venv/Lib/site-packages/pvporcupine/resources/keyword_files/windows', 'pvporcupine/resources/keyword_files/windows'),
        ('venv/Lib/site-packages/RealtimeSTT/warmup_audio.wav', 'RealtimeSTT'),
        ('venv/Lib/site-packages/faster_whisper/assets/silero_encoder_v5.onnx', 'faster_whisper/assets'),
        ('venv/Lib/site-packages/faster_whisper/assets/silero_decoder_v5.onnx', 'faster_whisper/assets')
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
