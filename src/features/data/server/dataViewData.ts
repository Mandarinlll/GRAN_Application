// データタブ（GRAN_Data_Tab）のビューモデル組み立ての薄い委譲ラッパ（Server）。
//
// OOP 化（oop-architecture.md §2.5 / §5）に伴い、組み立てロジックは
// data/application/DataViewService へ移設し、集計素材の取得は SqliteDataRepository が、
// 整列・分布・期間算出は data/domain の Domain Service が担う。本モジュールは、まだ OOP 化前の
// 呼び出し元（app/(user)/data/page.tsx が buildDataViewData を、DataTabView.tsx が DataViewData 型を
// 参照）を壊さないための薄い委譲ラッパとして、buildDataViewData と DataViewData を残置する。

import { createDataViewService } from "@/server/container";
import type { CurrentUser } from "@/types/home";

// 戻り値型 DataViewData は Server Action 戻り値型（§11 外部契約）として引き続き公開する。
export type { DataViewData } from "@/features/data/application/DataViewService";

// データタブ全体のビューモデルを組み立てる（Server）。
export function buildDataViewData(
  viewer: CurrentUser,
  viewerId: string,
): import("@/features/data/application/DataViewService").DataViewData {
  return createDataViewService().buildDataViewData(viewer, viewerId);
}
