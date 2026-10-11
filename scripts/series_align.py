"""Series (owner-permitted recitation, e.g. دعاء الصباح): time every word of the KNOWN text in the recording.

Forced alignment (ctc-forced-aligner, MMS-300m, Arabic romanized): the model is told the exact text and finds where each
word is said, so it works on a melodic recitation where speech-to-text would mishear. Output: per word and per phrase
start/end (seconds) and a confidence score, used to cut the series into Reels and to time the on-screen lines.
Numbers only: nothing is rendered, uploaded or published.

Usage: python scripts/series_align.py <audio.wav> <phrases.json> <out.json>
"""
import json
import sys

import torch
from ctc_forced_aligner import (
    generate_emissions,
    get_alignments,
    get_spans,
    load_alignment_model,
    load_audio,
    postprocess_results,
    preprocess_text,
)

audio_path, phrases_path, out_path = sys.argv[1:4]
data = json.load(open(phrases_path, encoding="utf-8"))
words, owner = [], []
for p in data["phrases"]:
    for w in p["text"].split():
        words.append(w)
        owner.append(p["i"])

model, tokenizer = load_alignment_model("cpu", dtype=torch.float32)
wave = load_audio(audio_path, model.dtype, model.device)
emissions, stride = generate_emissions(model, wave, batch_size=4)
tokens_starred, text_starred = preprocess_text(" ".join(words), romanize=True, language="ara")
segments, scores, blank = get_alignments(emissions, tokens_starred, tokenizer)
spans = get_spans(tokens_starred, segments, blank)
timed = postprocess_results(text_starred, spans, stride, scores)
if len(timed) != len(words):
    raise SystemExit(f"aligner returned {len(timed)} words for {len(words)} in the text")

out_words = [{"w": words[k], "phrase": owner[k], "start": round(t["start"], 3), "end": round(t["end"], 3), "score": round(float(t.get("score", 0)), 4)} for k, t in enumerate(timed)]
out_phrases = []
for p in data["phrases"]:
    ws = [w for w in out_words if w["phrase"] == p["i"]]
    out_phrases.append({**p, "start": ws[0]["start"], "end": ws[-1]["end"], "score": round(sum(w["score"] for w in ws) / len(ws), 4)})
json.dump({"audioSec": round(wave.shape[-1] / 16000, 3), "phrases": out_phrases, "words": out_words}, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
low = sorted(out_phrases, key=lambda p: p["score"])[:8]
print(f"{len(out_words)} words, {len(out_phrases)} phrases; recording {wave.shape[-1] / 16000:.1f} s; text spans {out_phrases[0]['start']:.1f}-{out_phrases[-1]['end']:.1f} s")
print("lowest-confidence phrases:", " | ".join(f"#{p['i']} {p['score']}" for p in low))
