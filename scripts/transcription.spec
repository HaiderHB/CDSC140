# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['transcription.py'],
    pathex=[],
    binaries=[],
    datas=[('venve/Lib/site-packages/pvporcupine/resources/keyword_files/windows', 'pvporcupine/resources/keyword_files/windows'), ('venve/Lib/site-packages/RealtimeSTT/warmup_audio.wav', 'RealtimeSTT'), ('venve/Lib/site-packages/faster_whisper/assets/silero_encoder_v5.onnx', 'faster_whisper/assets'), ('venve/Lib/site-packages/faster_whisper/assets/silero_decoder_v5.onnx', 'faster_whisper/assets')],
    hiddenimports=['pkg_resources.py2_warn'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['webrtcvad'],
    noarchive=False,
    optimize=0,
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
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
