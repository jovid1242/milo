// Audio analysis and conservative MP3 optimisation via ffmpeg/ffprobe.

import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { round, run, sha256 } from './util.mjs';

const toDb = (x) => (x > 0 ? round(20 * Math.log10(x), 2) : null);

export async function probeAudio(file) {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    file,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams.find((s) => s.codec_type === 'audio');
  if (!stream) throw new Error(`${file}: no audio stream`);
  return {
    codec: stream.codec_name,
    sampleRate: Number(stream.sample_rate),
    channels: stream.channels,
    bitrateKbps: round(Number(stream.bit_rate || data.format.bit_rate) / 1000, 1),
    durationMs: round(Number(stream.duration || data.format.duration) * 1000, 1),
    tags: Object.keys(data.format.tags || {}),
    attachedPicture: data.streams.some((s) => s.disposition?.attached_pic === 1),
  };
}

export async function decodePcm(file, filters = []) {
  const args = ['-v', 'error', '-i', file, '-map', '0:a:0'];
  if (filters.length) args.push('-af', filters.join(','));
  args.push('-f', 'f32le', '-acodec', 'pcm_f32le', '-');
  const { stdout } = await run('ffmpeg', args, { encoding: 'buffer' });
  const aligned = new Uint8Array(stdout.byteLength);
  aligned.set(stdout);
  return new Float32Array(aligned.buffer, 0, Math.floor(aligned.byteLength / 4));
}

export function analyzePcm(samples, channels, sampleRate, silenceThresholdDb) {
  const frames = Math.floor(samples.length / channels);
  const threshold = 10 ** (silenceThresholdDb / 20);
  const nearFullScale = 10 ** (-0.1 / 20);
  let peak = 0;
  let overs = 0;
  let runLength = 0;
  let maxRun = 0;
  let sumSq = 0;
  let first = -1;
  let last = -1;
  let ll = 0;
  let rr = 0;
  let lr = 0;
  let side = 0;
  let mid = 0;
  for (let i = 0; i < frames; i++) {
    let frameMax = 0;
    for (let c = 0; c < channels; c++) {
      const v = samples[i * channels + c];
      const a = Math.abs(v);
      if (a > frameMax) frameMax = a;
      if (a >= 1) overs++;
      sumSq += v * v;
    }
    if (frameMax > peak) peak = frameMax;
    if (frameMax >= nearFullScale) maxRun = Math.max(maxRun, ++runLength);
    else runLength = 0;
    if (frameMax > threshold) {
      if (first < 0) first = i;
      last = i;
    }
    if (channels === 2) {
      const l = samples[i * 2];
      const r = samples[i * 2 + 1];
      ll += l * l;
      rr += r * r;
      lr += l * r;
      side += ((l - r) / 2) ** 2;
      mid += ((l + r) / 2) ** 2;
    }
  }
  const window = Math.max(1, Math.round(sampleRate * 0.01));
  const rmsOf = (start, end) => {
    let acc = 0;
    let count = 0;
    for (let i = start; i < end; i++) {
      for (let c = 0; c < channels; c++) {
        acc += samples[i * channels + c] ** 2;
        count++;
      }
    }
    return count ? Math.sqrt(acc / count) : 0;
  };
  const ms = (count) => round((count / sampleRate) * 1000, 1);
  return {
    frames,
    durationMs: ms(frames),
    peakDb: toDb(peak),
    overs,
    maxRunNearFullScale: maxRun,
    rmsDb: toDb(Math.sqrt(sumSq / Math.max(1, frames * channels))),
    silent: first < 0,
    firstAudible: first,
    lastAudible: last,
    leadingSilenceMs: first < 0 ? ms(frames) : ms(first),
    trailingSilenceMs: last < 0 ? ms(frames) : ms(frames - 1 - last),
    startRmsDb: toDb(rmsOf(0, Math.min(frames, window))),
    endRmsDb: toDb(rmsOf(Math.max(0, frames - window), frames)),
    stereo:
      channels === 2
        ? {
            correlation: round(lr / (Math.sqrt(ll * rr) || 1), 5),
            sideToMidDb:
              side > 0 && mid > 0 ? round(Math.max(-120, 10 * Math.log10(side / mid)), 1) : -120,
          }
        : null,
  };
}

export async function measureLoudness(file) {
  const { stderr } = await run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    file,
    '-map',
    '0:a:0',
    '-filter:a',
    'ebur128=peak=true',
    '-f',
    'null',
    '-',
  ]);
  const summary = stderr.slice(stderr.lastIndexOf('Integrated loudness:'));
  const pick = (re) => {
    const m = summary.match(re);
    return m ? Number(m[1]) : null;
  };
  const lufs = pick(/I:\s+(-?[\d.]+)\s+LUFS/);
  return {
    integratedLufs: lufs != null && lufs > -70 ? lufs : null, // -70 = below the absolute gate
    truePeakDb: pick(/Peak:\s+(-?[\d.]+)\s+dBFS/),
  };
}

export async function analyzeAudio(sourcePath, cfg) {
  const probe = await probeAudio(sourcePath);
  const samples = await decodePcm(sourcePath);
  const pcm = analyzePcm(samples, probe.channels, probe.sampleRate, cfg.silenceThresholdDb);
  const loudness = await measureLoudness(sourcePath);
  const pcmHash = sha256(new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
  return { probe, pcm, loudness, pcmHash, clipped: pcm.overs > 0 || pcm.maxRunNearFullScale >= 3 };
}

function signalToNoiseDb(reference, decoded) {
  const n = Math.min(reference.length, decoded.length);
  let signal = 0;
  let noise = 0;
  for (let i = 0; i < n; i++) {
    signal += reference[i] ** 2;
    noise += (reference[i] - decoded[i]) ** 2;
  }
  return noise > 0 ? round(10 * Math.log10(signal / noise), 1) : 99;
}

export async function buildAudio({
  sourcePath,
  sourceBytes,
  sourceExt,
  analysis,
  outputPathNoExt,
  cfg,
  override,
}) {
  const { probe, pcm } = analysis;
  const sr = probe.sampleRate;
  const channels = probe.channels;

  const copyOriginal = async (reason) => {
    const outputPath = `${outputPathNoExt}.${sourceExt}`;
    await copyFile(sourcePath, outputPath);
    const buf = await readFile(outputPath);
    return {
      action: 'copied',
      reason,
      ext: sourceExt,
      format: sourceExt,
      bytes: buf.length,
      sha256: sha256(buf),
      codec: probe.codec,
      sampleRate: sr,
      channels,
      durationMs: probe.durationMs,
      bitrateKbps: probe.bitrateKbps,
      encoding: null,
      checks: null,
      output: {
        peakDb: pcm.peakDb,
        rmsDb: pcm.rmsDb,
        overs: pcm.overs,
        leadingSilenceMs: pcm.leadingSilenceMs,
        trailingSilenceMs: pcm.trailingSilenceMs,
      },
    };
  };

  const mode = override?.mode ?? (analysis.clipped || pcm.silent ? 'copy' : 'reencode');
  if (mode === 'copy') {
    const reason = override?.mode
      ? 'mode "copy" set in config'
      : analysis.clipped
        ? 'source is clipped: kept byte-identical instead of transcoding damaged audio'
        : 'source is silent';
    return copyOriginal(reason);
  }

  // Plan: trim obvious silence, drop an inaudible stereo image.
  const t = cfg.trim;
  const samplesFor = (ms) => Math.round((sr * ms) / 1000);
  let start = 0;
  let end = pcm.frames;
  if (pcm.leadingSilenceMs >= t.leadingMinMs)
    start = Math.max(0, pcm.firstAudible - samplesFor(t.leadingPadMs));
  if (pcm.trailingSilenceMs >= t.trailingMinMs)
    end = Math.min(pcm.frames, pcm.lastAudible + 1 + samplesFor(t.trailingPadMs));
  const mono =
    channels === 2 &&
    pcm.stereo.correlation >= cfg.mono.minCorrelation &&
    pcm.stereo.sideToMidDb <= cfg.mono.maxSideToMidDb;

  const filters = [];
  if (start > 0 || end < pcm.frames)
    filters.push(`atrim=start_sample=${start}:end_sample=${end}`, 'asetpts=PTS-STARTPTS');
  // Fades cover only the retained padding, which is below the silence threshold.
  if (start > 0) filters.push(`afade=t=in:st=0:d=${t.fadeInMs / 1000}`);
  if (end < pcm.frames) {
    const seconds = (end - start) / sr;
    filters.push(
      `afade=t=out:st=${(seconds - t.fadeOutMs / 1000).toFixed(6)}:d=${t.fadeOutMs / 1000}`,
    );
  }
  if (mono) filters.push('pan=mono|c0=0.5*c0+0.5*c1');

  const tmp = await mkdtemp(join(tmpdir(), 'milo-audio-'));
  try {
    const encodedPath = join(tmp, 'encoded.mp3');
    const args = ['-v', 'error', '-y', '-i', sourcePath, '-map', '0:a:0'];
    if (filters.length) args.push('-af', filters.join(','));
    args.push(
      '-c:a',
      'libmp3lame',
      '-q:a',
      String(cfg.mp3.vbrQuality),
      '-ar',
      String(sr),
      '-map_metadata',
      '-1',
      '-id3v2_version',
      '0',
      '-write_xing',
      '1',
      '-fflags',
      '+bitexact',
      '-flags:a',
      '+bitexact',
      encodedPath,
    );
    await run('ffmpeg', args);

    // Verify: decoded output vs. exactly what the encoder was fed.
    const outChannels = mono ? 1 : channels;
    const reference = await decodePcm(sourcePath, filters);
    const decoded = await decodePcm(encodedPath);
    const refStats = analyzePcm(reference, outChannels, sr, cfg.silenceThresholdDb);
    const outStats = analyzePcm(decoded, outChannels, sr, cfg.silenceThresholdDb);
    const tol = cfg.tolerance;
    const checks = {
      duration: Math.abs(outStats.durationMs - refStats.durationMs) <= tol.durationMs,
      rms: Math.abs(outStats.rmsDb - refStats.rmsDb) <= tol.rmsDb,
      peak: Math.abs(outStats.peakDb - refStats.peakDb) <= tol.peakDb,
      noNewClipping: outStats.overs === 0 || refStats.overs > 0,
    };
    const encoded = await readFile(encodedPath);
    const savings = 1 - encoded.length / sourceBytes;
    const failed = Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([name]) => name);
    if (failed.length)
      return copyOriginal(`transcode rejected (failed checks: ${failed.join(', ')})`);
    if (savings < cfg.minRelativeSavings) {
      return copyOriginal(
        `transcode saves only ${Math.round(savings * 100)}% (< ${cfg.minRelativeSavings * 100}%)`,
      );
    }

    const outputPath = `${outputPathNoExt}.mp3`;
    await writeFile(outputPath, encoded);
    const outProbe = await probeAudio(outputPath);
    return {
      action: 'reencoded',
      reason: `MP3 VBR V${cfg.mp3.vbrQuality}${mono ? ', mono' : ''}${start > 0 ? ', leading silence trimmed' : ''}${end < pcm.frames ? ', trailing silence trimmed' : ''}`,
      ext: 'mp3',
      format: 'mp3',
      bytes: encoded.length,
      sha256: sha256(encoded),
      codec: outProbe.codec,
      sampleRate: outProbe.sampleRate,
      channels: outProbe.channels,
      durationMs: outProbe.durationMs,
      bitrateKbps: round((encoded.length * 8) / (outStats.frames / sr) / 1000, 1),
      encoding: {
        encoder: 'libmp3lame',
        vbr: `V${cfg.mp3.vbrQuality}`,
        mono,
        trimmedLeadingMs: round((start / sr) * 1000, 1),
        trimmedTrailingMs: round(((pcm.frames - end) / sr) * 1000, 1),
        filters,
      },
      checks: { ...checks, snrDb: signalToNoiseDb(reference, decoded) },
      output: {
        peakDb: outStats.peakDb,
        rmsDb: outStats.rmsDb,
        overs: outStats.overs,
        leadingSilenceMs: outStats.leadingSilenceMs,
        trailingSilenceMs: outStats.trailingSilenceMs,
      },
    };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
