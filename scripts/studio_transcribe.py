"""Studio: transcribe a permitted clip's voice (Arabic) with word times.

faster-whisper, word_timestamps, VAD filter. Output: segments and words with start/end (seconds) and probability.
The words are a DRAFT for the owner to check in the preview; any Quran quoted in a clip is shown from the API, never
from this transcript.

Usage: python scripts/studio_transcribe.py <voice.wav> <model> <out.json>
"""
import json
import sys

from faster_whisper import WhisperModel

audio_path, model_name, out_path = sys.argv[1:4]
model = WhisperModel(model_name, device="cpu", compute_type="int8")
segs, info = model.transcribe(audio_path, language="ar", word_timestamps=True, vad_filter=True, beam_size=5)
out = {"duration": round(info.duration, 3), "segments": [], "words": []}
for s in segs:
    out["segments"].append({"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip()})
    for w in s.words or []:
        out["words"].append({"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "p": round(w.probability, 3)})
json.dump(out, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for s in out["segments"]:
    print(f"{s['start']:6.2f}-{s['end']:6.2f}  {s['text']}")
print(f"{len(out['words'])} words")
