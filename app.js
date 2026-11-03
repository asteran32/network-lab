import { presets, simulate, phaseAt } from './model.js';

const $ = id => document.getElementById(id);
let params = { ...presets.classic };
let model = simulate(params);
let time = 0;
let playing = false;
let lastFrame = 0;
let visibleTooltip = null;
let pinnedTooltip = null;
const specs = [
  ['count', 'Number of cars', 'N', 1, 16, 1, 'cars'],
  ['service', 'Service per car', '1/R', 1, 60, 1, 's'],
  ['distance', 'Road length', 'd', 10, 200, 10, 'km'],
  ['speed', 'Car speed', 's', 50, 1000, 50, 'km/h'],
  ['processing', 'Packet processing', 'P', 0, 120, 5, 's'],
  ['queue', 'Other traffic wait', 'Q', 0, 300, 10, 's'],
];
const delays = [
  {
    key: 'processing', en: 'PROCESSING', name: 'Processing delay', color: 'var(--proc)',
    formula: 'd<sub>proc</sub> = P',
    description: 'Time to check a packet and choose its outgoing link. Applied once to the whole caravan.',
    detail: 'P is the configured processing time in this model.',
    calculation: () => `P = ${num(params.processing)} s per packet`,
  },
  {
    key: 'queue', en: 'QUEUEING', name: 'Queueing delay', color: 'var(--queue)',
    formula: 'd<sub>queue</sub> = Q',
    description: 'Time spent waiting for other packets to use the link. Waiting behind cars in this same caravan is already part of transmission.',
    detail: 'Q is a configured wait here; real queueing delay depends on traffic.',
    calculation: () => `Q = ${num(params.queue)} s per packet`,
  },
  {
    key: 'tx', en: 'TRANSMISSION', name: 'Transmission delay', color: 'var(--tx)',
    formula: 'd<sub>trans</sub> = L / R = N × S',
    description: 'Time to push the entire packet onto the link: from starting the first car’s service to releasing the last car.',
    detail: 'L: bits · R: bits/s · N: cars · S: seconds per car',
    calculation: () => `${params.count} cars × ${params.service} s/car = ${num(model.tx)} s`,
  },
  {
    key: 'prop', en: 'PROPAGATION', name: 'Propagation delay', color: 'var(--prop)',
    formula: 'd<sub>prop</sub> = d / s',
    description: 'Time for one bit to travel across the link. It depends on distance and speed, not packet length.',
    detail: 'd: distance · s: speed. Convert hours to seconds for this road model.',
    calculation: () => `${params.distance} km ÷ ${params.speed} km/h × 3,600 = ${num(model.prop)} s`,
  },
];
const num = n => Number(n.toFixed(1)).toLocaleString('en-US');
function clock(n) {
  n = Math.floor(n + 1e-7);
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}
function duration(n) {
  const minutes = Math.floor(n / 60);
  const seconds = Number((n % 60).toFixed(1));
  return `${minutes ? minutes + ' min ' : ''}${seconds} s`;
}

for (const [id, name, symbol, min, max, step, unit] of specs) {
  const el = document.createElement('div');
  el.className = 'parameter';
  el.innerHTML = `<div class="parameter-head"><label for="${id}">${name}<small>${symbol}</small></label><output id="${id}-value" for="${id}"></output></div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${params[id]}"><div class="range-labels"><span>${min} ${unit === 'cars' && min === 1 ? 'car' : unit}</span><span>${max} ${unit}</span></div>`;
  $(id === 'processing' || id === 'queue' ? 'extra-parameters' : 'parameters').append(el);
  $(id).addEventListener('input', () => {
    params[id] = Number($(id).value);
    $('preset').value = 'custom';
    $('preset-caption').textContent = 'Custom settings · Explore your own conditions';
    rebuild();
  });
}

$('delay-grid').innerHTML = delays.map((d, i) => `
  <div class="delay-cell" id="cell-${d.key}">
    <button class="delay-item" id="delay-${d.key}" aria-describedby="tooltip-${d.key}" aria-expanded="false" aria-controls="tooltip-${d.key}">
      <span class="delay-item-head"><span><i style="background:${d.color}"></i>${d.en}</span><span>0${i + 1}</span></span>
      <span class="delay-name">${d.name} <span class="info-mark" aria-hidden="true">ⓘ</span></span>
      <strong id="value-${d.key}"></strong>
    </button>
    <div class="delay-tooltip" id="tooltip-${d.key}" role="tooltip" hidden>
      <strong>${d.name}</strong><p>${d.description}</p>
      <div class="tooltip-formula">${d.formula}</div>
      <p class="tooltip-variables">${d.detail}</p>
      <div class="tooltip-calculation" id="calculation-${d.key}"></div>
    </div>
  </div>`).join('');

function showTooltip(key) {
  visibleTooltip = key;
  for (const d of delays) {
    const open = d.key === key;
    $('tooltip-' + d.key).hidden = !open;
    $('delay-' + d.key).setAttribute('aria-expanded', String(open));
    $('cell-' + d.key).classList.toggle('tooltip-open', open);
  }
}
for (const d of delays) {
  const cell = $('cell-' + d.key);
  const button = $('delay-' + d.key);
  cell.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') showTooltip(d.key);
  });
  cell.addEventListener('pointerleave', () => {
    if (pinnedTooltip !== d.key && !cell.contains(document.activeElement)) showTooltip(pinnedTooltip);
  });
  button.addEventListener('focus', () => showTooltip(d.key));
  button.addEventListener('blur', () => {
    if (pinnedTooltip !== d.key && !cell.matches(':hover')) showTooltip(pinnedTooltip);
  });
  button.addEventListener('click', () => {
    pinnedTooltip = pinnedTooltip === d.key ? null : d.key;
    showTooltip(pinnedTooltip);
  });
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && visibleTooltip) {
    pinnedTooltip = null;
    showTooltip(null);
  }
});
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.delay-cell')) {
    pinnedTooltip = null;
    showTooltip(null);
  }
});

function setPlaying(value) {
  playing = value;
  $('play').textContent = playing ? 'Ⅱ Pause' : '▶ Play';
  $('play').setAttribute('aria-label', playing ? 'Pause simulation' : 'Play simulation');
  lastFrame = 0;
}
function rebuild() {
  setPlaying(false);
  time = 0;
  model = simulate(params);
  for (const [id, , , , , , unit] of specs) {
    $(id).value = params[id];
    $(id + '-value').innerHTML = `${params[id]} <small>${unit === 'cars' && params[id] === 1 ? 'car' : unit}</small>`;
  }
  for (const d of delays) {
    $('value-' + d.key).innerHTML = `${num(model[d.key])} <small>s</small>`;
    $('calculation-' + d.key).textContent = d.calculation();
  }
  $('delay-bar').innerHTML = delays.map(d => `<span class="bar-part" style="background:${d.color};width:${model[d.key] / model.total * 100}%" title="${d.name}: ${num(model[d.key])} s"></span>`).join('');
  $('sum-result').textContent = num(model.total) + ' s';
  $('total-result').innerHTML = `${Math.floor(model.total / 60)}<span>min</span> ${num(model.total % 60)}<span>s</span>`;
  $('first-result').textContent = duration(model.firstArrival);
  $('distance-label').textContent = params.distance + ' km';
  $('speed-label').textContent = params.speed + ' km/h →';
  $('duration').textContent = '/ ' + clock(model.total);
  $('scrub').max = model.total;
  $('cars').innerHTML = model.cars.map(c => `<g id="car-${c.id}"><use href="#car"/><text y="-17" text-anchor="middle" style="font:9px monospace;fill:#8292b2">${String(c.id).padStart(2, '0')}</text></g>`).join('');
  $('car-timeline').innerHTML = model.cars.map(c => `<div class="car-row"><span>${String(c.id).padStart(2, '0')}</span><div class="car-track"><i style="left:${(c.depart - params.service) / model.total * 100}%;width:${params.service / model.total * 100}%"></i><i class="prop-track" style="left:${c.depart / model.total * 100}%;width:${model.prop / model.total * 100}%"></i><b class="time-cursor"></b></div></div>`).join('') + `<div class="timeline-axis"><span>00:00</span><span>${clock(model.total / 2)}</span><span>${clock(model.total)}</span></div>`;
  render();
}
function render() {
  const departed = model.cars.filter(c => time >= c.depart).length;
  const arrived = model.cars.filter(c => time >= c.arrive).length;
  const waiting = params.count - departed;
  for (const c of model.cars) {
    let x, y = 185, color = '#a5b1ca';
    if (time >= c.arrive) {
      x = 780 - (c.id - 1) * Math.min(25, 242 / Math.max(1, params.count - 1));
      y = 217;
      color = '#508b7b';
    } else if (time >= c.depart) {
      x = 313 + (time - c.depart) / model.prop * 467;
      color = '#2449cf';
    } else {
      x = 277 - (c.id - departed - 1) * Math.min(27, 242 / Math.max(1, params.count - 1));
      if (c.id === departed + 1 && time >= model.start) color = '#2449cf';
    }
    const g = $('car-' + c.id);
    g.setAttribute('transform', `translate(${x},${y})`);
    g.style.color = color;
    g.querySelector('text').style.opacity = (time >= c.depart && time < c.arrive && params.service / model.prop * 467 < 28 && c.id !== departed) ? '0' : '1';
    g.setAttribute('aria-label', `Car ${c.id}: ${time >= c.arrive ? 'arrived' : time >= c.depart ? 'traveling' : 'not departed'}`);
  }
  $('waiting').textContent = waiting;
  $('traveling').textContent = departed - arrived;
  $('arrived').textContent = arrived;
  $('clock').textContent = clock(time);
  $('scrub').value = time;
  $('scrub').setAttribute('aria-valuetext', duration(time));
  document.querySelectorAll('.time-cursor').forEach(e => e.style.left = time / model.total * 100 + '%');
  const phase = phaseAt(time, model);
  const names = { processing: 'Processing packet', queue: 'Waiting for other traffic', transmission: 'Transmitting at booth A', propagation: 'Propagating along the road', complete: 'All cars arrived' };
  $('state').textContent = time === 0 ? 'Ready to depart' : names[phase];
  let title, text;
  if (time === 0) {
    title = `${params.count} ${params.count === 1 ? 'car is' : 'cars are'} ready to depart.`;
    text = 'Press Play, or use Next event to explore one step at a time.';
  } else if (phase === 'processing') {
    title = 'Checking the caravan before transmission.';
    text = `The ${params.processing} s processing delay applies once to the whole packet.`;
  } else if (phase === 'queue') {
    title = 'Other traffic is using the toll booth.';
    text = `This caravan starts transmission at ${duration(model.start)}.`;
  } else if (phase === 'complete') {
    title = `All cars arrived in ${duration(model.total)}.`;
    text = `Processing ${num(params.processing)} + queueing ${num(params.queue)} + transmission ${num(model.tx)} + propagation ${num(model.prop)} = ${num(model.total)} s`;
  } else if (arrived > 0 && waiting > 0) {
    title = `${arrived} arrived · ${waiting} ${waiting === 1 ? 'car has' : 'cars have'} yet to depart.`;
    text = 'Transmission and propagation overlap. Earlier bits do not wait for the last bit to leave.';
  } else if (phase === 'transmission') {
    title = `${departed} departed · ${waiting} waiting at the toll booth.`;
    text = `One car leaves every ${params.service} s. Each car starts traveling as soon as it is released.`;
  } else {
    title = arrived ? `${arrived} arrived · ${params.count - arrived} still traveling.` : 'The last car has left booth A and is now traveling.';
    text = `Transmission is complete, but propagation continues. Each car takes ${duration(model.prop)} to cross the link.`;
  }
  $('moment-title').textContent = title;
  $('moment-text').textContent = text;
}

$('play').addEventListener('click', () => {
  if (time >= model.total) time = 0;
  setPlaying(!playing);
  render();
});
$('reset').addEventListener('click', () => { setPlaying(false); time = 0; render(); });
$('step').addEventListener('click', () => {
  setPlaying(false);
  time = model.events.find(e => e.time > time + 1e-6)?.time ?? model.total;
  render();
});
$('scrub').addEventListener('input', () => { setPlaying(false); time = Number($('scrub').value); render(); });
$('play-speed').addEventListener('change', () => $('time-hint').textContent = `1 real second = ${$('play-speed').value} simulated seconds`);
function applyPreset(name) {
  params = { ...presets[name] };
  $('preset').value = name;
  $('preset-caption').textContent = {
    classic: 'Week 2 · p.51 — Transmission vs propagation',
    fast: 'Week 2 · p.52 — Overlapping delays',
    congestion: 'Extended model — Processing 30 s + queueing 90 s',
  }[name];
  document.querySelector('.extra-settings').open = name === 'congestion';
  rebuild();
}
$('preset').addEventListener('change', () => applyPreset($('preset').value));
function selectView(view) {
  const road = view === 'road';
  $('road-view').hidden = !road;
  $('time-view').hidden = road;
  $('road-tab').setAttribute('aria-selected', road);
  $('time-tab').setAttribute('aria-selected', !road);
  $('road-tab').tabIndex = road ? 0 : -1;
  $('time-tab').tabIndex = road ? -1 : 0;
}
for (const view of ['road', 'time']) {
  $(view + '-tab').addEventListener('click', () => selectView(view));
  $(view + '-tab').addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const next = e.key === 'Home' ? 'road' : e.key === 'End' ? 'time' : view === 'road' ? 'time' : 'road';
      selectView(next);
      $(next + '-tab').focus();
    }
  });
}
function frame(now) {
  if (playing) {
    if (lastFrame) {
      time = Math.min(model.total, time + Math.min((now - lastFrame) / 1000, .1) * Number($('play-speed').value));
      if (time >= model.total) setPlaying(false);
      render();
    }
    lastFrame = now;
  }
  requestAnimationFrame(frame);
}
rebuild();
selectView('road');
requestAnimationFrame(frame);
