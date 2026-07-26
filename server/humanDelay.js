function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export const DELAY_RANGES = {
  short: [2000, 4500],
  medium: [5000, 10000],
  long: [12000, 22000],
  between_jobs: [20000, 40000],
  page_read: [4000, 9000],
  after_login: [3000, 6000],
  before_click: [800, 2000],
  form_field: [1500, 3500],
  after_submit: [5000, 10000],
  typing_char: [40, 120],
};

export function getDelay(type = 'medium') {
  const range = DELAY_RANGES[type] || DELAY_RANGES.medium;
  return randomBetween(range[0], range[1]);
}

export async function humanDelay(type = 'medium', onWait) {
  const ms = getDelay(type);
  onWait?.(`Pacing: waiting ${(ms / 1000).toFixed(1)}s`);
  await new Promise((r) => setTimeout(r, ms));
  return ms;
}

export async function humanScroll(page) {
  const scrollAmount = randomBetween(200, 600);
  await page.evaluate((y) => window.scrollBy(0, y), scrollAmount);
  await new Promise((r) => setTimeout(r, randomBetween(500, 1500)));
}

export async function humanType(page, locator, text) {
  await locator.click();
  await new Promise((r) => setTimeout(r, randomBetween(300, 800)));

  const chunkSize = randomBetween(3, 8);
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    await locator.pressSequentially(chunk, { delay: randomBetween(40, 120) });
    if (Math.random() < 0.15) {
      await new Promise((r) => setTimeout(r, randomBetween(200, 600)));
    }
  }
}

export async function humanClick(page, locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await new Promise((r) => setTimeout(r, randomBetween(500, 1500)));
  const box = await locator.boundingBox().catch(() => null);
  if (box) {
    const x = box.x + box.width * (0.3 + Math.random() * 0.4);
    const y = box.y + box.height * (0.3 + Math.random() * 0.4);
    await page.mouse.move(x, y, { steps: randomBetween(5, 15) });
    await new Promise((r) => setTimeout(r, randomBetween(100, 400)));
  }
  await locator.click();
}
