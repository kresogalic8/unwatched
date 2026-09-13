"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { useMotionAllowed } from "./Experience";
import s from "./landing.module.css";

/** Keep native details semantics while animating both opening and closing. */
export default function Disclosure({ title, children, dropdown = false, className }: {
  title: string; children: ReactNode; dropdown?: boolean; className?: string;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const target = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const motion = useMotionAllowed();

  const toggle = (open: boolean) => {
    const el = root.current, body = panel.current;
    if (!el || !body) return;
    const height = body.getBoundingClientRect().height;
    const opacity = el.open ? getComputedStyle(body).opacity : "0";
    animation.current?.cancel();
    target.current = open;
    setExpanded(open);
    if (!motion) { el.open = open; return; }
    el.open = true;
    const frames = dropdown
      ? [{ opacity, transform: `translateY(${open ? -8 : 0}px)` }, { opacity: open ? 1 : 0, transform: `translateY(${open ? 0 : -8}px)` }]
      : [{ height: `${height}px`, opacity }, { height: `${open ? body.scrollHeight : 0}px`, opacity: open ? 1 : 0 }];
    const current = body.animate(frames, { duration: open ? 260 : 190, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
    animation.current = current;
    current.onfinish = () => { el.open = open; current.cancel(); animation.current = null; };
  };

  useEffect(() => {
    if (!motion && animation.current) {
      animation.current.cancel();
      animation.current = null;
      if (root.current) root.current.open = target.current;
    }
  }, [motion]);
  useEffect(() => () => animation.current?.cancel(), []);
  useEffect(() => {
    if (!dropdown || !expanded) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) toggle(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  });

  return <details ref={root} className={className} data-expanded={expanded} data-animate={motion}
    onKeyDown={event => { if (event.key === "Escape" && target.current) { event.preventDefault(); toggle(false); root.current?.querySelector("summary")?.focus(); } }}>
    <summary onClick={event => { event.preventDefault(); toggle(!target.current); }}>
      {title}<span className={s.disclosureIcon} aria-hidden="true"><Icon name="plus" size={20} /></span>
    </summary>
    <div ref={panel} className={dropdown ? undefined : s.answerClip} inert={!expanded}
      onClick={event => { if (dropdown && (event.target as HTMLElement).closest("a")) toggle(false); }}>
      {children}
    </div>
  </details>;
}
