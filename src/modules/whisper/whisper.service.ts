import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

@Injectable()
export class WhisperService {
    private readonly logger = new Logger(WhisperService.name);
    private readonly baseDir = path.join(process.cwd(), 'uploads', 'whisper');
    // Simple in-memory session store for assembling chunked transcriptions
    // sessionId -> { chunks: Map<chunkIndex, { text, startTime?, endTime?, model?, quick? }>, finalized?: boolean, lastUpdated: number }
    private sessions: Map<
        string,
        {
            chunks: Map<number, { text: string; startTime?: number; endTime?: number; model?: string; quick?: boolean }>;
            finalized?: boolean;
            lastUpdated: number;
        }
    > = new Map();

    constructor() {
        this.ensureBaseDir();
        // Fire-and-forget check for local dependencies (python whisper, ffmpeg)
        this.checkLocalDependencies().catch((e) => this.logger.warn(`Local whisper check failed: ${e?.message || e}`));
    }

    private ensureBaseDir() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }


    private async checkLocalDependencies(): Promise<void> {
        // Try several python commands (allow override via WHISPER_PYTHON_CMD)
        const pythonCandidates = process.env.WHISPER_PYTHON_CMD
            ? [process.env.WHISPER_PYTHON_CMD]
            : process.platform === 'win32'
            ? ['python', 'py']
            : ['python3', 'python'];

        const tryPython = (cmd: string) =>
            new Promise<void>((resolve, reject) => {
                try {
                    const env = { ...(process.env || {}) } as NodeJS.ProcessEnv;
                    // add common Homebrew path on macOS to improve discovery for devs using Homebrew
                    if (process.platform === 'darwin') {
                        env.PATH = `${env.PATH || ''}:/opt/homebrew/bin`;
                    }
                    const proc = spawn(cmd, ['-m', 'whisper', '--help'], { env });
                    proc.on('error', (err) => reject(err));
                    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error('not available'))));
                } catch (err) {
                    reject(err);
                }
            });

        let pythonOk = false;
        for (const c of pythonCandidates) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await tryPython(c);
                pythonOk = true;
                break;
            } catch (e) {
                // try next candidate
            }
        }
        if (!pythonOk) {
            throw new Error('python -m whisper not available; set WHISPER_PYTHON_CMD to your python executable');
        }

        // Check ffmpeg presence. Prefer explicit FFMPEG_BINARY, else rely on PATH using platform-appropriate helper.
        const ffEnv = process.env.FFMPEG_BINARY;
        if (ffEnv && fs.existsSync(ffEnv)) {
            return;
        }

        const whichCmd = process.platform === 'win32' ? 'where' : 'which';
        await new Promise<void>((resolve, reject) => {
            try {
                const proc = spawn(whichCmd, ['ffmpeg']);
                let out = '';
                proc.stdout.on('data', (d) => (out += d.toString()));
                proc.on('error', (e) => reject(e));
                proc.on('close', (code) => {
                    if (code === 0 && out.trim()) resolve();
                    else reject(new Error('ffmpeg not found'));
                });
            } catch (e) {
                reject(e);
            }
        }).catch(() => {
            throw new Error('ffmpeg not found in PATH or via FFMPEG_BINARY; please install ffmpeg and ensure it is on PATH');
        });
    }

    // No persistent saveChunk: audio is handled in-memory for immediate transcription only

    async transcribeBuffer(buffer: Buffer, mimeType?: string, language?: string, modelOverride?: string): Promise<string> {
        // Always use local transcription (python -m whisper + ffmpeg).
        try {
            return await this.transcribeBufferLocal(buffer, mimeType, language, modelOverride);
        } catch (err) {
            this.logger.error('local transcription failed', err as any);
            return `transcription error (local failed)`;
        }
    }

    // Local transcription helpers: write buffer to temp file and call python -m whisper
    private async transcribeBufferLocal(buffer: Buffer, mimeType?: string, language?: string, modelOverride?: string): Promise<string> {
        // Create a unique temporary directory in the OS temp folder for this transcription
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-'));
        const tmpName = `local-${Date.now()}-${Math.round(Math.random() * 1e6)}.webm`;
        const tmpPath = path.join(tmpDir, tmpName);
        fs.writeFileSync(tmpPath, buffer);
        try {
            const text = await this.transcribeLocalFile(tmpPath, language, modelOverride);
            return text;
        } finally {
            // Ensure we remove the temporary directory and all created files to avoid persisting chunks
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch (e) {
                this.logger.warn(`Failed to remove temp dir ${tmpDir}: ${e?.message || e}`);
            }
        }
    }

    private async transcribeLocalFile(filePath: string, language?: string, modelOverride?: string): Promise<string> {
        // Use python -m whisper <file> --model <model> --language <lang> --task transcribe --output_dir <dir>
    const model = modelOverride || process.env.WHISPER_MODEL || 'small';
    // If language is provided, pass it to whisper; otherwise omit the flag to let whisper auto-detect
    // If language === 'auto', treat as undefined to force Whisper auto-detection
    const lang = language === 'auto' ? undefined : (language || process.env.WHISPER_LANGUAGE);
        const outDir = path.dirname(filePath);
        const filename = path.parse(filePath).name;

        return new Promise<string>((resolve, reject) => {
            // Determine python command and ffmpeg path (allow env overrides)
            const pythonCmd = process.env.WHISPER_PYTHON_CMD || 'python';
            // Use FFMPEG_BINARY if set, otherwise rely on 'ffmpeg' being available in PATH
            const ffmpegPath = process.env.FFMPEG_BINARY || 'ffmpeg';
            const wavPath = path.join(outDir, `${filename}.wav`);

            const ffmpegArgs = ['-y', '-i', filePath, '-ar', '16000', '-ac', '1', wavPath];
            this.logger.debug(`Transcoding via ffmpeg: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);

            const spawnFfmpeg = (args: string[]) => {
                return new Promise<{ code: number | null; stderr: string }>((res, rej) => {
                    try {
                        // Build environment for ffmpeg spawn. Add common locations for macOS and Windows if missing.
                        const env = { ...(process.env || {}) } as NodeJS.ProcessEnv;
                        if (!env.PATH) env.PATH = '';
                        if (process.platform === 'darwin' && !env.PATH.includes('/opt/homebrew/bin')) {
                            env.PATH = `${env.PATH}:/opt/homebrew/bin`;
                        }
                        if (process.platform === 'win32') {
                            // common ffmpeg installation locations on Windows
                            const winCandidates = ['C:\\Program Files\\ffmpeg\\bin', 'C:\\ffmpeg\\bin'];
                            for (const p of winCandidates) {
                                if (!env.PATH.includes(p)) env.PATH = `${env.PATH};${p}`;
                            }
                        }
                        const ff = spawn(ffmpegPath, args, { env });
                        let ffErr = '';
                        ff.stderr.on('data', (d) => (ffErr += d.toString()));
                        ff.on('error', (e) => {
                            this.logger.error('ffmpeg spawn error', e as any);
                        });
                        ff.on('close', (code) => {
                            res({ code, stderr: ffErr });
                        });
                    } catch (err) {
                        rej(err);
                    }
                });
            };

            // spawnFfmpeg returns a promise; use then/catch to avoid top-level await inside this callback
            spawnFfmpeg(ffmpegArgs)
                .then((first) => {
                    if (first.code === 0) {
                        // success on first try
                        filePath = wavPath;
                        runWhisper();
                        return;
                    }

                    this.logger.error(`ffmpeg failed code=${first.code} stderr=${first.stderr}`);
                    const stderrLow = (first.stderr || '').toLowerCase();
                    if (stderrLow.includes('ebml header parsing failed') || stderrLow.includes('invalid data found when processing input')) {
                        this.logger.warn('ffmpeg initial transcode failed; retrying with tolerant flags (err_detect ignore_err, increased probesize)');
                        const tolerantArgs = ['-y', '-err_detect', 'ignore_err', '-analyzeduration', '2147483647', '-probesize', '2147483647', '-i', filePath, '-ar', '16000', '-ac', '1', wavPath];
                        return spawnFfmpeg(tolerantArgs).then((second) => {
                            if (second.code === 0) {
                                // success on second try
                                filePath = wavPath;
                                runWhisper();
                                return;
                            }

                            this.logger.error(`ffmpeg tolerant retry failed code=${second.code} stderr=${second.stderr}`);
                            // Try remuxing (copy streams) to recover a better container and retry
                            const remuxPath = path.join(outDir, `${filename}.remux.webm`);
                            const remuxArgs = ['-y', '-err_detect', 'ignore_err', '-i', filePath, '-c', 'copy', remuxPath];
                            this.logger.warn(`Attempting remux copy to recover container: ${ffmpegPath} ${remuxArgs.join(' ')}`);
                            return spawnFfmpeg(remuxArgs).then((remuxRes) => {
                                if (remuxRes.code !== 0) {
                                    this.logger.error(`ffmpeg remux failed code=${remuxRes.code} stderr=${remuxRes.stderr}`);
                                    const e: any = new Error('ffmpeg invalid input (possibly truncated webm)');
                                    e.name = 'UnreadableChunk';
                                    return reject(e);
                                }
                                // Remux succeeded — try transcoding from remuxPath
                                const transcodeFromRemux = ['-y', '-i', remuxPath, '-ar', '16000', '-ac', '1', wavPath];
                                this.logger.debug(`Transcoding remuxed file: ${ffmpegPath} ${transcodeFromRemux.join(' ')}`);
                                return spawnFfmpeg(transcodeFromRemux).then((tRes) => {
                                    if (tRes.code !== 0) {
                                        this.logger.error(`ffmpeg transcode from remux failed code=${tRes.code} stderr=${tRes.stderr}`);
                                        const e: any = new Error('ffmpeg invalid input after remux');
                                        e.name = 'UnreadableChunk';
                                        return reject(e);
                                    }
                                    // success after remux
                                    filePath = wavPath;
                                    // cleanup remux file
                                    try { if (fs.existsSync(remuxPath)) fs.unlinkSync(remuxPath); } catch (e) {}
                                    runWhisper();
                                    return;
                                });
                            });
                        });
                    }

                    return reject(new Error('ffmpeg failed to transcode input'));
                })
                .catch((err) => {
                    this.logger.error('ffmpeg failed to start or threw', err as any);
                    return reject(err);
                });
            // continue to spawn whisper below will be invoked by runWhisper() after transcode

            const runWhisper = () => {
                const argsBase = ['-m', 'whisper', filePath, '--model', model, '--task', 'transcribe', '--output_dir', outDir, '--output_format', 'txt'];
                const args = typeof lang === 'string' && lang.trim() ? [...argsBase.slice(0, 3), ...['--language', lang], ...argsBase.slice(3)] : argsBase;
                this.logger.log(`Running local whisper: ${pythonCmd} ${args.join(' ')}`);
                // Ensure ffmpeg from Homebrew is available to the spawned process by fixing PATH
                const env = { ...(process.env || {}) } as NodeJS.ProcessEnv;
                // Ensure ffmpeg is discoverable by whisper process. If an explicit binary path was provided, expose it; otherwise
                // rely on PATH. Add macOS Homebrew path or common Windows locations if missing.
                if (!env.PATH) env.PATH = '';
                if (process.platform === 'darwin' && !env.PATH.includes('/opt/homebrew/bin')) {
                    env.PATH = `${env.PATH}:/opt/homebrew/bin`;
                }
                if (process.platform === 'win32') {
                    const winCandidates = ['C:\\Program Files\\ffmpeg\\bin', 'C:\\ffmpeg\\bin'];
                    for (const p of winCandidates) {
                        if (!env.PATH.includes(p)) env.PATH = `${env.PATH};${p}`;
                    }
                }
                env.FFMPEG_BINARY = process.env.FFMPEG_BINARY || ffmpegPath;

                const proc = spawn(pythonCmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env });
                let stdout = '';
                let stderr = '';
                proc.stdout.on('data', (d) => (stdout += d.toString()));
                proc.stderr.on('data', (d) => (stderr += d.toString()));
                proc.on('error', (err) => {
                    this.logger.error('spawn error', err as any);
                    reject(err);
                });
                proc.on('close', (code) => {
                    this.logger.debug(`whisper process closed code=${code} stdout=${stdout ? '[stdout present]' : 'empty'} stderr=${stderr ? '[stderr present]' : 'empty'}`);
                    if (code !== 0) {
                        this.logger.error(`whisper process exited ${code} stderr=${stderr}`);
                        return reject(new Error(`whisper process failed: ${code}`));
                    }

                    // Prefer reading generated text file, but fall back to stdout if file missing
                    const txtPath = path.join(outDir, `${path.parse(filePath).name}.txt`);
                    if (fs.existsSync(txtPath)) {
                        try {
                            const txt = fs.readFileSync(txtPath, 'utf-8');
                            try { fs.unlinkSync(txtPath); } catch {}
                            // cleanup wav
                            try { fs.unlinkSync(wavPath); } catch {}
                            return resolve(txt.trim());
                        } catch (e) {
                            this.logger.error('failed to read whisper txt output', e as any);
                            // continue to fallback to stdout
                        }
                    }

                    // If stdout contains likely transcription, return it
                    if (stdout && stdout.trim()) {
                        // cleanup wav
                        try { fs.unlinkSync(wavPath); } catch {}
                        const cleaned = stdout.trim();
                        return resolve(cleaned);
                    }

                    // If no txt and no stdout, return error with stderr for debugging
                    this.logger.error('whisper produced no output file and no stdout', { txtPath, stdout, stderr });
                    // cleanup wav
                    try { fs.unlinkSync(wavPath); } catch {}
                    return reject(new Error('whisper produced no output'));
                });
            };
        });
    }
    // removed queue/session helper methods to keep service minimal for single-file transcription
    // --- Session helpers for chunked/near-real-time transcription ---
    addSessionChunk(
        sessionId: string,
        chunkIndex: number,
        text: string,
        meta?: { startTime?: number; endTime?: number; model?: string; quick?: boolean },
    ) {
        if (!sessionId) return;
        const now = Date.now();
        const session =
            this.sessions.get(sessionId) || { chunks: new Map<number, { text: string }>(), finalized: false, lastUpdated: now };
        session.chunks.set(Number(chunkIndex), {
            text: text ?? '',
            startTime: meta?.startTime,
            endTime: meta?.endTime,
            model: meta?.model,
            quick: !!meta?.quick,
        });
        session.lastUpdated = now;
        this.sessions.set(sessionId, session);
        return this.getSessionText(sessionId);
    }

    getSessionText(sessionId: string): string {
        const session = this.sessions.get(sessionId);
        if (!session) return '';

        // Helper: normalize a token for robust comparison
        const normalize = (tok: string) => {
            if (!tok) return '';
            // lowercase
            let s = tok.toLowerCase();
            // unicode normalize and strip combining marks (accents)
            s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            // remove surrounding punctuation
            s = s.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
            // remove internal apostrophes and fancy quotes
            s = s.replace(/["'`’]/g, '');
            // remove trailing hyphen (word césure)
            s = s.replace(/-$/g, '');
            return s;
        };

        const entries = Array.from(session.chunks.entries()).sort((a, b) => a[0] - b[0]);
        let assembled = '';
        for (const [_, chunk] of entries) {
            const curr = (chunk && typeof chunk.text === 'string' ? chunk.text.trim() : '');
            if (!curr) continue;
            if (!assembled) {
                assembled = curr;
                continue;
            }

            const prevTokens = assembled.split(/\s+/).filter(Boolean);
            const currTokens = curr.split(/\s+/).filter(Boolean);

            // If previous chunk ends with a hyphenated token, join directly (word was cut)
            const lastPrevRaw = prevTokens[prevTokens.length - 1] || '';
            if (lastPrevRaw.endsWith('-')) {
                // remove trailing hyphen from assembled and concatenate without extra space
                assembled = assembled.replace(/-$/g, '') + currTokens.join(' ');
                continue;
            }

            const prevNorm = prevTokens.map((t) => normalize(t));
            const currNorm = currTokens.map((t) => normalize(t));

            const maxCheck = Math.min(20, prevNorm.length, currNorm.length);
            let dup = 0;
            for (let k = maxCheck; k >= 1; k--) {
                const prevSuffix = prevNorm.slice(-k).join(' ');
                const currPrefix = currNorm.slice(0, k).join(' ');
                if (prevSuffix && currPrefix && prevSuffix === currPrefix) {
                    dup = k;
                    break;
                }
            }

            if (dup > 0) {
                const remaining = currTokens.slice(dup).join(' ');
                if (remaining) assembled = `${assembled} ${remaining}`;
                // else entire chunk duplicated
            } else {
                assembled = `${assembled}\n${curr}`;
            }
        }

        return assembled.trim();
    }

    finalizeSession(sessionId: string) {
        const session = this.sessions.get(sessionId);
        if (!session) return '';
        session.finalized = true;
        session.lastUpdated = Date.now();
        this.sessions.set(sessionId, session);
        return this.getSessionText(sessionId);
    }

    getSessionInfo(sessionId: string) {
        const session = this.sessions.get(sessionId);
        if (!session) return { chunksCount: 0, finalized: false, lastUpdated: null };
        return { chunksCount: session.chunks.size, finalized: !!session.finalized, lastUpdated: session.lastUpdated };
    }
}
