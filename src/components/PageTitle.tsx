import { Text } from "@fluentui/react-components";

interface PageTitleProps {
  title: string;
}

export const PageTitle = ({ title }: PageTitleProps): JSX.Element => (
  <Text size={700} weight="bold">
    {title}
  </Text>
);
