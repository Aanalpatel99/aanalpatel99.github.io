---
title: "Designing the CAN Bus Health Monitor FSM (and What Went Wrong)"
tags: [embedded, can-bus, fsm, systems-design]
excerpt: "How the NOMINAL / DEGRADED / SAFE_MODE state machine for the spacecraft CAN bus monitor came together — and the two real gaps I found once I went back and read my own code closely."
---

A single fault reading doesn't tell you much on its own. A voltage dip could be noise, a
sensor glitch, or the start of a real failure — you can't tell from one bad frame. What
actually matters is *pattern and persistence*, and that's a state problem, not a threshold
problem. This is the story of building a safe-state FSM for a simulated 4-node spacecraft
CAN bus, and the two real gaps I found in it once I went back and read my own code closely.

## The problem

The system simulates four spacecraft subsystems — Power (PMS), Attitude (ADCS), Thermal
(TCS), and Propulsion (PROP) — talking over a shared CAN bus, and it has to catch five
distinct fault conditions: a node going silent (missed heartbeats), a corrupted frame
(checksum mismatch), dropped frames (sequence gaps), and two flavors of bus flooding —
one node spamming the bus, or the whole bus overloaded.

A plain threshold check — "alert if voltage is out of range" — can't hold all of that. It has
no memory of what already happened, no way to distinguish "one bad frame" from "this node has
been silent for three heartbeat intervals," and no concept of *how bad* the situation currently
is. What the spacecraft actually needs to know isn't "is this one frame bad" — it's "what state
am I in right now, and does this fault change that." That's exactly what a state machine gives
you that a threshold check can't.

## State design

Three states: `NOMINAL`, `DEGRADED`, `SAFE_MODE`. Power and Attitude are marked critical
subsystems; Thermal and Propulsion are not — a deliberate design choice, and one I had to
defend. My first instinct was to treat Thermal as non-critical and leave it there, since a
temperature reading alone doesn't stop the spacecraft from flying. But thermal failure isn't
actually isolated — a runaway temperature can cascade into battery damage, which cascades into
power loss, which *is* critical. That reasoning is why the criticality flag exists per-node at
all, rather than treating every fault the same.

The transitions:

```
NOMINAL  ──[critical timeout / bus flood]──► SAFE_MODE
NOMINAL  ──[non-critical timeout]──────────► DEGRADED
DEGRADED ──[critical timeout]──────────────► SAFE_MODE
SAFE_MODE ──[all critical nodes recover]───► NOMINAL
```

A non-critical node going silent (Thermal, Propulsion) degrades the system but doesn't trip
safe mode on its own. A critical node going silent (Power, Attitude), or the bus getting
flooded, jumps straight to `SAFE_MODE` regardless of current state — some failures are severe
enough that they shouldn't have to escalate one step at a time.

## Bug #1: the recovery path that only exists on paper

Here's the honest one. Going back through my own `monitor.py` to write this post, I found that
the de-escalation path I documented — `SAFE_MODE → NOMINAL` once critical nodes recover — isn't
actually implemented. The transition logic only ever escalates:

```python
def _transition_state(self, new_state, node_id):
    with self._state_lock:
        old_state = self._state
        if new_state.value > old_state.value:
            self._state = new_state
            ...
```

That `if new_state.value > old_state.value` check is a one-way gate. There's no matching path
anywhere that moves state back down, and the set tracking which nodes have timed out
(`_timed_out_nodes`) gets added to but is never cleared. So in the current implementation, once
the spacecraft enters `SAFE_MODE`, it stays there — even if every node comes back online a
moment later. The documentation describes recovery-triggered de-escalation because that was
the intended design; the code doesn't back it up yet.

I'm including this here specifically because it's more useful than a bug I already fixed. A
missing feature you can point to precisely — file, function, exactly what's absent — is a more
honest signal of engineering maturity than pretending everything shipped clean.

## Bug #2: severity ranking that only works by accident

The same escalation check has a second, subtler problem. `new_state.value > old_state.value`
relies on Python enum declaration order to double as a severity ranking:

```python
class SpacecraftState(Enum):
    NOMINAL   = auto()  # 1
    DEGRADED  = auto()  # 2
    SAFE_MODE = auto()  # 3
```

It works today because the enum happens to be declared in the right order. But nothing in the
code actually says "these values represent severity" — that meaning is implicit, carried
entirely by the order the three lines were typed in. Reorder the enum for any reason — even a
purely cosmetic refactor — and the safety-critical escalation logic silently breaks with no
error, no warning, just wrong behavior. A system that's supposed to protect against failure
shouldn't have a failure mode this quiet.

## What I'd do differently

Two things, with hindsight. First, the recovery path deserves more than "clean heartbeat
received, node's back." I'd require N consecutive clean heartbeats — within the same window
used to detect the timeout in the first place — before a node counts as recovered, not one.
A single good frame right after a real failure is exactly the kind of signal that could mean
the fault cleared, or could just be one lucky frame on an otherwise unstable link, and
de-escalating out of `SAFE_MODE` on that alone would defeat the whole point of tracking state
instead of single readings.

Second, I'd stop letting severity ride on enum declaration order. `new_state.value >
old_state.value` reads fine today, but it only works because nobody has reordered
`SpacecraftState` yet — that's not a guarantee, it's a coincidence with a shelf life. An
explicit severity mapping — a dict, or values assigned by hand instead of `auto()` — would
make the ranking a stated fact instead of an implicit one, and it's the kind of fix that's
cheap now and expensive to discover you needed after someone innocently reorders a class.
