# Network Lab

An interactive English-language lesson on network delay using the caravan analogy.

## Run locally

Serve this folder using `python3 -m http.server 5173`, then open http://localhost:5173.

## GitHub Pages

In this repository's Settings → Pages, choose **Deploy from a branch**, select **main**, and select **/(root)**. Save the setting. The site is a static application and needs no build or package installation.

## Features

- Animated road view and per-car timeline
- Play, pause, next event, time scrubbing, and playback speed
- Classic, faster-car, and processing/congestion scenarios
- Adjustable car count, service time, distance, speed, processing, and queueing
- Hover, focus, or tap the four delays for definitions, formulas, and calculated values

## Model

One car represents one bit; the whole caravan represents one packet. Processing and other-traffic queueing apply once to the whole packet. Car i departs at P + Q + iS and arrives after an additional distance/speed travel time. The simulation ends when the last car reaches the front of the second toll booth.

The classic example takes 62 minutes. In the faster-car example, the first car arrives after 7 minutes while three cars have yet to depart; the last car arrives after 16 minutes.

The interface uses Google Fonts with system-font fallbacks. No backend, login, or database is required.
