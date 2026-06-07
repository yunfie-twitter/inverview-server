import type { CSSProperties, ReactNode } from "react";
import { Card, makeStyles } from "@fluentui/react-components";

interface StateCardProps {
  children: ReactNode;
  className?: string;
  centered?: boolean;
  padding?: CSSProperties["padding"];
}

const useStyles = makeStyles({
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  centered: {
    alignItems: "center",
    textAlign: "center",
  },
});

export const StateCard = ({
  children,
  className,
  centered = false,
  padding = "20px",
}: StateCardProps): JSX.Element => {
  const styles = useStyles();

  return (
    <Card
      appearance="outline"
      className={[styles.card, centered ? styles.centered : "", className].filter(Boolean).join(" ")}
      style={{ padding }}
    >
      {children}
    </Card>
  );
};
