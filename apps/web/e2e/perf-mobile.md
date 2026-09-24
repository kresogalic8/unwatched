# The town on a phone

Measured 2026-09-24 with `PERF=1 pnpm --filter @unwatched/web test:visual perf` (e2e/perf.spec.ts): a phone's screen (412×915 at 2.625×,
touch), the street at the market, frame times from requestAnimationFrame over six seconds per scene, and the town's own count of the
work in each frame (`window.__ftperf`, now including Pixi's draw as "render"). The CPU is this Mac's slowed four times, as DevTools
approximates a mid-range Android; the GPU is this Mac's (Apple M1 Max), so fill-rate costs read low and the CPU numbers are the ones to
trust. On a 120 Hz screen frame intervals come in steps of 8.3 ms, so "work" is the finer measure. Runs vary by about ten per cent.

At full speed every scene holds 120 fps with about 3 ms of work a frame. With the CPU at 4×:

| scene | before | after |
|---|---|---|
| noon, street | 39 fps, 24 ms work | 57 fps, 19 ms work |
| night, street | 31 fps, 29 ms work | 58 fps, 18 ms work |
| snow | 30 fps, 33 ms work | 57 fps, 20 ms work |
| whole island | 39 fps, 27 ms work | 58 fps, 19 ms work |
| miniature | 30 fps, 33 ms work | 41 fps, 22 ms work |

Where it went: three quarters of a slowed frame is Pixi drawing it, and a third of that was re-tessellating vector shapes redrawn every
few steps. What changed:

- The shore's foam, the wet sand and the caustics are redrawn only where the camera looks, not round the whole island.
- The animals, the gulls, the boat and the pennant are drawn once per frame; a slow frame used to step the town up to four times and redraw them on each step.
- The night's bloom costs about 6 ms a frame on a slow CPU. The town watches its own frame times: a couple of seconds of slow frames lightens the bloom (half resolution, fewer passes), more drops it, and fast frames for fifteen seconds bring it back.

Left on the table: the miniature's tilt-shift is two full-screen passes; the renderer runs at 2× on phones, which a real GPU would feel
more than this one does. A real phone is the next measurement.
