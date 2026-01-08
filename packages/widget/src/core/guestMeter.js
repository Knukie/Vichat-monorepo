import { getGuestMeter, setGuestMeter, resetGuestMeter } from './storage.js';

export function createGuestMeter({ config, isLoggedIn }) {
  function guestHardBlocked() {
    if (isLoggedIn()) return false;
    const meter = getGuestMeter(config);
    return meter.count >= config.guestFreeRoundSize * config.guestMaxRounds;
  }

  function bumpGuestCount() {
    if (isLoggedIn()) return;
    const meter = getGuestMeter(config);
    meter.count += 1;
    setGuestMeter(meter, config);
  }

  function maybePromptLoginAfterSend(openAuth) {
    if (isLoggedIn()) return;
    const meter = getGuestMeter(config);
    const threshold = (meter.roundsShown + 1) * config.guestFreeRoundSize;
    if (meter.count >= threshold && meter.roundsShown < config.guestMaxRounds) {
      meter.roundsShown += 1;
      setGuestMeter(meter, config);
      openAuth?.({ hard: meter.roundsShown >= config.guestMaxRounds });
    }
  }

  return {
    guestHardBlocked,
    bumpGuestCount,
    maybePromptLoginAfterSend,
    reset: () => resetGuestMeter(config)
  };
}
