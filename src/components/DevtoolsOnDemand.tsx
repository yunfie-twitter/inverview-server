import { useEffect, useState } from "react";
import type { ComponentType } from "react";

interface DevtoolsOnDemandProps {
  runWhenIdle: (task: () => void) => void;
}

export const DevtoolsOnDemand = ({ runWhenIdle }: DevtoolsOnDemandProps): JSX.Element | null => {
  const [DevtoolsComponent, setDevtoolsComponent] = useState<ComponentType<{ initialIsOpen?: boolean }> | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    runWhenIdle(() => {
      void import("@tanstack/react-query-devtools").then(({ ReactQueryDevtools }) => {
        setDevtoolsComponent(() => ReactQueryDevtools);
      });
    });
  }, [runWhenIdle]);

  if (!DevtoolsComponent) return null;
  return <DevtoolsComponent initialIsOpen={false} />;
};
