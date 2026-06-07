/**
 * 渡されたアイテムの配列に対して、非同期処理を並行数制限付きで実行します。
 * Promise.allSettled と同様の結果オブジェクトの配列を返します。
 *
 * @param items 処理対象のアイテム配列
 * @param limit 最大並行実行数
 * @param fn 各アイテムを処理する非同期関数
 */
export async function settledWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const currentIdx = index++;
      const item = items[currentIdx];
      try {
        const val = await fn(item);
        results[currentIdx] = { status: "fulfilled", value: val };
      } catch (err) {
        results[currentIdx] = { status: "rejected", reason: err };
      }
    }
  };

  // アイテム数またはリミットの小さい方でワーカー数（並行実行タスク）を決定
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
