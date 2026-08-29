/** Serviceavgift per beställning baserat på biljettbelopp (efter rabatt). */
export const DEFAULT_SERVICE_FEE_TIERS = [
  { minAmount: 0, maxAmount: 499, fee: 15 },
  { minAmount: 500, maxAmount: 999, fee: 25 },
  { minAmount: 1000, maxAmount: 2000, fee: 35 },
  { minAmount: 2001, maxAmount: null, fee: 45 }
];

const parseTierNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100) / 100;
};

export const normalizeServiceFeeTier = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const minAmount = parseTierNumber(raw.minAmount);
  const maxAmount = parseTierNumber(raw.maxAmount);
  const fee = parseTierNumber(raw.fee);
  if (minAmount == null || fee == null || minAmount < 0 || fee < 0) return null;
  if (maxAmount != null && maxAmount < minAmount) return null;
  return { minAmount, maxAmount, fee };
};

export const normalizeServiceFeeTiers = (input) => {
  if (!Array.isArray(input) || input.length === 0) {
    return DEFAULT_SERVICE_FEE_TIERS.map((tier) => ({ ...tier }));
  }
  const tiers = input.map(normalizeServiceFeeTier).filter(Boolean);
  if (tiers.length === 0) {
    return DEFAULT_SERVICE_FEE_TIERS.map((tier) => ({ ...tier }));
  }
  tiers.sort((a, b) => a.minAmount - b.minAmount);
  return tiers;
};

const roundMoney = (value) => Math.round(value * 100) / 100;

/** Matchar mot nivåns startbelopp (minAmount) så att decimaler efter rabatt alltid träffar rätt. */
export const calcServiceFeeAmount = (ticketAmount, tiers = DEFAULT_SERVICE_FEE_TIERS) => {
  const amount = roundMoney(
    typeof ticketAmount === "number" && Number.isFinite(ticketAmount) ? ticketAmount : 0
  );
  if (amount <= 0) return 0;
  const activeTiers = normalizeServiceFeeTiers(tiers);
  for (let i = activeTiers.length - 1; i >= 0; i--) {
    const tier = activeTiers[i];
    if (amount >= tier.minAmount) {
      return tier.fee;
    }
  }
  return 0;
};

export const validateServiceFeeTiers = (input) => {
  const tiers = normalizeServiceFeeTiers(input);
  if (tiers.length === 0) {
    return { ok: false, error: "Minst en nivå krävs." };
  }
  if (tiers[0].minAmount !== 0) {
    return { ok: false, error: "Första nivån måste börja på 0 kr." };
  }
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const isLast = i === tiers.length - 1;
    if (!isLast) {
      if (tier.maxAmount == null) {
        return { ok: false, error: "Endast sista nivån får sakna övre gräns." };
      }
      const next = tiers[i + 1];
      if (next.minAmount !== tier.maxAmount + 1) {
        return {
          ok: false,
          error: "Nivåerna måste följa direkt efter varandra utan glapp (t.ex. 0–499 kr, därefter 500–999 kr)."
        };
      }
    } else if (tier.maxAmount != null) {
      return { ok: false, error: "Sista nivån ska sakna övre gräns (obegränsad)." };
    }
  }
  return { ok: true, tiers };
};

export const formatServiceFeeTierLabel = (tier) => {
  const feeLabel = `${tier.fee} kr`;
  if (tier.maxAmount == null) {
    return `Från ${tier.minAmount.toLocaleString("sv-SE")} kr: ${feeLabel}`;
  }
  if (tier.minAmount <= 0) {
    return `Under ${(tier.maxAmount + 1).toLocaleString("sv-SE")} kr: ${feeLabel}`;
  }
  return `${tier.minAmount.toLocaleString("sv-SE")}–${tier.maxAmount.toLocaleString("sv-SE")} kr: ${feeLabel}`;
};

export const buildServiceFeeTierLines = (tiers = DEFAULT_SERVICE_FEE_TIERS) =>
  normalizeServiceFeeTiers(tiers).map((tier) => formatServiceFeeTierLabel(tier));

export const serviceFeeTiersToFormRows = (tiers = DEFAULT_SERVICE_FEE_TIERS) =>
  normalizeServiceFeeTiers(tiers).map((tier) => ({
    minAmount: String(tier.minAmount),
    maxAmount: tier.maxAmount == null ? "" : String(tier.maxAmount),
    fee: String(tier.fee)
  }));

export const serviceFeeTiersFromFormRows = (rows) => {
  const tiers = (Array.isArray(rows) ? rows : []).map((row, index, allRows) => {
    const isLast = index === allRows.length - 1;
    return {
      minAmount: row.minAmount,
      maxAmount: isLast ? null : row.maxAmount,
      fee: row.fee
    };
  });
  return validateServiceFeeTiers(tiers);
};
