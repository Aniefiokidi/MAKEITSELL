type TopupFeeConfig = {
  flatFeeNgn: number
  percentFee: number
  minFeeNgn: number
  maxFeeNgn: number
}

export type TopupAmounts = {
  walletCreditAmount: number
  feeAmount: number
  payableAmount: number
}

const toSafeNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const round2 = (value: number) => Math.round(value * 100) / 100

export const getTopupFeeConfig = (): TopupFeeConfig => {
  const flatFeeNgn = Math.max(
    0,
    toSafeNumber(
      process.env.XORO_TOPUP_FEE_FLAT_NGN || process.env.NEXT_PUBLIC_XORO_TOPUP_FEE_FLAT_NGN,
      1
    )
  )

  const percentFee = Math.max(
    0,
    toSafeNumber(
      process.env.XORO_TOPUP_FEE_PERCENT || process.env.NEXT_PUBLIC_XORO_TOPUP_FEE_PERCENT,
      0
    )
  )

  const minFeeNgn = Math.max(
    0,
    toSafeNumber(
      process.env.XORO_TOPUP_FEE_MIN_NGN || process.env.NEXT_PUBLIC_XORO_TOPUP_FEE_MIN_NGN,
      0
    )
  )

  const maxFeeNgn = Math.max(
    0,
    toSafeNumber(
      process.env.XORO_TOPUP_FEE_MAX_NGN || process.env.NEXT_PUBLIC_XORO_TOPUP_FEE_MAX_NGN,
      0
    )
  )

  return {
    flatFeeNgn,
    percentFee,
    minFeeNgn,
    maxFeeNgn,
  }
}

export const calculateTopupAmounts = (requestedWalletCreditAmount: number): TopupAmounts => {
  const walletCreditAmount = round2(Number(requestedWalletCreditAmount) || 0)
  if (!Number.isFinite(walletCreditAmount) || walletCreditAmount <= 0) {
    return {
      walletCreditAmount: 0,
      feeAmount: 0,
      payableAmount: 0,
    }
  }

  const { flatFeeNgn, percentFee, minFeeNgn, maxFeeNgn } = getTopupFeeConfig()

  let feeAmount = round2(flatFeeNgn + walletCreditAmount * (percentFee / 100))

  if (minFeeNgn > 0) {
    feeAmount = Math.max(feeAmount, round2(minFeeNgn))
  }

  if (maxFeeNgn > 0) {
    feeAmount = Math.min(feeAmount, round2(maxFeeNgn))
  }

  feeAmount = Math.max(0, round2(feeAmount))

  return {
    walletCreditAmount,
    feeAmount,
    payableAmount: round2(walletCreditAmount + feeAmount),
  }
}
