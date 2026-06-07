import { Card, CardHeader, Text, Caption1, makeStyles, tokens } from "@fluentui/react-components";
import type { HashtagObject } from "../types/invidious";

interface HashtagCardProps {
  hashtag: HashtagObject;
}

const useStyles = makeStyles({
  card: {
    width: "100%",
  },
  title: {
    fontWeight: tokens.fontWeightBold,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  description: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
});

export const HashtagCard = ({ hashtag }: HashtagCardProps): JSX.Element => {
  const styles = useStyles();

  return (
    <Card className={styles.card} appearance="outline">
      <CardHeader
        header={
          <Text className={styles.title} block>
            {hashtag.title || hashtag.hashtag || "Hashtag"}
          </Text>
        }
        description={
          <Caption1 className={styles.description}>
            {hashtag.description || "関連ハッシュタグ"}
          </Caption1>
        }
      />
    </Card>
  );
};
