import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter

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

# --- Launch ---
def gen_app_launch():
    duration = 1.80
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    sig = np.zeros_like(t)

    # Engine room coming up to pressure on the same low D the defeat horn
    # answers on. The slow drift keeps it breathing; a fixed pitch here reads
    # as a test tone rather than machinery.
    drift = 1 + 0.004 * np.sin(2 * np.pi * 0.7 * t)
    phase = 2 * np.pi * np.cumsum(73.42 * drift) / SAMPLE_RATE
    engine = np.sin(phase) + 0.4 * np.sin(phase * 2) + 0.15 * np.sin(phase * 3)
    swell = np.minimum(t / 0.55, 1.0) * np.exp(-np.maximum(t - 0.9, 0.0) * 1.4)
    sig += engine / 1.55 * swell * 0.55

    # One struck ship's bell over it. A bell's partials are inharmonic — the
    # tierce and quint are what stop it reading as a plain sine chord — and the
    # high ones die first, so each partial carries its own decay rate.
    strike = 0.30
    b_mask = t >= strike
    tb = t[b_mask] - strike
    bell = np.zeros_like(tb)
    for ratio, amp, decay in [
        (0.50, 0.45, 1.4),  # hum
        (1.00, 1.00, 1.8),  # prime
        (1.19, 0.55, 2.6),  # tierce
        (1.50, 0.40, 3.2),  # quint
        (2.00, 0.35, 4.0),  # nominal
        (2.55, 0.18, 6.0),
        (3.01, 0.10, 8.0),
    ]:
        bell += np.sin(2 * np.pi * 587.33 * ratio * tb) * amp * np.exp(-tb * decay)
    # The clapper itself — without the tick the bell fades up instead of being hit
    tick = (np.random.rand(len(tb)) * 2 - 1) * np.exp(-tb * 220)
    sig[b_mask] += (bell / 3.0 + tick * 0.35) * 0.9

    # Sea under the whole thing, built like the defeat horn's wash
    wash = np.random.rand(len(t)) * 2 - 1
    wash = lfilter([1.0], [1.0, -0.985], wash)
    wash = lfilter([1.0, -1.0], [1.0, -0.99], wash)
    wash /= np.max(np.abs(wash))
    sig += wash * 0.25 * np.minimum(t / 0.40, 1.0)

    return sig

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
    duration = 2.00
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    sig = np.zeros_like(t)

    # Brass call transcribed from the reference take: two pickups (G4, A3)
    # into a rising D major arpeggio, held on A4, resolving up to D5.
    notes = [
        (0.000, 0.14, 392.00, 2.0),
        (0.140, 0.16, 220.00, 2.0),
        (0.385, 0.11, 293.66, 2.0),
        (0.517, 0.11, 369.99, 2.0),
        (0.645, 0.48, 440.00, 0.5),
        (1.115, 0.50, 587.33, 4.0),
    ]
    for start, dur, f0, decay in notes:
        mask = (t >= start) & (t < start + dur)
        ts = t[mask] - start
        body = np.exp(-ts * decay)
        attack = np.minimum(ts / 0.012, 1.0)
        release = np.minimum((dur - ts) / 0.05, 1.0)
        env = attack * release * body

        # Every attack in the reference lands ~20 cents sharp and settles,
        # and held notes pick up a slow player's vibrato once they ring on
        vibrato = 0.0007 * np.sin(2 * np.pi * 5.5 * ts) * np.minimum(ts / 0.25, 1.0)
        freq = f0 * (1 + 0.012 * np.exp(-ts * 40) + vibrato)
        phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE

        # A brass tone brightens as it blossoms: the reference's held note
        # rolls off at about h**-0.25 while its short pickups sit near
        # h**-0.75. Sweeping that exponent as the note develops is what keeps
        # the timbre off a static sawtooth.
        bloom = np.minimum(ts / 0.25, 1.0) * body

        voice = np.zeros_like(ts)
        for h in range(1, 21):
            partial = f0 * h
            if partial > 12000:
                break
            # The bell's own cliff, steep but not the brick wall of a
            # truncated harmonic series
            cut = np.exp(-((partial / 5000.0) ** 4))
            # Real partials are not phase-locked; aligned ones stack each
            # attack into a single spike that reads as additive synthesis
            offset = np.random.rand() * 2 * np.pi
            voice += np.sin(phase * h + offset) * h ** (-0.75 + 0.5 * bloom) * cut
        voice /= 3.0

        breath = (np.random.rand(len(ts)) * 2 - 1) * np.exp(-ts * 30)
        sig[mask] += (voice + breath * 0.2) * env

    # The take ends on a bell-like D6 that rings out under the last note
    bell_start = 1.115
    b_mask = t >= bell_start
    tb = t[b_mask] - bell_start
    sig[b_mask] += np.sin(2 * np.pi * 1174.66 * tb) * np.exp(-tb * 4.0) * 0.5

    # A short room around the horn: the reference never goes fully silent
    # between notes, and the reflections are most of what sells it as played
    ir_len = int(SAMPLE_RATE * 0.22)
    ir_t = np.arange(ir_len) / SAMPLE_RATE
    ir = (np.random.rand(ir_len) * 2 - 1) * np.exp(-ir_t * 14)
    ir[0] = 0.0
    wet = np.convolve(sig, ir)[: len(sig)]
    wet /= np.max(np.abs(wet))
    return sig + wet * 0.30

def gen_defeat_horn():
    duration = 2.60
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), False)
    sig = np.zeros_like(t)

    # Two foghorn blasts falling a fifth in D, answering the victory call
    blasts = [(0.00, 1.00, 110.00), (1.05, 1.55, 73.42)]
    for start, dur, f0 in blasts:
        mask = (t >= start) & (t < start + dur)
        ts = t[mask] - start
        # Air pressure sags over the blast, so the pitch droops with it
        freq = f0 * (1 - 0.015 * np.minimum(ts / dur, 1.0))
        phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE

        # A detuned second voice gives the slow beating of a real horn
        voice = np.zeros_like(ts)
        for h, amp in [(1, 1.0), (2, 0.5), (3, 0.28), (4, 0.12), (5, 0.06)]:
            voice += (np.sin(phase * h) + np.sin(phase * h * 1.004)) * amp
        voice /= 4.0

        swell = np.minimum(ts / 0.18, 1.0)
        release = np.minimum((dur - ts) / 0.35, 1.0)
        sig[mask] += voice * swell * release * np.exp(-ts * 0.5)

    # Sea wash under the horns. Two leaky integrators tilt white noise down
    # into a swell; the final high-pass strips the DC drift they introduce,
    # which a plain cumulative sum would leave as inaudible rumble.
    wash = np.random.rand(len(t)) * 2 - 1
    wash = lfilter([1.0], [1.0, -0.985], wash)
    wash = lfilter([1.0, -1.0], [1.0, -0.99], wash)
    wash /= np.max(np.abs(wash))
    sig += wash * 0.3 * np.minimum(t / 0.5, 1.0)

    return sig

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

# --- Lobby ---
def gen_lobby_music():
    """
    A 24 s loop, not a cue. It sits under the harbour screen while the player
    picks a name or waits for an opponent, so it has to survive being heard
    fifty times without ever asking to be listened to: no melody that resolves,
    no arrival, nothing that would make a player notice the seam.
    """
    duration = 24.0
    crossfade = 2.5
    n = int(SAMPLE_RATE * duration)
    total = duration + crossfade
    t = np.linspace(0, total, int(SAMPLE_RATE * total), False)
    sig = np.zeros_like(t)

    def bowed(ts, f0, dur, ensemble=3):
        """
        One bowed note, played by a section rather than a soloist. Three players
        never quite agree on pitch, and that disagreement — not the waveform —
        is most of what separates strings from a sawtooth oscillator.
        """
        voice = np.zeros_like(ts)
        spread = [(-0.0043, 0.8), (0.0, 1.0), (0.0038, 0.8)][:ensemble]
        for detune, weight in spread:
            # A player leans into a long note and settles. Held pitch that does
            # not move reads as an oscillator whatever the timbre does.
            vib = 0.0024 * np.sin(2 * np.pi * 4.6 * ts + np.random.rand() * 6.283)
            vib *= np.minimum(ts / 1.2, 1.0)
            drift = 0.0016 * np.sin(2 * np.pi * 0.21 * ts + np.random.rand() * 6.283)
            freq = f0 * (1 + detune) * (1 + vib + drift)
            phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE
            for h in range(1, 25):
                partial = f0 * h
                if partial > 9000:
                    break
                # Gut and horsehair rather than brass: the upper partials leave
                # early, which is what keeps this dark enough to ignore.
                cut = np.exp(-((partial / 3300.0) ** 2))
                offset = np.random.rand() * 6.283
                voice += np.sin(phase * h + offset) * h ** -1.15 * cut * weight
        voice /= 9.0

        # The bow itself. A little scratch riding the attack is the tell that
        # something is being drawn across a string by hand.
        bow = np.random.rand(len(ts)) * 2 - 1
        bow = lfilter([1.0], [1.0, -0.86], bow)
        bow /= np.max(np.abs(bow)) + 1e-9

        attack = np.minimum(ts / 0.8, 1.0) ** 1.6
        release = np.minimum(np.maximum(dur - ts, 0.0) / 1.4, 1.0)
        return (voice + bow * 0.06 * np.exp(-ts * 1.1)) * attack * release

    def place(start, dur, f0, gain, ensemble=3):
        mask = (t >= start) & (t < start + dur)
        if not mask.any():
            return
        sig[mask] += bowed(t[mask] - start, f0, dur, ensemble) * gain

    # Cello line in D minor, the key the whole set lives in — the same D the
    # engine room wakes on and the foghorn falls to. It circles D-F-A-G and
    # goes home, which is a shape with no destination: nothing here resolves
    # anywhere the ear can anticipate.
    place(0.00, 7.00, 146.83, 0.78)   # D3
    place(5.80, 5.20, 174.61, 0.60)   # F3
    place(10.40, 5.60, 220.00, 0.54)  # A3
    place(15.20, 5.00, 196.00, 0.57)  # G3
    # Runs past the loop point on purpose: the wrap lands mid-note, where a
    # seam has nothing to catch on.
    place(19.60, 7.00, 146.83, 0.74)

    # Double bass under all of it, breathing on a slow swell. Two octaves below
    # the line, so it is felt rather than followed.
    drone_env = 0.55 + 0.45 * np.sin(2 * np.pi * t / duration - np.pi / 2)
    sig += bowed(t, 73.42, total + 10.0, ensemble=2) * 0.20 * drone_env
    # The fifth arrives late and leaves before the loop does, which is the only
    # event in the piece.
    fifth = np.clip(np.sin(np.pi * (t - 7.0) / 13.0), 0, 1) ** 1.5
    sig += bowed(t, 110.00, total + 10.0, ensemble=2) * 0.13 * fifth

    # One foghorn, far enough off that it is weather rather than a signal.
    horn_start = 12.6
    h_mask = t >= horn_start
    th = t[h_mask] - horn_start
    hd = 2.4
    horn = np.zeros_like(th)
    for h, amp in [(1, 1.0), (2, 0.42), (3, 0.16)]:
        horn += (np.sin(2 * np.pi * 73.42 * h * th)
                 + np.sin(2 * np.pi * 73.42 * h * 1.004 * th)) * amp
    horn /= 3.2
    henv = np.minimum(th / 0.5, 1.0) * np.minimum(np.maximum(hd - th, 0.0) / 0.9, 1.0)
    # Distance is a low-pass and a delay, not just a fader
    horn = lfilter([1.0], [1.0, -0.82], horn * henv)
    sig[h_mask] += horn * 0.10

    # Sea underneath, the same wash the defeat horn stands on. Two leaky
    # integrators tilt white noise down into a swell; the high-pass strips the
    # DC drift they leave behind.
    wash = np.random.rand(len(t)) * 2 - 1
    wash = lfilter([1.0], [1.0, -0.985], wash)
    wash = lfilter([1.0, -1.0], [1.0, -0.99], wash)
    wash /= np.max(np.abs(wash))
    # Slow sets rolling through, period chosen not to divide the loop evenly
    swell = 0.62 + 0.38 * np.sin(2 * np.pi * t / 7.3 + 1.1)
    sig += wash * 0.17 * swell

    # A long room around the whole thing. The reflections are what put the
    # players in a space instead of in a mixer.
    ir_len = int(SAMPLE_RATE * 1.1)
    ir_t = np.arange(ir_len) / SAMPLE_RATE
    ir = (np.random.rand(ir_len) * 2 - 1) * np.exp(-ir_t * 3.4)
    ir[0] = 0.0
    wet = np.convolve(sig, ir)[: len(sig)]
    wet /= np.max(np.abs(wet))
    sig = sig + wet * 0.45

    # Fold the tail back over the head so the loop has no seam. Everything
    # above is written to still be sounding at the wrap, so the crossfade has
    # material on both sides of it.
    out = sig[:n].copy()
    xf = int(SAMPLE_RATE * crossfade)
    ramp = np.linspace(0.0, 1.0, xf)
    out[:xf] = out[:xf] * ramp + sig[n : n + xf] * (1.0 - ramp)
    return out
# ==========================================
# BATCH EXECUTION
# ==========================================
cues = [
    ("lobby_music.wav", gen_lobby_music, 0.020),
    ("app_launch.wav", gen_app_launch, 0.130),
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
