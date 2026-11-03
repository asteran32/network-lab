// All model times are seconds; distance is km and propagation speed is km/h.
// One car is one bit, and the whole caravan is one packet. Per-car toll
// service therefore models transmission, including the 60 s example whose
// original slide labels that service "processing delay" inconsistently.
// Processing and externally caused queueing apply once to the whole packet.
// Waiting behind other bits in the same packet is already part of transmission.
// The destination is immediately BEFORE the second toll booth: no second-hop
// service or forwarding delay is included. Cars propagate as soon as released.

export const presets = Object.freeze({
  classic: Object.freeze({ count: 10, service: 12, distance: 100, speed: 100, processing: 0, queue: 0 }),
  fast: Object.freeze({ count: 10, service: 60, distance: 100, speed: 1000, processing: 0, queue: 0 }),
  congestion: Object.freeze({ count: 10, service: 12, distance: 100, speed: 100, processing: 30, queue: 90 }),
});

export function simulate(params) {
  const { count, service, distance, speed, processing, queue } = params;
  for (const [name, value] of Object.entries({ count, service, distance, speed, processing, queue })) {
    if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
  }
  if (!Number.isInteger(count) || count < 1) throw new RangeError('count must be a positive integer');
  if (service <= 0 || speed <= 0) throw new RangeError('service and speed must be positive');
  if (distance < 0 || processing < 0 || queue < 0) throw new RangeError('distance, processing and queue must be non-negative');

  const tx = count * service;
  const prop = distance / speed * 3600;
  const start = processing + queue;
  const lastDeparture = start + tx;
  const total = lastDeparture + prop;
  if (!Number.isFinite(total)) throw new RangeError('parameters produce an unrepresentable duration');
  const cars = Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    const depart = start + id * service;
    return { id, depart, arrive: depart + prop };
  });
  const events = [
    { time: processing, type: 'processing-done', label: 'Processing complete' },
    { time: start, type: 'queue-done', label: 'Queueing complete · Transmission starts' },
    ...cars.flatMap(car => [
      { time: car.depart, type: 'departure', label: `Car ${car.id} departs`, car: car.id },
      { time: car.arrive, type: 'arrival', label: `Car ${car.id} arrives`, car: car.id },
    ]),
  ];
  // At exact boundaries, completed departures count as released. In the fast
  // example, car 7 departs at the same instant car 1 arrives (t = 420 s).
  const priority = { 'processing-done': 0, 'queue-done': 1, departure: 2, arrival: 3 };
  events.sort((a, b) => a.time - b.time || priority[a.type] - priority[b.type] || (a.car || 0) - (b.car || 0));
  return { tx, prop, start, total, firstArrival: cars[0].arrive, lastDeparture, processing, queue, params: { ...params }, cars, events };
}

// Overall phase follows serialization until the LAST car leaves, even when
// propagation or arrival of earlier cars overlaps. Per-car states use their
// depart/arrive times, not this overall phase.
export function phaseAt(time, model) {
  if (!Number.isFinite(time)) throw new TypeError('time must be a finite number');
  const t = Math.max(0, time);
  if (t < model.processing) return 'processing';
  if (t < model.start) return 'queue';
  if (t < model.lastDeparture) return 'transmission';
  if (t < model.total) return 'propagation';
  return 'complete';
}
