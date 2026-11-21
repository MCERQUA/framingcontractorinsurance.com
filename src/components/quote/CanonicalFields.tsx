"use client"
// Canonical ACORD quote fields ADDED alongside framingcontractorinsurance.com's existing quote form.
// Helpers (text/area/select/radio/checks) and ynBlock are copied verbatim from the shared QuoteForm.tsx
// (~/josh-desk-1/_shared/quote-component). Existing legacy fields are untouched; this only renders the canonical
// fields the legacy form does not have. Field names come from ../../lib/quote/quoteSpec (never renamed).
// Hard rule: no signature / signed-date / initials field. yn_* radios have no default (blank stays blank).
import React from 'react'
import {
  YES_NO, US_STATE_CODES, ENTITY_TYPES, GL_EACH_OCCURRENCE, GL_GENERAL_AGGREGATE, GL_PRODUCTS_COMPOPS,
  GL_PERSONAL_ADV, GL_RENTED_PREMISES, GL_MEDICAL_EXPENSE, LOSS_LINES, SAFETY_ELEMENTS, POOL_FEATURES,
  RENT_EQUIPMENT_TYPES, TERMINATION_REASONS, YN_QUESTIONS, GENERAL_DETAILS, QUESTIONS_WITH_EXPLAIN, EXPLAIN_MAX,
  EXPLAIN_DEFAULT_MAX, MAX_LEN, SELECT_OPTIONS, detailName, ynKeysFor,
  type Flat, type QuoteOptions,
} from "@/lib/quote/quoteSpec"

export interface CanonicalFieldsProps {
  v: Flat
  setField: (name: string, value: string) => void
  touched: Record<string, boolean>
  touch: (name: string) => void
  errors: Record<string, string>
  opts: Required<QuoteOptions>
  /** legacy mailing values, used only by the "same as mailing" button */
  mailing: { address: string; city: string; stateCode: string; zip: string }
  classes: { section: string; heading: string; grid: string; label: string; input: string; error: string; legend: string; option: string; detail: string }
}

export function CanonicalFields({ v, setField, touched, touch, errors, opts, mailing, classes: C }: CanonicalFieldsProps) {
  const ynKeys = ynKeysFor(opts)
  const set = setField
  const err = (name: string) => (touched[name] ? errors[name] : undefined)
  const yes = (k: string) => v[`yn_${k}`] === "Yes"
  const Err = ({ n }: { n: string }) => (err(n) ? <p className={C.error} role="alert">{err(n)}</p> : null)
  const text = (name: string, label: string, o: { required?: boolean; type?: string; ph?: string } = {}) => (
    <div key={name}>
      <label htmlFor={`f-${name}`} className={C.label}>{label}{o.required === false ? '' : ' *'}</label>
      <input id={`f-${name}`} name={name} type={o.type ?? 'text'} value={v[name] ?? ''} placeholder={o.ph}
        maxLength={MAX_LEN[name]} className={C.input}
        onChange={e => set(name, e.target.value)} onBlur={() => touch(name)} />
      <Err n={name} />
    </div>
  )
  const area = (name: string, label: string, max?: number, required = true) => (
    <div key={name}>
      <label htmlFor={`f-${name}`} className={C.label}>{label}{required ? ' *' : ''}</label>
      <textarea id={`f-${name}`} name={name} rows={3} maxLength={max} value={v[name] ?? ''} className={C.input}
        onChange={e => set(name, e.target.value)} onBlur={() => touch(name)} />
      <Err n={name} />
    </div>
  )
  const select = (name: string, label: string, options: string[], required = true) => (
    <div key={name}>
      <label htmlFor={`f-${name}`} className={C.label}>{label}{required ? ' *' : ''}</label>
      <select id={`f-${name}`} name={name} value={v[name] ?? ''} className={C.input}
        onChange={e => { set(name, e.target.value); touch(name) }}>
        <option value="">Select</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <Err n={name} />
    </div>
  )
  // Radio pair with NO default checked: unanswered stays ''.
  const radio = (name: string, label: string, options: string[] = YES_NO, required = true) => (
    <fieldset key={name}>
      <legend className={C.legend}>{label}{required ? ' *' : ''}</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {options.map(o => (
          <label key={o} className={C.option}>
            <input type="radio" name={name} value={o} checked={v[name] === o}
              onChange={() => { set(name, o); touch(name) }} />
            {o}
          </label>
        ))}
      </div>
      <Err n={name} />
    </fieldset>
  )
  const checks = (name: string, label: string, options: string[]) => {
    const picked = v[name] ? v[name].split(', ') : []
    const toggle = (o: string) => {
      const next = picked.includes(o) ? picked.filter(p => p !== o) : [...picked, o]
      set(name, options.filter(x => next.includes(x)).join(', ')); touch(name)
    }
    return (
      <fieldset key={name}>
        <legend className={C.legend}>{label} *</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {options.map(o => (
            <label key={o} className={C.option}>
              <input type="checkbox" checked={picked.includes(o)} onChange={() => toggle(o)} />{o}
            </label>
          ))}
        </div>
        <Err n={name} />
      </fieldset>
    )
  }
  const ynBlock = (key: string) => {
    const q = YN_QUESTIONS.find(x => x.key === key)!
    const out: React.ReactNode[] = [radio(`yn_${key}`, q.label, YES_NO, opts.ynRequired)]
    if (yes(key)) {
      if (QUESTIONS_WITH_EXPLAIN.includes(key))
        out.push(<div key={`x-${key}`}>{area(`ynExplain_${key}`, 'Please explain', EXPLAIN_MAX[key] ?? EXPLAIN_DEFAULT_MAX)}</div>)
      if (GENERAL_DETAILS[key])
        out.push(<div key={`d-${key}`} className={C.detail}>{GENERAL_DETAILS[key].map(f =>
          text(detailName(key, f.key), f.label, { type: f.kind === 'date' ? 'date' : 'text' }))}</div>)
      if (key === 'coverageTerminated')
        out.push(<div key="ct" className={C.detail}>
          <p className={C.legend}>Why was coverage terminated? (tick at least one) *</p>
          {[...TERMINATION_REASONS, { key: 'conditionCorrected', label: 'Condition Corrected' }].map(r => {
            const n = `general_coverageTerminated__${r.key}`
            return <label key={r.key} className={C.option}><input type="checkbox" checked={v[n] === 'Yes'}
              onChange={e => { set(n, e.target.checked ? 'Yes' : ''); touch('general_coverageTerminated__nonPayment') }} />{r.label}</label>
          })}
          <Err n="general_coverageTerminated__nonPayment" />
          {v.general_coverageTerminated__conditionCorrected === 'Yes' &&
            text('general_coverageTerminated__conditionCorrectedDescription', 'Describe how the condition was corrected')}
        </div>)
      if (key === 'safetyProgramsExist') {
        out.push(<div key="sp">{checks('safetyProgramElements', 'Safety program elements', SAFETY_ELEMENTS)}</div>)
        if ((v.safetyProgramElements ?? '').split(', ').includes('Other')) out.push(text('safetyOtherText', 'Other safety program'))
      }
      if (key === 'athleticTeams')
        out.push(<div key="at" className={C.detail}>{text('athleticSportDescription', 'Sport')}{radio('athleticContactSport', 'Contact sport?')}
          {text('athleticSponsorshipExtent', 'Extent of sponsorship')}{select('athleticTeamAgeGroup', 'Age group', SELECT_OPTIONS.athleticTeamAgeGroup)}</div>)
      if (key === 'swimmingPool')
        out.push(<div key="pool" className={C.detail}>{select('poolConstruction', 'Pool construction', SELECT_OPTIONS.poolConstruction)}
          {checks('poolSafetyFeatures', 'Pool safety features', POOL_FEATURES)}</div>)
      if (key === 'rentOrLoanEquipment')
        out.push(<div key="re" className={C.detail}>{checks('rentEquipmentTypes', 'Type of equipment rented or loaned', RENT_EQUIPMENT_TYPES)}
          {radio('rentEquipmentInstructionGiven', 'Is instruction given to renters?')}</div>)
      if (key === 'leaseEmployees')
        out.push(<div key="le" className={C.detail}>{radio('leaseEmployeesWorkersCompCarried', 'Workers compensation carried for leased employees?')}</div>)
    }
    return <div key={`yn-${key}`} className="space-y-2">{out}</div>
  }

  const copyMailing = () => {
    set("physicalAddress", mailing.address.slice(0, MAX_LEN.physicalAddress))
    set("physicalCity", mailing.city.slice(0, MAX_LEN.physicalCity))
    set("physicalState", mailing.stateCode)
    set("physicalZip", mailing.zip)
  }

  return (
    <div className="space-y-8 pt-6 border-t border-adobe">
      <section className={C.section}>
        <h3 className={C.heading}>A few more details for your quote</h3>
        <div className={C.grid}>
          {select("entityType", "Business entity", ENTITY_TYPES)}
          {text("businessStartDate", "Date business started", { type: "date" })}
          {opts.fein && text("fein", "FEIN (XX-XXXXXXX)", { ph: "00-0000000" })}
        </div>
      </section>

      <section className={C.section}>
        <h3 className={C.heading}>Physical location</h3>
        <button type="button" onClick={copyMailing} className="text-sm underline">Physical location is the same as the address above</button>
        <div className={C.grid}>
          {text("physicalAddress", "Physical street address")}{text("physicalCity", "Physical city")}
          {opts.physicalCounty && text("physicalCounty", "Physical county")}
          {select("physicalState", "Physical state", US_STATE_CODES)}{text("physicalZip", "Physical ZIP")}
          {text("locationDescription", "Description of the premises")}
          {select("premisesCityLimits", "Inside / outside city limits", SELECT_OPTIONS.premisesCityLimits)}
          {select("premisesInterest", "Owner / tenant of premises", SELECT_OPTIONS.premisesInterest)}
        </div>
      </section>

      <section className={C.section}>
        <h3 className={C.heading}>Operations</h3>
        <div className={C.grid}>
          {select("tradeType", "Trade / class of business", opts.tradeTypeOptions)}
          {text("statesOfOperation", "States where you work", { ph: "e.g. AZ, NV" })}
          {text("fullTimeEmployees", "Full-time employees")}{text("partTimeEmployees", "Part-time employees")}
          {radio("usesSubcontractors", "Do you use subcontractors?")}
          {text("workSubcontractedPercent", "Percent of work subcontracted (0 if none)")}
          {v.usesSubcontractors === "Yes" && radio("subsCarryInsurance", "Do your subs carry their own insurance?")}
        </div>
        {v.usesSubcontractors === "Yes" && area("workSubcontractedDescription", "Type of work subcontracted", 136, opts.subcontractedDescriptionRequired)}
      </section>

      <section className={C.section}>
        <h3 className={C.heading}>Coverage and history</h3>
        <div className={C.grid}>
          {text("desiredEffectiveDate", "Coverage start date", { type: "date" })}
          {select("glEachOccurrence", "Each occurrence limit", GL_EACH_OCCURRENCE)}
          {select("glGeneralAggregate", "General aggregate limit", GL_GENERAL_AGGREGATE)}
          {select("glProductsCompOpsAggregate", "Products / completed operations aggregate", GL_PRODUCTS_COMPOPS)}
          {select("glPersonalAdvertisingInjury", "Personal & advertising injury limit", GL_PERSONAL_ADV)}
          {select("glDamageToRentedPremises", "Damage to rented premises limit", GL_RENTED_PREMISES)}
          {select("glMedicalExpense", "Medical expense limit", GL_MEDICAL_EXPENSE)}
          {select("glTrigger", "Occurrence / claims-made", SELECT_OPTIONS.glTrigger)}
          {select("glAggregateAppliesTo", "How the aggregate applies", SELECT_OPTIONS.glAggregateAppliesTo)}
          {select("billingPlan", "Billing plan", SELECT_OPTIONS.billingPlan)}
          {radio("currentlyInsured", "Currently insured?")}
          {radio("lossesLast3Years", "Any losses in the last 3 years?")}
        </div>
        {v.lossesLast3Years === "Yes" && (
          <div className={C.detail}>
            {text("lossCount", "Number of losses")}{select("lossLineOfBusiness", "Loss line of business", LOSS_LINES)}
            {text("lossDate", "Loss date", { type: "date" })}{text("lossDescription", "Loss description")}
            {select("lossHistoryStatus", "Open / closed", SELECT_OPTIONS.lossHistoryStatus)}
            {text("lossAmountPaid", "Amount paid")}{text("lossAmountReserved", "Amount reserved")}
            {radio("lossSubrogation", "Subrogation?")}
          </div>
        )}
      </section>

      {ynKeys.length > 0 && (
        <section className={C.section}>
          <h3 className={C.heading}>Underwriting questions</h3>
          {ynKeys.map(ynBlock)}
        </section>
      )}
    </div>
  )
}

export default CanonicalFields
