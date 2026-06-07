import { useEffect, useState } from "react";

export const useKeyboardNavigationMode = (): boolean => {
  const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        setIsKeyboardNavigating(true);
      }
    };

    const onPointerDown = () => {
      setIsKeyboardNavigating(false);
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  return isKeyboardNavigating;
};
