"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Building2, FileText, Calculator, CheckCircle2 } from "lucide-react"

interface TaxProfile {
  businessName: string
  businessType: string
  entityType: string
  deductions: string[]
}

interface TaxWizardProps {
  onComplete: (profile: TaxProfile) => void
}

export function TaxWizard({ onComplete }: TaxWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [profile, setProfile] = useState<TaxProfile>({
    businessName: "",
    businessType: "gohighlevel-agency",
    entityType: "llc",
    deductions: [],
  })

  // ========================================
  // RANKING SB — Digital Marketing Agency
  // ========================================
  const ghlDeductions = [
    // Line 8 — Advertising
    { id: "advertising", label: "Advertising & Marketing", description: "Line 8 · X Corp ads, Webflow, Google Ads, Facebook Ads — 100% deductible", scheduleCLine: "8" },
    // Line 9 — Car & Truck
    { id: "vehicle", label: "Vehicle & Mileage", description: "Line 9 · $0.70/mile for 2025, gas, parking, tolls — track with MileIQ/Everlance", scheduleCLine: "9" },
    // Line 10 — Commissions & Fees
    { id: "merchant-fees", label: "Merchant & Platform Fees", description: "Line 10 · Stripe fees, PayPal fees, Upwork service fees", scheduleCLine: "10" },
    // Line 11 — Contract Labor
    { id: "contractors", label: "Contract Labor (1099s)", description: "Line 11 · Freelancers, subcontractors — must issue 1099-NEC if $600+", scheduleCLine: "11" },
    // Line 13 — Depreciation
    { id: "equipment", label: "Equipment & Depreciation", description: "Line 13 · Computers, monitors, cameras — Section 179 up to $1.22M", scheduleCLine: "13" },
    // Line 15 — Insurance
    { id: "insurance", label: "Business Insurance", description: "Line 15 · United Financial Casualty, E&O, general liability — NOT health insurance", scheduleCLine: "15" },
    // Line 16b — Interest
    { id: "bank-fees", label: "Interest & Bank Fees", description: "Line 16b · Overdraft fees, monthly service fees, business loan interest", scheduleCLine: "16b" },
    // Line 17 — Legal & Professional
    { id: "professional", label: "Professional Services", description: "Line 17 · Bench Accounting, CoinLedger, CPA fees, legal fees", scheduleCLine: "17" },
    // Line 18 — Office
    { id: "office", label: "Office Supplies & Expenses", description: "Line 18 · UPS Store, shipping, paper, ink, desk supplies", scheduleCLine: "18" },
    // Line 24a — Travel
    { id: "travel", label: "Business Travel", description: "Line 24a · Flights, hotels, Uber/Lyft — conferences, client visits", scheduleCLine: "24a" },
    // Line 24b — Meals
    { id: "meals", label: "Business Meals", description: "Line 24b · Client meals, networking — 50% deductible only", scheduleCLine: "24b" },
    // Line 25 — Utilities
    { id: "utilities", label: "Utilities", description: "Line 25 · SoCal Edison, water — business-use percentage", scheduleCLine: "25" },
    { id: "phone-internet", label: "Phone & Internet", description: "Line 25 · Verizon Wireless, home internet — 60-80% business use typical for agencies", scheduleCLine: "25" },
    // Line 27a — Other
    { id: "software", label: "Software & SaaS Subscriptions", description: "Line 27a · GoHighLevel ($497+$25/mo), Mailgun, OpenAI, Cursor, Loom, Screaming Frog", scheduleCLine: "27a" },
    { id: "education", label: "Education & Training", description: "Line 27a · Codecademy, courses, certifications, books — must be business-related", scheduleCLine: "27a" },
    { id: "waste", label: "Waste & Disposal", description: "Line 27a · Marborg — business-use percentage", scheduleCLine: "27a" },
    // Line 30 — Home Office
    { id: "home-office", label: "Home Office Deduction", description: "Line 30 · Simplified: $5/sq ft up to 300 sq ft ($1,500 max). Must be dedicated space.", scheduleCLine: "30" },
    // Schedule 1 (not Schedule C, but critical)
    { id: "health-insurance", label: "Self-Employed Health Insurance ★", description: "Schedule 1 · 100% of premiums deductible — reduces AGI, not on Schedule C", scheduleCLine: "Sch 1" },
    { id: "sep-ira", label: "SEP-IRA / Solo 401(k) ★", description: "Schedule 1 · Up to 25% of net SE income (max $69,000). Open before filing deadline.", scheduleCLine: "Sch 1" },
    { id: "california-fees", label: "California LLC / Franchise Tax", description: "Line 23 · $800 minimum franchise tax + LLC fee if gross > $250k", scheduleCLine: "23" },
  ]

  // ========================================
  // JANICE — Hair Stylist Business
  // ========================================
  const hairStylistDeductions = [
    // Line 20b — Rent
    { id: "booth-rent", label: "Booth / Chair Rental", description: "Line 20b · Monthly booth rental fee at salon — 100% deductible, usually largest expense", scheduleCLine: "20b" },
    // Line 22 — Supplies
    { id: "hair-products", label: "Hair Products & Color", description: "Line 22 · Shampoo, conditioner, color, treatments, developer — keep ALL receipts", scheduleCLine: "22" },
    { id: "styling-tools", label: "Styling Tools & Equipment", description: "Line 22 · Scissors, flat irons, dryers, curling irons, brushes, combs, clips", scheduleCLine: "22" },
    { id: "disposables", label: "Disposable Supplies", description: "Line 22 · Gloves, foils, capes, neck strips, towels, sanitizer", scheduleCLine: "22" },
    // Line 8 — Advertising
    { id: "marketing", label: "Marketing & Advertising", description: "Line 8 · Instagram/Facebook ads, business cards, Yelp, website", scheduleCLine: "8" },
    // Line 9 — Car & Truck
    { id: "vehicle", label: "Vehicle & Mileage", description: "Line 9 · $0.70/mile — commute to salon, supply runs, house calls", scheduleCLine: "9" },
    // Line 15 — Insurance
    { id: "insurance", label: "Professional Liability Insurance", description: "Line 15 · Stylist/salon insurance, general liability", scheduleCLine: "15" },
    // Line 23 — Taxes & Licenses
    { id: "license-fees", label: "Cosmetology License & Permits", description: "Line 23 · CA Board of Barbering & Cosmetology renewal, city business license", scheduleCLine: "23" },
    // Line 25 — Utilities
    { id: "phone-internet", label: "Phone & Internet", description: "Line 25 · Cell phone (business %), booking confirmations, client texts", scheduleCLine: "25" },
    // Line 27a — Other
    { id: "software-booking", label: "Booking & Payment Software", description: "Line 27a · Square, Vagaro, Schedulicity, GlossGenius — 100% deductible", scheduleCLine: "27a" },
    { id: "education", label: "Continuing Education", description: "Line 27a · Advanced color classes, cutting workshops, cosmetology CE hours", scheduleCLine: "27a" },
    { id: "laundry", label: "Laundry & Cleaning", description: "Line 27a · Towel service, cape cleaning, smock laundering", scheduleCLine: "27a" },
    { id: "clothing", label: "Professional Clothing / Uniforms", description: "Line 27a · Only if required by salon or branded — NOT everyday clothes", scheduleCLine: "27a" },
    // Line 24b — Meals
    { id: "meals", label: "Business Meals", description: "Line 24b · Client consultations over coffee/lunch — 50% deductible, must document purpose", scheduleCLine: "24b" },
    // Line 30 — Home Office
    { id: "home-office", label: "Home Office / Home Studio", description: "Line 30 · If you do ANY work from home (booking, inventory, social media). Simplified: $5/sq ft.", scheduleCLine: "30" },
    // Schedule 1
    { id: "health-insurance", label: "Self-Employed Health Insurance ★", description: "Schedule 1 · 100% of health/dental/vision premiums deductible — huge tax saver", scheduleCLine: "Sch 1" },
    { id: "sep-ira", label: "SEP-IRA / Solo 401(k) ★", description: "Schedule 1 · Save for retirement AND reduce taxes — contribute up to 25% of net income", scheduleCLine: "Sch 1" },
    { id: "california-fees", label: "California Taxes & Fees", description: "Line 23 · State license fees, sales tax on retail products, LLC/business registration", scheduleCLine: "23" },
  ]

  const deductionCategories = profile.businessType === "hair-stylist" ? hairStylistDeductions : ghlDeductions

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete(profile)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const selectAll = () => {
    setProfile((prev) => ({
      ...prev,
      deductions: deductionCategories.map((c) => c.id),
    }))
  }

  const deselectAll = () => {
    setProfile((prev) => ({ ...prev, deductions: [] }))
  }

  const toggleDeduction = (id: string) => {
    setProfile((prev) => ({
      ...prev,
      deductions: prev.deductions.includes(id) ? prev.deductions.filter((d) => d !== id) : [...prev.deductions, id],
    }))
  }

  const steps = [
    { number: 1, title: "Business Info", icon: Building2 },
    { number: 2, title: "Business Structure", icon: FileText },
    { number: 3, title: "Deduction Categories", icon: Calculator },
    { number: 4, title: "Review & Complete", icon: CheckCircle2 },
  ]

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">California Business Tax Setup</h2>
        <p className="text-muted-foreground">
          Configure your accounting system to minimize taxes for your California business
        </p>
      </div>

      <div className="flex justify-between mb-8">
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <div key={step.number} className="flex flex-col items-center flex-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                  currentStep >= step.number ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <span
                className={`text-sm font-medium ${
                  currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.title}
              </span>
            </div>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep - 1].title}</CardTitle>
          <CardDescription>
            Step {currentStep} of {steps.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  placeholder="Your Business Name"
                  value={profile.businessName}
                  onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                />
              </div>
              <div>
                <Label>Business Type</Label>
                <RadioGroup
                  value={profile.businessType}
                  onValueChange={(value) => setProfile({ ...profile, businessType: value, deductions: [] })}
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="gohighlevel-agency" id="ghl" />
                    <Label htmlFor="ghl" className="font-normal cursor-pointer flex-1">
                      <span className="font-medium">GoHighLevel Digital Marketing Agency</span>
                      <p className="text-xs text-muted-foreground">SaaS subscriptions, Stripe/Upwork income, contractor management</p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value="hair-stylist" id="hair-stylist" />
                    <Label htmlFor="hair-stylist" className="font-normal cursor-pointer flex-1">
                      <span className="font-medium">Hair Stylist / Salon Professional</span>
                      <p className="text-xs text-muted-foreground">Booth rental, supplies, cosmetology license, client services</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Entity Type</Label>
                <RadioGroup
                  value={profile.entityType}
                  onValueChange={(value) => setProfile({ ...profile, entityType: value })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="llc" id="llc" />
                    <Label htmlFor="llc" className="font-normal">
                      LLC (Recommended for California)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="s-corp" id="s-corp" />
                    <Label htmlFor="s-corp" className="font-normal">
                      S-Corp (Tax savings if profit over $60k)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sole-prop" id="sole-prop" />
                    <Label htmlFor="sole-prop" className="font-normal">
                      Sole Proprietorship
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="bg-accent p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>California LLC:</strong> $800 annual minimum franchise tax. Consider S-Corp election if your
                  net profit exceeds $60,000 to save on self-employment taxes.
                </p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>
                  Select deduction categories to track
                  {profile.businessType === "hair-stylist" ? " — Hair Stylist" : " — Digital Marketing Agency"}
                </Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>Clear</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ★ = deducted on Schedule 1 (reduces AGI), not Schedule C. Still tracked here for completeness.
                You can always edit categories later after reviewing your transactions.
              </p>
              <div className="space-y-2">
                {deductionCategories.map((category) => (
                  <div key={category.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                    <Checkbox
                      id={category.id}
                      checked={profile.deductions.includes(category.id)}
                      onCheckedChange={() => toggleDeduction(category.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label htmlFor={category.id} className="font-medium cursor-pointer">
                        {category.label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                      {category.scheduleCLine}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="bg-accent p-6 rounded-lg space-y-4">
                <div>
                  <Label className="text-muted-foreground">Business Name</Label>
                  <p className="font-medium">{profile.businessName || "Not set"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Business Type</Label>
                  <p className="font-medium">
                    {profile.businessType === "gohighlevel-agency" && "GoHighLevel Digital Marketing Agency"}
                    {profile.businessType === "hair-stylist" && "Hair Stylist / Salon Professional"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entity Type</Label>
                  <p className="font-medium">
                    {profile.entityType === "llc" && "LLC"}
                    {profile.entityType === "s-corp" && "S-Corp"}
                    {profile.entityType === "sole-prop" && "Sole Proprietorship"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Tracking {profile.deductions.length} of {deductionCategories.length} Deduction Categories
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mt-2">
                    {profile.deductions.map((id) => {
                      const category = deductionCategories.find((c) => c.id === id)
                      return category ? (
                        <div key={id} className="flex items-center gap-2 text-sm">
                          <span className="text-green-500">✓</span>
                          <span>{category.label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{category.scheduleCLine}</span>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              </div>
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
                <p className="text-sm">
                  <strong>Ready to minimize your taxes!</strong> Upload your bank statements next — transactions will be
                  auto-categorized using 80+ rules built for your business. You can manually review and edit every
                  transaction before generating your final tax reports.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
              Back
            </Button>
            <Button onClick={handleNext} disabled={currentStep === 1 && !profile.businessName}>
              {currentStep === 4 ? "Complete Setup" : "Next"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
