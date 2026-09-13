"use client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useMotionAllowed } from "./Experience";
import s from "./landing.module.css";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function ScrollMotion() {
  const motion = useMotionAllowed();
  useGSAP(
    () => {
      if (!motion) return;
      const page = document.querySelector(`.${s.page}`);
      if (!page) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Text stays visible even if JS fails. Motion establishes the reading order.
        page.querySelectorAll("[data-reveal]").forEach((el) =>
          gsap.from(el, {
            y: 32,
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 92%", once: true },
          }),
        );
        if (matchMedia("(min-width: 768px)").matches) {
          gsap.from(page.querySelectorAll("[data-building]"), {
            y: 65,
            stagger: 0.1,
            ease: "none",
            scrollTrigger: {
              trigger: `.${s.buildLandscape}`,
              start: "top bottom",
              end: "center center",
              scrub: 1,
            },
          });
          gsap.fromTo(
            `.${s.paper}`,
            { y: 34 },
            {
              y: -24,
              ease: "none",
              scrollTrigger: {
                trigger: `.${s.letters}`,
                start: "top bottom",
                end: "center center",
                scrub: 1,
              },
            },
          );
        }
      });
      return () => mm.revert();
    },
    { dependencies: [motion], revertOnUpdate: true },
  );
  return null;
}
