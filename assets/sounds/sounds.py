import numpy as np
from scipy.io import wavfile

SAMPLE_RATE = 44100

def normalize_rms(signal, target_rms):
    """
    Scales the signal to match the target RMS precisely.
    Uses soft clipping (tanh) to prevent digital distortion on highly 
    transient sounds (like explosions) that need high RMS values.
    """
    current_rms = np.sqrt(np.mean(signal**2))
    if current_rms == 0:
        return signal
        
    scaled = signal * (target_rms / current_rms)
    
    # If peaks exceed 1.0, soft-clip them to simulate analog saturation, 
    # then quickly re-level to ensure the RMS target is still exactly met.
    if np.max(np.abs(scaled)) > 0.95:
        scaled = np.tanh(scaled)
        current_rms = np.sqrt(np.mean(scaled**2))
        scaled = scaled * (target_rms / current_rms)
        
        # Hard limit just in case, while preserving RMS as best as possible
        max_val = np.max(np.abs(scaled))
        if max_val > 0.99:
            scaled = scaled * (0.99 / max_val)
            
    return scaled

def to_16bit(signal):
    """Converts float audio (-1.0 to 1.0) to 16-bit PCM WAV standard."""
    return (signal * 32767).astype(np.int16)

def generate_wav(filename, signal, target_rms):
    scaled = normalize_rms(signal, target_rms)
    wavfile.write(filename, SAMPLE_RATE, to_16bit(scaled))
    print(f"Generated {filename:<20} | Target RMS: {target_rms:.3f}")

# ==========================================
# CUE GENERATORS
# ==========================================

# --- Interface ---
def gen_ui_tap():
    duration = 0.06
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    # Dry switch click (filtered noise burst) + low thump
    click = (np.random.rand(len(t)) * 2 - 1) * np.exp(-t * 300)
    thump = np.sin(2 * np.pi * 90 * t) * np.exp(-t * 100)
    return click * 0.5 + thump * 0.5

# --- Placement ---
def gen_ship_pickup():
    duration = 0.14
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    freq = np.linspace(200, 600, len(t))
    chirp = np.sin(2 * np.pi * freq * t) * np.exp(-t * 15)
    noise = (np.random.rand(len(t)) * 2 - 1) * np.exp(-t * 20)
    return chirp * 0.6 + noise * 0.4

def gen_ship_drop():
    duration = 0.24
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    freq = np.linspace(350, 60, len(t))
    thud = np.sin(2 * np.pi * freq * t) * np.exp(-t * 15)
    noise = (np.random.rand(len(t)) * 2 - 1) * np.exp(-t * 10)
    return thud * 0.7 + noise * 0.3

def gen_ship_blocked():
    duration = 0.26
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    # Square wave for a flat, negative electrical buzz
    buzz_wave = np.sign(np.sin(2 * np.pi * 110 * t)) 
    env1 = (t < 0.11) * np.exp(-t * 10)
    t2 = t - 0.14
    env2 = (t >= 0.14) * np.exp(-t2 * 10)
    return buzz_wave * (env1 + env2)

def gen_ship_rotate():
    duration = 0.20
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    signal = np.zeros_like(t)
    # Three mechanical clicks, rising pitch
    for i, p in enumerate([350, 500, 700]):
        start = i * 0.06
        mask = (t >= start) & (t < start + 0.05)
        ts = t[mask] - start
        signal[mask] += np.sin(2 * np.pi * p * ts) * np.exp(-ts * 150)
    return signal

def gen_fleet_shuffle():
    duration = 0.60
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    signal = np.zeros_like(t)
    # Six ratchet clicks
    for i, p in enumerate(np.linspace(300, 800, 6)):
        start = i * 0.09
        mask = (t >= start) & (t < start + 0.07)
        ts = t[mask] - start
        signal[mask] += np.sin(2 * np.pi * p * ts) * np.exp(-ts * 120)
    return signal

# --- Transitions ---
def gen_battle_start():
    duration = 2.00
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    # Power chord (D2, A2, D3) with slight detuning for brass thickness
    brass = (np.sin(2 * np.pi * 73.42 * t) + 
             np.sin(2 * np.pi * 110.00 * t) + 
             np.sin(2 * np.pi * 146.83 * t) + 
             np.sin(2 * np.pi * 147.50 * t)) / 4.0
    swell = np.minimum(t / 0.8, 1.0) * np.exp(-(t - 0.8) * 0.5)
    
    # Deep drum hits at 0.0s and 0.5s
    drum = np.sin(2 * np.pi * 50 * t) * np.exp(-t * 15)
    t_d2 = t - 0.5
    drum += (t >= 0.5) * np.sin(2 * np.pi * 50 * t_d2) * np.exp(-t_d2 * 15)
    
    return (brass * swell * 0.7) + (drum * 0.4)

def gen_sonar_ping():
    duration = 1.10
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    ping = np.sin(2 * np.pi * 1050 * t) * np.exp(-t * 5)
    # Soft delay/echo
    t_e = t - 0.4
    echo = (t >= 0.4) * np.sin(2 * np.pi * 1050 * t_e) * np.exp(-t_e * 5) * 0.25
    return ping + echo

# --- Combat ---
def gen_target_lock():
    duration = 0.30
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    beep1 = np.sin(2 * np.pi * 1600 * t) * (t < 0.08)
    t2 = t - 0.12
    beep2 = np.sin(2 * np.pi * 2200 * t2) * (t >= 0.12) * (t < 0.20)
    # Apply slight decay to avoid hard pops
    return (beep1 + beep2) * np.exp(-t * 2)

def gen_cannon_fire():
    duration = 0.70
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    # Crack: harsh white noise burst
    crack = (np.random.rand(len(t)) * 2 - 1) * np.exp(-t * 40)
    # Boom: exponential pitch drop for massive weight
    boom_freq = 200 * np.exp(-t * 15) + 30 
    boom = np.sin(2 * np.pi * boom_freq * t) * np.exp(-t * 6)
    return crack * 0.4 + boom * 0.8

def gen_incoming_shell():
    duration = 0.80
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    # Exponential pitch drop feels much heavier than linear
    freq_base = 2000 * np.exp(-t * 1.5) + 300
    whistle = (np.sin(2 * np.pi * freq_base * t) + 
               np.sin(2 * np.pi * (freq_base * 1.02) * t)) * 0.5
    env = np.minimum(t / 0.1, 1.0) * (1 - (t / duration)**2)
    return whistle * env

def gen_shot_hit():
    duration = 0.80
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    # Filtered-style pinkish noise for debris
    noise = (np.random.rand(len(t)) * 2 - 1) * np.exp(-t * 5)
    # Low body punch
    body_freq = 100 * np.exp(-t * 10) + 20
    body = np.sin(2 * np.pi * body_freq * t) * np.exp(-t * 4)
    return noise * 0.6 + body * 0.7

def gen_shot_miss():
    duration = 0.55
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    splash = (np.random.rand(len(t)) * 2 - 1) * np.exp(-t * 10)
    bubble = np.sin(2 * np.pi * 150 * t) * np.exp(-t * 8)
    return splash * 0.6 + bubble * 0.5

def gen_ship_sunk():
    duration = 1.60
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    blast = (np.random.rand(len(t)) * 2 - 1) * np.exp(-t * 2.5)
    groan_freq = 150 * np.exp(-t * 2) + 30
    groan = np.sin(2 * np.pi * groan_freq * t) * np.exp(-t * 2)
    return blast * 0.5 + groan * 0.7

# --- Endgame ---
def gen_victory_fanfare():
    duration = 2.40
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    sig = np.zeros_like(t)
    # Triplet lead-in (G3, C4, E4) -> Sustained Chord (C4 Major)
    lead_notes = [196.00, 261.63, 329.63] 
    for i, n in enumerate(lead_notes):
        start = i * 0.2
        mask = (t >= start) & (t < start + 0.2)
        ts = t[mask] - start
        sig[mask] += np.sin(2 * np.pi * n * ts) * np.exp(-ts * 5)
        
    # Sustained major chord hits at 0.6s
    chord_start = 0.6
    c_mask = (t >= chord_start)
    tc = t[c_mask] - chord_start
    chord = (np.sin(2 * np.pi * 261.63 * tc) + 
             np.sin(2 * np.pi * 329.63 * tc) + 
             np.sin(2 * np.pi * 392.00 * tc)) / 3.0
    sig[c_mask] += chord * np.exp(-tc * 1.2)
    
    drum = (t >= chord_start) * np.sin(2 * np.pi * 45 * (t - chord_start)) * np.exp(-(t - chord_start) * 8)
    return sig * 0.8 + drum * 0.4

def gen_defeat_horn():
    duration = 2.60
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    # Add harmonics to base sine for "foghorn" thickness
    horn1_base = 110.0
    horn1 = (np.sin(2 * np.pi * horn1_base * t) + 0.3 * np.sin(2 * np.pi * horn1_base * 2 * t))
    env1 = (t < 0.9) * np.exp(-t * 1.5)
    
    t2 = t - 1.0
    horn2_base = 73.42 # Lower D2
    horn2 = (np.sin(2 * np.pi * horn2_base * t2) + 0.3 * np.sin(2 * np.pi * horn2_base * 2 * t2))
    env2 = (t >= 1.0) * np.exp(-t2 * 1.2)
    
    sea_noise = (np.random.rand(len(t)) * 2 - 1) * 0.15 * np.exp(-t * 0.3)
    return (horn1 * env1 + horn2 * env2) * 0.8 + sea_noise

def gen_retreat_alarm():
    duration = 1.40
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    # Two mechanical klaxon sweeps using a square wave base
    half = int(len(t) / 2)
    t_sweep1 = t[:half]
    t_sweep2 = t[half:] - t[half]
    
    # Built per sweep: an odd sample count leaves the second half one longer
    freq_sweep1 = np.linspace(400, 750, len(t_sweep1))
    freq_sweep2 = np.linspace(400, 750, len(t_sweep2))
    sweep1 = np.sign(np.sin(2 * np.pi * freq_sweep1 * t_sweep1)) * np.exp(-t_sweep1 * 2)
    sweep2 = np.sign(np.sin(2 * np.pi * freq_sweep2 * t_sweep2)) * np.exp(-t_sweep2 * 2)
    
    return np.concatenate([sweep1, sweep2])

# ==========================================
# BATCH EXECUTION
# ==========================================
cues = [
    ("ui_tap.wav", gen_ui_tap, 0.060),
    ("ship_pickup.wav", gen_ship_pickup, 0.080),
    ("ship_drop.wav", gen_ship_drop, 0.090),
    ("ship_blocked.wav", gen_ship_blocked, 0.080),
    ("ship_rotate.wav", gen_ship_rotate, 0.043),
    ("fleet_shuffle.wav", gen_fleet_shuffle, 0.045),
    ("battle_start.wav", gen_battle_start, 0.200),
    ("sonar_ping.wav", gen_sonar_ping, 0.090),
    ("target_lock.wav", gen_target_lock, 0.080),
    ("cannon_fire.wav", gen_cannon_fire, 0.149),
    ("incoming_shell.wav", gen_incoming_shell, 0.120),
    ("shot_hit.wav", gen_shot_hit, 0.171),
    ("shot_miss.wav", gen_shot_miss, 0.093),
    ("ship_sunk.wav", gen_ship_sunk, 0.196),
    ("victory_fanfare.wav", gen_victory_fanfare, 0.200),
    ("defeat_horn.wav", gen_defeat_horn, 0.200),
    ("retreat_alarm.wav", gen_retreat_alarm, 0.140),
]

if __name__ == "__main__":
    import argparse

    names = [name[: -len(".wav")] for name, _, _ in cues]
    parser = argparse.ArgumentParser(
        description="Generate the Hulls & Hellfire audio cues."
    )
    parser.add_argument(
        "cue",
        nargs="?",
        choices=names,
        help="Name of a single cue to generate (default: all of them).",
    )
    args = parser.parse_args()

    if args.cue:
        filename, generator, rms = next(c for c in cues if c[0] == f"{args.cue}.wav")
        generate_wav(filename, generator(), rms)
        print("Done!")
    else:
        print("Generating Hulls & Hellfire audio placeholders...")
        for filename, generator, rms in cues:
            generate_wav(filename, generator(), rms)
        print(f"Done! All {len(cues)} cues generated successfully.")
