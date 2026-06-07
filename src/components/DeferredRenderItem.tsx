import { useEffect, useRef, useState, type ReactNode } from "react";

interface DeferredRenderItemProps {
  children: ReactNode;
  estimatedHeight?: number;
  rootMargin?: string;
  disableVirtualization?: boolean;
}

export const DeferredRenderItem = ({
  children,
  estimatedHeight = 280,
  rootMargin = "300px 0px",
  disableVirtualization = false,
}: DeferredRenderItemProps): JSX.Element => {
  const [isVisible, setIsVisible] = useState(disableVirtualization);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disableVirtualization) {
      setIsVisible(true);
      return;
    }

    const target = containerRef.current;
    if (!target) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [disableVirtualization, rootMargin]);

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: isVisible ? undefined : estimatedHeight,
        contentVisibility: isVisible ? "visible" : "auto",
        containIntrinsicSize: `${estimatedHeight}px 1px`,
      }}
      onFocusCapture={() => {
        setIsVisible(true);
      }}
    >
      {isVisible ? children : null}
    </div>
  );
};
