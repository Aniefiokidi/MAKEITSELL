const round2 = (value: number) => Math.round(value * 100) / 100

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toBool = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

export type PaystackChargeConfig = {
  enabled: boolean
  ratePercent: number
  flatFeeNgn: number
  feeCapNgn: number
  flatWaiverBelowNgn: number
}

export type PaystackCheckoutAmounts = {
  orderAmount: number
  chargeAmount: number
  payableAmount: number
}

export const getPaystackChargeConfig = (): PaystackChargeConfig => {
  const enabled = toBool(
    process.env.PAYSTACK_PASS_CHARGES_TO_CUSTOMER || process.env.NEXT_PUBLIC_PAYSTACK_PASS_CHARGES_TO_CUSTOMER,
    true
  )

  return {
    enabled,
    ratePercent: Math.max(0, toNumber(process.env.PAYSTACK_LOCAL_PERCENT_FEE || process.env.NEXT_PUBLIC_PAYSTACK_LOCAL_PERCENT_FEE, 1.5)),
    flatFeeNgn: Math.max(0, toNumber(process.env.PAYSTACK_LOCAL_FLAT_FEE_NGN || process.env.NEXT_PUBLIC_PAYSTACK_LOCAL_FLAT_FEE_NGN, 100)),
    feeCapNgn: Math.max(0, toNumber(process.env.PAYSTACK_LOCAL_FEE_CAP_NGN || process.env.NEXT_PUBLIC_PAYSTACK_LOCAL_FEE_CAP_NGN, 2000)),
    flatWaiverBelowNgn: Math.max(0, toNumber(process.env.PAYSTACK_LOCAL_FLAT_WAIVER_BELOW_NGN || process.env.NEXT_PUBLIC_PAYSTACK_LOCAL_FLAT_WAIVER_BELOW_NGN, 2500)),
  }
}

export const calculatePaystackFeeOnGross = (grossAmount: number, config = getPaystackChargeConfig()) => {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0 || !config.enabled) {
    return 0
  }

  const rateFee = (grossAmount * config.ratePercent) / 100
  const flatFee = grossAmount < config.flatWaiverBelowNgn ? 0 : config.flatFeeNgn
  const uncappedFee = rateFee + flatFee
  const fee = config.feeCapNgn > 0 ? Math.min(uncappedFee, config.feeCapNgn) : uncappedFee

  return Math.max(0, round2(fee))
}

export const calculatePaystackCheckoutAmounts = (orderAmountInput: number): PaystackCheckoutAmounts => {
  const orderAmount = round2(Number(orderAmountInput) || 0)
  if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
    return {
      orderAmount: 0,
      chargeAmount: 0,
      payableAmount: 0,
    }
  }

  const config = getPaystackChargeConfig()
  if (!config.enabled) {
    return {
      orderAmount,
      chargeAmount: 0,
      payableAmount: orderAmount,
    }
  }

  const maxExtra = config.feeCapNgn + config.flatFeeNgn + 500
  let low = orderAmount
  let high = orderAmount + Math.max(100, maxExtra)

  const netFromGross = (gross: number) => round2(gross - calculatePaystackFeeOnGross(gross, config))

  while (netFromGross(high) < orderAmount) {
    high = round2(high + Math.max(500, maxExtra))
    if (high > orderAmount + 100000) {
      break
    }
  }

  for (let i = 0; i < 40; i += 1) {
    const mid = round2((low + high) / 2)
    const net = netFromGross(mid)
    if (net >= orderAmount) {
      high = mid
    } else {
      low = mid
    }
  }

  const payableAmount = round2(high)
  const chargeAmount = round2(payableAmount - orderAmount)

  return {
    orderAmount,
    chargeAmount,
    payableAmount,
  }
}
