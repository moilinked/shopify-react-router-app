import { useEffect, useState } from 'react'

interface DateTimeFieldProps {
  label: string
  value: string
  required?: boolean
  disabled?: boolean
  error?: string
  onChange: (value: string) => void
}

export function DateTimeField({ label, value, required, disabled, error, onChange }: DateTimeFieldProps) {
  const { datePart, timePart } = splitDateTimeValue(value)
  const [timeInput, setTimeInput] = useState(timePart || '00:00:00')
  const [timeError, setTimeError] = useState<string | undefined>()

  useEffect(() => {
    setTimeInput(timePart || '00:00:00')
  }, [timePart])

  const buildDateTimeValue = (date: string, time: string) => {
    if (!date) return ''
    const safeTime = time || '00:00:00'
    return `${date} ${safeTime}`
  }

  const handleDateChange = (e: Event) => {
    const newDate = (e.target as HTMLInputElement).value
    const combined = buildDateTimeValue(newDate, timeInput || '')
    onChange(combined)
  }

  const isValidTimeFormat = (time: string): boolean => {
    if (!time) return true
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/
    return timeRegex.test(time)
  }

  const handleTimeChange = (e: Event) => {
    const newTime = (e.target as HTMLInputElement).value
    setTimeInput(newTime)

    // 校验格式
    if (newTime && !isValidTimeFormat(newTime)) {
      setTimeError('格式错误')
      return
    }

    setTimeError(undefined)

    if (!datePart) {
      // 没有选择日期时只改时间没有意义，保持原值
      return
    }

    const combined = buildDateTimeValue(datePart, newTime)
    onChange(combined)
  }

  return (
    <s-stack gap="small-300">
      <s-text>
        {label}
        {required && <s-text tone="critical"> *</s-text>}
      </s-text>
      <s-stack direction="inline" gap="small">
        <s-date-field
          label=""
          labelAccessibilityVisibility="exclusive"
          value={datePart || ''}
          required={required}
          disabled={disabled}
          error={error}
          onChange={handleDateChange}
        />
        <s-box inlineSize="100px">
          <s-text-field
            label=""
            labelAccessibilityVisibility="exclusive"
            value={timeInput}
            required={required}
            disabled={disabled}
            placeholder="HH:MM:SS"
            error={timeError}
            onInput={handleTimeChange}
          />
        </s-box>
      </s-stack>
    </s-stack>
  )
}

function splitDateTimeValue(value: string): { datePart: string; timePart: string } {
  if (!value) {
    return { datePart: '', timePart: '' }
  }

  const normalized = value.trim().replace('T', ' ')
  const [datePart = '', timePart = ''] = normalized.split(' ')

  return {
    datePart,
    timePart: timePart || '00:00:00'
  }
}
