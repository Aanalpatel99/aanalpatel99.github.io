---
title: "TFLite Micro on ESP32-CAM: tensor arenas, INT8, and a threshold decision"
tags: [embedded, tinyml, esp32]
excerpt: "Notes on getting a quantized model running inside an ESP32-CAM's memory budget — and the tradeoffs behind the decisions that made it fit."
---

<!-- SKELETON — outline only, no specifics filled in yet. Replace each bracketed prompt with the real details. -->

## The constraint

[Describe the ESP32-CAM's memory/compute budget and why it forced specific decisions — SRAM available, PSRAM if used, clock speed.]

## Sizing the tensor arena

[Explain how the tensor arena size was chosen — what happened when it was too small/too large, how you landed on the final number.]

## Why INT8 quantization

[Walk through the quantization decision — accuracy tradeoff observed, calibration dataset used, before/after model size and latency.]

## The cosine-threshold decision

[Describe the specific threshold-tuning problem — what was being classified/matched, how the threshold was chosen, false positive/negative tradeoffs.]

## What I'd do differently

[Honest retrospective — what you'd change if starting over.]
