"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: ElementType;
};

/**
 * Fades children up the first time they enter view. The reveal is written
 * straight to `data-visible` rather than held in state — nothing else depends
 * on it, so there's no reason to re-render. React emits the attribute as a
 * constant "false" and never patches it again, so the value set here survives.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const show = () => {
      node.dataset.visible = "true";
    };

    if (typeof IntersectionObserver === "undefined") {
      show();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        show();
        observer.disconnect();
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-visible="false"
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
      className={`reveal ${className}`}
    >
      {children}
    </Tag>
  );
}
