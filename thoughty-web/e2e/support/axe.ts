import { AxeBuilder as BaseAxeBuilder } from '@axe-core/playwright';

type AxeParams = ConstructorParameters<typeof BaseAxeBuilder>[0];

/**
 * Resolves once no finite CSS animation or transition is running in the page, waiting again for any
 * that start meanwhile. Endless ones (spinners) are left alone: they never settle.
 */
async function settleAnimations(page: AxeParams['page']) {
  await page.evaluate(async () => {
    const running = () =>
      document.getAnimations().filter((animation) =>
        animation.playState === 'running' && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)));
    for (let pending = running(); pending.length > 0; pending = running()) {
      await Promise.all(pending.map((animation) => animation.finished.catch(() => undefined)));
    }
  });
}

/**
 * Every spec scans with this AxeBuilder rather than the package's: it waits for the page's
 * animations to finish before the scan. axe reads opacity into contrast, so a dialog scanned while
 * it fades in reports text that is fine at rest (the Highlights dialog's 0.3s slide-up failed the
 * #64748b card dates at 97% opacity).
 */
export default class AxeBuilder extends BaseAxeBuilder {
  private readonly scannedPage: AxeParams['page'];

  constructor(params: AxeParams) {
    super(params);
    this.scannedPage = params.page;
  }

  override async analyze() {
    await settleAnimations(this.scannedPage);
    return super.analyze();
  }
}
