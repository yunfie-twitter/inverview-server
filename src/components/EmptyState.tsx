import {
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { StateCard } from "./StateCard";

interface EmptyStateProps {
  title: string;
  description: string;
}

const useStyles = makeStyles({
  card: {
    gap: "8px",
  },
  description: {
    color: tokens.colorNeutralForeground3,
  },
});

export const EmptyState = ({ title, description }: EmptyStateProps): JSX.Element => {
  const styles = useStyles();
  return (
    <StateCard className={styles.card} centered padding="24px">
      <Text size={400} weight="bold">
        {title}
      </Text>
      <Text className={styles.description}>
        {description}
      </Text>
    </StateCard>
  );
};
