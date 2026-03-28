import { Page, ElementHandle } from "playwright";
import { Place } from "../types/place";
import { extractPlaceFromCard } from "./extractFromCard";

/**
 * Random delay giữa min-max ms (chống detect bot)
 */
function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Crawl Google Maps LIST (CARD ONLY)
 * - Scroll incremental + random delay
 * - Stuck detection tăng lên 5 rounds
 * - skipCount: bỏ qua N kết quả đầu (dùng cho resume crawling)
 */
export async function crawlWithAutoScroll(
  page: Page,
  limit: number,
  skipCount: number = 0
): Promise<Place[]> {
  const results: Place[] = [];
  const seenUrls = new Set<string>();

  let stuckRounds = 0;
  const MAX_STUCK = 5;
  let skipped = 0;

  if (skipCount > 0) {
    console.log(`⏩ Resume mode: skipping first ${skipCount} results`);
  }

  while (results.length < limit) {
    console.log(`🔄 Loop | current=${results.length}/${limit}`);

    // 📍 Handle single place redirect (no feed/list)
    const hasFeed = await page.$('div[role="feed"]');
    if (!hasFeed) {
      const hasLink = await page.$("a.hfpxzc");
      if (!hasLink) {
        // Có thể là single place detail → extract trực tiếp
        const detailPanel = await page.$("div.tAiQdd");
        if (detailPanel) {
          console.log("📍 Single place detected (no feed) → extracting from detail panel");
          const { extractPlace } = await import("./extract");
          const place = await extractPlace(page);
          if (place?.name) {
            place.url = page.url();
            results.push(place);
          }
          break;
        }
      }
    }

    // ⏳ chờ feed load
    await page.waitForSelector('div[role="feed"]', {
      timeout: 20000,
    });

    const links = await page.$$("a.hfpxzc");

    let newFoundThisRound = 0;

    for (const link of links) {
      if (results.length >= limit) break;

      try {
        const href = await link.getAttribute("href");
        if (!href || seenUrls.has(href)) continue;

        await link.scrollIntoViewIfNeeded();
        await page.waitForTimeout(randomDelay(100, 300));

        /**
         * 🔥 LẤY CARD CHA (div[role="article"])
         */
        const card = (await link.evaluateHandle((el) =>
          el.closest('div[role="article"]')
        )) as ElementHandle<Element> | null;

        if (!card) continue;

        /**
         * 🔥 Extract semantic từ CARD
         */
        const place = await extractPlaceFromCard(card);
        if (!place?.name) continue;

        place.url = href;
        seenUrls.add(href);

        // ⏩ Skip nếu đang trong resume mode
        if (skipped < skipCount) {
          skipped++;
          if (skipped % 50 === 0 || skipped === skipCount) {
            console.log(`⏩ Skipped ${skipped}/${skipCount}`);
          }
          continue;
        }

        results.push(place);
        newFoundThisRound++;

        console.log(`✅ ${results.length}. ${place.name}`);
      } catch {
        continue;
      }
    }

    // 📜 scroll incremental (cuộn theo bước thay vì nhảy cuối)
    await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (feed) {
        // Cuộn thêm 1500px thay vì nhảy hết
        feed.scrollTop += 1500;
      }
    });

    // Random delay giữa mỗi scroll (1-2 giây)
    await page.waitForTimeout(randomDelay(1000, 2000));

    // 🧠 detect stuck
    if (newFoundThisRound === 0) {
      stuckRounds++;
      console.log(`⚠️ No new data (stuck=${stuckRounds}/${MAX_STUCK})`);

      // Thử scroll thêm 1 lần nữa xuống cuối
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollTop = feed.scrollHeight;
      });
      await page.waitForTimeout(2000);

    } else {
      stuckRounds = 0;
    }

    if (stuckRounds >= MAX_STUCK) {
      console.log("🛑 No more data, stop crawling");
      break;
    }
  }

  console.log(`📊 Crawl finished: ${results.length} results`);
  return results;
}