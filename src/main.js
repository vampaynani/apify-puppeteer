// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/).
import { Actor } from "apify";
// this is ESM project, and as such, it requires you to specify extensions in your relative imports
// read more about this here: https://nodejs.org/docs/latest-v18.x/api/esm.html#mandatory-file-extensions
// import { router } from './routes.js'
import { PuppeteerCrawler } from "crawlee";

await Actor.init();

const crawler = new PuppeteerCrawler({
  async requestHandler({ page, request }) {
    await page.goto(request.url);

    console.info("Authorizing cookies...");
    await page.waitForSelector(".sc-eec3bcfd-2", { visible: true });
    await page.click(".sc-eec3bcfd-2 button:nth-child(2)");

    console.info("Extract categories with their items");
    const categories = await page.$$eval(".sc-3fa27536-0", (categories) => {
      function getItems(category) {
        const itemsEl = category.querySelectorAll(".sc-62beaeae-0");
        const items = Array.from(itemsEl).map((item) => {
          const name = item.querySelector(".sc-866b5984-2").textContent;
          const description = item.querySelector(".sc-866b5984-0").textContent;
          const price =
            item.querySelector(".sc-750cb459-3")?.textContent ?? "PLN 0.0";
          return { name, description, price };
        });
        return items;
      }
      return categories.map((category) => {
        const name = category.querySelector("h2").textContent;
        const items = getItems(category);
        return { name, items };
      });
    });
    console.info(`${Object.keys(categories).length} categories extracted`);
    for (let category of categories) {
      if (category.items) {
        for (let categoryItem of category.items) {
          console.info(
            `Extract ${category.name}/${categoryItem.name} child modifiers with their child items...`
          );
          const categoryItemElem = await page.$x(
            `//button[contains(.,"${categoryItem.name}")]`
          );
          await categoryItemElem[0].evaluate((el) => el.click());
          await page.waitForSelector(".sc-59932752-4", { visible: true });
          const childModifiers = await page.$eval(".sc-59932752-4", (modal) => {
            const childModifiersEl = modal.querySelectorAll(".sc-32952ef4-0");
            return Array.from(childModifiersEl).map((childModifier) => {
              let min_selection = 0;
              let max_selection = 0;
              const name = childModifier.querySelector("legend")?.textContent;
              const inputType = childModifier.querySelector("input")?.type;
              if (inputType === "radio") {
                min_selection = 1;
                max_selection = 1;
              }
              const childItemsEl =
                childModifier.querySelectorAll(".sc-b1d4473c-0");
              const child_items = Array.from(childItemsEl).map((childItem) => {
                const name =
                  childItem.querySelector(".sc-7f7800c6-0").textContent;
                const price =
                  childItem.querySelector(".sc-63e36ce8-0")?.textContent ||
                  "+PLN 0.00";
                return { name, price };
              });
              if (name) {
                return { name, min_selection, max_selection, child_items };
              }
            });
          });
          categoryItem.child_modifiers = childModifiers;
          console.info(
            `${Object.keys(childModifiers).length} child modifiers extracted`
          );
        }
      }
    }
    await Actor.pushData(categories);
  },
});
// Save headings to Dataset - a table-like storage.
await crawler.run([
  "https://wolt.com/en/pol/lublin/restaurant/bafra-kebab-prusa",
]);

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit().
await Actor.exit();
