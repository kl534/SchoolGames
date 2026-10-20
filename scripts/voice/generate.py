# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["kokoro>=0.9", "soundfile", "numpy", "lameenc", "torch", "pip"]
#
# [tool.uv.sources]
# torch = { index = "pytorch-cpu" }
#
# [[tool.uv.index]]
# name = "pytorch-cpu"
# url = "https://download.pytorch.org/whl/cpu"
# explicit = true
# ///
"""Records every line in src/shared/voice-lines.json to public/voice/<key>.mp3 with Kokoro.

Run through `npm run voice` (which refreshes the line list first) or `uv run scripts/voice/generate.py`.
Only missing clips are generated. Everything is regenerated when the settings below change
(compared with scripts/voice/settings.json) or with --force; if only `countSpeed` differs (or
the saved settings lack it), just the count lines are regenerated. Model weights go to the normal
Hugging Face cache, never into the repo.
"""

import json
import re
import sys
import time
from pathlib import Path

import lameenc
import numpy as np
from kokoro import KPipeline

VOICE = "af_heart"
LANG = "a"  # American English
SPEED = 0.9  # matches the browser fallback voice's rate
COUNT_SPEED = 1.45  # count lines ("21."), about 1.6x the normal pace
COUNT_LINE = re.compile(r"^\d+\.$")
SAMPLE_RATE = 24000
LEAD_MS = 40  # silence kept before the first sound
TAIL_MS = 80  # silence kept after the last sound, so timers that start on `end` aren't delayed
SILENCE_RATIO = 0.02  # samples below this share of the peak count as silence
PEAK_DBFS = -1.0
BITRATE_KBPS = 48

ROOT = Path(__file__).resolve().parents[2]
LINES = ROOT / "src/shared/voice-lines.json"
OUT = ROOT / "public/voice"
SETTINGS_FILE = ROOT / "scripts/voice/settings.json"
SETTINGS = {
    "voice": VOICE,
    "lang": LANG,
    "speed": SPEED,
    "countSpeed": COUNT_SPEED,
    "sampleRate": SAMPLE_RATE,
    "leadMs": LEAD_MS,
    "tailMs": TAIL_MS,
    "silenceRatio": SILENCE_RATIO,
    "peakDbfs": PEAK_DBFS,
    "bitrateKbps": BITRATE_KBPS,
}


def trim_and_normalize(audio: np.ndarray) -> np.ndarray:
    """Cuts leading and trailing silence (keeping a short margin) and normalizes the peak."""
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak == 0.0:
        return audio
    loud = np.nonzero(np.abs(audio) > peak * SILENCE_RATIO)[0]
    start = max(0, int(loud[0]) - SAMPLE_RATE * LEAD_MS // 1000)
    end = min(len(audio), int(loud[-1]) + 1 + SAMPLE_RATE * TAIL_MS // 1000)
    audio = audio[start:end]
    return audio * (10 ** (PEAK_DBFS / 20) / peak)


def encode_mp3(audio: np.ndarray) -> bytes:
    pcm = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(BITRATE_KBPS)
    encoder.set_in_sample_rate(SAMPLE_RATE)
    encoder.set_channels(1)
    encoder.set_quality(2)
    return bytes(encoder.encode(pcm.tobytes())) + bytes(encoder.flush())


def main() -> None:
    force = "--force" in sys.argv[1:]
    lines: dict[str, str] = json.loads(LINES.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)

    previous = json.loads(SETTINGS_FILE.read_text()) if SETTINGS_FILE.exists() else None
    counts_only = False
    if previous != SETTINGS:
        rest = lambda settings: {k: v for k, v in settings.items() if k != "countSpeed"}
        if previous is not None and rest(previous) == rest(SETTINGS):
            counts_only = True  # only the count speed changed
        else:
            force = True

    existing = {p.stem: p for p in OUT.glob("*.mp3")}
    deleted = [key for key in existing if key not in lines]
    for key in deleted:
        existing[key].unlink()
    todo = [
        key
        for key in sorted(lines)
        if force
        or key not in existing
        or (counts_only and COUNT_LINE.match(lines[key]))
    ]
    kept = len(lines) - len(todo)

    if todo:
        pipeline = KPipeline(lang_code=LANG, repo_id="hexgrad/Kokoro-82M")
        started = time.time()
        for i, key in enumerate(todo, 1):
            text = lines[key]
            chunks = [
                np.asarray(chunk, dtype=np.float32)
                for _, _, chunk in pipeline(
                    text, voice=VOICE, speed=COUNT_SPEED if COUNT_LINE.match(text) else SPEED
                )
            ]
            if not chunks:
                raise RuntimeError(f"No audio for {key}: {text!r}")
            audio = trim_and_normalize(np.concatenate(chunks))
            (OUT / f"{key}.mp3").write_bytes(encode_mp3(audio))
            if i % 25 == 0 or i == len(todo):
                print(f"  {i}/{len(todo)} ({time.time() - started:.0f}s) {text}", flush=True)

    SETTINGS_FILE.write_text(json.dumps(SETTINGS, indent=2) + "\n")
    size = sum(p.stat().st_size for p in OUT.glob("*.mp3"))
    print(
        f"generated {len(todo)}, kept {kept}, deleted {len(deleted)}; "
        f"{len(lines)} clips, {size / 1024:.0f} KiB total"
    )


if __name__ == "__main__":
    main()
