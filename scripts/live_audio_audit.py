#!/usr/bin/env python3
"""Basaer Live audio audit (read-only analysis; writes TSV reports).

Mode "full": the quranicaudio.com Minshawi Mujawwad full-surah MP3s (the source used in the transport test).
Mode "ayah": the Quran.com per-ayah files of recitation 8 (verses.quran.com), joined per surah as yt_surah.js does,
             plus per-ayah edge silence (what a viewer hears at every ayah join).
Measures: codec / sample rate / channels / bitrate, duration, EBU R128 integrated loudness + LRA + true peak,
per-channel RMS (balance), peak count (clipping hint), leading / trailing silence, silences longer than 4 s inside.
Usage: live_audio_audit.py full 1-114 out.tsv  |  live_audio_audit.py ayah 1,67,112-114 out.tsv
"""
import json, os, re, subprocess, sys, tempfile, urllib.request


def rng(spec):
    out = []
    for part in spec.split(','):
        a, _, b = part.partition('-')
        out += list(range(int(a), int(b or a) + 1))
    return out


def get(url, path=None, tries=4):
    err = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'basaer-audio-audit'})
            data = urllib.request.urlopen(req, timeout=180).read()
            if path:
                with open(path, 'wb') as fh:
                    fh.write(data)
                return path
            return data
        except Exception as e:  # retry network errors
            err = e
    raise RuntimeError(f'{url}: {err}')


def probe(f):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', f],
                                  capture_output=True, text=True).stdout)
    s = j['streams'][0]
    return dict(codec=s['codec_name'], sr=int(s['sample_rate']), ch=int(s['channels']),
                kbps=round(int(j['format'].get('bit_rate', 0)) / 1000), dur=float(j['format']['duration']))


def num(x):
    try:
        return float(x)
    except ValueError:
        return None


def analyse(f):
    af = ('ebur128=peak=true:framelog=quiet,'
          'astats=measure_perchannel=RMS_level+Peak_level+Peak_count:measure_overall=none,'
          'silencedetect=n=-50dB:d=1')
    err = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-nostats', '-i', f, '-af', af, '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', err)
    LRA = re.findall(r'LRA:\s+([\d.]+) LU', err)
    TP = re.findall(r'Peak:\s+(-?[\d.]+|-inf) dBFS', err)
    rms = [v for v in (num(x) for x in re.findall(r'RMS level dB: (\S+)', err)) if v is not None]
    peaks = [v for v in (num(x) for x in re.findall(r'Peak level dB: (\S+)', err)) if v is not None]
    pcount = [int(float(x)) for x in re.findall(r'Peak count: ([\d.]+)', err)]
    starts = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', err)]
    ends = [(float(a), float(b)) for a, b in re.findall(r'silence_end: ([\d.]+) \| silence_duration: ([\d.]+)', err)]
    return dict(I=num(I[-1]) if I else None, LRA=num(LRA[-1]) if LRA else None, TP=num(TP[-1]) if TP else None,
                rmsL=rms[0] if rms else None, rmsR=rms[1] if len(rms) > 1 else None,
                peak=max(peaks) if peaks else None, pcount=max(pcount) if pcount else 0, starts=starts, ends=ends)


def silences(a, dur):
    lead = next((d for e, d in a['ends'] if e - d < 0.05), 0.0)
    trail = 0.0
    if a['starts'] and len(a['starts']) > len(a['ends']):
        trail = dur - a['starts'][-1]
    elif a['ends'] and abs(a['ends'][-1][0] - dur) < 0.2:
        trail = a['ends'][-1][1]
    inner = [d for e, d in a['ends'] if e - d > 0.05 and abs(e - dur) > 0.2 and d > 4]
    return lead, trail, inner


def r2(x):
    return round(x, 2) if isinstance(x, float) else x


def main():
    mode, spec, out = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    tmp = tempfile.mkdtemp()
    rows = []
    for s in rng(spec):
        sid = f'{s:03d}'
        if mode == 'full':
            f = get(f'https://download.quranicaudio.com/quran/minshawi_mujawwad/{sid}.mp3', os.path.join(tmp, sid + '.mp3'))
            p = probe(f)
            a = analyse(f)
            lead, trail, inner = silences(a, p['dur'])
            rows.append([sid, p['codec'], p['sr'], p['ch'], p['kbps'], round(p['dur'], 1), a['I'], a['LRA'], a['TP'],
                         r2(a['rmsL']), r2(a['rmsR']), r2((a['rmsL'] or 0) - (a['rmsR'] or 0)), a['peak'], a['pcount'],
                         round(lead, 2), round(trail, 2), len(inner), round(max(inner), 1) if inner else 0])
            os.remove(f)
        else:
            verses, page = [], 1
            while True:
                r = json.loads(get(f'https://api.quran.com/api/v4/verses/by_chapter/{s}?audio=8&per_page=50&page={page}'))
                if not r['verses']:
                    break
                verses += r['verses']
                page += 1
            files, edges, missing, noseg = [], [], 0, 0
            for v in verses:
                au = v.get('audio') or {}
                if not au.get('url'):
                    missing += 1
                    continue
                if not au.get('segments'):
                    noseg += 1
                f = get('https://verses.quran.com/' + au['url'], os.path.join(tmp, v['verse_key'].replace(':', '_') + '.mp3'))
                p = probe(f)
                a = analyse(f)
                lead, trail, _ = silences(a, p['dur'])
                edges.append((v['verse_key'], p['sr'], p['ch'], p['kbps'], round(p['dur'], 2), a['I'], a['TP'], round(lead, 2), round(trail, 2)))
                files.append(f)
            lst = os.path.join(tmp, 'l.txt')
            with open(lst, 'w') as fh:
                fh.write(''.join(f"file '{f}'\n" for f in files))
            j = os.path.join(tmp, sid + '.wav')
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst,
                            '-ar', '48000', '-ac', '2', j], check=True)
            p = probe(j)
            a = analyse(j)
            lead, trail, inner = silences(a, p['dur'])
            srs = '/'.join(map(str, sorted({e[1] for e in edges})))
            chs = '/'.join(map(str, sorted({e[2] for e in edges})))
            loud = [e[5] for e in edges if e[5] is not None and e[5] > -70]
            gaps = [round(edges[k][8] + edges[k + 1][7], 2) for k in range(len(edges) - 1)]
            rows.append([sid, 'ayah-join', srs, chs, len(verses), round(p['dur'], 1), a['I'], a['LRA'], a['TP'],
                         r2(a['rmsL']), r2(a['rmsR']), r2((a['rmsL'] or 0) - (a['rmsR'] or 0)), a['peak'], a['pcount'],
                         round(lead, 2), round(trail, 2), len(inner), round(max(inner), 1) if inner else 0, missing, noseg,
                         round(min(loud), 1) if loud else '', round(max(loud), 1) if loud else '',
                         max(gaps) if gaps else 0, round(sum(gaps) / len(gaps), 2) if gaps else 0])
            with open(out.replace('.tsv', f'-{sid}-ayahs.tsv'), 'w') as fh:
                fh.write('key\tsr\tch\tkbps\tdur\tI\tTP\tlead_sil\ttrail_sil\n')
                fh.writelines('\t'.join(map(str, e)) + '\n' for e in edges)
            for f in files:
                os.remove(f)
            os.remove(j)
        print('\t'.join(map(str, rows[-1])), flush=True)
    head = ['surah', 'codec', 'sr', 'ch', 'kbps_or_ayahs', 'dur_s', 'I_LUFS', 'LRA', 'TP_dBFS', 'rmsL', 'rmsR', 'L_minus_R',
            'peak_dB', 'peak_count', 'lead_sil', 'trail_sil', 'inner_sil_gt4s', 'max_inner_sil']
    if mode == 'ayah':
        head += ['missing_audio', 'no_segments', 'ayah_I_min', 'ayah_I_max', 'max_join_sil', 'mean_join_sil']
    with open(out, 'w') as fh:
        fh.write('\t'.join(head) + '\n')
        fh.writelines('\t'.join(map(str, r)) + '\n' for r in rows)


if __name__ == '__main__':
    main()
