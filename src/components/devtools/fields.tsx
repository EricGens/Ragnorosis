import { useState } from 'react'

const inputClass =
  'w-full rounded border border-ink-600 bg-ink-950 px-1.5 py-0.5 text-right text-xs text-ink-100 focus:border-signal focus:outline-none'

/**
 * Numeric input that edits a local draft while focused and commits on blur/Enter, so the per-tick
 * re-render doesn't fight the user's typing. When not focused it always shows the live value.
 */
export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step,
  scale = 1,
  suffix,
}: {
  label: string
  value: number
  onCommit: (v: number) => void
  min?: number
  max?: number
  step?: number
  /** Display value = value / scale (e.g. 1e9 to edit dollars in billions). */
  scale?: number
  suffix?: string
}) {
  const shown = String(round(value / scale))
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    const n = Number(draft ?? shown)
    if (Number.isFinite(n)) {
      let v = n * scale
      if (min !== undefined) v = Math.max(min, v)
      if (max !== undefined) v = Math.min(max, v)
      onCommit(v)
    }
    setDraft(null)
  }

  return (
    <label className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-[10px] tracking-[0.12em] text-ink-400 uppercase">{label}</span>
      <span className="flex w-32 items-center gap-1">
        <input
          type="number"
          className={inputClass}
          value={draft ?? shown}
          min={min !== undefined ? min / scale : undefined}
          max={max !== undefined ? max / scale : undefined}
          step={step}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setDraft(shown)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        {suffix && <span className="text-[10px] text-ink-400">{suffix}</span>}
      </span>
    </label>
  )
}

export function TextField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <label className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-[10px] tracking-[0.12em] text-ink-400 uppercase">{label}</span>
      <input
        type="text"
        className={`${inputClass} w-32 text-left`}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setDraft(value)}
        onBlur={() => {
          onCommit(draft ?? value)
          setDraft(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-[10px] tracking-[0.12em] text-ink-400 uppercase">{label}</span>
      <select
        className="w-32 rounded border border-ink-600 bg-ink-950 px-1 py-0.5 text-xs text-ink-100 focus:border-signal focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-[10px] tracking-[0.12em] text-ink-400 uppercase">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="accent-signal" />
    </label>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3 border-t border-ink-700 pt-2 first:border-t-0 first:pt-0">
      <h3 className="mb-1 text-[10px] tracking-[0.25em] text-signal uppercase">{title}</h3>
      {children}
    </section>
  )
}

function round(v: number): number {
  return Math.round(v * 1e6) / 1e6
}
