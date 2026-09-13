import { ScrollTrigger } from "gsap/ScrollTrigger";

let pending: number | undefined;

// Renderers become ready independently. Recalculate all pins in document order
// after React has committed their spacers, including when motion is disabled.
export function refreshScrollLayout() {
  if (pending !== undefined) cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    pending = undefined;
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  });
}
