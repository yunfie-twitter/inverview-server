import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  DialogTrigger,
  Button,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import type React from "react";

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "small" | "medium" | "large";
}

const useStyles = makeStyles({
  surface: {
    maxWidth: "500px",
    width: "90%",
    borderRadius: "12px",
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    boxShadow: tokens.shadow28,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    marginBottom: "16px",
  },
  body: {
    padding: "0",
  },
  footer: {
    marginTop: "20px",
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
  },
});

/**
 * A reusable, premium-styled modal component that matches the app's design system using Fluent UI v9.
 */
export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "medium",
}) => {
  const styles = useStyles();

  return (
    <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className={styles.surface}>
        <div className={styles.header}>
          {title && <DialogTitle>{title}</DialogTitle>}
          <DialogTrigger disableButtonEnhancement>
            <Button
              appearance="subtle"
              icon={<Dismiss24Regular />}
              aria-label="Close"
              onClick={onClose}
            />
          </DialogTrigger>
        </div>
        <DialogBody className={styles.body}>
          <DialogContent>{children}</DialogContent>
          {footer && <div className={styles.footer}>{footer}</div>}
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
