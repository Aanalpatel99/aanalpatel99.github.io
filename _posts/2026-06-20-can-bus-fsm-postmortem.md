---
title: "Designing the CAN bus health monitor FSM (and what went wrong)"
tags: [embedded, can-bus, fsm]
excerpt: "How the NOMINAL / DEGRADED / SAFE_MODE state machine for the spacecraft CAN bus monitor came together — including the bugs that shaped it."
---

<!-- SKELETON — outline only, no specifics filled in yet. Replace each bracketed prompt with the real details. -->

## The problem

[Describe what the CAN bus health monitor needed to detect and why a plain threshold check wasn't enough — why an FSM.]

## State design

[Explain the NOMINAL / DEGRADED / SAFE_MODE states — what triggers each transition, what "recovery" looks like, whether transitions are one-directional or can bounce back.]

## Bug #1: [name the bug]

[What broke, how it was found, root cause, fix.]

## Bug #2: [name the bug]

[What broke, how it was found, root cause, fix.]

## What I'd do differently

[Honest retrospective — what you'd change if starting over.]
