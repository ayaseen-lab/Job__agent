function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

// Fast minimal delays
export const DELAY_RANGES = {
  short: [500, 1000],
  medium: [1000, 2000],
  between_jobs: [2000, 3500],
  page_load: [1500, 2500],
};

export function getDelay(type = 'medium') {
  const range = DELAY_RANGES[type] || DELAY_RANGES.medium;
  return randomBetween(range[0], range[1]);
}

export async function pause(type = 'medium', shouldAbort = () => false) {
  const delay = getDelay(type);
  const step = 200;
  let elapsed = 0;
  while (elapsed < delay) {
    if (shouldAbort()) return;
    const wait = Math.min(step, delay - elapsed);
    await new Promise((r) => setTimeout(r, wait));
    elapsed += wait;
  }
}

export async function fastFill(locator, text) {
  await locator.click();
  await locator.fill(text);
}

export async function fastClick(locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click();
}
