import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingGrid } from "./LoadingGrid";

interface QueryStateViewProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  loadingCount?: number;
  errorTitle: string;
  errorMessage: string;
  emptyTitle: string;
  emptyDescription: string;
  onRetry: () => void;
  children: ReactNode;
}

export const QueryStateView = ({
  isLoading,
  isError,
  isEmpty,
  loadingCount,
  errorTitle,
  errorMessage,
  emptyTitle,
  emptyDescription,
  onRetry,
  children,
}: QueryStateViewProps): JSX.Element => {
  if (isLoading) return <LoadingGrid count={loadingCount} />;
  if (isError) {
    return <ErrorState title={errorTitle} message={errorMessage} onRetry={onRetry} />;
  }
  if (isEmpty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return <>{children}</>;
};
