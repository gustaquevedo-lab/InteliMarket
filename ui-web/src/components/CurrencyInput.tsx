import React, { useState, useEffect } from "react"
import { formatInputPYG, formatInputDecimal, formatDecimal } from "../utils/format"

export interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number | string | null | undefined
  onChangeValue: (numValue: number, formattedStr: string) => void
  currency?: "PYG" | "BRL" | "USD"
  allowDecimals?: boolean
  prefix?: string
  className?: string
}

export default function CurrencyInput({
  value,
  onChangeValue,
  currency = "PYG",
  allowDecimals,
  prefix,
  className = "",
  placeholder,
  ...props
}: CurrencyInputProps) {
  const isDecimal = allowDecimals !== undefined ? allowDecimals : currency !== "PYG"

  const getInitialStr = (val: number | string | null | undefined) => {
    if (val == null || val === "") return ""
    if (isDecimal) {
      if (typeof val === "number") {
        return formatDecimal(val, 2)
      }
      return formatInputDecimal(val).formatted
    } else {
      return formatInputPYG(val).formatted
    }
  }

  const [displayValue, setDisplayValue] = useState<string>(() => getInitialStr(value))

  useEffect(() => {
    if (value === "" || value == null) {
      setDisplayValue("")
      return
    }
    const currentNum = isDecimal ? formatInputDecimal(displayValue).numValue : formatInputPYG(displayValue).numValue
    const externalNum = typeof value === "number" ? value : (isDecimal ? formatInputDecimal(value).numValue : formatInputPYG(value).numValue)
    if (Math.abs(currentNum - externalNum) > (isDecimal ? 0.009 : 0.5)) {
      setDisplayValue(getInitialStr(value))
    }
  }, [value, isDecimal])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (isDecimal) {
      const { formatted, numValue } = formatInputDecimal(raw)
      setDisplayValue(formatted)
      onChangeValue(numValue, formatted)
    } else {
      const { formatted, numValue } = formatInputPYG(raw)
      setDisplayValue(formatted)
      onChangeValue(numValue, formatted)
    }
  }

  return (
    <div className="relative w-full flex items-center">
      {prefix && (
        <span className="absolute left-3 text-xs font-mono font-bold text-gray-400 pointer-events-none select-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode={isDecimal ? "decimal" : "numeric"}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder || (isDecimal ? "0,00" : "0")}
        className={`${className} ${prefix ? "pl-7" : ""}`}
        {...props}
      />
    </div>
  )
}
