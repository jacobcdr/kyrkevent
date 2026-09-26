/** SIE typ 4 (PC8/CP437) för import i Fortnox. */

const CP437_EXTRA = {
  Ç: 0x80,
  ü: 0x81,
  é: 0x82,
  â: 0x83,
  ä: 0x84,
  à: 0x85,
  å: 0x86,
  ç: 0x87,
  ê: 0x88,
  ë: 0x89,
  è: 0x8a,
  ï: 0x8b,
  î: 0x8c,
  ì: 0x8d,
  Ä: 0x8e,
  Å: 0x8f,
  É: 0x90,
  æ: 0x91,
  Æ: 0x92,
  ô: 0x93,
  ö: 0x94,
  ò: 0x95,
  û: 0x96,
  ù: 0x97,
  ÿ: 0x98,
  Ö: 0x99,
  Ü: 0x9a,
  á: 0xa0,
  í: 0xa1,
  ó: 0xa2,
  ú: 0xa3,
  ñ: 0xa4,
  Ñ: 0xa5
};

export const SIE_ACCOUNTS = {
  bank: "1930",
  organizer: "2890",
  serviceFee: "6230",
  vatOut: "2611",
  payoutFee: "3041"
};

export const SIE_ACCOUNT_NAMES = {
  bank: "Företagskonto / Betallösning",
  organizer: "Övriga kortfristiga skulder",
  serviceFee: "Försäljning serviceavgifter",
  vatOut: "Utgående moms 25%",
  payoutFee: "Utbetalningsavgift"
};

const toCents = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

/**
 * Serviceavgift är inklusive moms. Delar varje order för sig och summerar,
 * så öresavrundning blir densamma som på kvittot.
 */
export const aggregateServiceFees = (feeAmounts, ratePercent = 25) => {
  const rate = Number(ratePercent);
  const divisor = 100 + (Number.isFinite(rate) && rate > 0 ? rate : 0);
  let inclCents = 0;
  let vatCents = 0;
  let orderCount = 0;
  for (const raw of feeAmounts || []) {
    const cents = toCents(raw);
    if (cents <= 0) continue;
    const vat = divisor > 100 ? Math.round((cents * rate) / divisor) : 0;
    inclCents += cents;
    vatCents += vat;
    orderCount += 1;
  }
  const netCents = inclCents - vatCents;
  return {
    orderCount,
    serviceFeeInclCents: inclCents,
    serviceFeeNetCents: netCents,
    serviceFeeVatCents: vatCents,
    serviceFeeIncl: inclCents / 100,
    serviceFeeNet: netCents / 100,
    serviceFeeVat: vatCents / 100
  };
};

const pad2 = (value) => String(value).padStart(2, "0");

const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Räkenskapsår som börjar t.ex. 1 november och slutar 31 oktober. */
export const fiscalYearRange = (ymd, startMonth = 11, startDay = 1) => {
  const compact = String(ymd || "").replace(/\D/g, "");
  const year = Number(compact.slice(0, 4));
  const month = Number(compact.slice(4, 6));
  const day = Number(compact.slice(6, 8));
  const monthNum = Number(startMonth) >= 1 && Number(startMonth) <= 12 ? Number(startMonth) : 11;
  const dayNum = Number(startDay) >= 1 && Number(startDay) <= 31 ? Number(startDay) : 1;
  const onOrAfterStart = month > monthNum || (month === monthNum && day >= dayNum);
  const startYear = onOrAfterStart ? year : year - 1;
  let endYear = startYear + 1;
  let endMonth = monthNum;
  let endDay = dayNum - 1;
  if (endDay < 1) {
    endMonth -= 1;
    if (endMonth < 1) {
      endMonth = 12;
      endYear -= 1;
    }
    endDay = daysInMonth(endYear, endMonth);
  }
  return {
    start: `${startYear}${pad2(monthNum)}${pad2(dayNum)}`,
    end: `${endYear}${pad2(endMonth)}${pad2(endDay)}`
  };
};

export const stockholmYmd = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  return { year, ymd: `${year}${month}${day}` };
};

const sieQuote = (value, maxLen = 200) => {
  const cleaned = String(value ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen)
    .replace(/"/g, '""');
  return `"${cleaned}"`;
};

const sieAmountFromCents = (cents) => {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
};

const sieAccount = (value, fallback) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || fallback;
};

const renderSieVoucher = ({
  companyName,
  orgNumber,
  programName = "Kyrkevent",
  programVersion = "1.0",
  voucherDate,
  voucherNumber,
  voucherText,
  series = "A",
  fiscalYearStartMonth = 11,
  fiscalYearStartDay = 1,
  accounts
}) => {
  const active = (accounts || []).filter((row) => row.cents !== 0);
  const debit = active.filter((row) => row.cents > 0).reduce((sum, row) => sum + row.cents, 0);
  const credit = active.filter((row) => row.cents < 0).reduce((sum, row) => sum + row.cents, 0);
  if (debit <= 0 || debit + credit !== 0) {
    throw new Error("SIE-verifikationen balanserar inte.");
  }

  const generated = stockholmYmd();
  const date = String(voucherDate || generated.ymd).replace(/\D/g, "");
  const fiscalYear = fiscalYearRange(date, fiscalYearStartMonth, fiscalYearStartDay);
  const org = String(orgNumber || "").replace(/\s/g, "");
  const lines = [
    "#FLAGGA 0",
    `#PROGRAM ${sieQuote(programName)} ${String(programVersion).replace(/\s/g, "") || "1.0"}`,
    "#FORMAT PC8",
    `#GEN ${generated.ymd}`,
    "#SIETYP 4",
    `#FNAMN ${sieQuote(companyName || "Kyrkevent")}`,
    `#ORGNR ${org || "0000000000"}`,
    `#RAR 0 ${fiscalYear.start} ${fiscalYear.end}`,
    "#KPTYP EUBAS97"
  ];
  const seen = new Set();
  for (const account of active) {
    if (seen.has(account.number)) continue;
    seen.add(account.number);
    lines.push(`#KONTO ${account.number} ${sieQuote(account.name)}`);
  }
  const seriesToken = String(series || "A").replace(/[^A-Za-z0-9]/g, "") || "A";
  const hasNumber = voucherNumber != null && String(voucherNumber).trim() !== "";
  const numberField = hasNumber ? String(Math.max(1, parseInt(voucherNumber, 10) || 1)) : '""';
  lines.push(`#VER ${seriesToken} ${numberField} ${date} ${sieQuote(voucherText, 100)}`);
  lines.push("{");
  for (const account of active) {
    lines.push(`#TRANS ${account.number} {} ${sieAmountFromCents(account.cents)}`);
  }
  lines.push("}");
  lines.push("#FLAGGA 0");
  return `${lines.join("\r\n")}\r\n`;
};

const organizerCentsOrThrow = (organizerAmountCents) => {
  const organizerCents = Math.round(Number(organizerAmountCents) || 0);
  if (organizerCents < 0) {
    throw new Error("Arrangörens belopp är ogiltigt.");
  }
  if (organizerCents === 0) {
    throw new Error("Det finns inget belopp att bokföra.");
  }
  return organizerCents;
};

const payoutFeeCentsWithin = (organizerCents, payoutFeeCents) =>
  Math.min(organizerCents, Math.max(0, Math.round(Number(payoutFeeCents) || 0)));

/**
 * SIE 1. Skulden på 2890 är beloppet som ska betalas ut efter utbetalningsavgift.
 * debet 1930 = biljettintäkt + serviceavgift inkl. moms
 * kredit 2890 = utbetalning till arrangören
 * kredit 3041 = utbetalningsavgift inkl. moms, när avgift finns
 * kredit 6230 = serviceavgift exkl. moms
 * kredit 2611 = utgående moms på serviceavgift
 */
export const buildPayoutSie = ({
  bankAccount = SIE_ACCOUNTS.bank,
  organizerAmountCents,
  serviceFeeNetCents = 0,
  serviceFeeVatCents = 0,
  payoutFeeCents = 0,
  ...header
}) => {
  const organizerCents = organizerCentsOrThrow(organizerAmountCents);
  const feeCents = payoutFeeCentsWithin(organizerCents, payoutFeeCents);
  const payableCents = organizerCents - feeCents;
  const serviceNetCents = Math.max(0, Math.round(Number(serviceFeeNetCents) || 0));
  const serviceVatCents = Math.max(0, Math.round(Number(serviceFeeVatCents) || 0));
  const bankCents = organizerCents + serviceNetCents + serviceVatCents;
  const accounts = [
    {
      number: sieAccount(bankAccount, SIE_ACCOUNTS.bank),
      name: SIE_ACCOUNT_NAMES.bank,
      cents: bankCents
    }
  ];
  if (payableCents > 0) {
    accounts.push({
      number: SIE_ACCOUNTS.organizer,
      name: SIE_ACCOUNT_NAMES.organizer,
      cents: -payableCents
    });
  }
  if (feeCents > 0) {
    accounts.push({
      number: SIE_ACCOUNTS.payoutFee,
      name: SIE_ACCOUNT_NAMES.payoutFee,
      cents: -feeCents
    });
  }
  if (serviceNetCents > 0) {
    accounts.push({
      number: SIE_ACCOUNTS.serviceFee,
      name: SIE_ACCOUNT_NAMES.serviceFee,
      cents: -serviceNetCents
    });
  }
  if (serviceVatCents > 0) {
    accounts.push({
      number: SIE_ACCOUNTS.vatOut,
      name: SIE_ACCOUNT_NAMES.vatOut,
      cents: -serviceVatCents
    });
  }
  return renderSieVoucher({ ...header, accounts });
};

/**
 * SIE 2. Bara beloppet som betalas ut till arrangören efter utbetalningsavgift.
 * debet 2890 = utbetalning
 * kredit 1930 = utbetalning
 */
export const buildPayoutClearingSie = ({
  bankAccount = SIE_ACCOUNTS.bank,
  organizerAmountCents,
  payoutFeeCents = 0,
  ...header
}) => {
  const organizerCents = organizerCentsOrThrow(organizerAmountCents);
  const payableCents = organizerCents - payoutFeeCentsWithin(organizerCents, payoutFeeCents);
  if (payableCents <= 0) {
    throw new Error("Det finns inget belopp att betala ut efter utbetalningsavgiften.");
  }
  const bank = sieAccount(bankAccount, SIE_ACCOUNTS.bank);
  return renderSieVoucher({
    ...header,
    accounts: [
      {
        number: SIE_ACCOUNTS.organizer,
        name: SIE_ACCOUNT_NAMES.organizer,
        cents: payableCents
      },
      {
        number: bank,
        name: SIE_ACCOUNT_NAMES.bank,
        cents: -payableCents
      }
    ]
  });
};

export const encodeSiePc8 = (text) => {
  const bytes = [];
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (code <= 0x7f) {
      bytes.push(code);
      continue;
    }
    const mapped = CP437_EXTRA[ch];
    bytes.push(mapped != null ? mapped : 0x3f);
  }
  return Buffer.from(bytes);
};
