// ====== CONFIG ======
const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/control";
// Expected backend later on Pi:
// - WebSocket: /ws/control
// - POST /api/ai/ask      { question: string } -> { answer: string }
// - POST /api/talk/chunk  (audio/webm chunks)  -> 200 OK

// ====== HELPERS ======
const $ = (id) => document.getElementById(id);

function setStatus(text, ok=false){
  $("statusText").textContent = text;
  $("statusText").style.color = ok ? "var(--ok)" : "var(--muted)";
}

function setCaptions(text){
  const t = text || "—";
  $("captionText").textContent = t;
  $("captionTextAsk").textContent = t;
  $("captionTextTalk").textContent = t;
}

function addChatBubble(text, who){
  const div = document.createElement("div");
  div.className = `bubble ${who}`;
  div.textContent = text;
  $("chat").appendChild(div);
  $("chat").scrollTop = $("chat").scrollHeight;
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

// ====== TABS ======
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");

    const target = btn.dataset.screen;
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    $(`screen-${target}`).classList.add("active");
  });
});

// ====== ACCESSIBILITY ======
$("toggleBigText").addEventListener("click", ()=> document.body.classList.toggle("bigText"));
$("toggleContrast").addEventListener("click", ()=> document.body.classList.toggle("highContrast"));
$("clearCaptions").addEventListener("click", ()=> setCaptions("—"));

// ====== SPEED ======
let speedCap = parseInt($("speed").value, 10) / 100;
$("speedVal").textContent = `${Math.round(speedCap*100)}%`;
$("speed").addEventListener("input", (e)=>{
  speedCap = parseInt(e.target.value, 10) / 100;
  $("speedVal").textContent = `${Math.round(speedCap*100)}%`;
});

// ====== WEBSOCKET ======
let ws = null;

function wsSend(obj){
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function connectWS(){
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    setStatus("Connected", true);
    $("connectBtn").textContent = "Connected";
    $("connectBtn").disabled = true;
    wsSend({ type: "hello", client: "duck-web" });
  };

  ws.onclose = () => {
    setStatus("Disconnected");
    $("connectBtn").textContent = "Connect";
    $("connectBtn").disabled = false;
  };

  ws.onerror = () => {
    setStatus("Connection error");
  };

  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === "caption") setCaptions(msg.text);
      if (msg.type === "status" && msg.text) setStatus(msg.text, !!msg.ok);
    } catch {
      // ignore
    }
  };
}

$("connectBtn").addEventListener("click", connectWS);

// ====== CONTROLLER LOGIC (DUAL STICKS) ======
let driveY = 0;  // -1 back, +1 forward
let steerX = 0;  // -1 left, +1 right

function setKnob(knobEl, xPx, yPx){
  knobEl.style.transform = `translate(${xPx}px, ${yPx}px) translate(-50%, -50%)`;
}

function createStick(stickEl, knobEl, axis){
  let active = false;

  const getGeom = () => {
    const r = stickEl.getBoundingClientRect();
    const radius = Math.min(r.width, r.height)/2 - 12;
    return { cx: r.left + r.width/2, cy: r.top + r.height/2, radius };
  };

  const move = (clientX, clientY) => {
    const { cx, cy, radius } = getGeom();
    const dx = clientX - cx;
    const dy = clientY - cy;

    let xNorm = clamp(dx / radius, -1, 1);
    let yNorm = clamp(dy / radius, -1, 1);

    if (axis === "vertical"){
      // Only up/down for drive. Invert so up is +.
      driveY = clamp(-yNorm, -1, 1);
      // knob moves visually: up when driveY positive
      const yPx = clamp(dy, -radius, radius);
      setKnob(knobEl, 0, yPx);
    } else {
      // Only left/right for steer.
      steerX = clamp(xNorm, -1, 1);
      const xPx = clamp(dx, -radius, radius);
      setKnob(knobEl, xPx, 0);
    }
  };

  const end = () => {
    active = false;
    if (axis === "vertical") driveY = 0;
    else steerX = 0;
    setKnob(knobEl, 0, 0);
  };

  stickEl.addEventListener("pointerdown", (e)=>{
    e.preventDefault();
    active = true;
    stickEl.setPointerCapture(e.pointerId);
    move(e.clientX, e.clientY);
  });

  stickEl.addEventListener("pointermove", (e)=>{
    if (!active) return;
    e.preventDefault();
    move(e.clientX, e.clientY);
  });

  stickEl.addEventListener("pointerup", (e)=>{
    e.preventDefault();
    end();
  });

  stickEl.addEventListener("pointercancel", end);
  stickEl.addEventListener("pointerleave", () => { if (active) end(); });
}

createStick($("stickDrive"), $("knobDrive"), "vertical");
createStick($("stickSteer"), $("knobSteer"), "horizontal");

// Send control values continuously (backend can ignore repeats)
function controlLoop(){
  const drive = clamp(driveY * speedCap, -1, 1); // apply speed cap
  const steer = clamp(steerX, -1, 1);

  // Your backend will map these to motors:
  // - drive_value controls rear motor
  // - steer_value controls front steering motor
  wsSend({ type: "drive_value", value: drive });
  wsSend({ type: "steer_value", value: steer });

  requestAnimationFrame(controlLoop);
}
controlLoop();

// Buttons
$("duckBtn").addEventListener("click", ()=> wsSend({ type: "quack" }));
$("btnLights").addEventListener("click", ()=> wsSend({ type: "lights_toggle" }));

function stopAll(){
  driveY = 0;
  steerX = 0;
  setKnob($("knobDrive"), 0, 0);
  setKnob($("knobSteer"), 0, 0);
  wsSend({ type: "stop_all" });
}
$("btnStop").addEventListener("click", stopAll);
$("talkStop").addEventListener("click", stopAll);
$("talkQuack").addEventListener("click", ()=> wsSend({ type: "quack" }));

// ====== ASK DUCK (AI) ======
async function askDuck(question){
  const q = (question || "").trim();
  if (!q) return;

  addChatBubble(q, "user");
  $("askInput").value = "";

  addChatBubble("…thinking…", "duck");
  const thinkingBubble = $("chat").lastChild;

  try{
    const res = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ question: q })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const answer = data.answer ?? "(no answer returned)";
    thinkingBubble.textContent = answer;
    setCaptions(answer);

  } catch {
    thinkingBubble.textContent = "Backend not running yet (AI endpoint missing).";
  }
}

$("askSendBtn").addEventListener("click", ()=> askDuck($("askInput").value));
$("askInput").addEventListener("keydown", (e)=> { if (e.key === "Enter") askDuck($("askInput").value); });

// Placeholder mic-to-text
$("askMicBtn").addEventListener("click", ()=>{
  addChatBubble("Mic-to-text can be added next. For now, type your question 🙂", "duck");
});

// ====== TALK MODE (PUSH TO TALK) ======
let mediaRecorder = null;
let talkStream = null;
let talking = false;

async function startTalk(){
  if (talking) return;
  talking = true;
  $("talkState").textContent = "Listening…";

  try{
    talkStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(talkStream, { mimeType: "audio/webm" });

    mediaRecorder.ondataavailable = async (evt) => {
      if (!evt.data || evt.data.size === 0) return;
      try{
        await fetch("/api/talk/chunk", {
          method: "POST",
          headers: { "Content-Type": "audio/webm" },
          body: evt.data
        });
      } catch {
        // backend may not be running yet
      }
    };

    mediaRecorder.start(300); // chunk every 300ms
  } catch {
    $("talkState").textContent = "Mic blocked / not available";
    talking = false;
  }
}

function stopTalk(){
  $("talkState").textContent = "Idle";
  talking = false;

  try{ mediaRecorder?.stop(); } catch {}
  mediaRecorder = null;

  if (talkStream){
    talkStream.getTracks().forEach(t=>t.stop());
    talkStream = null;
  }
}

function bindHold(el, onStart, onEnd){
  let held = false;
  el.addEventListener("pointerdown", (e)=>{ e.preventDefault(); if (held) return; held = true; onStart(); });
  el.addEventListener("pointerup", (e)=>{ e.preventDefault(); if (!held) return; held = false; onEnd(); });
  el.addEventListener("pointercancel", ()=>{ if (!held) return; held = false; onEnd(); });
  el.addEventListener("pointerleave", ()=>{ if (!held) return; held = false; onEnd(); });
}

bindHold($("talkHoldBtn"), startTalk, stopTalk);

// ====== PWA ======
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(()=>{});
  });
}
