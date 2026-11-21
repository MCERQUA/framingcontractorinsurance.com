"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { FadeIn } from "@/components/animations/FadeIn";
import { SITE } from "@/lib/site";
import { US_STATES, QUOTE_SERVICE_TYPES, YEARS_OPTIONS } from "@/lib/content";
import { CanonicalFields } from "@/components/quote/CanonicalFields";
import {
  emptyQuote, fieldsFor, oneYearAfter, resolveOptions, sanitizeYn, validateQuote, US_STATE_CODES,
  type Flat, type QuoteOptions,
} from "@/lib/quote/quoteSpec";
import { CheckCircle2, ShieldCheck, ArrowRight, Phone, Clock, Zap, MapPin } from "lucide-react";

const WEBHOOK_URL =
  "https://josh.jam-bot.com/social-api/api/leads/webhook/netlify?tenant=josh&site=framingcontractorinsurance.com";

// Canonical ACORD fields are ADDED alongside the existing fields (nothing renamed or removed).
// tradeType is the one class this site sells; the mapper derives SIC/NAICS from it (none are asked or sent).
const TRADE_TYPE = "Carpentry / Framing";
const QUOTE_OPTIONS: QuoteOptions = { yn: "audit", subcontractedDescriptionRequired: false, tradeTypeOptions: [TRADE_TYPE] };
// Legacy field -> canonical field it also feeds (copied on submit only when the legacy value is valid and the
// canonical field was not filled). Legacy values are still posted under their own names.
const ALIASES: Array<[string, string]> = [
  ["street_address", "address"], ["business_description", "businessDescription"],
  ["prior_year_gross_sales", "lastGrossSales"], ["prior_year_subcontractor_expenses", "lastSubcontractingCosts"],
  ["prior_year_employee_count", "lastEmployeeCount"], ["prior_year_employee_payroll", "lastEmployeePayroll"],
  ["estimated_gross_sales", "nextGrossEstimate"], ["estimated_subcontractor_expenses", "nextSubcontractingCosts"],
  ["estimated_employee_count", "nextEmployeeCount"], ["estimated_employee_payroll", "nextEmployeePayroll"],
  ["estimated_material_costs", "nextMaterialCosts"], ["prior_carrier_name", "currentCarrier"],
  ["prior_policy_expiration", "currentPolicyExpiration"], ["year_business_started", "yearBusinessStarted"],
];
// where a missing canonical value is entered on the legacy form (for the error summary)
const LEGACY_LABEL: Record<string, string> = {
  address: "Street address", lastGrossSales: "Prior year gross sales",
  lastSubcontractingCosts: "Prior year subcontractor expenses", businessDescription: "Description of business",
  firstName: "Full name", lastName: "Full name (first and last)",
};
// the legacy state select posts FULL names; canonical validation/physicalState use postal codes
const STATE_CODE: Record<string, string> = Object.fromEntries(
  US_STATES.map((n, i) => [n, US_STATE_CODES.filter((c) => c !== "DC")[i]])
);

const trustItems = [
  { icon: ShieldCheck, title: "Built for framers", desc: "Policies written for framing & rough-carpentry crews — not generic handyman coverage." },
  { icon: Zap, title: "~15-minute quotes", desc: "Real quotes from real markets, fast." },
  { icon: Clock, title: "2-hour claims response", desc: "When a loss hits, you reach a person." },
  { icon: MapPin, title: "All 50 states", desc: "Licensed nationwide — NPN #8608479." },
];

export default function QuotePage() {
  const [formData, setFormData] = useState({
    name: "",
    businessName: "",
    email: "",
    phone: "",
    state: "",
    serviceType: "",
    yearsInBusiness: "",
    message: "",
    "bot-field": "",
    street_address: "", city: "", zip: "", prior_year_gross_sales: "", prior_year_subcontractor_expenses: "", prior_year_employee_count: "", prior_year_employee_payroll: "", estimated_gross_sales: "", estimated_subcontractor_expenses: "", estimated_employee_count: "", estimated_employee_payroll: "", estimated_material_costs: "", subcontractors_have_insurance: "", percent_subcontractors_insured: "", coverage_for_uninsured_subcontractors: "", coverage_types: "", annual_gross_sales: "", year_business_started: "", business_description: "", class_code_1: "", class_code_2: "", class_code_3: "", class_code_4: "", class_code_5: "", residential_vs_commercial: "", new_vs_existing_construction: "", largest_projects: "", prior_carrier_name: "", prior_policy_number: "", prior_policy_expiration: "",
  });
  const qopts = resolveOptions(QUOTE_OPTIONS);
  const [cq, setCq] = useState<Flat>(() => ({ ...emptyQuote(), tradeType: TRADE_TYPE }));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attrVals, setAttrVals] = useState({ traffic_source: "", landing_url: "" });
  const attr = useRef(attrVals);
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      let src = p.get("utm_source") || p.get("ref") || "";
      if (!src && document.referrer) { try { src = new URL(document.referrer).hostname; } catch { src = document.referrer; } }
      if (!src) src = "direct";
      attr.current = { traffic_source: src, landing_url: window.location.href };
      setAttrVals(attr.current);
    } catch {}
  }, []);
  const setField = (name: string, value: string) => setCq((prev) => ({ ...prev, [name]: value }));
  const touch = (name: string) => setTouched((t) => ({ ...t, [name]: true }));

  // Build the canonical record from the add-on state + the legacy fields that feed it.
  const buildCanonical = (): Flat => {
    const fd = formData as Record<string, string>;
    const data: Flat = { ...cq };
    data.name = (fd.name || "").trim();
    data.businessName = fd.businessName; data.email = fd.email; data.phone = fd.phone;
    data.city = fd.city; data.zip = fd.zip;
    data.state = fd.state; // full name, as the legacy select posts it (mapper translates)
    const parts = data.name.split(/\s+/).filter(Boolean);
    data.firstName = parts[0] || "";
    data.lastName = parts.slice(1).join(" ");
    for (const [from, to] of ALIASES) {
      if (!(data[to] || "").trim() && (fd[from] || "").trim()) data[to] = fd[from].trim();
    }
    if (data.businessStartDate) data.yearBusinessStarted = data.businessStartDate.slice(0, 4);
    if (!data.desiredExpirationDate && data.desiredEffectiveDate) data.desiredExpirationDate = oneYearAfter(data.desiredEffectiveDate);
    if (data.yn_coverageTerminated === "Yes") {
      for (const r of ["nonPayment", "nonRenewal", "agentStopRepresenting", "underwriting", "conditionCorrected"]) {
        const k = `general_coverageTerminated__${r}`; if (data[k] !== "Yes") data[k] = "No";
      }
    }
    return sanitizeYn(data);
  };
  const canonical = buildCanonical();
  // validation copy: state as a postal code (validator requirement only; the posted value stays the legacy one)
  const errors = validateQuote(
    { ...canonical, state: STATE_CODE[canonical.state] || canonical.state }, new Date(), QUOTE_OPTIONS
  );
  // errors on fields the legacy inputs feed are shown in the summary under the legacy label
  const pretty = (k: string) => { const t = k.replace(/_/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };
  const summaryFor = (errs: Record<string, string>) => {
    const out = new Set<string>();
    for (const k of Object.keys(errs)) {
      const alias = ALIASES.find(([, to]) => to === k);
      if (LEGACY_LABEL[k]) out.add(LEGACY_LABEL[k]);
      else if (alias) out.add(pretty(alias[0]));
      else if (k === "state") out.add("Primary state");
      else if (k === "zip") out.add("ZIP code");
      else if (k === "city") out.add("City");
    }
    return Array.from(out);
  };
  const [summary, setSummary] = useState<string[]>([]);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (formData["bot-field"]) return;
    const errs = errors;
    if (Object.keys(errs).length) {
      setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(errs).map((k) => [k, true])) }));
      setSummary(summaryFor(errs));
      setError("Please complete the highlighted fields.");
      return;
    }
    setSummary([]);
    setSubmitting(true);
    setError("");
    // legacy fields keep their own names; canonical fields are added next to them
    const payload: Record<string, string> = { ...(formData as Record<string, string>) };
    for (const f of fieldsFor(QUOTE_OPTIONS)) {
      if (f === "sicCode" || f === "naicsCode") continue; // never asked or sent (agency-assigned)
      if (f in payload && f !== "address") continue; // shared names (name, businessName, email, phone, state, city, zip) stay legacy
      payload[f] = canonical[f] ?? "";
    }
    payload.traffic_source = attr.current.traffic_source;
    payload.landing_url = attr.current.landing_url;
    let captured = false;
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_name: "quote", source: "framingcontractorinsurance.com", ...payload }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        // 2xx counts only if the leads API did not say stored:false
        captured = !(body && body.stored === false);
      }
    } catch {}
    if (!captured) {
      // webhook failed or did not store the lead: Netlify Forms fallback
      try {
        const fres = await fetch("/__forms.html", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ "form-name": "quote", ...payload }).toString(),
        });
        captured = fres.ok;
      } catch {}
    }
    try {
      if (!captured) throw new Error("lead not captured");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please call us at 844-967-5247 or try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-adobe bg-cream/50 text-espresso placeholder-mocha/60 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20 transition-all text-sm";
  const labelClass = "block text-sm font-heading font-semibold text-espresso mb-1.5";

  return (
    <>
      <Navbar />
      <main>
        <section className="relative bg-warm-radial pt-32 pb-20 md:pt-40 md:pb-28">
          <div className="container-wide">
            <FadeIn className="text-center max-w-2xl mx-auto mb-12">
              <span className="pill-clay"><ShieldCheck className="h-3.5 w-3.5" /> Free quote</span>
              <h1 className="mt-5 font-heading font-extrabold text-espresso text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
                Get your{" "}
                <span className="bg-gradient-to-r from-clay via-clay-light to-gold-dark bg-clip-text text-transparent">
                  framing contractor insurance quote
                </span>
              </h1>
              <p className="mt-5 lead">
                Tell us about your framing operation. We&rsquo;ll shop A-rated
                specialty trades markets and come back with real quotes in about
                15 minutes — no obligation.
              </p>
            </FadeIn>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Trust sidebar */}
              <div className="space-y-4">
                {trustItems.map((item) => (
                  <FadeIn key={item.title}>
                    <div className="flex gap-3 p-5 rounded-2xl bg-white border border-adobe shadow-card">
                      <span className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-clay/10 text-clay">
                        <item.icon className="h-5 w-5" strokeWidth={2.2} />
                      </span>
                      <div>
                        <p className="font-heading font-bold text-espresso text-sm">{item.title}</p>
                        <p className="text-mocha text-xs leading-relaxed mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  </FadeIn>
                ))}
                <FadeIn>
                  <div className="p-5 rounded-2xl bg-espresso text-cream text-center">
                    <p className="text-xs font-heading font-bold uppercase tracking-wider text-gold mb-2">
                      Prefer to call?
                    </p>
                    <a href={SITE.phoneHref} className="flex items-center justify-center gap-2 text-cream font-heading font-extrabold text-xl hover:text-gold-light transition-colors">
                      <Phone className="h-5 w-5" />
                      {SITE.phone}
                    </a>
                    <p className="text-xs text-cream/60 mt-1">{SITE.hours}</p>
                  </div>
                </FadeIn>
              </div>

              {/* Form */}
              <div className="lg:col-span-2">
                {submitted ? (
                  <FadeIn>
                    <div className="p-10 md:p-12 rounded-3xl bg-white border border-adobe shadow-card text-center">
                      <div className="w-16 h-16 rounded-full bg-sage/15 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8 text-sage" />
                      </div>
                      <h2 className="font-heading font-extrabold text-espresso text-2xl mb-3">
                        Quote request received
                      </h2>
                      <p className="text-mocha mb-2">
                        Thank you! We&rsquo;ll review your operation and reach out within one
                        business day with personalized quotes.
                      </p>
                      <p className="text-sm text-mocha">
                        Need it sooner? Call{" "}
                        <a href={SITE.phoneHref} className="text-clay font-heading font-semibold">
                          {SITE.phone}
                        </a>
                        .
                      </p>
                      <Link href="/" className="btn-secondary mt-6 inline-flex">
                        Back to home
                      </Link>
                    </div>
                  </FadeIn>
                ) : (
                  <FadeIn>
                    <form
                      name="quote"
                      data-netlify="true"
                      netlify-honeypot="bot-field"
                      onSubmit={handleSubmit}
                      className="rounded-3xl bg-white border border-adobe shadow-card p-7 md:p-9 space-y-5"
                    >
                      <input type="hidden" name="form-name" value="quote" />
                      <input
                        name="bot-field"
                        type="hidden"
                        value={formData["bot-field"]}
                        onChange={handleChange}
                        className="hidden"
                      />

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="name" className={labelClass}>Full name *</label>
                          <input id="name" name="name" type="text" required value={formData.name} onChange={handleChange} placeholder="Jane Smith" className={inputClass} />
                        </div>
                        <div>
                          <label htmlFor="businessName" className={labelClass}>Business name *</label>
                          <input id="businessName" name="businessName" type="text" required value={formData.businessName} onChange={handleChange} placeholder="Smith Brothers Framing LLC" className={inputClass} />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="email" className={labelClass}>Email *</label>
                          <input id="email" name="email" type="email" required value={formData.email} onChange={handleChange} placeholder="jane@smithframing.com" className={inputClass} />
                        </div>
                        <div>
                          <label htmlFor="phone" className={labelClass}>Phone *</label>
                          <input id="phone" name="phone" type="tel" required value={formData.phone} onChange={handleChange} placeholder="(512) 555-0100" className={inputClass} />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="state" className={labelClass}>Primary state *</label>
                          <select id="state" name="state" required value={formData.state} onChange={handleChange} className={inputClass}>
                            <option value="">Select a state…</option>
                            {US_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="yearsInBusiness" className={labelClass}>Years in business</label>
                          <select id="yearsInBusiness" name="yearsInBusiness" value={formData.yearsInBusiness} onChange={handleChange} className={inputClass}>
                            <option value="">Select…</option>
                            {YEARS_OPTIONS.map((y) => (<option key={y} value={y}>{y}</option>))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="serviceType" className={labelClass}>What do you need? *</label>
                        <select id="serviceType" name="serviceType" required value={formData.serviceType} onChange={handleChange} className={inputClass}>
                          <option value="">Select coverage…</option>
                          {QUOTE_SERVICE_TYPES.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="message" className={labelClass}>
                          Tell us about your operation{" "}
                          <span className="text-mocha/60 font-normal">(optional)</span>
                        </label>
                        <textarea
                          id="message" name="message" rows={4} value={formData.message}
                          onChange={handleChange} placeholder="Crew size, residential vs. commercial, typical project size, W-2 vs. subs, coverage lines needed, current insurer, loss history, or anything else that helps us quote accurately…"
                          className={`${inputClass} resize-none`}
                        />
                      </div>

                      <input type="hidden" name="traffic_source" value={attrVals.traffic_source} readOnly />
                      <input type="hidden" name="landing_url" value={attrVals.landing_url} readOnly />

                      <CanonicalFields
                        v={cq}
                        setField={setField}
                        touched={touched}
                        touch={touch}
                        errors={errors}
                        opts={qopts}
                        mailing={{
                          address: formData.street_address,
                          city: formData.city,
                          stateCode: STATE_CODE[formData.state] || "",
                          zip: formData.zip,
                        }}
                        classes={{
                          section: "space-y-4",
                          heading: "font-heading font-bold text-espresso text-lg",
                          grid: "grid sm:grid-cols-2 gap-4",
                          label: labelClass,
                          input: inputClass,
                          error: "text-red-600 text-xs mt-1",
                          legend: labelClass,
                          option: "flex items-center gap-2 text-sm text-espresso",
                          detail: "mt-2 grid sm:grid-cols-2 gap-3 pl-4 border-l-2 border-adobe",
                        }}
                      />

                      {error && (
                        <p className="text-red-600 text-sm font-medium">
                          {error}
                          {summary.length > 0 && <> Also needed above: {summary.join(", ")}.</>}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-clay-gradient text-white font-heading font-bold rounded-full shadow-warm hover:shadow-warm-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {submitting ? "Sending…" : "Request my free quote"}
                        {!submitting && <ArrowRight className="h-5 w-5" />}
                      </button>
                      <p className="text-xs text-center text-mocha/70">
                        No spam. No commitment. We&rsquo;ll only contact you about your quote.
                      </p>
                    
        {/* complete contractor field set — forms-required-fields.json */}
        <div>
          <label className="block text-sm font-bold mb-1.5">Street address</label>
          <input type="text" name="street_address" value={formData.street_address} onChange={(e) => setFormData({ ...formData, street_address: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">City</label>
          <input type="text" name="city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">ZIP code</label>
          <input type="text" name="zip" value={formData.zip} onChange={(e) => setFormData({ ...formData, zip: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Prior year gross sales</label>
          <input type="text" name="prior_year_gross_sales" value={formData.prior_year_gross_sales} onChange={(e) => setFormData({ ...formData, prior_year_gross_sales: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Prior year subcontractor expenses</label>
          <input type="text" name="prior_year_subcontractor_expenses" value={formData.prior_year_subcontractor_expenses} onChange={(e) => setFormData({ ...formData, prior_year_subcontractor_expenses: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Prior year employee count</label>
          <input type="number" name="prior_year_employee_count" value={formData.prior_year_employee_count} onChange={(e) => setFormData({ ...formData, prior_year_employee_count: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Prior year employee payroll</label>
          <input type="text" name="prior_year_employee_payroll" value={formData.prior_year_employee_payroll} onChange={(e) => setFormData({ ...formData, prior_year_employee_payroll: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Estimated gross sales (next 12 months)</label>
          <input type="text" name="estimated_gross_sales" value={formData.estimated_gross_sales} onChange={(e) => setFormData({ ...formData, estimated_gross_sales: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Estimated subcontractor expenses (next 12 months)</label>
          <input type="text" name="estimated_subcontractor_expenses" value={formData.estimated_subcontractor_expenses} onChange={(e) => setFormData({ ...formData, estimated_subcontractor_expenses: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Estimated employee count (year total)</label>
          <input type="number" name="estimated_employee_count" value={formData.estimated_employee_count} onChange={(e) => setFormData({ ...formData, estimated_employee_count: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Estimated employee annual payroll</label>
          <input type="text" name="estimated_employee_payroll" value={formData.estimated_employee_payroll} onChange={(e) => setFormData({ ...formData, estimated_employee_payroll: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Estimated material costs</label>
          <input type="text" name="estimated_material_costs" value={formData.estimated_material_costs} onChange={(e) => setFormData({ ...formData, estimated_material_costs: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Do your subcontractors have insurance?</label>
          <select name="subcontractors_have_insurance" value={formData.subcontractors_have_insurance} onChange={(e) => setFormData({ ...formData, subcontractors_have_insurance: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg">
            <option value="">Select...</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">What percent of your subcontractors have insurance?</label>
          <input type="number" name="percent_subcontractors_insured" value={formData.percent_subcontractors_insured} onChange={(e) => setFormData({ ...formData, percent_subcontractors_insured: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Do you need coverage for uninsured subcontractors?</label>
          <select name="coverage_for_uninsured_subcontractors" value={formData.coverage_for_uninsured_subcontractors} onChange={(e) => setFormData({ ...formData, coverage_for_uninsured_subcontractors: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg">
            <option value="">Select...</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Coverages requested (checkboxes)</label>
          <div className="flex flex-wrap pt-1">
            <label className="inline-flex items-center gap-2 mr-4 mb-1"><input type="checkbox" name="coverage_types" value="General liability" onChange={(e) => { const cur = (formData.coverage_types || "").split(", ").filter(Boolean); const next = e.target.checked ? [...cur, e.target.value] : cur.filter((v) => v !== e.target.value); setFormData({ ...formData, coverage_types: next.join(", ") }); }} /><span className="text-sm">General liability</span></label>
            <label className="inline-flex items-center gap-2 mr-4 mb-1"><input type="checkbox" name="coverage_types" value="Commercial auto" onChange={(e) => { const cur = (formData.coverage_types || "").split(", ").filter(Boolean); const next = e.target.checked ? [...cur, e.target.value] : cur.filter((v) => v !== e.target.value); setFormData({ ...formData, coverage_types: next.join(", ") }); }} /><span className="text-sm">Commercial auto</span></label>
            <label className="inline-flex items-center gap-2 mr-4 mb-1"><input type="checkbox" name="coverage_types" value="Workers compensation" onChange={(e) => { const cur = (formData.coverage_types || "").split(", ").filter(Boolean); const next = e.target.checked ? [...cur, e.target.value] : cur.filter((v) => v !== e.target.value); setFormData({ ...formData, coverage_types: next.join(", ") }); }} /><span className="text-sm">Workers compensation</span></label>
            <label className="inline-flex items-center gap-2 mr-4 mb-1"><input type="checkbox" name="coverage_types" value="Umbrella / excess" onChange={(e) => { const cur = (formData.coverage_types || "").split(", ").filter(Boolean); const next = e.target.checked ? [...cur, e.target.value] : cur.filter((v) => v !== e.target.value); setFormData({ ...formData, coverage_types: next.join(", ") }); }} /><span className="text-sm">Umbrella / excess</span></label>
            <label className="inline-flex items-center gap-2 mr-4 mb-1"><input type="checkbox" name="coverage_types" value="Pollution liability" onChange={(e) => { const cur = (formData.coverage_types || "").split(", ").filter(Boolean); const next = e.target.checked ? [...cur, e.target.value] : cur.filter((v) => v !== e.target.value); setFormData({ ...formData, coverage_types: next.join(", ") }); }} /><span className="text-sm">Pollution liability</span></label>
            <label className="inline-flex items-center gap-2 mr-4 mb-1"><input type="checkbox" name="coverage_types" value="Professional liability" onChange={(e) => { const cur = (formData.coverage_types || "").split(", ").filter(Boolean); const next = e.target.checked ? [...cur, e.target.value] : cur.filter((v) => v !== e.target.value); setFormData({ ...formData, coverage_types: next.join(", ") }); }} /><span className="text-sm">Professional liability</span></label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Annual gross sales</label>
          <input type="text" name="annual_gross_sales" value={formData.annual_gross_sales} onChange={(e) => setFormData({ ...formData, annual_gross_sales: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Year business started</label>
          <input type="number" name="year_business_started" value={formData.year_business_started} onChange={(e) => setFormData({ ...formData, year_business_started: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Description of business</label>
          <textarea name="business_description" rows={3} value={formData.business_description} onChange={(e) => setFormData({ ...formData, business_description: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Class code 1 (+ % of operations)</label>
          <input type="text" name="class_code_1" value={formData.class_code_1} onChange={(e) => setFormData({ ...formData, class_code_1: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Class code 2 (+ % of operations)</label>
          <input type="text" name="class_code_2" value={formData.class_code_2} onChange={(e) => setFormData({ ...formData, class_code_2: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Class code 3 (+ % of operations)</label>
          <input type="text" name="class_code_3" value={formData.class_code_3} onChange={(e) => setFormData({ ...formData, class_code_3: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Class code 4 (+ % of operations)</label>
          <input type="text" name="class_code_4" value={formData.class_code_4} onChange={(e) => setFormData({ ...formData, class_code_4: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Class code 5 (+ % of operations)</label>
          <input type="text" name="class_code_5" value={formData.class_code_5} onChange={(e) => setFormData({ ...formData, class_code_5: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Residential vs commercial split</label>
          <input type="text" name="residential_vs_commercial" value={formData.residential_vs_commercial} onChange={(e) => setFormData({ ...formData, residential_vs_commercial: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">New construction vs existing / remodel</label>
          <input type="text" name="new_vs_existing_construction" value={formData.new_vs_existing_construction} onChange={(e) => setFormData({ ...formData, new_vs_existing_construction: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">5 largest projects ever (description + dollar amount)</label>
          <textarea name="largest_projects" rows={3} value={formData.largest_projects} onChange={(e) => setFormData({ ...formData, largest_projects: e.target.value })} placeholder="Description and dollar amount for each" className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Prior insurance carrier name</label>
          <input type="text" name="prior_carrier_name" value={formData.prior_carrier_name} onChange={(e) => setFormData({ ...formData, prior_carrier_name: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Prior policy number</label>
          <input type="text" name="prior_policy_number" value={formData.prior_policy_number} onChange={(e) => setFormData({ ...formData, prior_policy_number: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1.5">Prior policy expiration date</label>
          <input type="date" name="prior_policy_expiration" value={formData.prior_policy_expiration} onChange={(e) => setFormData({ ...formData, prior_policy_expiration: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg" />
        </div>
</form>
                  </FadeIn>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
