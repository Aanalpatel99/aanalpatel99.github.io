---
title: "Designing an OTA A/B Partition System: What a Zero-Brick Guarantee Actually Takes"
tags: [embedded, firmware, ota, systems-design]
excerpt: "Building a zero-brick OTA system for a 50-device embedded Linux fleet — A/B partitioning, SHA-256 + RSA verification, and a watchdog-driven rollback — and what I'd change with hindsight."
---

Somewhere around device #30 of a 50-unit fleet, it stops being okay to think of a firmware
update as "just flash it and see." At that scale, a bad update isn't an inconvenience — it's
a truck roll. This is the story of building an OTA system with a promise attached to it:
whatever happens mid-update, the device boots back up working.

## The problem

We had a distributed fleet of roughly 50 embedded Linux devices in the field, each needing
firmware updates pushed remotely rather than physically re-flashed on-site. The obvious
approach — download new firmware, overwrite the old, reboot — has one fatal flaw: if the
download is corrupted, the new firmware is broken, or power drops mid-write, the device is
bricked. At 50 devices spread across real physical locations, a bricked device means someone
drives out with a laptop. That cost scales linearly with fleet size, and it doesn't scale well.

The requirement wasn't just "get updates out." It was: **no update, however it fails, should
ever leave a device unable to boot.**

## Why A/B partitioning

The fix is to never overwrite the thing that's currently running. Instead, the device holds
two complete firmware partitions — call them A and B. If A is live, an update downloads and
verifies into B, entirely offline from the running system. Only after B passes every check
does the bootloader get told "boot from B next time." If anything goes wrong before that
handoff, A is untouched and the device just keeps running on what it already had.

This is the actual mechanism behind a "zero-brick guarantee" — it's not a hope, it's a
structural property of never letting the update process touch the partition currently
keeping the device alive.

## The verification chain

Downloading new firmware isn't enough on its own — you also need to know it's *intact* and
that it's *actually yours*. Two separate checks, doing two separate jobs:

- **SHA-256 hashing** verifies integrity — did the file arrive complete and uncorrupted,
  byte for byte matching what was built.
- **RSA signature validation** verifies authenticity — was this firmware actually signed
  by us, not something injected by a compromised update server or a man-in-the-middle
  on a field network.

Skip either one and you've got a real gap: hash-only means a corrupted-but-untampered file
still fails safely, but an attacker who can forge a valid hash for malicious firmware sails
right through. Signature-only catches forged firmware but not honest corruption. Both
together is the actual bar for a system you're willing to trust with a fleet of unattended
devices.

## Build and delivery pipeline

Firmware images were built and released through **GitHub Actions**, with signed builds pushed
to **GCP Cloud Storage** for devices to pull from. Each device runs through an explicit state
machine on update:

```
IDLE → CHECKING → DOWNLOADING → VERIFYING → REBOOTING → HEALTHY / ROLLBACK
```

`CHECKING` polls for a new signed release. `DOWNLOADING` pulls it into the inactive partition.
`VERIFYING` runs the SHA-256 + RSA checks before anything is marked bootable. `REBOOTING`
hands control to the new partition — and a **watchdog timer** is the safety net on the other
side of that reboot: the new firmware has 30 seconds and up to 3 retries — whichever comes
first — to call `watchdog_ack()`, confirming the software actually came up and is running
correctly. If that acknowledgment doesn't land in time, the watchdog assumes the update
failed, flips the boot pointer back to the last known-good partition, and the device comes
back up on the original firmware with no manual intervention required.

## What I'd do differently

Two things, with hindsight. First, rollback only ever falls back to *one* prior partition —
whatever was running before the failed update. If two updates in a row both had subtle,
uncaught problems, a rollback lands you on a "known-good" build that was never actually
fully proven either, just not the one that failed loudly. A deeper fallback chain, or a
separate known-stable "golden" image that's never overwritten by regular updates, would
close that gap.

Second, updates went out to the whole fleet in one wave rather than staged. That's fine
when a build is good, but if a flawed signed build ever went out fleet-wide, every device
would independently hit its watchdog timeout and roll back around the same time — which is
functionally fine, but looks like 50 simultaneous incidents from a monitoring dashboard,
not one root cause. A canary rollout to a small subset first, with a delay before pushing
to the rest of the fleet, would catch a bad build with 2-3 devices affected instead of 50,
and make the failure mode a lot easier to read from the outside.
