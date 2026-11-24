export function declaredWithCallback(stockLevel: StockLevel, labelOf: (status: Status) => string): string {
  return labelOf(stockLevel.status);
}

export async function declaredAsyncWithCallback(action: () => Promise<void>): Promise<void> {
  await action();
}

export const arrowWithCallback = (stockLevel: StockLevel, labelOf: (status: Status) => string): string =>
  labelOf(stockLevel.status);

export const arrowWithEmptyCallback = (onClose: () => void) => {
  onClose();
};

export const genericArrowWithCallback = <TSelected>(selector: (state: State) => TSelected) => selector(state);

export const multiLineArrowWithCallback = (
  stockLevel: StockLevel,
  labelOf: (status: Status) => string,
): string => labelOf(stockLevel.status);

export const destructuredWithCallback = ({ onClose }: { onClose: () => void }) => onClose();

export const typedConstWithCallback: Formatter = (labelOf: (status: Status) => string) => labelOf(Status.InStock);

export const nestedCallback = (run: (next: (value: string) => void) => void) => run(() => undefined);

export const defaultCallValue = (at = Date.now()) => at;

export const genericWithNestedGeneric = <TItem extends Record<string, unknown>>(items: TItem[]) => items;

export const labelOfRenamedLevel = (level: StockLevel, labelOf: (status: Status) => string): string => labelOf(level.status);

export const shownLabel = (stockLevel: StockLevel, labelOf: (status: Status) => string): string => {
  const label = labelOfRenamedLevel(stockLevel, (status) => labelOf(status));
  return label;
};

export const plainArrow = (stockLevel: StockLevel, label: string): string => `${label} ${stockLevel.status}`;

export class DownloadPage {
  async waitForDownload(action: () => Promise<void>): Promise<string> {
    await action();
    return '';
  }

  private readonly onSelect = (pick: (row: Row) => boolean) => this.rows.filter(pick);

  plainMethod(label: string): string {
    return label;
  }
}
