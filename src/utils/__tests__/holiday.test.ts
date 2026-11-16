import { describe, expect, it } from "vitest";
import { getEventName, getJapaneseHolidayName, isJapaneseHoliday as h } from "../holiday";

const list = (y: number) => {
  const r: string[] = [];
  for (let m = 1; m <= 12; m++)
    for (let d = 1; d <= 31; d++) {
      if (new Date(y, m - 1, d).getMonth() !== m - 1) continue;
      if (h(y, m, d)) r.push(`${m}/${d}`);
    }
  return r.join(" ");
};

describe("isJapaneseHoliday", () => {
  it("2024年", () => {
    expect(list(2024)).toBe(
      "1/1 1/8 2/11 2/12 2/23 3/20 4/29 5/3 5/4 5/5 5/6 7/15 8/11 8/12 9/16 9/22 9/23 10/14 11/3 11/4 11/23",
    );
  });
  it("2025年", () => {
    expect(list(2025)).toBe(
      "1/1 1/13 2/11 2/23 2/24 3/20 4/29 5/3 5/4 5/5 5/6 7/21 8/11 9/15 9/23 10/13 11/3 11/23 11/24",
    );
  });
  it("2026年（国民の休日 9/22 を含む）", () => {
    expect(list(2026)).toBe(
      "1/1 1/12 2/11 2/23 3/20 4/29 5/3 5/4 5/5 5/6 7/20 8/11 9/21 9/22 9/23 10/12 11/3 11/23",
    );
  });
});

describe("名称", () => {
  it("祝日名・振替休日・国民の休日", () => {
    expect(getJapaneseHolidayName(2026, 1, 1)).toBe("元日");
    expect(getJapaneseHolidayName(2026, 5, 6)).toBe("振替休日");
    expect(getJapaneseHolidayName(2026, 9, 22)).toBe("国民の休日");
    expect(getJapaneseHolidayName(2026, 12, 25)).toBeNull();
  });
  it("イベント名", () => {
    expect(getEventName(2026, 12, 25)).toBe("クリスマス");
    expect(getEventName(2026, 10, 31)).toBe("ハロウィン");
    expect(getEventName(2026, 5, 10)).toBe("母の日");
    expect(getEventName(2026, 6, 21)).toBe("父の日");
    expect(getEventName(2026, 4, 2)).toBeNull();
  });
});