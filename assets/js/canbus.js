/**
 * Spacecraft CAN bus replay — canvas visualization.
 *
 * Data source is /assets/data/canbus-mock-data.json, which is currently
 * SYNTHETIC placeholder data (see meta.note in that file). To go live with
 * the real 1,868-frame flight dataset, replace that JSON file with one
 * matching the same schema — no changes needed here.
 */
(function () {
  const DATA_URL = "/assets/data/canbus-mock-data.json";
  const FRAME_MS = 120;

  const STATE_COLORS = {
    NOMINAL: "#2dd4bf",
    DEGRADED: "#f59e0b",
    SAFE_MODE: "#ef4444",
  };

  const NODE_STATUS_COLORS = {
    NOMINAL: "#2dd4bf",
    DEGRADED: "#f59e0b",
    FAULT: "#ef4444",
  };

  const NODE_LABELS = {
    power: "POWER",
    attitude: "ATTITUDE",
    thermal: "THERMAL",
    propulsion: "PROPULSION",
  };

  const canvas = document.getElementById("canbus-canvas");
  if (!canvas) return; // section not on this page

  const ctx = canvas.getContext("2d");
  const stateBadge = document.getElementById("canbus-state-badge");
  const playBtn = document.getElementById("canbus-play");
  const stepBackBtn = document.getElementById("canbus-step-back");
  const stepFwdBtn = document.getElementById("canbus-step-fwd");
  const scrubber = document.getElementById("canbus-scrubber");
  const frameLabel = document.getElementById("canbus-frame-label");
  const faultLabel = document.getElementById("canbus-fault-label");

  let data = null;
  let nodes = [];
  let frameIndex = 0;
  let playing = false;
  let timer = null;

  fetch(DATA_URL)
    .then((res) => res.json())
    .then((json) => {
      data = json;
      nodes = json.meta.nodes;
      scrubber.max = String(data.frames.length - 1);
      render();
    })
    .catch((err) => {
      console.error("canbus: failed to load dataset", err);
      const parent = canvas.parentElement;
      const msg = document.createElement("p");
      msg.className = "text-muted";
      msg.textContent = "Replay data failed to load.";
      parent.appendChild(msg);
    });

  function nodePositions() {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const spread = Math.min(w, h) * 0.34;
    return {
      power: { x: cx, y: cy - spread },
      attitude: { x: cx + spread * 1.15, y: cy },
      thermal: { x: cx, y: cy + spread },
      propulsion: { x: cx - spread * 1.15, y: cy },
    };
  }

  function render() {
    if (!data) return;
    const frame = data.frames[frameIndex];
    const pos = nodePositions();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // bus lines connecting all nodes through the center
    ctx.strokeStyle = "#262c36";
    ctx.lineWidth = 1.5;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    nodes.forEach((n) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pos[n].x, pos[n].y);
      ctx.stroke();
    });

    // center bus hub
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = STATE_COLORS[frame.state] || "#9ba3af";
    ctx.fill();

    // node boxes
    nodes.forEach((n) => {
      const p = pos[n];
      const status = frame.status[n];
      const color = NODE_STATUS_COLORS[status] || "#9ba3af";
      const boxW = 132;
      const boxH = 56;

      ctx.fillStyle = "#151b23";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      roundRect(ctx, p.x - boxW / 2, p.y - boxH / 2, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#e6e6e6";
      ctx.font = "600 12px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(NODE_LABELS[n], p.x, p.y - 6);

      ctx.fillStyle = color;
      ctx.font = "600 13px 'IBM Plex Mono', monospace";
      const val = frame.values[n];
      const unit = data.meta.units[n];
      ctx.fillText(`${val} ${unit}`, p.x, p.y + 14);
    });

    // UI text
    stateBadge.textContent = frame.state;
    stateBadge.dataset.state = frame.state;
    frameLabel.textContent = `Frame ${frame.i} / ${data.frames.length - 1}`;
    faultLabel.textContent = frame.fault ? `⚠ ${frame.fault}` : "";
    scrubber.value = String(frameIndex);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function step(delta) {
    if (!data) return;
    frameIndex = Math.max(0, Math.min(data.frames.length - 1, frameIndex + delta));
    render();
  }

  function play() {
    if (!data || playing) return;
    playing = true;
    playBtn.textContent = "Pause";
    timer = setInterval(() => {
      if (frameIndex >= data.frames.length - 1) {
        frameIndex = 0;
      } else {
        frameIndex += 1;
      }
      render();
    }, FRAME_MS);
  }

  function pause() {
    playing = false;
    playBtn.textContent = "Play";
    clearInterval(timer);
  }

  playBtn.addEventListener("click", () => (playing ? pause() : play()));
  stepBackBtn.addEventListener("click", () => {
    pause();
    step(-1);
  });
  stepFwdBtn.addEventListener("click", () => {
    pause();
    step(1);
  });
  scrubber.addEventListener("input", (e) => {
    pause();
    frameIndex = parseInt(e.target.value, 10);
    render();
  });
})();
