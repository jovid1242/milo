import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

export async function run(cmd, args, { encoding = 'utf8', allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding, maxBuffer: 1 << 30 }, (error, stdout, stderr) => {
      if (error && !allowFailure) {
        const detail = (Buffer.isBuffer(stderr) ? stderr.toString() : stderr || '').trim();
        reject(new Error(`${cmd} ${args.join(' ')}\n${detail || error.message}`));
        return;
      }
      resolve({
        stdout,
        stderr: Buffer.isBuffer(stderr) ? stderr.toString() : stderr,
        code: error?.code ?? 0,
      });
    });
  });
}

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Relative POSIX paths of all regular files, skipping dotfiles (.DS_Store etc.).
export async function walkFiles(root, rel = '') {
  const out = [];
  const entries = await readdir(join(root, rel), { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await walkFiles(root, childRel)));
    else if (entry.isFile()) out.push(childRel);
  }
  return out;
}

export const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function toKebabCase(name) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*\(\d+\)\s*$/, '') // "name (1)"
    .replace(/[\s._-]+copy(?:[\s._-]*\d+)?$/i, '') // "name copy", "name-copy-2"
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2') // camelCase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Names that are valid kebab-case but still look accidental.
export function suspiciousNameReason(id) {
  if (/(^|-)final-final($|-)/.test(id)) return 'contains "final-final"';
  if (/(^|-)(untitled|copy|new-file)($|-)/.test(id)) return 'looks like an editor default name';
  if (/^(img|image|dall-e|dalle|chatgpt|gemini|midjourney|screenshot)(-|$)/.test(id))
    return 'looks like a generated file name';
  if (/[0-9a-f]{12,}/.test(id)) return 'contains a random hash';
  return null;
}

export function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const reductionPercent = (before, after) =>
  before > 0 ? Math.round((1 - after / before) * 1000) / 10 : 0;

export const round = (value, digits = 2) => {
  if (value == null || !Number.isFinite(value)) return value ?? null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// Minimal promise-based worker_threads pool.
export class WorkerPool {
  constructor(url, size) {
    this.idle = [];
    this.queue = [];
    this.pending = new Map();
    this.nextId = 0;
    this.workers = Array.from({ length: size }, () => {
      const worker = new Worker(url);
      worker.on('message', ({ id, ok, result, error }) => {
        const job = this.pending.get(id);
        this.pending.delete(id);
        this.idle.push(worker);
        this.#drain();
        if (ok) job.resolve(result);
        else job.reject(new Error(error));
      });
      worker.on('error', (err) => {
        for (const job of this.pending.values()) job.reject(err);
        this.pending.clear();
      });
      this.idle.push(worker);
      return worker;
    });
  }

  run(type, payload) {
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, type, payload, resolve, reject });
      this.#drain();
    });
  }

  #drain() {
    while (this.idle.length && this.queue.length) {
      const worker = this.idle.pop();
      const job = this.queue.shift();
      this.pending.set(job.id, job);
      worker.postMessage({ id: job.id, type: job.type, payload: job.payload });
    }
  }

  async close() {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}
