import { PDFParse } from 'pdf-parse'
import crypto from 'crypto'
import {
  ParsedPayStatement,
  ParsedPayItem,
  ParsedDeposit,
  PayItemCategoryCode,
} from '@/lib/types'

interface ParseResult {
  success: boolean
  data?: ParsedPayStatement
  error?: string
  fileHash: string
  rawText?: string
}

/**
 * Parse an ADP pay stub PDF and extract pay statement data
 */
export async function parsePayStatementPdf(
  pdfBuffer: Buffer,
  debug: boolean = false
): Promise<ParseResult> {
  const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

  try {
    const parser = new PDFParse({ data: pdfBuffer })
    const textResult = await parser.getText()
    const text = textResult.text
    await parser.destroy()

    if (debug) {
      console.log('=== RAW PDF TEXT ===')
      console.log(JSON.stringify(text))
      console.log('=== END RAW PDF TEXT ===')
    }

    // Parse pay period dates
    const dates = parseDates(text)
    if (!dates) {
      return { success: false, error: 'Could not extract pay period dates', fileHash }
    }

    // Extract all amount pairs ONCE to create a shared pool
    const amountPool = extractAmountPairs(text, debug)

    // Detect pay stub type: RSU vesting vs regular paycheck
    const hasRegularSalary = /\bRegular\b/i.test(text)
    const isRsuVesting = !hasRegularSalary && /Restricted\s*Stoc/i.test(text)

    if (debug) console.log(`=== PAY STUB TYPE: ${isRsuVesting ? 'RSU VESTING' : 'REGULAR PAYCHECK'} ===`)

    // Parse all line items using the shared pool
    const items: ParsedPayItem[] = []

    // Parse earnings
    const earnings = isRsuVesting ? parseRsuVestingEarnings(text) : parseEarnings(text)
    items.push(...earnings)

    // Parse taxes (same logic for both types)
    if (debug) console.log('=== PARSING TAXES ===')
    const taxes = parseTaxes(text, amountPool, debug)
    items.push(...taxes)

    // Parse deductions (different logic for RSU vesting)
    if (debug) console.log('=== PARSING DEDUCTIONS ===')
    const deductions = isRsuVesting
      ? parseRsuVestingDeductions(text, debug)
      : parseDeductions(text, amountPool, debug)
    items.push(...deductions)

    // Parse employer benefits (skip for RSU vesting - none present)
    if (!isRsuVesting) {
      if (debug) console.log('=== PARSING BENEFITS ===')
      const benefits = parseEmployerBenefits(text, amountPool, debug)
      items.push(...benefits)
    }

    if (debug) {
      console.log('=== REMAINING IN POOL ===')
      amountPool.forEach(a => console.log(`  ${a.current.toFixed(2)}`))
    }

    // Parse deposits
    const deposits = parseDeposits(text)

    // Calculate totals
    const grossEarnings = items
      .filter(i => i.categoryCode === 'earnings')
      .reduce((sum, i) => sum + i.currentAmount, 0)

    const totalTaxes = items
      .filter(i => i.categoryCode === 'statutory_tax')
      .reduce((sum, i) => sum + i.currentAmount, 0)

    const totalDeductions = items
      .filter(i => i.categoryCode === 'pretax_deduction' || i.categoryCode === 'posttax_deduction')
      .reduce((sum, i) => sum + i.currentAmount, 0)

    const employerBenefitsTotal = items
      .filter(i => i.categoryCode === 'employer_benefit')
      .reduce((sum, i) => sum + i.currentAmount, 0)

    // Try to extract net pay directly
    const netPay = parseNetPay(text) ?? (grossEarnings - totalTaxes - totalDeductions)

    const statement: ParsedPayStatement = {
      periodStart: dates.periodStart,
      periodEnd: dates.periodEnd,
      payDate: dates.payDate,
      sourceType: 'adp',
      grossEarnings,
      totalTaxes,
      totalDeductions,
      employerBenefits: employerBenefitsTotal,
      netPay,
      items,
      deposits,
    }

    const result: ParseResult = { success: true, data: statement, fileHash }
    if (debug) {
      result.rawText = text
    }
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error parsing PDF'
    return { success: false, error: message, fileHash }
  }
}

/**
 * Parse a single monetary amount from ADP format
 * Handles formats like:
 * - "625 07" -> 625.07
 * - "1 266 40" -> 1266.40
 * - "-17 .00*" -> 17.00
 * - "-1 ,143.00*" -> 1143.00
 * - "1,266.40" -> 1266.40
 */
function parseAmount(str: string): number {
  if (!str) return 0

  // Remove asterisks, negative signs, and dollar signs
  let cleaned = str.replace(/[-*$]/g, '').trim()

  // Handle format with explicit decimal point like "-17 .00" or "1,266.40"
  // First, normalize spaces around decimal points: "17 .00" -> "17.00"
  cleaned = cleaned.replace(/\s*\.\s*/g, '.')
  // Normalize spaces around commas: "1 ,143" -> "1,143"
  cleaned = cleaned.replace(/\s*,\s*/g, ',')

  // If it has an explicit decimal point, parse directly
  if (cleaned.includes('.')) {
    // Remove commas and extra spaces
    const normalized = cleaned.replace(/[,\s]/g, '')
    const val = parseFloat(normalized)
    return isNaN(val) ? 0 : val
  }

  // Otherwise, use the space-separated format where last 2 digits are cents
  // Remove everything except digits and spaces
  cleaned = cleaned.replace(/[^\d\s]/g, '').trim()
  if (!cleaned) return 0

  // Split by spaces
  const parts = cleaned.split(/\s+/).filter(p => p.length > 0)
  if (parts.length === 0) return 0

  // Last part should be 2 digits (cents)
  const lastPart = parts[parts.length - 1]

  if (parts.length >= 2 && lastPart.length === 2) {
    const dollars = parts.slice(0, -1).join('')
    return parseFloat(`${dollars}.${lastPart}`)
  }

  // Single number - might already be formatted or just dollars
  return parseFloat(parts.join(''))
}

/**
 * Parse pay period and pay dates
 */
function parseDates(text: string): { periodStart: string; periodEnd: string; payDate: string } | null {
  const beginMatch = text.match(/Period\s*Beginning[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i)
  const endMatch = text.match(/Period\s*Ending[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i)
  const payMatch = text.match(/Pay\s*Date[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i)

  if (!beginMatch || !endMatch) {
    return null
  }

  return {
    periodStart: formatDate(beginMatch[1]),
    periodEnd: formatDate(endMatch[1]),
    payDate: payMatch ? formatDate(payMatch[1]) : formatDate(endMatch[1]),
  }
}

function formatDate(dateStr: string): string {
  const [month, day, year] = dateStr.split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * Find a value after a label, extracting just the first number group
 * Returns { current, ytd } where ytd might be undefined
 */
function findAmountAfterLabel(text: string, labelPattern: RegExp): { current: number; ytd?: number } | null {
  const match = text.match(labelPattern)
  if (!match) return null

  // Get text after the label
  const afterLabel = text.substring(match.index! + match[0].length, match.index! + match[0].length + 100)

  // Look for number patterns - digits possibly separated by single spaces, ending in 2 digits
  // Pattern: captures groups of digits with spaces like "625 07" or "6 374 88"
  const numberPattern = /(-?\d[\d ]*\d{2})\b/g
  const numbers: number[] = []

  let numMatch
  while ((numMatch = numberPattern.exec(afterLabel)) !== null && numbers.length < 2) {
    const val = parseAmount(numMatch[1])
    if (val > 0) {
      numbers.push(val)
    }
  }

  if (numbers.length === 0) return null

  return {
    current: numbers[0],
    ytd: numbers.length > 1 ? numbers[1] : undefined
  }
}

/**
 * Parse earnings for RSU vesting pay stub (only Restricted Stock).
 */
function parseRsuVestingEarnings(text: string): ParsedPayItem[] {
  const items: ParsedPayItem[] = []

  // Restricted Stock earnings - look after "Restricted Stoc" for amount pair
  const rsuMatch = text.match(/Restricted\s*Stoc/i)
  if (rsuMatch && rsuMatch.index !== undefined) {
    // The RSU amount appears after "Restricted Stoc" - look for the pattern "92 738 80     92 738 80"
    const afterRsu = text.substring(rsuMatch.index + rsuMatch[0].length, rsuMatch.index + rsuMatch[0].length + 150)

    // Find positive amount pair (current, YTD)
    const pattern = /(\d{1,3}(?: \d{3})* \d{2})\s+(\d{1,3}(?: \d{3})* \d{2})/
    const match = pattern.exec(afterRsu)
    if (match) {
      const current = parseAmount(match[1])
      const ytd = parseAmount(match[2])
      if (current > 0) {
        items.push({
          categoryCode: 'earnings',
          itemCode: 'RSU_VEST',
          itemName: 'RSU Vesting',
          currentAmount: current,
          ytdAmount: ytd,
        })
      }
    }
  }

  return items
}

/**
 * Parse deductions for RSU vesting pay stub.
 * RSU vesting has only RSU deduction, which appears after "Medicare Tax" label.
 */
function parseRsuVestingDeductions(text: string, debug: boolean = false): ParsedPayItem[] {
  const items: ParsedPayItem[] = []

  // RSU deduction appears after "Medicare Tax" label in RSU vesting pay stubs
  const medicareMatch = text.match(/Medicare\s*Tax/i)
  if (medicareMatch && medicareMatch.index !== undefined) {
    const afterMedicare = text.substring(medicareMatch.index + medicareMatch[0].length, medicareMatch.index + medicareMatch[0].length + 100)
    const rsuAmounts = findFirstNegativeAmountPair(afterMedicare)

    // RSU deduction is typically large (> $10,000)
    if (rsuAmounts.current >= 10000) {
      items.push({
        categoryCode: 'posttax_deduction',
        itemCode: 'RSU_TAX',
        itemName: 'RSU Tax Withholding',
        currentAmount: rsuAmounts.current,
        ytdAmount: rsuAmounts.ytd,
      })
      if (debug) console.log(`  RSU_TAX: $${rsuAmounts.current.toFixed(2)} (YTD: ${rsuAmounts.ytd?.toFixed(2) || 'N/A'})`)
    }
  }

  return items
}

/**
 * Parse earnings items for regular paycheck.
 */
function parseEarnings(text: string): ParsedPayItem[] {
  const items: ParsedPayItem[] = []

  // Regular salary - format: "Regular  10390.92  86.67  10,390.92  10,390.92"
  // Pattern: rate, hours, this_period, year_to_date
  const regularMatch = text.match(/\bRegular\b/i)
  if (regularMatch) {
    const afterRegular = text.substring(regularMatch.index!, regularMatch.index! + 80)
    const numbers = extractNumbers(afterRegular, 4)
    // numbers[0] = rate, numbers[1] = hours, numbers[2] = current, numbers[3] = ytd
    if (numbers.length >= 3 && numbers[2] > 0) {
      items.push({
        categoryCode: 'earnings',
        itemCode: 'REGULAR',
        itemName: 'Regular Salary',
        currentAmount: numbers[2],
        ytdAmount: numbers[3],
      })
    } else if (numbers.length >= 1 && numbers[0] > 0) {
      // Fallback: use first large number as salary
      const salary = numbers.find(n => n > 1000)
      if (salary) {
        items.push({
          categoryCode: 'earnings',
          itemCode: 'REGULAR',
          itemName: 'Regular Salary',
          currentAmount: salary,
        })
      }
    }
  }

  // RSU - "Restricted Stoc" - may only have YTD, not current period
  // Look for the YTD value which is typically large (> $10,000)
  const rsuMatch = text.match(/Restricted\s*Stoc/i)
  if (rsuMatch) {
    const afterRsu = text.substring(rsuMatch.index!, rsuMatch.index! + 80)
    // Look for all amounts after the RSU label
    const rsuAmounts = extractAllAmounts(afterRsu)

    // Find YTD (large value > $10,000) - RSU YTD is typically significant
    const ytdAmount = rsuAmounts.find(a => a > 10000)
    // Current period RSU would be smaller but still meaningful (> $100, < $50,000)
    const currentAmount = rsuAmounts.find(a => a > 100 && a < 50000 && a !== ytdAmount)

    if (ytdAmount || currentAmount) {
      items.push({
        categoryCode: 'earnings',
        itemCode: 'RSU_VEST',
        itemName: 'RSU Vesting',
        currentAmount: currentAmount || 0,
        ytdAmount: ytdAmount,
      })
    }
  }

  // Gross Pay fallback - "Gross Pay  $10,390.92"
  if (items.length === 0) {
    const grossMatch = text.match(/Gross\s*Pay/i)
    if (grossMatch) {
      const afterGross = text.substring(grossMatch.index!, grossMatch.index! + 30)
      const amount = extractFirstNumber(afterGross)
      if (amount !== null && amount > 0) {
        items.push({
          categoryCode: 'earnings',
          itemCode: 'REGULAR',
          itemName: 'Gross Pay',
          currentAmount: amount,
        })
      }
    }
  }

  return items
}

/**
 * Extract N numbers from text. Handles multiple formats:
 * - Space-separated: "10390 92" -> 10390.92
 * - Decimal format: "10,390.92" or "10390.92" -> 10390.92
 * - ADP format with spaces around decimals: "-17 .00*" -> 17.00
 */
function extractNumbers(text: string, maxCount: number): number[] {
  const results: number[] = []

  // Split by tabs and newlines to separate distinct values
  const segments = text.split(/[\t\n]/)

  for (const segment of segments) {
    if (results.length >= maxCount) break

    // Try multiple number patterns in order of preference

    // Pattern 1: Standard decimal format (possibly with comma thousands separator)
    // Matches: 1,266.40, 17.00, -2.00, etc. (with optional spaces around decimal)
    const decimalMatch = segment.match(/-?\d[\d,]*\s*\.\s*\d{2}\b/)
    if (decimalMatch) {
      const val = parseAmount(decimalMatch[0])
      if (val > 0) {
        results.push(val)
        continue
      }
    }

    // Pattern 2: Space-separated format where last 2 digits are cents
    // Matches: "10390 92", "1 266 40", etc.
    const spaceMatch = segment.match(/(\d+(?: \d+)+)/)
    if (spaceMatch) {
      const numStr = spaceMatch[1]
      // Must end with space + 2 digits (cents)
      if (/ \d{2}$/.test(numStr)) {
        const val = parseAmount(numStr)
        if (val > 0) {
          results.push(val)
          continue
        }
      }
    }
  }

  return results
}

/**
 * Extract all monetary amounts from text.
 * Supports multiple formats:
 * - ADP space-separated: "625 07", "1 062 11"
 * - Standard decimal: "146.19", "1,143.00", "$344.00"
 * - With negative/asterisk: "-2 00*", "-$17.00"
 */
function extractAmountPairs(text: string, debug: boolean = false): Array<{ current: number; ytd?: number; index: number }> {
  const amounts: Array<{ current: number; index: number }> = []

  // Pattern 1: ADP space-separated format (e.g., "625 07", "1 062 11", "-2 00*")
  // Must have at least one space before the 2-digit cents
  const spacePattern = /-?(\d{1,3}(?: \d{3})* \d{2})\*?/g
  let match
  while ((match = spacePattern.exec(text)) !== null) {
    const val = parseAmount(match[1])
    if (val > 0) {
      amounts.push({ current: val, index: match.index })
    }
  }

  // Pattern 2: Standard decimal format (e.g., "146.19", "1,143.00", "$344.00")
  const decimalPattern = /-?\$?\d{1,3}(?:,\d{3})*\.\d{2}\b/g
  while ((match = decimalPattern.exec(text)) !== null) {
    const val = parseAmount(match[0])
    // Avoid duplicates (values may appear in both formats)
    if (val > 0 && !amounts.some(a => Math.abs(a.current - val) < 0.01)) {
      amounts.push({ current: val, index: match.index })
    }
  }

  // Sort by position in text
  amounts.sort((a, b) => a.index - b.index)

  if (debug) {
    console.log('=== EXTRACTED AMOUNTS ===')
    amounts.forEach(a => console.log(`  ${a.current.toFixed(2)} at index ${a.index}`))
    console.log('=== END AMOUNTS ===')
  }

  // Convert to pairs format (for compatibility)
  return amounts.map(a => ({ current: a.current, index: a.index }))
}

/**
 * Parse tax items from ADP pay stub.
 * Due to PDF column interleaving, each tax value appears after the PREVIOUS tax label.
 * The interleaving pattern differs based on whether Medicare Surtax is present.
 */
function parseTaxes(text: string, _amountPool: Array<{ current: number; ytd?: number; index: number }>, debug: boolean = false): ParsedPayItem[] {
  const items: ParsedPayItem[] = []

  // Check if Medicare Surtax exists (changes the interleaving pattern)
  const hasMedicareSurtax = /Medicare\s*Surtax/i.test(text)
  if (debug) console.log(`  [Medicare Surtax present: ${hasMedicareSurtax}]`)

  // Federal Income Tax: try multiple locations
  // 1. After "this period total to date" header (some pay stubs)
  // 2. After "Exemptions/Allowances:" (RSU vesting and some regular pay stubs)
  let fedAmounts: { current: number; ytd?: number } = { current: 0 }

  const fedHeaderMatch = text.match(/this\s*period\s+total\s*to\s*date/i)
  if (fedHeaderMatch && fedHeaderMatch.index !== undefined) {
    const afterHeader = text.substring(fedHeaderMatch.index + fedHeaderMatch[0].length, fedHeaderMatch.index + fedHeaderMatch[0].length + 100)
    fedAmounts = findFirstNegativeAmountPair(afterHeader)
  }

  if (fedAmounts.current === 0) {
    const exemptionsMatch = text.match(/Exemptions\/Allowances:/i)
    if (exemptionsMatch && exemptionsMatch.index !== undefined) {
      const afterExemptions = text.substring(exemptionsMatch.index + exemptionsMatch[0].length, exemptionsMatch.index + exemptionsMatch[0].length + 100)
      fedAmounts = findFirstNegativeAmountPair(afterExemptions)
    }
  }

  if (fedAmounts.current > 0) {
    items.push({
      categoryCode: 'statutory_tax',
      itemCode: 'FED_TAX',
      itemName: 'Federal Income Tax',
      currentAmount: fedAmounts.current,
      ytdAmount: fedAmounts.ytd,
    })
    if (debug) console.log(`  FED_TAX: $${fedAmounts.current.toFixed(2)} (YTD: ${fedAmounts.ytd?.toFixed(2) || 'N/A'})`)
  }

  if (hasMedicareSurtax) {
    // Pattern WITH Medicare Surtax:
    // After "Statutory": Medicare Tax
    // After "Federal Income Tax": Medicare Surtax
    // After "Medicare Tax": State Tax
    // After "Medicare Surtax": Social Security (may be YTD only)

    // Medicare Tax: after "Statutory"
    const statutoryMatch = text.match(/\bStatutory\b/i)
    if (statutoryMatch && statutoryMatch.index !== undefined) {
      const afterStatutory = text.substring(statutoryMatch.index + statutoryMatch[0].length, statutoryMatch.index + statutoryMatch[0].length + 100)
      const medicareAmounts = findFirstNegativeAmountPair(afterStatutory)
      if (medicareAmounts.current > 0) {
        items.push({
          categoryCode: 'statutory_tax',
          itemCode: 'MEDICARE',
          itemName: 'Medicare Tax',
          currentAmount: medicareAmounts.current,
          ytdAmount: medicareAmounts.ytd,
        })
        if (debug) console.log(`  MEDICARE: $${medicareAmounts.current.toFixed(2)} (YTD: ${medicareAmounts.ytd?.toFixed(2) || 'N/A'})`)
      }
    }

    // Medicare Surtax: after "Federal Income Tax"
    const fedLabelMatch = text.match(/Federal\s*Income\s*Tax/i)
    if (fedLabelMatch && fedLabelMatch.index !== undefined) {
      const afterFedLabel = text.substring(fedLabelMatch.index + fedLabelMatch[0].length, fedLabelMatch.index + fedLabelMatch[0].length + 100)
      const surtaxAmounts = findFirstNegativeAmountPair(afterFedLabel)
      if (surtaxAmounts.current > 0) {
        items.push({
          categoryCode: 'statutory_tax',
          itemCode: 'MEDICARE_SURTAX',
          itemName: 'Medicare Surtax',
          currentAmount: surtaxAmounts.current,
          ytdAmount: surtaxAmounts.ytd,
        })
        if (debug) console.log(`  MEDICARE_SURTAX: $${surtaxAmounts.current.toFixed(2)} (YTD: ${surtaxAmounts.ytd?.toFixed(2) || 'N/A'})`)
      }
    }

    // State Tax: after "Medicare Tax"
    const medicareLabelMatch = text.match(/Medicare\s*Tax\b/i)
    if (medicareLabelMatch && medicareLabelMatch.index !== undefined) {
      const afterMedicareLabel = text.substring(medicareLabelMatch.index + medicareLabelMatch[0].length, medicareLabelMatch.index + medicareLabelMatch[0].length + 100)
      const stateAmounts = findFirstNegativeAmountPair(afterMedicareLabel)
      if (stateAmounts.current > 0) {
        items.push({
          categoryCode: 'statutory_tax',
          itemCode: 'STATE_TAX',
          itemName: 'State Income Tax',
          currentAmount: stateAmounts.current,
          ytdAmount: stateAmounts.ytd,
        })
        if (debug) console.log(`  STATE_TAX: $${stateAmounts.current.toFixed(2)} (YTD: ${stateAmounts.ytd?.toFixed(2) || 'N/A'})`)
      }
    }

    // Social Security: after "Medicare Surtax" - may be YTD only
    const surtaxLabelMatch = text.match(/Medicare\s*Surtax/i)
    if (surtaxLabelMatch && surtaxLabelMatch.index !== undefined) {
      const afterSurtaxLabel = text.substring(surtaxLabelMatch.index + surtaxLabelMatch[0].length, surtaxLabelMatch.index + surtaxLabelMatch[0].length + 100)
      // Try negative amount first
      let ssAmounts = findFirstNegativeAmountPair(afterSurtaxLabel)
      // If no current period, try to find YTD-only positive amount
      if (ssAmounts.current === 0) {
        const ytdOnly = findFirstPositiveAmount(afterSurtaxLabel)
        if (ytdOnly > 0) {
          ssAmounts = { current: 0, ytd: ytdOnly }
        }
      }
      if (ssAmounts.current > 0 || ssAmounts.ytd) {
        items.push({
          categoryCode: 'statutory_tax',
          itemCode: 'SOC_SEC',
          itemName: 'Social Security Tax',
          currentAmount: ssAmounts.current,
          ytdAmount: ssAmounts.ytd,
        })
        if (debug) console.log(`  SOC_SEC: $${ssAmounts.current.toFixed(2)} (YTD: ${ssAmounts.ytd?.toFixed(2) || 'N/A'})`)
      }
    }
  } else {
    // Pattern WITHOUT Medicare Surtax (original logic):
    // After "Statutory": Social Security
    // After "Federal Income Tax": Medicare
    // After "Social Security Tax": State

    // Social Security Tax: after "Statutory"
    const statutoryMatch = text.match(/\bStatutory\b/i)
    if (statutoryMatch && statutoryMatch.index !== undefined) {
      const afterStatutory = text.substring(statutoryMatch.index + statutoryMatch[0].length, statutoryMatch.index + statutoryMatch[0].length + 100)
      const ssAmounts = findFirstNegativeAmountPair(afterStatutory)
      if (ssAmounts.current > 0) {
        items.push({
          categoryCode: 'statutory_tax',
          itemCode: 'SOC_SEC',
          itemName: 'Social Security Tax',
          currentAmount: ssAmounts.current,
          ytdAmount: ssAmounts.ytd,
        })
        if (debug) console.log(`  SOC_SEC: $${ssAmounts.current.toFixed(2)} (YTD: ${ssAmounts.ytd?.toFixed(2) || 'N/A'})`)
      }
    }

    // Medicare Tax: after "Federal Income Tax"
    const fedLabelMatch = text.match(/Federal\s*Income\s*Tax/i)
    if (fedLabelMatch && fedLabelMatch.index !== undefined) {
      const afterFedLabel = text.substring(fedLabelMatch.index + fedLabelMatch[0].length, fedLabelMatch.index + fedLabelMatch[0].length + 100)
      const medicareAmounts = findFirstNegativeAmountPair(afterFedLabel)
      if (medicareAmounts.current > 0) {
        items.push({
          categoryCode: 'statutory_tax',
          itemCode: 'MEDICARE',
          itemName: 'Medicare Tax',
          currentAmount: medicareAmounts.current,
          ytdAmount: medicareAmounts.ytd,
        })
        if (debug) console.log(`  MEDICARE: $${medicareAmounts.current.toFixed(2)} (YTD: ${medicareAmounts.ytd?.toFixed(2) || 'N/A'})`)
      }
    }

    // State Tax: after "Social Security Tax"
    const ssLabelMatch = text.match(/Social\s*Security\s*Tax/i)
    if (ssLabelMatch && ssLabelMatch.index !== undefined) {
      const afterSSLabel = text.substring(ssLabelMatch.index + ssLabelMatch[0].length, ssLabelMatch.index + ssLabelMatch[0].length + 100)
      const stateAmounts = findFirstNegativeAmountPair(afterSSLabel)
      if (stateAmounts.current > 0) {
        items.push({
          categoryCode: 'statutory_tax',
          itemCode: 'STATE_TAX',
          itemName: 'State Income Tax',
          currentAmount: stateAmounts.current,
          ytdAmount: stateAmounts.ytd,
        })
        if (debug) console.log(`  STATE_TAX: $${stateAmounts.current.toFixed(2)} (YTD: ${stateAmounts.ytd?.toFixed(2) || 'N/A'})`)
      }
    }
  }

  return items
}

/**
 * Find the first positive amount in text (for YTD-only values).
 */
function findFirstPositiveAmount(text: string): number {
  const pattern = /(\d{1,3}(?: \d{3})* \d{2})/
  const match = pattern.exec(text)
  if (match) {
    // Make sure it's not preceded by a negative sign
    const charBefore = match.index && match.index > 0 ? text[match.index - 1] : ''
    if (charBefore !== '-') {
      return parseAmount(match[1])
    }
  }
  return 0
}

/**
 * Find the first negative amount pair in text.
 * Returns { current, ytd } where current is the negative amount value.
 */
function findFirstNegativeAmountPair(text: string): { current: number; ytd?: number } {
  // Pattern: negative amount followed by optional positive YTD
  // Format: "-1 062 11     21 466 63" or "-625 07     6 374 88"
  const pattern = /-(\d{1,3}(?: \d{3})* \d{2})\*?\s+(\d{1,3}(?: \d{3})* \d{2})?/
  const match = pattern.exec(text)

  if (match) {
    const current = parseAmount(match[1])
    const ytd = match[2] ? parseAmount(match[2]) : undefined
    return { current, ytd }
  }

  return { current: 0 }
}

/**
 * Find the amount pair (current, YTD) that appears before a given position in text.
 * ADP format for deductions/taxes: "-625 07     6 374 88\nFederal Income Tax"
 * The current period is NEGATIVE, followed by positive YTD.
 */
function findAmountsBeforePosition(text: string, labelIndex: number): { current: number; ytd?: number } {
  // Look at text before the label (up to 80 chars back - reduced to avoid picking up unrelated values)
  const startIndex = Math.max(0, labelIndex - 80)
  const beforeLabel = text.substring(startIndex, labelIndex)

  // Pattern: NEGATIVE current amount followed by optional positive YTD
  // Format: "-625 07     6 374 88" or "-17 00*     17 00" or just "-4 94"
  // The negative sign is REQUIRED for deductions/taxes
  const negativePattern = /-(\d{1,3}(?: \d{3})* \d{2})\*?\s+(\d{1,3}(?: \d{3})* \d{2})?/g

  let lastMatch: { current: number; ytd?: number } | null = null
  let match

  while ((match = negativePattern.exec(beforeLabel)) !== null) {
    const current = parseAmount(match[1])
    const ytd = match[2] ? parseAmount(match[2]) : undefined
    if (current > 0) {
      lastMatch = { current, ytd }
    }
  }

  // If no space-separated negative format found, try negative decimal format
  if (!lastMatch) {
    const decimalPattern = /-\$?(\d{1,3}(?:,\d{3})*\.\d{2})/g
    while ((match = decimalPattern.exec(beforeLabel)) !== null) {
      const current = parseAmount(match[1])
      if (current > 0) {
        lastMatch = { current }
      }
    }
  }

  return lastMatch || { current: 0 }
}

/**
 * Extract the first number from text (looking for money amounts).
 */
function extractFirstNumber(text: string): number | null {
  // Look for decimal format first (most common in this PDF)
  const decimalMatch = text.match(/-?\d[\d,]*\s*\.\s*\d{2}/)
  if (decimalMatch) {
    const val = parseAmount(decimalMatch[0])
    if (val > 0) return val
  }

  // Then try space-separated format (e.g., "625 07" or "1 062 11")
  const spaceMatch = text.match(/-?(\d+(?: \d+)+)/)
  if (spaceMatch && / \d{2}$/.test(spaceMatch[1])) {
    const val = parseAmount(spaceMatch[1])
    if (val > 0) return val
  }

  return null
}

/**
 * Extract all monetary amounts from text.
 */
function extractAllAmounts(text: string): number[] {
  const amounts: number[] = []

  // Space-separated format (e.g., "92 738 80" = $92,738.80)
  const spacePattern = /(\d{1,3}(?: \d{3})* \d{2})/g
  let match
  while ((match = spacePattern.exec(text)) !== null) {
    const val = parseAmount(match[1])
    if (val > 0) amounts.push(val)
  }

  // Decimal format (e.g., "92,738.80")
  const decimalPattern = /\d{1,3}(?:,\d{3})*\.\d{2}/g
  while ((match = decimalPattern.exec(text)) !== null) {
    const val = parseAmount(match[0])
    if (val > 0 && !amounts.some(a => Math.abs(a - val) < 0.01)) {
      amounts.push(val)
    }
  }

  return amounts
}

/**
 * Extract number that appears BEFORE a label in the text.
 * This handles PDFs where multi-column layout causes values to appear before labels.
 */
function extractNumberBeforeLabel(text: string, labelIndex: number): number | null {
  // Look at text BEFORE the label (up to 50 chars back)
  const startIndex = Math.max(0, labelIndex - 50)
  const beforeLabel = text.substring(startIndex, labelIndex)

  // Find all numbers in this section
  const numbers: number[] = []

  // Space-separated format like "1 062 11" or "625 07"
  const spacePattern = /-?(\d+(?: \d+)+)/g
  let match
  while ((match = spacePattern.exec(beforeLabel)) !== null) {
    if (/ \d{2}$/.test(match[1])) {
      const val = parseAmount(match[1])
      if (val > 0) numbers.push(val)
    }
  }

  // Return the last number found (closest to the label)
  return numbers.length > 0 ? numbers[numbers.length - 1] : null
}

/**
 * Parse deduction items from ADP pay stub.
 * Due to PDF column interleaving, each deduction value appears after the PREVIOUS item's label.
 */
function parseDeductions(text: string, _amountPool: Array<{ current: number; ytd?: number; index: number }>, debug: boolean = false): ParsedPayItem[] {
  const items: ParsedPayItem[] = []

  // Deduction mappings: find value AFTER the specified label (due to interleaving)
  // The label listed is the PREVIOUS item in the PDF layout
  const deductionMappings = [
    { findAfterLabel: /Medicare\s*Tax/i, code: 'DENTAL', name: 'Dental Insurance', category: 'pretax_deduction' as PayItemCategoryCode },
    { findAfterLabel: /NC\s*State\s*Income\s*Tax/i, code: 'FSA_HEALTH', name: 'Health FSA', category: 'pretax_deduction' as PayItemCategoryCode },
    { findAfterLabel: /Dental\s*Pre-?Tax/i, code: 'MEDICAL', name: 'Medical Insurance', category: 'pretax_deduction' as PayItemCategoryCode },
    { findAfterLabel: /FSA\s*-?\s*Medical/i, code: 'LEGAL', name: 'MetLife Legal', category: 'posttax_deduction' as PayItemCategoryCode },
    { findAfterLabel: /Medical\s*Pre-?Tax/i, code: 'VISION', name: 'Vision Insurance', category: 'pretax_deduction' as PayItemCategoryCode },
    { findAfterLabel: /MetLife\s*Legal/i, code: '401K_PRETAX', name: '401(k)', category: 'pretax_deduction' as PayItemCategoryCode },
  ]

  for (const { findAfterLabel, code, name, category } of deductionMappings) {
    const match = text.match(findAfterLabel)
    if (match && match.index !== undefined) {
      const afterLabel = text.substring(match.index + match[0].length, match.index + match[0].length + 100)
      const amounts = findFirstNegativeAmountPair(afterLabel)
      if (amounts.current > 0) {
        items.push({
          categoryCode: category,
          itemCode: code,
          itemName: name,
          currentAmount: amounts.current,
          ytdAmount: amounts.ytd,
        })
        if (debug) console.log(`  ${code}: $${amounts.current.toFixed(2)} (YTD: ${amounts.ytd?.toFixed(2) || 'N/A'})`)
      }
    }
  }

  // RSU deduction handling depends on pay stub type:
  // 1. Regular pay stub: RSU YTD (positive, > $10k) appears after "Vision Pre-Tax" label
  // 2. RSU vesting pay stub: RSU current+YTD (negative, > $10k) appears before "Rsu" label

  // First, try to find RSU YTD after "Vision Pre-Tax" (regular pay stub case)
  const visionMatch = text.match(/Vision\s*Pre-?Tax/i)
  if (visionMatch && visionMatch.index !== undefined) {
    const afterVision = text.substring(visionMatch.index + visionMatch[0].length, visionMatch.index + visionMatch[0].length + 50)
    const rsuYtd = findFirstLargePositiveAmount(afterVision, 10000)
    if (rsuYtd > 0) {
      items.push({
        categoryCode: 'posttax_deduction',
        itemCode: 'RSU_TAX',
        itemName: 'RSU Tax Withholding',
        currentAmount: 0,
        ytdAmount: rsuYtd,
      })
      if (debug) console.log(`  RSU_TAX: $0.00 (YTD: ${rsuYtd.toFixed(2)}) [after Vision Pre-Tax]`)
      return items
    }
  }

  // If not found, try RSU vesting pay stub case: large negative before "Rsu" label
  const rsuLabelMatch = text.match(/\bRsu\b/i)
  if (rsuLabelMatch && rsuLabelMatch.index !== undefined) {
    const startIndex = Math.max(0, rsuLabelMatch.index - 100)
    const beforeRsu = text.substring(startIndex, rsuLabelMatch.index)

    // Find negative amount > $10,000 (to exclude 401k which is typically < $5k)
    const rsuAmounts = findLargeNegativeAmountPair(beforeRsu, 10000)
    if (rsuAmounts.current > 0) {
      items.push({
        categoryCode: 'posttax_deduction',
        itemCode: 'RSU_TAX',
        itemName: 'RSU Tax Withholding',
        currentAmount: rsuAmounts.current,
        ytdAmount: rsuAmounts.ytd,
      })
      if (debug) console.log(`  RSU_TAX: $${rsuAmounts.current.toFixed(2)} (YTD: ${rsuAmounts.ytd?.toFixed(2) || 'N/A'}) [before Rsu label]`)
    }
  }

  return items
}

/**
 * Find the first large positive amount in text.
 */
function findFirstLargePositiveAmount(text: string, minValue: number): number {
  const pattern = /(\d{1,3}(?: \d{3})* \d{2})/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    const charBefore = match.index > 0 ? text[match.index - 1] : ''
    if (charBefore === '-' || charBefore === '$') continue

    const amount = parseAmount(match[1])
    if (amount >= minValue) {
      return amount
    }
  }
  return 0
}

/**
 * Find a large negative amount pair (for RSU vesting).
 */
function findLargeNegativeAmountPair(text: string, minValue: number): { current: number; ytd?: number } {
  const pattern = /-(\d{1,3}(?: \d{3})* \d{2})\*?\s+(\d{1,3}(?: \d{3})* \d{2})?/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    const current = parseAmount(match[1])
    const ytd = match[2] ? parseAmount(match[2]) : undefined
    if (current >= minValue) {
      return { current, ytd }
    }
  }
  return { current: 0 }
}

/**
 * Find the LAST negative amount pair in text (searching backwards).
 */
function findLastNegativeAmountPair(text: string): { current: number; ytd?: number } {
  const pattern = /-(\d{1,3}(?: \d{3})* \d{2})\*?\s+(\d{1,3}(?: \d{3})* \d{2})?/g
  let lastMatch: { current: number; ytd?: number } | null = null
  let match

  while ((match = pattern.exec(text)) !== null) {
    const current = parseAmount(match[1])
    const ytd = match[2] ? parseAmount(match[2]) : undefined
    if (current > 0) {
      lastMatch = { current, ytd }
    }
  }

  return lastMatch || { current: 0 }
}

/**
 * Find the LAST large positive amount in text (for RSU YTD when no current).
 */
function findLastLargePositiveAmount(text: string, minValue: number): number {
  const pattern = /(\d{1,3}(?: \d{3})* \d{2})/g
  let lastMatch = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    // Make sure it's not preceded by - or $
    const charBefore = match.index > 0 ? text[match.index - 1] : ''
    if (charBefore === '-' || charBefore === '$') continue

    const amount = parseAmount(match[1])
    if (amount >= minValue) {
      lastMatch = amount
    }
  }

  return lastMatch
}

/**
 * Find negative amount AFTER a position (used for RSU which has different format)
 */
function findNegativeAmountAfterPosition(
  text: string,
  startIndex: number,
  range: readonly [number, number]
): { current: number; ytd?: number } {
  const afterLabel = text.substring(startIndex, startIndex + 80)

  // Pattern: NEGATIVE current amount followed by optional positive YTD
  const negativePattern = /-(\d{1,3}(?: \d{3})* \d{2})\s+(\d{1,3}(?: \d{3})* \d{2})?/

  const match = negativePattern.exec(afterLabel)
  if (match) {
    const current = parseAmount(match[1])
    const ytd = match[2] ? parseAmount(match[2]) : undefined
    if (current >= range[0] && current <= range[1]) {
      return { current, ytd }
    }
  }

  return { current: 0 }
}

/**
 * Find negative amount before position, with range validation.
 * If no amount in range found nearby, search more broadly.
 */
function findAmountsBeforePositionWithRange(
  text: string,
  labelIndex: number,
  range: readonly [number, number]
): { current: number; ytd?: number } {
  // First try nearby (80 chars back)
  let result = findNegativeAmountInRange(text, labelIndex, 80, range)
  if (result.current > 0) return result

  // If not found, try broader search (150 chars back)
  result = findNegativeAmountInRange(text, labelIndex, 150, range)
  return result
}

/**
 * Search for a negative amount within a range before a position.
 */
function findNegativeAmountInRange(
  text: string,
  labelIndex: number,
  lookbackChars: number,
  range: readonly [number, number]
): { current: number; ytd?: number } {
  const startIndex = Math.max(0, labelIndex - lookbackChars)
  const beforeLabel = text.substring(startIndex, labelIndex)

  // Pattern: NEGATIVE current amount followed by optional positive YTD
  const negativePattern = /-(\d{1,3}(?: \d{3})* \d{2})\*?\s+(\d{1,3}(?: \d{3})* \d{2})?/g

  let bestMatch: { current: number; ytd?: number } | null = null
  let match

  while ((match = negativePattern.exec(beforeLabel)) !== null) {
    const current = parseAmount(match[1])
    const ytd = match[2] ? parseAmount(match[2]) : undefined

    // Check if current is within expected range
    if (current >= range[0] && current <= range[1]) {
      bestMatch = { current, ytd }
    }
  }

  return bestMatch || { current: 0 }
}

/**
 * Parse employer benefit items
 * Uses position-based matching: amounts appear AFTER their labels for benefits.
 * (Unlike deductions/taxes where amounts appear before labels)
 */
function parseEmployerBenefits(text: string, _amountPool: Array<{ current: number; ytd?: number; index: number }>, debug: boolean = false): ParsedPayItem[] {
  const items: ParsedPayItem[] = []

  // Benefits - these appear in the "Other Benefits" section
  // Format: "Employer Dental     66 17     66 17"
  // Include max YTD range to avoid picking up unrelated large values (like RSU YTD)
  const benefitLabels = [
    { label: /Employer\s*Vision/i, code: 'VISION_ER', name: 'Employer Vision', maxYtd: 500 },
    { label: /Employer\s*Dental/i, code: 'DENTAL_ER', name: 'Employer Dental', maxYtd: 2000 },
    { label: /Employer\s*Medica/i, code: 'MEDICAL_ER', name: 'Employer Medical', maxYtd: 50000 },
    { label: /Group\s*Term\s*Life/i, code: 'LIFE_INS_ER', name: 'Group Term Life', maxYtd: 500 },
    { label: /401K\s*Match/i, code: '401K_MATCH', name: '401(k) Match', maxYtd: 30000 },
  ]

  for (const { label, code, name, maxYtd } of benefitLabels) {
    const match = text.match(label)
    if (match && match.index !== undefined) {
      // For employer benefits, amounts appear AFTER the label
      const amounts = findAmountsAfterPositionWithValidation(text, match.index + match[0].length, maxYtd)
      if (amounts.current > 0) {
        items.push({
          categoryCode: 'employer_benefit',
          itemCode: code,
          itemName: name,
          currentAmount: amounts.current,
          ytdAmount: amounts.ytd,
        })
        if (debug) console.log(`  ${code}: $${amounts.current.toFixed(2)} (YTD: ${amounts.ytd?.toFixed(2) || 'N/A'})`)
      }
    }
  }

  return items
}

/**
 * Find the amount pair (current, YTD) that appears after a given position in text.
 * Used for employer benefits which have format: "Employer Dental     66 17     66 17"
 * Validates YTD against maxYtd to avoid picking up unrelated large values.
 */
function findAmountsAfterPositionWithValidation(text: string, startIndex: number, maxYtd: number): { current: number; ytd?: number } {
  // Look at text after the label (up to 40 chars forward - reduced to avoid grabbing wrong values)
  const afterLabel = text.substring(startIndex, startIndex + 40)

  // Pattern: current amount followed by optional YTD
  // Format: "66 17     66 17" or "8 52" or "1 266 40     1 266 40"
  const pairPattern = /(\d{1,3}(?: \d{3})* \d{2})\s+(\d{1,3}(?: \d{3})* \d{2})?/

  const match = pairPattern.exec(afterLabel)
  if (match) {
    const current = parseAmount(match[1])
    const ytdCandidate = match[2] ? parseAmount(match[2]) : undefined
    // Only accept YTD if it's within reasonable range for this benefit type
    const ytd = ytdCandidate && ytdCandidate <= maxYtd ? ytdCandidate : undefined
    if (current > 0) {
      return { current, ytd }
    }
  }

  // Try decimal format
  const decimalPattern = /\$?(\d{1,3}(?:,\d{3})*\.\d{2})/
  const decMatch = decimalPattern.exec(afterLabel)
  if (decMatch) {
    const current = parseAmount(decMatch[1])
    if (current > 0) {
      return { current }
    }
  }

  return { current: 0 }
}

/**
 * Parse direct deposit information
 */
function parseDeposits(text: string): ParsedDeposit[] {
  const deposits: ParsedDeposit[] = []

  // Find all "Checking N" labels and their positions
  const checkingLabels: Array<{ num: number; index: number }> = []
  const checkingPattern = /Checking\s+(\d+)/gi
  let match

  while ((match = checkingPattern.exec(text)) !== null) {
    checkingLabels.push({
      num: parseInt(match[1], 10),
      index: match.index,
    })
  }

  // Sort by checking number to process in order
  checkingLabels.sort((a, b) => a.num - b.num)

  // For each checking label, find its amount
  for (const label of checkingLabels) {
    // First, try to find amount AFTER the label (on same line)
    // Format: "Checking 3     -1 00     1 00"
    const afterLabel = text.substring(label.index, label.index + 60)
    let amount = findDepositAmountAfterLabel(afterLabel)

    // If not found after, try looking BEFORE the label
    // Due to interleaving, amounts may appear before their labels
    if (amount === 0) {
      const startIndex = Math.max(0, label.index - 80)
      const beforeLabel = text.substring(startIndex, label.index)
      amount = findLastNegativeAmount(beforeLabel)
    }

    if (amount > 0) {
      deposits.push({
        accountType: 'checking',
        amount: amount,
      })
    }
  }

  return deposits
}

/**
 * Find deposit amount after "Checking N" label.
 * Format: "Checking 3     -1 00     1 00" or "Checking 1" (no amount on same line)
 */
function findDepositAmountAfterLabel(text: string): number {
  // Skip past the "Checking N" part and look for negative amount
  const match = text.match(/Checking\s+\d+\s+(-\d+(?: \d+)* \d{2})/)
  if (match) {
    return parseAmount(match[1].replace('-', ''))
  }
  return 0
}

/**
 * Find the last negative amount in text (closest to the label).
 */
function findLastNegativeAmount(text: string): number {
  const pattern = /-(\d+(?: \d+)* \d{2})/g
  let lastAmount = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    const amount = parseAmount(match[1])
    if (amount > 0) {
      lastAmount = amount
    }
  }

  return lastAmount
}


/**
 * Parse net pay
 */
function parseNetPay(text: string): number | null {
  // Look for "Net Pay" with amount before or after it
  const netPayMatch = text.match(/Net\s*Pay/i)
  if (netPayMatch && netPayMatch.index !== undefined) {
    // First try: Look for amount AFTER "Net Pay" (e.g., "Net Pay  $5,947.61")
    const afterNetPay = text.substring(netPayMatch.index, netPayMatch.index + 40)
    // Look for $X,XXX.XX format
    let amountMatch = afterNetPay.match(/Net\s*Pay\s*\$\s*([\d,]+\s*\.\s*\d{2})/)
    if (amountMatch) {
      return parseAmount(amountMatch[1])
    }

    // Second try: Look for amount BEFORE "Net Pay" (e.g., "$0 00    Net Pay")
    // This happens in RSU vesting stubs
    const startIndex = Math.max(0, netPayMatch.index - 30)
    const beforeNetPay = text.substring(startIndex, netPayMatch.index)

    // Look for "$X XX" space-separated format (e.g., "$0 00")
    amountMatch = beforeNetPay.match(/\$(\d+(?: \d+)*)\s*$/)
    if (amountMatch) {
      return parseAmount(amountMatch[1])
    }

    // Look for "$X,XXX.XX" format before Net Pay
    amountMatch = beforeNetPay.match(/\$([\d,]+\.\d{2})\s*$/)
    if (amountMatch) {
      return parseAmount(amountMatch[1])
    }
  }

  return null
}

/**
 * Generate a file hash for duplicate detection
 */
export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}
