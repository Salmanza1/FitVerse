/**
 * Synthesises the rest-timer bell into assets/sounds/rest-complete.wav.
 *
 * The sound is generated rather than sourced so it carries no licence and can
 * be re-tuned by editing the numbers below and re-running:
 *
 *     node scripts/make-rest-bell.js
 *
 * What makes a struck bell sound like metal rather than like an organ is that
 * its partials are inharmonic — not whole-number multiples of the fundamental
 * — and that the high ones fade faster than the low ones. Both are modelled
 * here, along with the noise transient of the strike itself.
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION_S = 1.6;
const BITS = 16;

/** Strike pitch. High enough to cut through a gym without being shrill. */
const F0 = 784; // G5

/**
 * ratio: multiple of F0 — deliberately not whole numbers.
 * gain:  relative loudness at the strike.
 * decay: seconds to fall to ~37%. Higher partials must be shorter or the
 *        result rings like a synth pad instead of a bell.
 */
const PARTIALS = [
    { ratio: 1.0, gain: 1.0, decay: 0.62 },
    { ratio: 2.01, gain: 0.58, decay: 0.42 },
    { ratio: 2.98, gain: 0.34, decay: 0.3 },
    { ratio: 4.16, gain: 0.22, decay: 0.2 },
    { ratio: 5.43, gain: 0.13, decay: 0.14 },
    { ratio: 6.79, gain: 0.08, decay: 0.1 },
];

/** Rise time of the strike. Any slower and it sounds blown, not hit. */
const ATTACK_S = 0.004;
/** The metallic click of the hammer. */
const NOISE_GAIN = 0.16;
const NOISE_DECAY_S = 0.02;

function render() {
    const total = Math.floor(SAMPLE_RATE * DURATION_S);
    const samples = new Float64Array(total);

    // Deterministic noise, so re-running produces an identical file.
    let seed = 0x2f6f2b19;
    const rand = () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return (seed >>> 0) / 0xffffffff * 2 - 1;
    };

    for (let i = 0; i < total; i++) {
        const t = i / SAMPLE_RATE;
        let value = 0;

        for (const p of PARTIALS) {
            value += p.gain * Math.exp(-t / p.decay) * Math.sin(2 * Math.PI * F0 * p.ratio * t);
        }

        value += NOISE_GAIN * Math.exp(-t / NOISE_DECAY_S) * rand();

        // Attack ramp, then a tail fade so the file cannot end on a step.
        const attack = t < ATTACK_S ? t / ATTACK_S : 1;
        const remaining = DURATION_S - t;
        const release = remaining < 0.05 ? Math.max(0, remaining / 0.05) : 1;

        samples[i] = value * attack * release;
    }

    let peak = 0;
    for (const s of samples) peak = Math.max(peak, Math.abs(s));
    // Leave a little headroom rather than normalising to full scale.
    const scale = peak > 0 ? 0.89 / peak : 0;

    const bytesPerSample = BITS / 8;
    const data = Buffer.alloc(total * bytesPerSample);
    for (let i = 0; i < total; i++) {
        const v = Math.max(-1, Math.min(1, samples[i] * scale));
        data.writeInt16LE(Math.round(v * 32767), i * bytesPerSample);
    }
    return data;
}

function wav(data) {
    const channels = 1;
    const byteRate = SAMPLE_RATE * channels * (BITS / 8);
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // PCM chunk size
    header.writeUInt16LE(1, 20); // PCM, uncompressed — what iOS wants
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(SAMPLE_RATE, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(channels * (BITS / 8), 32);
    header.writeUInt16LE(BITS, 34);
    header.write('data', 36);
    header.writeUInt32LE(data.length, 40);
    return Buffer.concat([header, data]);
}

const out = path.join(__dirname, '..', 'assets', 'sounds', 'rest-complete.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
const file = wav(render());
fs.writeFileSync(out, file);
console.log(
    `wrote ${path.relative(path.join(__dirname, '..'), out)} — ` +
        `${(file.length / 1024).toFixed(1)} KB, ${DURATION_S}s, ${SAMPLE_RATE} Hz, ${BITS}-bit mono`
);
