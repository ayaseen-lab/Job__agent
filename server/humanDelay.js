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

export async function pause(type = 'medium') {
  await new Promise((r) => setTimeout(r, getDelay(type)));
}

export async function fastFill(locator, text) {
  await locator.click();
  await locator.fill(text);
}

export async function fastClick(locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click();
}
